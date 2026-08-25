import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassRepository, ParsedClass } from '../database/repositories/class.repository';
import { SubjectRepository, normalizeSubjectCode, normalizeSubjectText } from '../database/repositories/subject.repository';
import { TimetableRepository } from '../database/repositories/timetable.repository';
import { runCommittedTransaction } from '../database/transaction';
import { AFGHANISTAN_CURRICULUM_TEMPLATE, getGradeCategory } from '../curriculum/afghanistanCurriculum';
import { AuditLog } from '../entity/AuditLog';
import { ClassGroup } from '../entity/ClassGroup';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { Room } from '../entity/Room';
import { RoomType } from '../entity/RoomType';
import { SchoolConfig } from '../entity/SchoolConfig';
import { SchoolCurriculumItem } from '../entity/SchoolCurriculumItem';
import { SchoolCurriculumPlan } from '../entity/SchoolCurriculumPlan';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import type { CurriculumPreviewRequest } from '../schemas/schoolCurriculum.schema';
import { buildCanonicalPeriodConfiguration, getEffectivePeriodsForClassDay } from '../utils/periodConfiguration';
import { safeJsonStringify } from '../utils/jsonTransformer';
import { clearDataSourceScopedInstances, getDataSourceScopedInstance } from '../utils/dataSourceScope';
import { RequirementService } from './requirement.service';

export type CurriculumConflictCode =
  | 'PREVIEW_EXPIRED'
  | 'CURRICULUM_REVISION_STALE'
  | 'PREVIEW_CHANGED'
  | 'CONFIRMATION_REQUIRED'
  | 'CURRICULUM_BLOCKED';

export class CurriculumConflictError extends Error {
  constructor(
    readonly code: CurriculumConflictCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'CurriculumConflictError';
  }
}

export interface CurriculumItemDraft {
  id: string;
  name: string;
  nameEn: string | null;
  code: string;
  normalizedCode: string;
  weeklyPeriods: number;
  isDifficult: boolean;
  requiredRoomType: string | null;
}

interface NormalizedGradeDraft {
  grade: number;
  items: CurriculumItemDraft[];
}

interface NormalizedPreviewRequest {
  schoolId: number | null;
  revision: number;
  changedGrades: NormalizedGradeDraft[];
  synchronizeClassIds: number[];
  proposedClasses: CurriculumPreviewRequest['proposedClasses'];
  catalogOnlyChanges: Array<{
    curriculumItemId: string;
    subjectId: number;
    name: string;
    code: string;
    grade: number | null;
    periodsPerWeek: number | null;
  }>;
  linkedSubjectPatches: Array<{
    subjectId?: number;
    curriculumItemId?: string;
    section?: string;
    requiredFeatures?: string[];
    desiredFeatures?: string[];
    minRoomCapacity?: number;
    meta?: Record<string, unknown>;
  }>;
}

export interface CurriculumCapacity {
  grade: number;
  totalPeriods: number;
  weeklyCapacity: number;
  freePeriods: number;
  withinCapacity: boolean;
}

export interface CurriculumPreview {
  revision: number;
  normalizedDrafts: NormalizedGradeDraft[];
  capacities: CurriculumCapacity[];
  subjectActions: Array<{
    action: 'create' | 'link' | 'update' | 'restore' | 'archive';
    curriculumItemId: string;
    subjectId: number | null;
    grade: number;
    name: string;
    code: string;
  }>;
  affectedClasses: Array<{ id: number; name: string; grade: number }>;
  affectedRequirements: Array<{
    classId: number;
    subjectId: number | null;
    curriculumItemId: string;
    action: 'create' | 'update' | 'remove' | 'preserve_override';
    currentPeriods: number | null;
    proposedPeriods: number | null;
  }>;
  proposedClasses: CurriculumPreviewRequest['proposedClasses'];
  assignmentImpacts: Array<{
    classId: number;
    subjectId: number;
    teacherIds: number[];
    assignmentCount: number;
  }>;
  capabilityImpacts: Array<{ subjectId: number; teacherIds: number[]; capabilityCount: number }>;
  warnings: Array<{ code: string; message: string }>;
  blockers: Array<{ code: string; message: string; grade?: number; row?: number }>;
  resultFingerprint: string;
  previewToken: string;
  expiresAt: string;
}

interface StoredPreview {
  request: NormalizedPreviewRequest;
  fingerprint: string;
  expiresAt: number;
}

const PREVIEW_TTL_MS = 10 * 60 * 1000;

function scopeWhere(schoolId: number | null) {
  return schoolId === null ? IsNull() : schoolId;
}

