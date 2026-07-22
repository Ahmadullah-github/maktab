import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import type { SchoolCurriculumSubjectData } from '../entity/CurriculumConfig';
import { ClassGroup } from '../entity/ClassGroup';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { Subject } from '../entity/Subject';
import { SchoolConfig } from '../entity/SchoolConfig';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { ClassRepository, type ClassInput } from '../database/repositories/class.repository';
import { CurriculumConfigRepository } from '../database/repositories/curriculum.repository';
import { SchoolConfigRepository } from '../database/repositories/schoolConfig.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { getGradeCategory } from '../curriculum';
import { CurriculumMaterializationService } from './curriculumMaterialization.service';
import { RequirementService } from './requirement.service';

export interface CurriculumPlanGrade {
  grade: number;
  revision: number;
  subjects: SchoolCurriculumSubjectData[];
}

export interface CurriculumClassProposal {
  name: string;
  displayName?: string;
  grade: number;
  section?: 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';
  sectionIndex?: string;
  studentCount: number;
  classTeacherId?: number | null;
}

export interface CurriculumPlanInput {
  schoolId?: number | null;
  schoolConfigRevision: number;
  gradeConfigs: CurriculumPlanGrade[];
  classes: CurriculumClassProposal[];
}

function normalizedCode(code: string): string {
  return code.normalize('NFKC').trim().toLocaleLowerCase();
}

function sectionForGrade(grade: number): 'PRIMARY' | 'MIDDLE' | 'HIGH' {
  return grade <= 6 ? 'PRIMARY' : grade <= 9 ? 'MIDDLE' : 'HIGH';
}

function weeklyCapacity(config: SchoolConfig, grade: number): number {
  const category = getGradeCategory(grade);
  const dynamic = config.periodsPerDayMap ?? {};
  const categoryMap = config.categoryPeriodsMap ?? {};
  return config.daysOfWeek.reduce((total, day) => {
    if (config.categoryPeriodsEnabled && category) {
      return total + (categoryMap[category]?.[day] ?? config.defaultPeriodsPerDay);
    }
    if (config.dynamicPeriodsEnabled) {
      return total + (dynamic[day] ?? config.defaultPeriodsPerDay);
    }
    return total + config.defaultPeriodsPerDay;
  }, 0);
}

function tokenFor(input: CurriculumPlanInput, configRevision: number, gradeRevisions: number[]): string {
  return createHash('sha256')
    .update(JSON.stringify({
      input: {
        schoolId: input.schoolId ?? null,
        schoolConfigRevision: input.schoolConfigRevision,
        gradeConfigs: input.gradeConfigs,
        classes: input.classes,
      },
      configRevision,
      gradeRevisions,
    }))
    .digest('hex');
}

export class CurriculumPlanError extends Error {
  constructor(message: string, readonly statusCode = 409, readonly code = 'CURRICULUM_PLAN_INVALID') {
    super(message);
  }
}

export class CurriculumPlanService {
  private readonly cache = CacheManager.getInstance();
  private readonly curricula: CurriculumConfigRepository;
  private readonly schoolConfigs: SchoolConfigRepository;
  private readonly classes: ClassRepository;
  private readonly requirements: RequirementService;
  private readonly materializer: CurriculumMaterializationService;

  constructor(private readonly dataSource: DataSource) {
    this.curricula = CurriculumConfigRepository.getInstance(dataSource, this.cache);
    this.schoolConfigs = SchoolConfigRepository.getInstance(dataSource, this.cache);
    this.classes = ClassRepository.getInstance(dataSource, this.cache);
    this.requirements = RequirementService.getInstance(dataSource, this.cache);
    this.materializer = CurriculumMaterializationService.getInstance(dataSource, this.cache);
  }

