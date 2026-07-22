import { DataSource, EntityManager } from 'typeorm';
import { getGradeCategory, type SubjectDefinition } from '../curriculum';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassRepository } from '../database/repositories/class.repository';
import { CurriculumConfigRepository } from '../database/repositories/curriculum.repository';
import {
  normalizeSubjectCode,
  SubjectRepository,
  type ParsedSubject,
  type SubjectInput,
} from '../database/repositories/subject.repository';
import { runCommittedTransaction } from '../database/transaction';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { RequirementService } from './requirement.service';
import { SubjectReferenceCleanupService } from './subjectReferenceCleanup.service';
import { TimetableRepository } from '../database/repositories/timetable.repository';

export interface CurriculumMaterializationResult {
  grades: number[];
  createdOrUpdatedSubjects: number;
  removedSubjects: number;
  synchronizedClasses: number;
  subjects: ParsedSubject[];
}

export interface GradeSubjectPeriodUpdateResult {
  subject: ParsedSubject;
  materialization: CurriculumMaterializationResult;
}

function sectionForGrade(grade: number): 'PRIMARY' | 'MIDDLE' | 'HIGH' {
  if (grade <= 6) return 'PRIMARY';
  if (grade <= 9) return 'MIDDLE';
  return 'HIGH';
}

function toSubjectInput(
  definition: SubjectDefinition,
  grade: number,
  schoolId: number | null
): SubjectInput {
  const specializedLabBySubject: Record<string, string> = {
    physics: 'physics_lab',
    chemistry: 'chemistry_lab',
    biology: 'biology_lab',
  };
  const roomType =
    definition.requiredRoomType === 'lab'
      ? specializedLabBySubject[definition.nameEn.trim().toLowerCase()] ?? 'lab'
      : definition.requiredRoomType ?? 'normal';
  return {
    schoolId,
    grade,
    name: definition.name,
    code: definition.code,
    periodsPerWeek: definition.periodsPerWeek,
    section: sectionForGrade(grade),
    requiredRoomType: roomType,
    isDifficult: definition.isDifficult ?? false,
    isCustom: definition.isCustom ?? false,
    customCategory: definition.isCustom ? getGradeCategory(grade) : null,
    meta: {
      curriculumManaged: true,
      curriculumItemId: definition.curriculumItemId,
      curriculumCode: definition.code,
      curriculumSource: 'school',
      nameEn: definition.nameEn,
      isCore: definition.isCore ?? false,
    },
  };
}

function isCurriculumManaged(subject: ParsedSubject): boolean {
  return subject.meta.curriculumManaged === true;
}