function normalizeCode(value: string): string {
  return normalizeSubjectCode(value).toLocaleLowerCase('fa');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function sectionForGrade(grade: number): string {
  if (grade <= 6) return 'PRIMARY';
  if (grade <= 9) return 'MIDDLE';
  return 'HIGH';
}

function activeGrades(config: { enablePrimary: boolean; enableMiddle: boolean; enableHigh: boolean }): number[] {
  return [
    ...(config.enablePrimary ? [1, 2, 3, 4, 5, 6] : []),
    ...(config.enableMiddle ? [7, 8, 9] : []),
    ...(config.enableHigh ? [10, 11, 12] : []),
  ];
}

export class SchoolCurriculumOrchestrator {
  private readonly cache: CacheManager;
  private readonly subjectRepository: SubjectRepository;
  private readonly classRepository: ClassRepository;
  private readonly requirementService: RequirementService;
  private readonly timetableRepository: TimetableRepository;
  private readonly previews = new Map<string, StoredPreview>();

  private constructor(private readonly dataSource: DataSource, cacheManager?: CacheManager) {
    this.cache = cacheManager ?? CacheManager.getInstance();
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cache);
    this.classRepository = ClassRepository.getInstance(dataSource, this.cache);
    this.requirementService = RequirementService.getInstance(dataSource, this.cache);
    this.timetableRepository = TimetableRepository.getInstance(dataSource, this.cache);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SchoolCurriculumOrchestrator {
    return getDataSourceScopedInstance(
      dataSource,
      SchoolCurriculumOrchestrator,
      () => new SchoolCurriculumOrchestrator(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(SchoolCurriculumOrchestrator);
  }

  async getPlan(schoolId: number | null = null) {
    const manager = this.dataSource.manager;
    const plan = await manager.getRepository(SchoolCurriculumPlan).findOne({
      where: { schoolId: scopeWhere(schoolId) },
    });
    const config = await this.loadSchoolConfig(schoolId, manager);
    const grades = activeGrades(config);
    const items = plan
      ? await manager.getRepository(SchoolCurriculumItem).find({
          where: { planId: plan.id },
          order: { grade: 'ASC', position: 'ASC' },
        })
      : [];
    const classes = await manager.getRepository(ClassGroup).find({
      where: { schoolId: scopeWhere(schoolId), isDeleted: false },
      order: { id: 'ASC' },
    });
    return {
      schoolId,
      revision: plan?.revision ?? 0,
      activeGrades: grades,
      grades: grades.map((grade) => ({
        grade,
        items: items.filter((item) => item.grade === grade).map((item) => this.toDraft(item)),
        capacity: this.capacityForGrade(config, grade, items.filter((item) => item.grade === grade)),
        affectedClassCount: classes.filter((classGroup) => classGroup.grade === grade).length,
      })),
    };
  }

  async getAfghanistanTemplate(schoolId: number | null = null) {
    const config = await this.loadSchoolConfig(schoolId, this.dataSource.manager);
    return {
      activeGrades: activeGrades(config),
      grades: activeGrades(config).map((grade) => ({
        grade,
        items: (AFGHANISTAN_CURRICULUM_TEMPLATE[`grade_${grade}`] ?? []).map((item) => ({
          id: randomUUID(),
          name: item.name,
          nameEn: item.nameEn || null,
          code: item.code,
          normalizedCode: normalizeCode(item.code),
          weeklyPeriods: item.periodsPerWeek,
          isDifficult: Boolean(item.isDifficult),
          requiredRoomType: item.requiredRoomType ?? null,
        })),
      })),
    };
  }

  async preview(raw: CurriculumPreviewRequest): Promise<CurriculumPreview> {
    const request = this.normalizeRequest(raw);
    return this.computePreview(request, true);
  }

  async apply(previewToken: string, confirmAssignmentRemoval: boolean) {
    const stored = this.previews.get(previewToken);
    if (!stored || stored.expiresAt <= Date.now()) {
      this.previews.delete(previewToken);
      throw new CurriculumConflictError('PREVIEW_EXPIRED', 'The curriculum preview has expired.');
    }

    const result = await runCommittedTransaction(this.dataSource, this.cache, async (manager) => {
      const currentPlan = await this.findPlan(stored.request.schoolId, manager);
      if ((currentPlan?.revision ?? 0) !== stored.request.revision) {
        throw new CurriculumConflictError(
          'CURRICULUM_REVISION_STALE',
          'The school curriculum changed after this preview.',
          { expectedRevision: stored.request.revision, actualRevision: currentPlan?.revision ?? 0 }
        );
      }
      const recomputed = await this.computePreview(stored.request, false, manager);
      if (recomputed.resultFingerprint !== stored.fingerprint) {
        throw new CurriculumConflictError(
          'PREVIEW_CHANGED',
          'Classes, requirements, teachers, rooms, or assignments changed after this preview.',
          { preview: recomputed }
        );
      }
      if (recomputed.blockers.length > 0) {
        throw new CurriculumConflictError('CURRICULUM_BLOCKED', 'The curriculum cannot be applied.', {
          preview: recomputed,
        });
      }
      if (
        !confirmAssignmentRemoval &&
        (recomputed.assignmentImpacts.length > 0 || recomputed.capabilityImpacts.length > 0)
      ) {
        throw new CurriculumConflictError(
          'CONFIRMATION_REQUIRED',
          'Teacher assignments or capabilities will be removed.',
          { preview: { ...recomputed, previewToken } }
        );
      }
      return this.applyInTransaction(stored.request, recomputed, manager);
    });
    this.previews.delete(previewToken);
    return result;
  }

  async createFromSubject(input: {
    schoolId?: number | null;
    name: string;
    code?: string;
    grade: number;
    periodsPerWeek: number;
    isDifficult?: boolean;
    requiredRoomType?: string | null;
    section?: string;
    requiredFeatures?: string[];
    desiredFeatures?: string[];
    minRoomCapacity?: number;
    meta?: Record<string, unknown>;
  }) {
    const plan = await this.getPlan(input.schoolId ?? null);
    const grade = plan.grades.find((entry) => entry.grade === input.grade);
    if (!grade) throw new CurriculumConflictError('CURRICULUM_BLOCKED', 'The selected grade is inactive.');
    const itemId = randomUUID();
    const previewRequest = this.normalizeRequest({
      schoolId: input.schoolId ?? null,
      revision: plan.revision,
      changedGrades: [
        {
          grade: input.grade,
          items: [
            ...grade.items,
            {
              id: itemId,
              name: input.name,
              nameEn: null,
              code: input.code?.trim() || input.name,
              weeklyPeriods: input.periodsPerWeek,
              isDifficult: input.isDifficult ?? false,
              requiredRoomType: input.requiredRoomType ?? null,
            },
          ],
        },
      ],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    previewRequest.linkedSubjectPatches.push({
      curriculumItemId: itemId,
      section: input.section,
      requiredFeatures: input.requiredFeatures,
      desiredFeatures: input.desiredFeatures,
      minRoomCapacity: input.minRoomCapacity,
      meta: input.meta,
    });
    const preview = await this.computePreview(previewRequest, true);
    await this.apply(preview.previewToken, false);
    return this.subjectRepository.findByCurriculumItemId(itemId);
  }

  async updateFromSubject(
    subjectId: number,
    input: {
      name?: string;
      code?: string;
      grade?: number | null;
      periodsPerWeek?: number | null;
      isDifficult?: boolean;
      requiredRoomType?: string | null;
      section?: string;
      requiredFeatures?: string[];
      desiredFeatures?: string[];
      minRoomCapacity?: number;
      meta?: Record<string, unknown>;
    }
  ) {
    const subject = await this.subjectRepository.getSubject(subjectId);
    if (!subject?.curriculumItemId || subject.grade === null) return null;
    const plan = await this.getPlan(subject.schoolId);
    const oldGrade = subject.grade;
    const nextGrade = input.grade === undefined ? oldGrade : input.grade;
    const nextPeriods = input.periodsPerWeek === undefined ? subject.periodsPerWeek : input.periodsPerWeek;
    const curriculumChanged = [
      input.name,
      input.code,
      input.grade,
      input.periodsPerWeek,
      input.isDifficult,
      input.requiredRoomType,
    ].some((value) => value !== undefined);
    const changedGrades = curriculumChanged
      ? new Set([oldGrade, ...(nextGrade ? [nextGrade] : [])])
      : new Set<number>();
    const drafts = [...changedGrades].map((grade) => {
      const current = plan.grades.find((entry) => entry.grade === grade)?.items ?? [];
      const without = current.filter((item) => item.id !== subject.curriculumItemId);
      if (grade !== nextGrade || !nextPeriods) return { grade, items: without };
      return {
        grade,
        items: [
          ...without,
          {
            id: subject.curriculumItemId as string,
            name: input.name ?? subject.name,
            nameEn: null,
            code: (input.code ?? subject.code) || input.name || subject.name,
            weeklyPeriods: nextPeriods,
            isDifficult: input.isDifficult ?? subject.isDifficult,
            requiredRoomType:
              input.requiredRoomType === undefined ? subject.requiredRoomType : input.requiredRoomType,
          },
        ],
      };
    });
    const previewRequest = this.normalizeRequest({
      schoolId: subject.schoolId,
      revision: plan.revision,
      changedGrades: drafts,
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    if (curriculumChanged && (!nextGrade || !nextPeriods)) {
      previewRequest.catalogOnlyChanges.push({
        curriculumItemId: subject.curriculumItemId,
        subjectId,
        name: input.name ?? subject.name,
        code: input.code ?? subject.code,
        grade: nextGrade,
        periodsPerWeek: nextPeriods,
      });
    }
    previewRequest.linkedSubjectPatches.push({
      subjectId,
      section: input.section,
      requiredFeatures: input.requiredFeatures,
      desiredFeatures: input.desiredFeatures,
      minRoomCapacity: input.minRoomCapacity,
      meta: input.meta,
    });
    const preview = await this.computePreview(previewRequest, true);
    try {
      await this.apply(preview.previewToken, false);
    } catch (error) {
      if (error instanceof CurriculumConflictError && error.code === 'CONFIRMATION_REQUIRED') {
        throw new CurriculumConflictError(error.code, error.message, { preview });
      }
      throw error;
    }
    return this.subjectRepository.getSubject(subjectId);
  }

  async deleteFromSubject(subjectId: number) {
    const subject = await this.subjectRepository.getSubject(subjectId);
    if (!subject?.curriculumItemId || subject.grade === null) return null;
    const plan = await this.getPlan(subject.schoolId);
    const current = plan.grades.find((entry) => entry.grade === subject.grade)?.items ?? [];
    const preview = await this.preview({
      schoolId: subject.schoolId,
      revision: plan.revision,
      changedGrades: [
        { grade: subject.grade, items: current.filter((item) => item.id !== subject.curriculumItemId) },
      ],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    try {
      await this.apply(preview.previewToken, false);
    } catch (error) {
      if (error instanceof CurriculumConflictError && error.code === 'CONFIRMATION_REQUIRED') {
        throw new CurriculumConflictError(error.code, error.message, { preview });
      }
      throw error;
    }
    return true;
  }

  private normalizeRequest(raw: CurriculumPreviewRequest): NormalizedPreviewRequest {
    return {
      schoolId: raw.schoolId ?? null,
      revision: raw.revision,
      changedGrades: [...raw.changedGrades]
        .sort((left, right) => left.grade - right.grade)
        .map((draft) => ({
          grade: draft.grade,
          items: draft.items.map((item) => ({
            id: item.id ?? randomUUID(),
            name: normalizeSubjectText(item.name),
            nameEn: item.nameEn?.trim() || null,
            code: normalizeSubjectCode(item.code),
            normalizedCode: normalizeCode(item.code),
            weeklyPeriods: item.weeklyPeriods,
            isDifficult: item.isDifficult ?? false,
            requiredRoomType: item.requiredRoomType?.trim().toLowerCase() || null,
          })),
        })),
      synchronizeClassIds: [...new Set(raw.synchronizeClassIds)].sort((a, b) => a - b),
      proposedClasses: [...raw.proposedClasses].map((entry) => ({ ...entry, name: entry.name.trim() })),
      catalogOnlyChanges: [],
      linkedSubjectPatches: [],
    };
  }

  private async computePreview(
    request: NormalizedPreviewRequest,
    issueToken: boolean,
    manager: EntityManager = this.dataSource.manager
  ): Promise<CurriculumPreview> {
    const plan = await this.findPlan(request.schoolId, manager);
    const revision = plan?.revision ?? 0;
    if (revision !== request.revision) {
      throw new CurriculumConflictError(
        'CURRICULUM_REVISION_STALE',
        'The school curriculum revision is stale.',
        { expectedRevision: request.revision, actualRevision: revision }
      );
    }
    const config = await this.loadSchoolConfig(request.schoolId, manager);
    const enabledGrades = new Set(activeGrades(config));
    const existingItems = plan
      ? await manager.getRepository(SchoolCurriculumItem).find({
          where: { planId: plan.id },
          order: { grade: 'ASC', position: 'ASC' },
        })
      : [];
    const proposedItems = this.mergeDrafts(existingItems, request.changedGrades);
    const blockers: CurriculumPreview['blockers'] = [];
    const warnings: CurriculumPreview['warnings'] = [];

    for (const draft of request.changedGrades) {
      if (!enabledGrades.has(draft.grade)) {
        blockers.push({ code: 'INACTIVE_GRADE', grade: draft.grade, message: `Grade ${draft.grade} is not active in School Settings.` });
      }
      const seenCodes = new Map<string, number>();
      const seenIds = new Set<string>();
      draft.items.forEach((item, row) => {
        if (!item.normalizedCode) blockers.push({ code: 'MISSING_CODE', grade: draft.grade, row, message: 'Subject code is required.' });
        if (seenCodes.has(item.normalizedCode)) blockers.push({ code: 'DUPLICATE_CODE', grade: draft.grade, row, message: `Code ${item.code} is duplicated in grade ${draft.grade}.` });
        if (seenIds.has(item.id)) blockers.push({ code: 'DUPLICATE_ITEM_ID', grade: draft.grade, row, message: 'A curriculum item appears more than once.' });
        seenCodes.set(item.normalizedCode, row);
        seenIds.add(item.id);
      });
    }
    const activeRoomTypes = new Set(
      (await manager.getRepository(RoomType).find({ where: { isDeleted: false } })).map(
        (roomType) => roomType.value
      )
    );
    for (const draft of request.changedGrades) {
      draft.items.forEach((item, row) => {
        if (item.requiredRoomType && !activeRoomTypes.has(item.requiredRoomType)) {
          blockers.push({
            code: 'ROOM_TYPE_NOT_FOUND',
            grade: draft.grade,
            row,
            message: `Room type ${item.requiredRoomType} is not active.`,
          });
        }
      });
    }

    const capacities = activeGrades(config).map((grade) =>
      this.capacityForGrade(config, grade, proposedItems.filter((item) => item.grade === grade))
    );
    for (const capacity of capacities.filter((entry) => !entry.withinCapacity)) {
      blockers.push({ code: 'GRADE_CAPACITY_EXCEEDED', grade: capacity.grade, message: `Grade ${capacity.grade} requires ${capacity.totalPeriods} periods but only ${capacity.weeklyCapacity} are available.` });
    }

    const allClasses = await manager.getRepository(ClassGroup).find({
      where: { schoolId: scopeWhere(request.schoolId), isDeleted: false },
      order: { id: 'ASC' },
    });
    const changedGrades = new Set(request.changedGrades.map((draft) => draft.grade));
    const explicitIds = new Set(request.synchronizeClassIds);
    for (const classId of explicitIds) {
      const classGroup = allClasses.find((entry) => entry.id === classId);
      if (!classGroup) blockers.push({ code: 'CLASS_NOT_FOUND', message: `Class ${classId} does not exist in this school.` });
      else if (classGroup.grade === null) blockers.push({ code: 'CLASS_GRADE_REQUIRED', message: `Class ${classGroup.name} has no grade.` });
    }
    const affectedClassEntities = allClasses.filter(
      (entry) => entry.grade !== null && (changedGrades.has(entry.grade) || explicitIds.has(entry.id))
    );
    const affectedClasses = affectedClassEntities.map((entry) => ({ id: entry.id, name: entry.name, grade: entry.grade as number }));

    const allSubjects = await manager.getRepository(Subject).find({
      where: { schoolId: scopeWhere(request.schoolId) },
      order: { id: 'ASC' },
    });
    const itemIds = new Set(proposedItems.map((item) => item.id));
    const subjectByItem = new Map(allSubjects.filter((subject) => subject.curriculumItemId).map((subject) => [subject.curriculumItemId as string, subject]));
    const subjectActions: CurriculumPreview['subjectActions'] = [];
    for (const item of proposedItems.filter((entry) => changedGrades.has(entry.grade))) {
      const linked = subjectByItem.get(item.id);
      const catalog = linked ?? allSubjects.find((subject) => subject.grade === item.grade && normalizeCode(subject.code || subject.name) === item.normalizedCode);
      let action: CurriculumPreview['subjectActions'][number]['action'] = 'create';
      if (catalog) {
        if (catalog.isDeleted) action = 'restore';
        else if (!catalog.curriculumItemId) action = 'link';
        else if (
          catalog.name !== item.name || catalog.code !== item.code || catalog.grade !== item.grade ||
          catalog.periodsPerWeek !== item.weeklyPeriods || catalog.isDifficult !== item.isDifficult ||
          catalog.requiredRoomType !== item.requiredRoomType
        ) action = 'update';
        else continue;
      }
      subjectActions.push({ action, curriculumItemId: item.id, subjectId: catalog?.id ?? null, grade: item.grade, name: item.name, code: item.code });
    }
    for (const oldItem of existingItems.filter((entry) => changedGrades.has(entry.grade) && !itemIds.has(entry.id))) {
      const subject = subjectByItem.get(oldItem.id);
      if (subject) subjectActions.push({
        action: request.catalogOnlyChanges.some((change) => change.curriculumItemId === oldItem.id) ? 'update' : 'archive',
        curriculumItemId: oldItem.id,
        subjectId: subject.id,
        grade: oldItem.grade,
        name: oldItem.name,
        code: oldItem.code,
      });
    }

    const subjectIdByItem = new Map<string, number>();
    for (const item of proposedItems) {
      const subject = subjectByItem.get(item.id) ?? allSubjects.find((entry) => entry.grade === item.grade && !entry.isDeleted && normalizeCode(entry.code || entry.name) === item.normalizedCode);
      if (subject) subjectIdByItem.set(item.id, subject.id);
    }
    const classIds = affectedClassEntities.map((entry) => entry.id);
    const requirements = classIds.length
      ? await manager.getRepository(ClassSubjectRequirement).find({ where: { classId: In(classIds), isDeleted: false }, order: { classId: 'ASC', id: 'ASC' } })
      : [];
    const affectedRequirements: CurriculumPreview['affectedRequirements'] = [];
    const requirementsToRemove: ClassSubjectRequirement[] = [];
    for (const classGroup of affectedClassEntities) {
      const desiredItems = proposedItems.filter((item) => item.grade === classGroup.grade);
      const desiredSubjectIds = new Set(desiredItems.map((item) => subjectIdByItem.get(item.id)).filter((id): id is number => id !== undefined));
      const current = requirements.filter((entry) => entry.classId === classGroup.id);
      for (const item of desiredItems) {
        const subjectId = subjectIdByItem.get(item.id) ?? null;
        const requirement = subjectId === null ? undefined : current.find((entry) => entry.subjectId === subjectId);
        if (!requirement) {
          affectedRequirements.push({ classId: classGroup.id, subjectId, curriculumItemId: item.id, action: 'create', currentPeriods: null, proposedPeriods: item.weeklyPeriods });
        } else if (requirement.periodMode === 'class_override') {
          affectedRequirements.push({ classId: classGroup.id, subjectId, curriculumItemId: item.id, action: 'preserve_override', currentPeriods: requirement.requiredPeriodsPerWeek, proposedPeriods: requirement.requiredPeriodsPerWeek });
        } else if (requirement.requiredPeriodsPerWeek !== item.weeklyPeriods) {
          affectedRequirements.push({ classId: classGroup.id, subjectId, curriculumItemId: item.id, action: 'update', currentPeriods: requirement.requiredPeriodsPerWeek, proposedPeriods: item.weeklyPeriods });
        }
      }
      for (const requirement of current.filter((entry) => !desiredSubjectIds.has(entry.subjectId))) {
        requirementsToRemove.push(requirement);
        const linkedItem = allSubjects.find((subject) => subject.id === requirement.subjectId)?.curriculumItemId ?? `catalog:${requirement.subjectId}`;
        affectedRequirements.push({ classId: classGroup.id, subjectId: requirement.subjectId, curriculumItemId: linkedItem, action: 'remove', currentPeriods: requirement.requiredPeriodsPerWeek, proposedPeriods: null });
      }
    }

    const assignmentImpacts: CurriculumPreview['assignmentImpacts'] = [];
    const allCanonicalAssignments = requirements.length
      ? await manager.getRepository(TeachingAssignment).find({
          where: { classSubjectRequirementId: In(requirements.map((entry) => entry.id)), isDeleted: false },
          order: { id: 'ASC' },
        })
      : [];
    if (requirementsToRemove.length > 0) {
      for (const requirement of requirementsToRemove) {
        const teacherIds = [
          ...allCanonicalAssignments.filter((entry) => entry.classSubjectRequirementId === requirement.id).map((entry) => entry.teacherId),
        ];
        if (teacherIds.length > 0) assignmentImpacts.push({ classId: requirement.classId, subjectId: requirement.subjectId, teacherIds: [...new Set(teacherIds)].sort((a, b) => a - b), assignmentCount: teacherIds.length });
      }
    }

    const archivedSubjectIds = subjectActions.filter((action) => action.action === 'archive' && action.subjectId !== null).map((action) => action.subjectId as number);
    const capabilities = archivedSubjectIds.length
      ? await manager.getRepository(TeacherSubjectCapability).find({ where: { subjectId: In(archivedSubjectIds), isDeleted: false } })
      : [];
    const capabilityImpacts = archivedSubjectIds.flatMap((subjectId) => {
      const rows = capabilities.filter((entry) => entry.subjectId === subjectId);
      return rows.length ? [{ subjectId, teacherIds: [...new Set(rows.map((entry) => entry.teacherId))].sort((a, b) => a - b), capabilityCount: rows.length }] : [];
    });

    await this.validateProposedClasses(request, allClasses, manager, blockers);
    if (request.changedGrades.length === 0 && affectedClasses.length === 0 && request.proposedClasses.length === 0) {
      warnings.push({ code: 'NO_CHANGES', message: 'This preview does not change curriculum or class requirements.' });
    }

    const fingerprintPayload = {
      request,
      revision,
      configRevision: config.revision,
      existingItems: existingItems.map((item) => this.toDraft(item)),
      subjects: allSubjects.map((subject) => ({ id: subject.id, curriculumItemId: subject.curriculumItemId, grade: subject.grade, name: subject.name, code: subject.code, periods: subject.periodsPerWeek, deleted: subject.isDeleted, updatedAt: subject.updatedAt })),
      classes: affectedClassEntities.map((entry) => ({ id: entry.id, grade: entry.grade, updatedAt: entry.updatedAt })),
      requirements: requirements.map((entry) => ({ id: entry.id, classId: entry.classId, subjectId: entry.subjectId, periods: entry.requiredPeriodsPerWeek, mode: entry.periodMode, version: entry.assignmentVersion, updatedAt: entry.updatedAt })),
      assignments: {
        canonical: allCanonicalAssignments.map((entry) => ({ id: entry.id, requirementId: entry.classSubjectRequirementId, teacherId: entry.teacherId, periods: entry.assignedPeriodsPerWeek, fixed: entry.isFixed, source: entry.source, updatedAt: entry.updatedAt })),
      },
      capabilities: capabilityImpacts,
      proposedNames: request.proposedClasses.map((entry) => entry.name),
      result: {
        subjectActions,
        affectedClasses,
        affectedRequirements,
        assignmentImpacts,
        capabilityImpacts,
        warnings,
        blockers,
      },
    };
    const resultFingerprint = fingerprint(fingerprintPayload);
    const expiresAtMs = Date.now() + PREVIEW_TTL_MS;
    const previewToken = issueToken ? randomUUID() : '';
    if (issueToken) this.previews.set(previewToken, { request, fingerprint: resultFingerprint, expiresAt: expiresAtMs });
    return {
      revision,
      normalizedDrafts: request.changedGrades,
      capacities,
      subjectActions,
      affectedClasses,
      affectedRequirements,
      proposedClasses: request.proposedClasses,
      assignmentImpacts,
      capabilityImpacts,
      warnings,
      blockers,
      resultFingerprint,
      previewToken,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  private async applyInTransaction(
    request: NormalizedPreviewRequest,
    preview: CurriculumPreview,
    manager: EntityManager
  ) {
    const planRepository = manager.getRepository(SchoolCurriculumPlan);
    let plan = await this.findPlan(request.schoolId, manager);
    if (!plan) {
      plan = planRepository.create({ schoolId: request.schoolId, revision: 0, createdAt: new Date(), updatedAt: new Date() });
      plan = await planRepository.save(plan);
    }
    const itemRepository = manager.getRepository(SchoolCurriculumItem);
    const existingItems = await itemRepository.find({ where: { planId: plan.id } });
    const changedGrades = new Set(request.changedGrades.map((draft) => draft.grade));
    const desiredItems = this.mergeDrafts(existingItems, request.changedGrades);
    const desiredIds = new Set(desiredItems.map((item) => item.id));
    const removedItems = existingItems.filter((item) => changedGrades.has(item.grade) && !desiredIds.has(item.id));
    for (const removed of removedItems) await itemRepository.delete({ id: removed.id });
    for (const draft of request.changedGrades) {
      for (let position = 0; position < draft.items.length; position += 1) {
        const item = draft.items[position];
        const existing = existingItems.find((entry) => entry.id === item.id);
        await itemRepository.save(itemRepository.create({
          ...(existing ?? {}),
          id: item.id,
          planId: plan.id,
          grade: draft.grade,
          position,
          name: item.name,
          nameEn: item.nameEn,
          code: item.code,
          normalizedCode: item.normalizedCode,
          weeklyPeriods: item.weeklyPeriods,
          isDifficult: item.isDifficult,
          requiredRoomType: item.requiredRoomType,
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        }));
      }
    }

    const subjectRepo = manager.getRepository(Subject);
    const allSubjects = await subjectRepo.find({ where: { schoolId: scopeWhere(request.schoolId) }, order: { id: 'ASC' } });
    const subjectByItem = new Map(allSubjects.filter((subject) => subject.curriculumItemId).map((subject) => [subject.curriculumItemId as string, subject]));
    const subjectIdByItem = new Map<string, number>();
    for (const item of desiredItems) {
      let subject = subjectByItem.get(item.id);
      if (!subject && changedGrades.has(item.grade)) {
        const matches = allSubjects.filter((entry) => entry.grade === item.grade && normalizeCode(entry.code || entry.name) === item.normalizedCode);
        if (matches.length > 1) throw new Error(`Ambiguous subject identity for grade ${item.grade}, code ${item.code}`);
        subject = matches[0];
      }
      if (!subject && changedGrades.has(item.grade)) subject = subjectRepo.create({ schoolId: request.schoolId, createdAt: new Date() });
      if (!subject) continue;
      subject.curriculumItemId = item.id;
      subject.name = item.name;
      subject.code = item.code;
      subject.grade = item.grade;
      subject.periodsPerWeek = item.weeklyPeriods;
      subject.section = sectionForGrade(item.grade);
      subject.isDifficult = item.isDifficult;
      subject.requiredRoomType = item.requiredRoomType;
      subject.isCustom = true;
      subject.customCategory = getGradeCategory(item.grade);
      subject.isDeleted = false;
      subject.deletedAt = null;
      subject.updatedAt = new Date();
      subject = await subjectRepo.save(subject);
      subjectIdByItem.set(item.id, subject.id);
    }
    for (const patch of request.linkedSubjectPatches) {
      const subject = patch.subjectId
        ? await subjectRepo.findOne({ where: { id: patch.subjectId, isDeleted: false } })
        : patch.curriculumItemId
          ? await subjectRepo.findOne({ where: { curriculumItemId: patch.curriculumItemId, isDeleted: false } })
          : null;
      if (!subject) continue;
      if (patch.section !== undefined) subject.section = patch.section;
      if (patch.requiredFeatures !== undefined) subject.requiredFeatures = safeJsonStringify(patch.requiredFeatures, '[]');
      if (patch.desiredFeatures !== undefined) subject.desiredFeatures = safeJsonStringify(patch.desiredFeatures, '[]');
      if (patch.minRoomCapacity !== undefined) subject.minRoomCapacity = patch.minRoomCapacity;
      if (patch.meta !== undefined) subject.meta = safeJsonStringify(patch.meta, '{}');
      subject.updatedAt = new Date();
      await subjectRepo.save(subject);
    }

    const createdClasses: ParsedClass[] = [];
    for (const proposal of request.proposedClasses) {
      const created = await this.classRepository.saveClass(
        {
          ...proposal,
          schoolId: request.schoolId,
          academicYearId: proposal.academicYearId ?? null,
          displayName: proposal.displayName || proposal.name,
          section: proposal.section || sectionForGrade(proposal.grade),
          sectionIndex: proposal.sectionIndex ?? '',
          studentCount: proposal.studentCount ?? 0,
          subjectRequirements: [],
          meta: {},
        },
        { manager, skipCache: true }
      );
      createdClasses.push(created);
    }
    const changedGradeClasses = await manager.getRepository(ClassGroup).find({
      where: request.changedGrades.length
        ? request.changedGrades.map((draft) => ({ schoolId: scopeWhere(request.schoolId), grade: draft.grade, isDeleted: false }))
        : { id: -1 },
      order: { id: 'ASC' },
    });
    const explicitClasses = request.synchronizeClassIds.length
      ? await manager.getRepository(ClassGroup).find({ where: { id: In(request.synchronizeClassIds), schoolId: scopeWhere(request.schoolId), isDeleted: false } })
      : [];
    const classes = [...changedGradeClasses, ...explicitClasses, ...createdClasses].filter(
      (entry, index, rows) => rows.findIndex((candidate) => candidate.id === entry.id) === index
    );
    for (const classGroup of classes) {
      if (classGroup.grade === null) continue;
      const gradeItems = desiredItems.filter((item) => item.grade === classGroup.grade);
      const existing = await manager.getRepository(ClassSubjectRequirement).find({ where: { classId: classGroup.id, isDeleted: false } });
      await this.requirementService.syncClassRequirements(
        classGroup.id,
        gradeItems.map((item) => {
          const subjectId = subjectIdByItem.get(item.id);
          if (!subjectId) throw new Error(`No materialized subject for curriculum item ${item.id}`);
          const requirement = existing.find((entry) => entry.subjectId === subjectId);
          return {
            subjectId,
            periodsPerWeek: requirement?.periodMode === 'class_override' ? requirement.requiredPeriodsPerWeek : item.weeklyPeriods,
            periodMode: requirement?.periodMode === 'class_override' ? 'class_override' as const : 'inherited' as const,
            allowSplitAssignment: requirement?.allowSplitAssignment ?? false,
          };
        }),
        { manager, markTimetableStale: false }
      );
    }

    const removedSubjectIds: number[] = [];
    for (const item of removedItems) {
      const subject = await subjectRepo.findOne({ where: { curriculumItemId: item.id } });
      if (!subject) continue;
      const catalogOnly = request.catalogOnlyChanges.find(
        (change) => change.curriculumItemId === item.id && change.subjectId === subject.id
      );
      subject.curriculumItemId = null;
      if (catalogOnly) {
        subject.name = catalogOnly.name;
        subject.code = catalogOnly.code;
        subject.grade = catalogOnly.grade;
        subject.periodsPerWeek = catalogOnly.periodsPerWeek;
        subject.isDeleted = false;
        subject.deletedAt = null;
      } else {
        subject.isDeleted = true;
        subject.deletedAt = new Date();
      }
      subject.updatedAt = new Date();
      await subjectRepo.save(subject);
      if (!catalogOnly) removedSubjectIds.push(subject.id);
    }
    if (removedSubjectIds.length > 0) {
      const capabilityRepo = manager.getRepository(TeacherSubjectCapability);
      const capabilities = await capabilityRepo.find({ where: { subjectId: In(removedSubjectIds), isDeleted: false } });
      for (const capability of capabilities) {
        capability.isDeleted = true;
        capability.deletedAt = new Date();
        capability.updatedAt = new Date();
      }
      if (capabilities.length > 0) await capabilityRepo.save(capabilities);
    }

    if (request.changedGrades.length > 0) {
      plan.revision += 1;
      plan.updatedAt = new Date();
      await planRepository.save(plan);
    }
    if (
      classes.length > 0 ||
      request.changedGrades.length > 0 ||
      request.linkedSubjectPatches.length > 0
    ) {
      await this.timetableRepository.markStaleForSchool(
        request.schoolId,
        JSON.stringify({ code: 'SCHOOL_CURRICULUM_APPLIED', revision: plan.revision, grades: [...changedGrades], classIds: classes.map((entry) => entry.id) }),
        { manager, skipCache: true }
      );
    }
    await manager.getRepository(AuditLog).save(manager.getRepository(AuditLog).create({
      schoolId: request.schoolId,
      action: request.changedGrades.length > 0 ? 'UPDATE' : 'SYNC',
      entityType: 'SchoolCurriculumPlan',
      entityId: plan.id,
      entityName: 'School Curriculum',
      oldValue: JSON.stringify({ revision: request.revision }),
      newValue: JSON.stringify({ revision: plan.revision, changedGrades: [...changedGrades], synchronizedClassIds: classes.map((entry) => entry.id), fingerprint: preview.resultFingerprint }),
      changedFields: JSON.stringify(request.changedGrades.length > 0 ? ['items', 'revision', 'requirements'] : ['requirements']),
      timestamp: new Date(),
    }));
    return { revision: plan.revision, changedGrades: [...changedGrades], synchronizedClassIds: classes.map((entry) => entry.id), createdClassIds: createdClasses.map((entry) => entry.id) };
  }

  private mergeDrafts(existingItems: SchoolCurriculumItem[], drafts: NormalizedGradeDraft[]): Array<CurriculumItemDraft & { grade: number; position: number }> {
    const changedGrades = new Set(drafts.map((draft) => draft.grade));
    return [
      ...existingItems.filter((item) => !changedGrades.has(item.grade)).map((item) => ({ ...this.toDraft(item), grade: item.grade, position: item.position })),
      ...drafts.flatMap((draft) => draft.items.map((item, position) => ({ ...item, grade: draft.grade, position }))),
    ].sort((left, right) => left.grade - right.grade || left.position - right.position);
  }

  private toDraft(item: SchoolCurriculumItem): CurriculumItemDraft {
    return { id: item.id, name: item.name, nameEn: item.nameEn, code: item.code, normalizedCode: item.normalizedCode, weeklyPeriods: item.weeklyPeriods, isDifficult: item.isDifficult, requiredRoomType: item.requiredRoomType };
  }

  private capacityForGrade(config: SchoolConfig, grade: number, items: Array<{ weeklyPeriods: number }>): CurriculumCapacity {
    const canonical = buildCanonicalPeriodConfiguration({
      ...config,
      daysOfWeek: config.daysOfWeek,
      periodsPerDayMap: config.periodsPerDayMap,
      categoryPeriodsMap: config.categoryPeriodsMap,
    });
    const category = getGradeCategory(grade);
    const weeklyCapacity = config.daysOfWeek.reduce((sum, day) => sum + (getEffectivePeriodsForClassDay(canonical, category, day) ?? 0), 0);
    const totalPeriods = items.reduce((sum, item) => sum + item.weeklyPeriods, 0);
    return { grade, totalPeriods, weeklyCapacity, freePeriods: weeklyCapacity - totalPeriods, withinCapacity: totalPeriods <= weeklyCapacity };
  }

  private findPlan(schoolId: number | null, manager: EntityManager) {
    return manager.getRepository(SchoolCurriculumPlan).findOne({ where: { schoolId: scopeWhere(schoolId) } });
  }

  private async loadSchoolConfig(schoolId: number | null, manager: EntityManager): Promise<SchoolConfig> {
    return (
      (await manager.getRepository(SchoolConfig).findOne({
        where: { schoolId: scopeWhere(schoolId) },
      })) ?? manager.getRepository(SchoolConfig).create({ schoolId })
    );
  }

  private async validateProposedClasses(
    request: NormalizedPreviewRequest,
    existingClasses: ClassGroup[],
    manager: EntityManager,
    blockers: CurriculumPreview['blockers']
  ): Promise<void> {
    const names = new Set(existingClasses.map((entry) => entry.name.trim().toLocaleLowerCase('fa')));
    for (const [row, proposal] of request.proposedClasses.entries()) {
      const key = proposal.name.trim().toLocaleLowerCase('fa');
      if (names.has(key)) blockers.push({ code: 'CLASS_NAME_CONFLICT', row, message: `Class name ${proposal.name} already exists.` });
      names.add(key);
      if (proposal.fixedRoomId || proposal.homeRoomId) {
        const roomIds = [...new Set([proposal.fixedRoomId, proposal.homeRoomId].filter((id): id is number => Boolean(id)))];
        const rooms = await manager.getRepository(Room).find({ where: { id: In(roomIds), isDeleted: false } });
        if (rooms.length !== roomIds.length) blockers.push({ code: 'INVALID_ROOM', row, message: `A selected room for ${proposal.name} is unavailable.` });
      }
      if (proposal.classTeacherId) {
        const teacher = await manager.getRepository(Teacher).findOne({ where: { id: proposal.classTeacherId, isDeleted: false } });
        if (!teacher) blockers.push({ code: 'INVALID_TEACHER', row, message: `The selected teacher for ${proposal.name} is unavailable.` });
      }
    }
  }
}
