import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { ClassSubjectRequirementRepository } from '../database/repositories/classSubjectRequirement.repository';
import { ClassRepository, SubjectRequirement } from '../database/repositories/class.repository';
import { SubjectRepository } from '../database/repositories/subject.repository';
import { TeacherClassSubjectAssignmentRepository } from '../database/repositories/teacherClassSubjectAssignment.repository';
import { AssignmentMirrorSyncService } from './assignmentMirrorSync.service';

interface RequirementWriteOptions {
  manager?: EntityManager;
}

export interface RequirementSyncInput {
  subjectId: number;
  periodsPerWeek: number;
  allowSplitAssignment?: boolean;
}

export class RequirementService {
  private static instance: RequirementService | null = null;

  private readonly classRepository: ClassRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly requirementRepository: ClassSubjectRequirementRepository;
  private readonly legacyAssignmentRepository: TeacherClassSubjectAssignmentRepository;
  private readonly mirrorSyncService: AssignmentMirrorSyncService;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.classRepository = ClassRepository.getInstance(dataSource, cache);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cache);
    this.requirementRepository = ClassSubjectRequirementRepository.getInstance(dataSource, cache);
    this.legacyAssignmentRepository = TeacherClassSubjectAssignmentRepository.getInstance(
      dataSource,
      cache
    );
    this.mirrorSyncService = AssignmentMirrorSyncService.getInstance(dataSource, cache);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RequirementService {
    if (!RequirementService.instance) {
      RequirementService.instance = new RequirementService(dataSource, cacheManager);
    }

    return RequirementService.instance;
  }

  static resetInstance(): void {
    RequirementService.instance = null;
  }

  async getRequirementByClassAndSubject(
    classId: number,
    subjectId: number,
    options?: RequirementWriteOptions
  ): Promise<ClassSubjectRequirement | null> {
    return this.requirementRepository.getActiveByClassAndSubject(classId, subjectId, {
      manager: options?.manager,
      skipCache: true,
    });
  }

  async updateRequirementPeriods(
    classId: number,
    subjectId: number,
    periodsPerWeek: number,
    options?: RequirementWriteOptions & { syncMirror?: boolean }
  ): Promise<ClassSubjectRequirement> {
    if (!Number.isInteger(periodsPerWeek) || periodsPerWeek <= 0) {
      throw new Error(
        `Invalid periodsPerWeek for subject ${subjectId} in class ${classId}: ${periodsPerWeek}`
      );
    }

    const manager = options?.manager ?? this.dataSource.manager;
    await this.assertClassIsActive(classId, manager);

    const existingRequirement = await this.requirementRepository.getActiveByClassAndSubject(
      classId,
      subjectId,
      { manager, skipCache: true }
    );

    if (!existingRequirement) {
      throw new Error(`Class ${classId} does not require subject ${subjectId}`);
    }

    const assignedPeriods = await this.getAssignedPeriodsForRequirement(existingRequirement.id, manager);
    if (assignedPeriods > periodsPerWeek) {
      throw new Error(
        `Cannot reduce requirement for subject ${subjectId} in class ${classId} below currently assigned periods`
      );
    }

    const updatedRequirement = await this.requirementRepository.upsertRequirement(
      {
        classId,
        subjectId,
        requiredPeriodsPerWeek: periodsPerWeek,
        allowSplitAssignment: existingRequirement.allowSplitAssignment,
      },
      { manager, skipCache: true }
    );

    if (options?.syncMirror ?? true) {
      await this.mirrorSyncService.syncClassRequirementMirror(classId, { manager });
    }

    return updatedRequirement;
  }

  async syncClassRequirements(
    classId: number,
    requirements: RequirementSyncInput[],
    options?: RequirementWriteOptions
  ): Promise<void> {
    const operation = async (manager: EntityManager) => {
      await this.assertClassIsActive(classId, manager);

      const normalizedRequirements = normalizeRequirements(requirements);
      await this.assertSubjectsAreActive(
        normalizedRequirements.map((requirement) => requirement.subjectId),
        manager
      );

      const existingRequirements = await this.requirementRepository.getActiveByClass(classId, {
        manager,
        skipCache: true,
      });
      const existingBySubject = new Map(
        existingRequirements.map((requirement) => [requirement.subjectId, requirement])
      );

      for (const requirement of normalizedRequirements) {
        const existingRequirement = existingBySubject.get(requirement.subjectId);
        if (existingRequirement) {
          const assignedPeriods = await this.getAssignedPeriodsForRequirement(existingRequirement.id, manager);
          if (assignedPeriods > requirement.periodsPerWeek) {
            throw new Error(
              `Cannot reduce requirement for subject ${requirement.subjectId} in class ${classId} below currently assigned periods`
            );
          }
        }

        await this.requirementRepository.upsertRequirement(
          {
            classId,
            subjectId: requirement.subjectId,
            requiredPeriodsPerWeek: requirement.periodsPerWeek,
            allowSplitAssignment:
              requirement.allowSplitAssignment ??
              existingRequirement?.allowSplitAssignment ??
              false,
          },
          { manager, skipCache: true }
        );
      }

      const desiredSubjectIds = new Set(normalizedRequirements.map((requirement) => requirement.subjectId));
      for (const existingRequirement of existingRequirements) {
        if (desiredSubjectIds.has(existingRequirement.subjectId)) {
          continue;
        }

        await this.softDeleteRequirement(existingRequirement, manager);
      }

      await this.mirrorSyncService.syncClassRequirementMirror(classId, { manager });
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await this.dataSource.transaction(operation);
  }

  async clearClassRequirements(classId: number, options?: RequirementWriteOptions): Promise<void> {
    const operation = async (manager: EntityManager) => {
      const requirements = await this.requirementRepository.getActiveByClass(classId, {
        manager,
        skipCache: true,
      });

      for (const requirement of requirements) {
        await this.softDeleteRequirement(requirement, manager);
      }

      await this.mirrorSyncService.syncClassRequirementMirror(classId, { manager });
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await this.dataSource.transaction(operation);
  }

  async syncLegacyRequirementMirror(
    classId: number,
    requirements: SubjectRequirement[],
    options?: RequirementWriteOptions
  ): Promise<void> {
    await this.syncClassRequirements(
      classId,
      requirements.map((requirement) => ({
        subjectId: requirement.subjectId,
        periodsPerWeek: requirement.periodsPerWeek,
      })),
      options
    );
  }

  private async softDeleteRequirement(
    requirement: ClassSubjectRequirement,
    manager: EntityManager
  ): Promise<void> {
    const canonicalAssignmentRepo = manager.getRepository(TeachingAssignment);
    const canonicalAssignments = await canonicalAssignmentRepo.find({
      where: { classSubjectRequirementId: requirement.id, isDeleted: false },
    });

    const affectedTeacherIds = [...new Set(canonicalAssignments.map((assignment) => assignment.teacherId))];
    for (const assignment of canonicalAssignments) {
      assignment.isDeleted = true;
      assignment.deletedAt = new Date();
      assignment.updatedAt = new Date();
      await canonicalAssignmentRepo.save(assignment);
    }

    const legacyAssignments = await this.legacyAssignmentRepository.findByClassAndSubject(
      requirement.classId,
      requirement.subjectId,
      { manager, skipCache: true }
    );
    for (const assignment of legacyAssignments) {
      await this.legacyAssignmentRepository.deleteAssignment(assignment.id, {
        manager,
        skipCache: true,
      });
      affectedTeacherIds.push(assignment.teacherId);
    }

    const requirementRepo = manager.getRepository(ClassSubjectRequirement);
    requirement.isDeleted = true;
    requirement.deletedAt = new Date();
    requirement.updatedAt = new Date();
    await requirementRepo.save(requirement);

    for (const teacherId of [...new Set(affectedTeacherIds)]) {
      await this.mirrorSyncService.syncTeacherAssignmentMirror(teacherId, { manager });
    }
  }

  private async getAssignedPeriodsForRequirement(
    requirementId: number,
    manager: EntityManager
  ): Promise<number> {
    const assignments = await manager.getRepository(TeachingAssignment).find({
      where: { classSubjectRequirementId: requirementId, isDeleted: false },
    });

    return assignments.reduce(
      (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
      0
    );
  }

  private async assertClassIsActive(classId: number, manager?: EntityManager): Promise<void> {
    const classGroup = await this.classRepository.getClass(classId, {
      manager,
      skipCache: true,
    });

    if (!classGroup || classGroup.isDeleted) {
      throw new Error(`Class with ID ${classId} not found`);
    }
  }

  private async assertSubjectsAreActive(
    subjectIds: number[],
    manager?: EntityManager
  ): Promise<void> {
    for (const subjectId of [...new Set(subjectIds)]) {
      const subject = await this.subjectRepository.getSubject(subjectId, {
        manager,
        skipCache: true,
      });

      if (!subject || subject.isDeleted) {
        throw new Error(`Subject with ID ${subjectId} not found`);
      }
    }
  }
}

function normalizeRequirements(requirements: RequirementSyncInput[]): RequirementSyncInput[] {
  const normalized = new Map<number, RequirementSyncInput>();

  for (const requirement of requirements) {
    if (!Number.isInteger(requirement.subjectId) || requirement.subjectId <= 0) {
      throw new Error(`Invalid subject ID ${requirement.subjectId}`);
    }
    if (!Number.isInteger(requirement.periodsPerWeek) || requirement.periodsPerWeek <= 0) {
      throw new Error(
        `Invalid periodsPerWeek for subject ${requirement.subjectId}: ${requirement.periodsPerWeek}`
      );
    }

    normalized.set(requirement.subjectId, {
      subjectId: requirement.subjectId,
      periodsPerWeek: requirement.periodsPerWeek,
      allowSplitAssignment: requirement.allowSplitAssignment,
    });
  }

  return Array.from(normalized.values()).sort((left, right) => left.subjectId - right.subjectId);
}