  async preview(input: CurriculumPlanInput, manager?: EntityManager) {
    const schoolId = input.schoolId ?? null;
    const config = await this.schoolConfigs.getOrCreate(schoolId, manager ? { manager, skipCache: true } : undefined);
    if (config.revision !== input.schoolConfigRevision) {
      throw new CurriculumPlanError('School Settings or Period Structure changed; reload the curriculum page', 409, 'SCHOOL_CONFIG_STALE');
    }

    const currentByGrade = new Map<number, Awaited<ReturnType<CurriculumConfigRepository['getForGrade']>>>();
    for (const gradeConfig of input.gradeConfigs) {
      const current = await this.curricula.getForGrade(gradeConfig.grade, schoolId, manager);
      const actualRevision = current?.revision ?? 0;
      if (actualRevision !== gradeConfig.revision) {
        throw new CurriculumPlanError(`Grade ${gradeConfig.grade} curriculum changed; reload before applying`, 409, 'CURRICULUM_STALE');
      }
      currentByGrade.set(gradeConfig.grade, current);
    }

    const duplicateClassNames = input.classes.filter((proposal, index) =>
      input.classes.findIndex((candidate) => candidate.name.trim().toLocaleLowerCase() === proposal.name.trim().toLocaleLowerCase()) !== index
    );
    if (duplicateClassNames.length) throw new CurriculumPlanError('Class proposals contain duplicate names', 400);

    const existingClasses = await (manager?.getRepository(ClassGroup) ?? this.dataSource.getRepository(ClassGroup)).find({
      where: { isDeleted: false },
    });
    const scopedClasses = existingClasses.filter((entry) => entry.schoolId === schoolId);
    const existingNames = new Set(scopedClasses.map((entry) => entry.name.trim().toLocaleLowerCase()));
    const conflicts = input.classes.filter((entry) => existingNames.has(entry.name.trim().toLocaleLowerCase()));
    if (conflicts.length) throw new CurriculumPlanError(`Class already exists: ${conflicts[0].name}`, 409, 'CLASS_NAME_CONFLICT');

    const subjectRepo = manager?.getRepository(Subject) ?? this.dataSource.getRepository(Subject);
    const allSubjects = (await subjectRepo.find({ where: { isDeleted: false } })).filter((subject) => subject.schoolId === schoolId);
    const gradeResults = [];
    const removedSubjectIds: number[] = [];

    for (const requested of input.gradeConfigs) {
      const currentSubjects = currentByGrade.get(requested.grade)?.subjects ?? [];
      const beforeByItem = new Map(currentSubjects.map((subject) => [subject.itemId, subject]));
      const afterByItem = new Map(requested.subjects.map((subject) => [subject.itemId, subject]));
      const added = requested.subjects.filter((subject) => !beforeByItem.has(subject.itemId));
      const removed = currentSubjects.filter((subject) => !afterByItem.has(subject.itemId));
      const updated = requested.subjects.filter((subject) => {
        const before = beforeByItem.get(subject.itemId);
        return before && JSON.stringify(before) !== JSON.stringify(subject);
      });
      for (const subject of allSubjects.filter((candidate) => candidate.grade === requested.grade)) {
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(subject.meta || '{}'); } catch { /* ignore malformed legacy metadata */ }
        if (removed.some((entry) => entry.itemId === meta.curriculumItemId || normalizedCode(entry.code) === normalizedCode(subject.code ?? ''))) {
          removedSubjectIds.push(subject.id);
        }
      }
      const demand = requested.subjects.reduce((sum, subject) => sum + subject.periodsPerWeek, 0);
      const capacity = weeklyCapacity(config, requested.grade);
      gradeResults.push({
        grade: requested.grade,
        demand,
        capacity,
        remaining: capacity - demand,
        blocker: demand > capacity,
        subjects: { added, updated, removed },
        existingClasses: scopedClasses.filter((entry) => entry.grade === requested.grade).length,
      });
    }