export class CurriculumMaterializationService {
  private readonly cacheManager: CacheManager;
  private readonly curriculumRepository: CurriculumConfigRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly classRepository: ClassRepository;
  private readonly requirementService: RequirementService;
  private readonly cleanupService: SubjectReferenceCleanupService;
  private readonly timetableRepository: TimetableRepository;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.curriculumRepository = CurriculumConfigRepository.getInstance(
      dataSource,
      this.cacheManager
    );
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cacheManager);
    this.classRepository = ClassRepository.getInstance(dataSource, this.cacheManager);
    this.requirementService = RequirementService.getInstance(dataSource, this.cacheManager);
    this.cleanupService = SubjectReferenceCleanupService.getInstance(
      dataSource,
      this.cacheManager
    );
    this.timetableRepository = TimetableRepository.getInstance(dataSource, this.cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): CurriculumMaterializationService {
    return getDataSourceScopedInstance(
      dataSource,
      CurriculumMaterializationService,
      () => new CurriculumMaterializationService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(CurriculumMaterializationService);
  }

  async materializeGrades(
    grades: number[],
    schoolId: number | null = null,
    options?: { manager?: EntityManager }
  ): Promise<CurriculumMaterializationResult> {
    const uniqueGrades = [...new Set(grades)].sort((a, b) => a - b);
    if (
      uniqueGrades.length === 0 ||
      uniqueGrades.some((grade) => !Number.isInteger(grade) || grade < 1 || grade > 12)
    ) {
      throw new Error('Curriculum grades must contain integers from 1 to 12');
    }

    const definitionsByGrade = new Map<number, SubjectDefinition[]>();
    for (const grade of uniqueGrades) {
      const definitions = (await this.curriculumRepository.getEffectiveSubjectsForGrade(
        grade,
        schoolId,
        options?.manager
      )) as SubjectDefinition[];
      if (definitions.some((definition) => definition.periodsPerWeek < 1)) {
        throw new Error(`Grade ${grade} contains a subject without positive periodsPerWeek`);
      }
      definitionsByGrade.set(grade, definitions);
    }

    if (options?.manager) {
      return this.materializeInsideTransaction(
        uniqueGrades,
        schoolId,
        definitionsByGrade,
        options.manager
      );
    }
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) =>
      this.materializeInsideTransaction(uniqueGrades, schoolId, definitionsByGrade, manager)
    );
  }

  async updateGradeSubjectPeriods(
    grade: number,
    subjectId: number,
    periodsPerWeek: number,
    schoolId: number | null = null
  ): Promise<GradeSubjectPeriodUpdateResult> {
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      throw new Error('Grade must be an integer from 1 to 12');
    }
    if (!Number.isInteger(periodsPerWeek) || periodsPerWeek < 1 || periodsPerWeek > 84) {
      throw new Error('periodsPerWeek must be an integer from 1 to 84');
    }

    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const subject = await this.subjectRepository.getSubject(subjectId, {
        manager,
        skipCache: true,
      });
      if (
        !subject ||
        subject.isDeleted ||
        subject.grade !== grade ||
        subject.schoolId !== schoolId
      ) {
        throw new Error(`Subject ${subjectId} is not active for grade ${grade}`);
      }

      if (isCurriculumManaged(subject)) {
        const itemId = typeof subject.meta.curriculumItemId === 'string' ? subject.meta.curriculumItemId : null;
        const config = await this.curriculumRepository.getForGrade(grade, schoolId, manager);
        const subjects = (config?.subjects ?? []).map((entry) =>
          entry.itemId === itemId || (!itemId && entry.code === subject.code)
            ? { ...entry, periodsPerWeek }
            : entry
        );
        await this.curriculumRepository.saveForGrade(
          grade,
          { subjects },
          schoolId,
          manager,
          config?.revision ?? 0
        );
      } else {
        await this.subjectRepository.updateSubject(
          subjectId,
          { periodsPerWeek },
          { manager, skipCache: true }
        );
      }

      const materialization = await this.materializeGrades([grade], schoolId, { manager });
      const updated = await this.subjectRepository.getSubject(subjectId, {
        manager,
        skipCache: true,
      });
      if (!updated) throw new Error(`Subject ${subjectId} disappeared during synchronization`);

      return { subject: updated, materialization };
    });
  }

  private async materializeInsideTransaction(
    grades: number[],
    schoolId: number | null,
    definitionsByGrade: Map<number, SubjectDefinition[]>,
    manager: EntityManager
  ): Promise<CurriculumMaterializationResult> {
    const materialized: ParsedSubject[] = [];
    const applicableSubjects: ParsedSubject[] = [];
    let removedSubjects = 0;
    let synchronizedClasses = 0;

    for (const grade of grades) {
      const existing = (await this.subjectRepository.findByGrade(grade, {
        manager,
        skipCache: true,
      })).filter((subject) => subject.schoolId === schoolId);
      const definitions = definitionsByGrade.get(grade) ?? [];
      const imported = await this.subjectRepository.bulkUpsert(
        definitions.map((definition) => toSubjectInput(definition, grade, schoolId)),
        { manager, skipCache: true }
      );
      materialized.push(...imported);

      const effectiveItemIds = new Set(definitions.map((definition) => definition.curriculumItemId).filter(Boolean));
      const effectiveCodes = new Set(imported.map((subject) => normalizeSubjectCode(subject.code)));
      const staleManaged = existing.filter(
        (subject) =>
          isCurriculumManaged(subject) &&
          !(typeof subject.meta.curriculumItemId === 'string'
            ? effectiveItemIds.has(subject.meta.curriculumItemId)
            : effectiveCodes.has(normalizeSubjectCode(subject.code)))
      );
      const managedSubjectIds = new Set([
        ...existing.filter(isCurriculumManaged).map((subject) => subject.id),
        ...imported.map((subject) => subject.id),
      ]);
      const staleIds = new Set(staleManaged.map((subject) => subject.id));
      applicableSubjects.push(...imported);

      const classes = (await this.classRepository.findByGrade(grade, {
        manager,
        skipCache: true,
      })).filter((classGroup) => classGroup.schoolId === schoolId && !classGroup.isDeleted);

      for (const classGroup of classes) {
        const existingRequirements = await this.requirementService.getRequirementsByClass(
          classGroup.id,
          { manager }
        );
        const manualRequirements = existingRequirements.filter(
          (requirement) =>
            !managedSubjectIds.has(requirement.subjectId) && !staleIds.has(requirement.subjectId)
        ).map((requirement) => ({
          subjectId: requirement.subjectId,
          periodsPerWeek: requirement.requiredPeriodsPerWeek,
          periodMode: requirement.periodMode,
        }));
        const requirementsBySubjectId = new Map(
          manualRequirements.map((requirement) => [requirement.subjectId, requirement])
        );

        const existingBySubjectId = new Map(
          existingRequirements.map((requirement) => [requirement.subjectId, requirement])
        );

        // Curriculum values are authoritative only for inherited rows. Explicit class
        // exceptions survive curriculum re-syncs and grade-default changes.
        for (const subject of imported) {
          const current = existingBySubjectId.get(subject.id);
          requirementsBySubjectId.set(
            subject.id,
            current?.periodMode === 'class_override'
              ? {
                  subjectId: subject.id,
                  periodsPerWeek: current.requiredPeriodsPerWeek,
                  periodMode: 'class_override',
                }
              : {
                  subjectId: subject.id,
                  periodsPerWeek: subject.periodsPerWeek!,
                  periodMode: 'inherited',
                }
          );
        }

        await this.requirementService.syncClassRequirements(
          classGroup.id,
          [...requirementsBySubjectId.values()],
          { manager }
        );
        synchronizedClasses += 1;
      }

      if (staleManaged.length > 0) {
        const staleSubjectIds = staleManaged.map((subject) => subject.id);
        removedSubjects += await this.subjectRepository.bulkDeleteSubjects(staleSubjectIds, {
          manager,
          skipCache: true,
        });
        await this.cleanupService.cleanupDeletedSubjectReferences(staleSubjectIds, manager);
      }
    }

    await this.timetableRepository.markStaleForSchool(
      schoolId,
      `Curriculum subjects were synchronized for grades ${grades.join(', ')}`,
      { manager, skipCache: true }
    );

    return {
      grades,
      createdOrUpdatedSubjects: materialized.length,
      removedSubjects,
      synchronizedClasses,
      subjects: applicableSubjects,
    };
  }
}
