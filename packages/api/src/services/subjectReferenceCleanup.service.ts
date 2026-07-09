import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import {
  ClassRepository,
  type SubjectRequirement,
} from '../database/repositories/class.repository';
import { SubjectRepository } from '../database/repositories/subject.repository';
import {
  TeacherClassSubjectAssignmentRepository,
} from '../database/repositories/teacherClassSubjectAssignment.repository';
import {
  TeacherRepository,
  type ParsedTeacher,
  type TeacherInput,
} from '../database/repositories/teacher.repository';
import { logger } from '../utils/logger';

interface TeacherClassAssignment {
  subjectId: string;
  classIds: string[];
}

export interface SubjectReferenceCleanupResult {
  targetSubjectIds: number[];
  updatedClasses: number;
  removedClassRequirements: number;
  updatedTeachers: number;
  removedPrimarySubjectRefs: number;
  removedAllowedSubjectRefs: number;
  removedTeacherClassAssignments: number;
  deletedTeacherAssignments: number;
}

function uniquePositiveIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeTeacherClassAssignments(
  assignments: ParsedTeacher['classAssignments']
): TeacherClassAssignment[] {
  return assignments
    .map((assignment) => {
      const subjectId = toPositiveNumber(assignment.subjectId);
      return {
        subjectId: subjectId ? String(subjectId) : '',
        classIds: Array.isArray(assignment.classIds)
          ? assignment.classIds
              .map((classId) => toPositiveNumber(classId))
              .filter((classId): classId is number => classId !== null)
              .map(String)
          : [],
      };
    })
    .filter((assignment) => assignment.subjectId !== '');
}

export class SubjectReferenceCleanupService {
  private static instance: SubjectReferenceCleanupService | null = null;