    const requirementRepo = manager?.getRepository(ClassSubjectRequirement) ?? this.dataSource.getRepository(ClassSubjectRequirement);
    const assignmentRepo = manager?.getRepository(TeachingAssignment) ?? this.dataSource.getRepository(TeachingAssignment);
    const scopedClassIds = new Set(scopedClasses.map((entry) => entry.id));
    const removedSubjectIdSet = new Set(removedSubjectIds);
    const removedRequirements = removedSubjectIds.length === 0
      ? []
      : (await requirementRepo.find({ where: { isDeleted: false } })).filter(
          (requirement) => scopedClassIds.has(requirement.classId) && removedSubjectIdSet.has(requirement.subjectId)
        );
    const removedRequirementById = new Map(removedRequirements.map((requirement) => [requirement.id, requirement]));
    const assignmentRows = removedRequirements.length === 0
      ? []
      : (await assignmentRepo.find({ where: { isDeleted: false } }))
          .filter((assignment) => removedRequirementById.has(assignment.classSubjectRequirementId))
          .map((assignment) => {
            const requirement = removedRequirementById.get(assignment.classSubjectRequirementId)!;
            return {
              id: assignment.id,
              teacherId: assignment.teacherId,
              classId: requirement.classId,
              subjectId: requirement.subjectId,
            };
          });
    const blockers = gradeResults.filter((grade) => grade.blocker).map((grade) => `Grade ${grade.grade} needs ${grade.demand} periods but only ${grade.capacity} are available`);
    const gradeRevisions = input.gradeConfigs.map((grade) => currentByGrade.get(grade.grade)?.revision ?? 0);
    return {
      previewToken: tokenFor(input, config.revision, gradeRevisions),
      changedGrades: gradeResults,
      classes: { create: input.classes, totalExistingAffected: gradeResults.reduce((sum, grade) => sum + grade.existingClasses, 0) },
      assignmentRemovals: assignmentRows,
      warnings: gradeResults.filter((grade) => grade.remaining > 0).map((grade) => `Grade ${grade.grade} has ${grade.remaining} free weekly periods`),
      blockers,
      canApply: blockers.length === 0,
    };
  }

  async apply(input: CurriculumPlanInput & { previewToken: string; confirmAssignmentRemoval: boolean }) {
    return runCommittedTransaction(this.dataSource, this.cache, async (manager) => {
      const preview = await this.preview(input, manager);
      if (preview.previewToken !== input.previewToken) throw new CurriculumPlanError('Preview is stale; review the latest changes before applying', 409, 'PREVIEW_STALE');
      if (!preview.canApply) throw new CurriculumPlanError(preview.blockers.join('; '), 409, 'CAPACITY_EXCEEDED');
      if (preview.assignmentRemovals.length > 0 && !input.confirmAssignmentRemoval) {
        throw new CurriculumPlanError('Teacher assignments will be removed; explicit confirmation is required', 409, 'ASSIGNMENT_REMOVAL_CONFIRMATION_REQUIRED');
      }

      const schoolId = input.schoolId ?? null;
      await this.curricula.bulkSave(input.gradeConfigs, schoolId, manager);
      const grades = input.gradeConfigs.map((grade) => grade.grade);
      const materialized = await this.materializer.materializeGrades(grades, schoolId, { manager });

      const subjectsByGrade = new Map<number, typeof materialized.subjects>();
      for (const grade of grades) subjectsByGrade.set(grade, materialized.subjects.filter((subject) => subject.grade === grade));
      const createdClasses = [];
      for (const proposal of input.classes) {
        const classInput: ClassInput = {
          ...proposal,
          schoolId,
          section: proposal.section || sectionForGrade(proposal.grade),
          singleTeacherMode: proposal.grade <= 3,
        };
        const created = await this.classes.saveClass(classInput, { manager, skipCache: true });
        await this.requirements.syncClassRequirements(
          created.id,
          (subjectsByGrade.get(proposal.grade) ?? []).map((subject) => ({
            subjectId: subject.id,
            periodsPerWeek: subject.periodsPerWeek!,
            periodMode: 'inherited',
          })),
          { manager }
        );
        createdClasses.push(created);
      }
      return { ...preview, materialized, createdClasses };
    });
  }
}
