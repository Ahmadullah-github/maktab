import { DataSource, EntityManager, In } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { Subject } from '../entity/Subject';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';

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
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
}

/** Removes references exclusively from canonical assignment storage. */
export class SubjectReferenceCleanupService {
  private readonly cacheManager: CacheManager;

  private constructor(private readonly dataSource: DataSource, cacheManager?: CacheManager) {
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): SubjectReferenceCleanupService {
    return getDataSourceScopedInstance(
      dataSource,
      SubjectReferenceCleanupService,
      () => new SubjectReferenceCleanupService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(SubjectReferenceCleanupService);
  }

  async cleanupDeletedSubjectReferences(
    subjectIds?: number[],
    manager?: EntityManager
  ): Promise<SubjectReferenceCleanupResult> {
    const operation = (transactionManager: EntityManager) =>
      this.cleanupInsideTransaction(subjectIds, transactionManager);
    const result = manager
      ? await operation(manager)
      : await runCommittedTransaction(this.dataSource, this.cacheManager, operation);
    if (result.removedClassRequirements || result.removedPrimarySubjectRefs || result.deletedTeacherAssignments) {
      logger.info('Cleaned canonical references to deleted subjects', { ...result });
    }
    return result;
  }

  private async cleanupInsideTransaction(
    subjectIds: number[] | undefined,
    manager: EntityManager
  ): Promise<SubjectReferenceCleanupResult> {
    const targets = await this.resolveTargets(subjectIds, manager);
    if (targets.length === 0) return emptyResult();

    const requirements = await manager.getRepository(ClassSubjectRequirement).find({
      where: { subjectId: In(targets), isDeleted: false },
    });
    const requirementIds = requirements.map((requirement) => requirement.id);
    const assignments = requirementIds.length
      ? await manager.getRepository(TeachingAssignment).find({
          where: { classSubjectRequirementId: In(requirementIds), isDeleted: false },
        })
      : [];
    const capabilities = await manager.getRepository(TeacherSubjectCapability).find({
      where: { subjectId: In(targets), isDeleted: false },
    });
    const now = new Date();

    for (const assignment of assignments) {
      assignment.isDeleted = true;
      assignment.deletedAt = now;
      assignment.updatedAt = now;
    }
    if (assignments.length) await manager.getRepository(TeachingAssignment).save(assignments);

    for (const requirement of requirements) {
      requirement.isDeleted = true;
      requirement.deletedAt = now;
      requirement.updatedAt = now;
    }
    if (requirements.length) {
      await manager.getRepository(ClassSubjectRequirement).save(requirements);
    }

    for (const capability of capabilities) {
      capability.isDeleted = true;
      capability.deletedAt = now;
      capability.updatedAt = now;
    }
    if (capabilities.length) {
      await manager.getRepository(TeacherSubjectCapability).save(capabilities);
    }

    return {
      targetSubjectIds: targets,
      updatedClasses: new Set(requirements.map((requirement) => requirement.classId)).size,
      removedClassRequirements: requirements.length,
      updatedTeachers: new Set(capabilities.map((capability) => capability.teacherId)).size,
      removedPrimarySubjectRefs: capabilities.filter((item) => item.capabilityLevel === 'primary').length,
      removedAllowedSubjectRefs: capabilities.filter((item) => item.capabilityLevel === 'allowed').length,
      removedTeacherClassAssignments: assignments.length,
      deletedTeacherAssignments: assignments.length,
    };
  }

  private async resolveTargets(
    subjectIds: number[] | undefined,
    manager: EntityManager
  ): Promise<number[]> {
    const explicit = uniquePositiveIds(subjectIds ?? []);
    if (explicit.length) return explicit;
    const active = new Set(
      (await manager.getRepository(Subject).find({ where: { isDeleted: false } })).map(
        (subject) => subject.id
      )
    );
    const [requirements, capabilities] = await Promise.all([
      manager.getRepository(ClassSubjectRequirement).find({ where: { isDeleted: false } }),
      manager.getRepository(TeacherSubjectCapability).find({ where: { isDeleted: false } }),
    ]);
    return uniquePositiveIds(
      [...requirements.map((item) => item.subjectId), ...capabilities.map((item) => item.subjectId)]
        .filter((subjectId) => !active.has(subjectId))
    );
  }
}

function emptyResult(): SubjectReferenceCleanupResult {
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

export default SubjectReferenceCleanupService;