  private readonly classRepository: ClassRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly teacherRepository: TeacherRepository;
  private readonly teacherAssignmentRepository: TeacherClassSubjectAssignmentRepository;
  private readonly cacheManager: CacheManager;
  private readonly dataSource: DataSource;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.classRepository = ClassRepository.getInstance(dataSource, this.cacheManager);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cacheManager);
    this.teacherRepository = TeacherRepository.getInstance(dataSource, this.cacheManager);
    this.teacherAssignmentRepository = TeacherClassSubjectAssignmentRepository.getInstance(
      dataSource,
      this.cacheManager
    );
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): SubjectReferenceCleanupService {
    if (!SubjectReferenceCleanupService.instance) {
      SubjectReferenceCleanupService.instance = new SubjectReferenceCleanupService(
        dataSource,
        cacheManager
      );
    }
    return SubjectReferenceCleanupService.instance;
  }

  static resetInstance(): void {
    SubjectReferenceCleanupService.instance = null;
  }

  async cleanupDeletedSubjectReferences(
    subjectIds?: number[],
    manager?: EntityManager
  ): Promise<SubjectReferenceCleanupResult> {
    const operation = async (transactionManager: EntityManager) => {
      return this.cleanupDeletedSubjectReferencesInternal(subjectIds, transactionManager);
    };

    const result = manager
      ? await operation(manager)
      : await this.dataSource.transaction(operation);

    const hasChanges =
      result.updatedClasses > 0 ||
      result.updatedTeachers > 0 ||
      result.deletedTeacherAssignments > 0;

    if (hasChanges) {
      this.cacheManager.clear();
      logger.info('Cleaned deleted subject references', {
        targetSubjectIds: result.targetSubjectIds,
        updatedClasses: result.updatedClasses,
        removedClassRequirements: result.removedClassRequirements,
        updatedTeachers: result.updatedTeachers,
        removedPrimarySubjectRefs: result.removedPrimarySubjectRefs,
        removedAllowedSubjectRefs: result.removedAllowedSubjectRefs,
        removedTeacherClassAssignments: result.removedTeacherClassAssignments,
        deletedTeacherAssignments: result.deletedTeacherAssignments,
      });
    }

    return result;
  }

  private async cleanupDeletedSubjectReferencesInternal(
    subjectIds: number[] | undefined,
    manager: EntityManager
  ): Promise<SubjectReferenceCleanupResult> {
    const classes = await this.classRepository.getAllClassesUnpaginated({
      manager,
      skipCache: true,
    });
    const teachers = await this.teacherRepository.getAllTeachersUnpaginated({
      manager,
      skipCache: true,
    });
    const assignments = await this.teacherAssignmentRepository.getAllAssignments({
      manager,
      skipCache: true,
    });

    const targetSubjectIds = await this.resolveSubjectIdsToCleanup(
      subjectIds,
      classes,
      teachers,
      assignments,
      manager
    );

    if (targetSubjectIds.length === 0) {
      return {
        targetSubjectIds: [],
        updatedClasses: 0,
        removedClassRequirements: 0,
        updatedTeachers: 0,
        removedPrimarySubjectRefs: 0,
        removedAllowedSubjectRefs: 0,
        removedTeacherClassAssignments: 0,
        deletedTeacherAssignments: 0,
      };
    }

    const targetSubjectIdSet = new Set(targetSubjectIds);

    let updatedClasses = 0;
    let removedClassRequirements = 0;
    for (const classGroup of classes) {
      const currentRequirements = Array.isArray(classGroup.subjectRequirements)
        ? classGroup.subjectRequirements
        : [];
      const filteredRequirements = currentRequirements.filter(
        (requirement: SubjectRequirement) => !targetSubjectIdSet.has(requirement.subjectId)
      );

      if (filteredRequirements.length !== currentRequirements.length) {
        removedClassRequirements += currentRequirements.length - filteredRequirements.length;
        updatedClasses += 1;
        await this.classRepository.updateClass(
          classGroup.id,
          { subjectRequirements: filteredRequirements },
          { manager, skipCache: true }
        );
      }
    }

    let updatedTeachers = 0;
    let removedPrimarySubjectRefs = 0;
    let removedAllowedSubjectRefs = 0;
    let removedTeacherClassAssignments = 0;

    for (const teacher of teachers) {
      const currentPrimarySubjectIds = Array.isArray(teacher.primarySubjectIds)
        ? teacher.primarySubjectIds
        : [];
      const currentAllowedSubjectIds = Array.isArray(teacher.allowedSubjectIds)
        ? teacher.allowedSubjectIds
        : [];
      const currentClassAssignments = normalizeTeacherClassAssignments(teacher.classAssignments);

      const filteredPrimarySubjectIds = currentPrimarySubjectIds.filter(
        (subjectId) => !targetSubjectIdSet.has(subjectId)
      );
      const filteredAllowedSubjectIds = currentAllowedSubjectIds.filter(
        (subjectId) => !targetSubjectIdSet.has(subjectId)
      );
      const filteredClassAssignments = currentClassAssignments.filter(
        (assignment) => !targetSubjectIdSet.has(Number.parseInt(assignment.subjectId, 10))
      );

      const teacherChanged =
        filteredPrimarySubjectIds.length !== currentPrimarySubjectIds.length ||
        filteredAllowedSubjectIds.length !== currentAllowedSubjectIds.length ||
        filteredClassAssignments.length !== currentClassAssignments.length;

      if (!teacherChanged) {
        continue;
      }

      removedPrimarySubjectRefs += currentPrimarySubjectIds.length - filteredPrimarySubjectIds.length;
      removedAllowedSubjectRefs += currentAllowedSubjectIds.length - filteredAllowedSubjectIds.length;
      removedTeacherClassAssignments +=
        currentClassAssignments.length - filteredClassAssignments.length;
      updatedTeachers += 1;

      const updatePayload: Partial<TeacherInput> = {
        primarySubjectIds: filteredPrimarySubjectIds,
        allowedSubjectIds: filteredAllowedSubjectIds,
        classAssignments: filteredClassAssignments,
      };

      await this.teacherRepository.updateTeacher(teacher.id, updatePayload, {
        manager,
        skipCache: true,
      });
    }

    const deletedTeacherAssignments = await this.teacherAssignmentRepository.deleteBySubjectIds(
      targetSubjectIds,
      {
        manager,
        skipCache: true,
      }
    );

    return {
      targetSubjectIds,
      updatedClasses,
      removedClassRequirements,
      updatedTeachers,
      removedPrimarySubjectRefs,
      removedAllowedSubjectRefs,
      removedTeacherClassAssignments,
      deletedTeacherAssignments,
    };
  }

  private async resolveSubjectIdsToCleanup(
    subjectIds: number[] | undefined,
    classes: Awaited<ReturnType<ClassRepository['getAllClassesUnpaginated']>>,
    teachers: Awaited<ReturnType<TeacherRepository['getAllTeachersUnpaginated']>>,
    assignments: Awaited<ReturnType<TeacherClassSubjectAssignmentRepository['getAllAssignments']>>,
    manager: EntityManager
  ): Promise<number[]> {
    const explicitIds = uniquePositiveIds(subjectIds ?? []);
    if (explicitIds.length > 0) {
      return explicitIds;
    }

    const subjects = await this.subjectRepository.getAllSubjectsUnpaginated({
      manager,
      skipCache: true,
    });
    const activeSubjectIds = new Set(subjects.map((subject) => subject.id));
    const orphanedSubjectIds = new Set<number>();

    for (const classGroup of classes) {
      for (const requirement of classGroup.subjectRequirements) {
        if (!activeSubjectIds.has(requirement.subjectId)) {
          orphanedSubjectIds.add(requirement.subjectId);
        }
      }
    }

    for (const teacher of teachers) {
      for (const subjectId of teacher.primarySubjectIds) {
        if (!activeSubjectIds.has(subjectId)) {
          orphanedSubjectIds.add(subjectId);
        }
      }

      for (const subjectId of teacher.allowedSubjectIds) {
        if (!activeSubjectIds.has(subjectId)) {
          orphanedSubjectIds.add(subjectId);
        }
      }

      for (const assignment of normalizeTeacherClassAssignments(teacher.classAssignments)) {
        const subjectId = Number.parseInt(assignment.subjectId, 10);
        if (!activeSubjectIds.has(subjectId)) {
          orphanedSubjectIds.add(subjectId);
        }
      }
    }

    for (const assignment of assignments) {
      if (!activeSubjectIds.has(assignment.subjectId)) {
        orphanedSubjectIds.add(assignment.subjectId);
      }
    }

    return [...orphanedSubjectIds];
  }
}

export default SubjectReferenceCleanupService;
