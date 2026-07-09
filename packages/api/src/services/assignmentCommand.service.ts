import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassRepository } from '../database/repositories/class.repository';
import { SubjectRepository } from '../database/repositories/subject.repository';
import {
  TeacherClassSubjectAssignmentInput,
  TeacherClassSubjectAssignmentRepository,
} from '../database/repositories/teacherClassSubjectAssignment.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';
import type {
  AssignmentConflict,
  AssignmentOperationResult,
  AssignmentValidationResult,
  ClassPeriodOverride,
} from './assignment.service';
import { AssignmentCompatibilityService } from './assignmentCompatibility.service';
import { AssignmentMirrorSyncService } from './assignmentMirrorSync.service';
import { RequirementService } from './requirement.service';
import { TeacherCapabilityService } from './teacherCapability.service';

interface CommandWriteOptions {
  manager?: EntityManager;
}

interface CanonicalRequirementContext {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
}

interface ResolvedRequirementAssignmentPlan {
  requirement: CanonicalRequirementContext;
  nextRequiredPeriodsPerWeek: number;
  nextTeacherPeriodsPerWeek: number;
  existingTeacherAssignment: TeachingAssignment | null;
  otherAssignments: TeachingAssignment[];
  warnings: AssignmentConflict[];
  conflicts: AssignmentConflict[];
  shouldPersistRequirementOverride: boolean;
}

const NEAR_CAPACITY_THRESHOLD = 5;

export class AssignmentCommandService {
  private static instance: AssignmentCommandService | null = null;

  private readonly teacherRepository: TeacherRepository;
  private readonly classRepository: ClassRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly legacyAssignmentRepository: TeacherClassSubjectAssignmentRepository;
  private readonly requirementService: RequirementService;
  private readonly capabilityService: TeacherCapabilityService;
  private readonly mirrorSyncService: AssignmentMirrorSyncService;
  private readonly assignmentCompatibilityService: AssignmentCompatibilityService;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cache);
    this.classRepository = ClassRepository.getInstance(dataSource, cache);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cache);
    this.legacyAssignmentRepository = TeacherClassSubjectAssignmentRepository.getInstance(
      dataSource,
      cache
    );
    this.requirementService = RequirementService.getInstance(dataSource, cache);
    this.capabilityService = TeacherCapabilityService.getInstance(dataSource, cache);
    this.mirrorSyncService = AssignmentMirrorSyncService.getInstance(dataSource, cache);
    this.assignmentCompatibilityService = new AssignmentCompatibilityService(dataSource);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): AssignmentCommandService {
    if (!AssignmentCommandService.instance) {
      AssignmentCommandService.instance = new AssignmentCommandService(dataSource, cacheManager);
    }

    return AssignmentCommandService.instance;
  }

  static resetInstance(): void {
    AssignmentCommandService.instance = null;
  }

  async validateAssignment(input: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
    classPeriodOverrides?: ClassPeriodOverride[];
    persistRequirementOverrides?: boolean;
  }, options?: CommandWriteOptions): Promise<ServiceResult<AssignmentValidationResult>> {
    try {
      const teacher = await this.getActiveTeacher(input.teacherId, options?.manager);
      const subject = await this.getActiveSubject(input.subjectId, options?.manager);
      const classPeriodOverrideMap = buildClassPeriodOverrideMap(input.classPeriodOverrides);
      const requirementContexts = await this.loadRequirementContexts(
        input.classIds,
        input.subjectId,
        options?.manager
      );

      const teacherAssignments = await (options?.manager ?? this.dataSource.manager)
        .getRepository(TeachingAssignment)
        .find({
          where: {
            teacherId: input.teacherId,
            isDeleted: false,
          },
        });

      const currentWorkload = teacherAssignments.reduce(
        (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
        0
      );

      let workloadDelta = 0;
      const conflicts: AssignmentConflict[] = [];
      const warnings: AssignmentConflict[] = [];

      const capabilityLevel = await this.capabilityService.getCapabilityLevel(
        input.teacherId,
        input.subjectId,
        { manager: options?.manager }
      );
      if (capabilityLevel === null) {
        warnings.push({
          type: 'subject_incompatible',
          severity: 'warning',
          message: `Subject "${subject.name}" will be added to teacher capabilities automatically`,
          messageFa: `مضمون "${subject.name}" به صورت خودکار به صلاحیت‌های معلم اضافه می‌شود`,
          affectedEntities: {
            teacherId: teacher.id,
            subjectId: subject.id,
          },
        });
      }

      for (const requirement of requirementContexts) {
        const plan = await this.resolveRequirementAssignmentPlan(
          {
            teacherId: input.teacherId,
            subjectId: input.subjectId,
            subjectName: subject.name,
            persistRequirementOverrides: input.persistRequirementOverrides ?? false,
            classPeriodOverrideMap,
          },
          requirement,
          options?.manager
        );

        workloadDelta +=
          plan.nextTeacherPeriodsPerWeek - (plan.existingTeacherAssignment?.assignedPeriodsPerWeek ?? 0);
        conflicts.push(...plan.conflicts);
        warnings.push(...plan.warnings);

        if (
          plan.existingTeacherAssignment &&
          plan.otherAssignments.length === 0 &&
          plan.existingTeacherAssignment.assignedPeriodsPerWeek === plan.nextTeacherPeriodsPerWeek &&
          plan.nextRequiredPeriodsPerWeek === requirement.requiredPeriodsPerWeek
        ) {
          warnings.push({
            type: 'duplicate_assignment',
            severity: 'warning',
            message: `Teacher "${teacher.fullName}" is already assigned to ${requirement.className} for subject ${subject.name}`,
            messageFa: `معلم "${teacher.fullName}" قبلاً برای مضمون ${subject.name} به ${requirement.className} تخصیص یافته است`,
            affectedEntities: {
              teacherId: teacher.id,
              subjectId: input.subjectId,
              classId: requirement.classId,
            },
          });
        }
      }

      const newWorkload = currentWorkload + workloadDelta;
      if (newWorkload > teacher.maxPeriodsPerWeek) {
        conflicts.push({
          type: 'workload_exceeded',
          severity: 'error',
          message: `Assignment would exceed teacher workload (${newWorkload}/${teacher.maxPeriodsPerWeek})`,
          messageFa: `این تخصیص از ظرفیت کاری معلم بیشتر می‌شود (${newWorkload}/${teacher.maxPeriodsPerWeek})`,
          affectedEntities: { teacherId: teacher.id },
        });
      } else if (teacher.maxPeriodsPerWeek > 0 && teacher.maxPeriodsPerWeek - newWorkload <= NEAR_CAPACITY_THRESHOLD) {
        warnings.push({
          type: 'workload_exceeded',
          severity: 'warning',
          message: `Teacher is approaching maximum workload (${newWorkload}/${teacher.maxPeriodsPerWeek})`,
          messageFa: `معلم به حداکثر ظرفیت کاری نزدیک می‌شود (${newWorkload}/${teacher.maxPeriodsPerWeek})`,
          affectedEntities: { teacherId: teacher.id },
        });
      }

      return {
        success: true,
        data: {
          isValid: conflicts.length === 0,
          conflicts,
          warnings,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async assignTeacher(
    teacherId: number,
    subjectId: number,
    classIds: number[],
    _periodsPerWeek?: number,
    classPeriodOverrides?: ClassPeriodOverride[],
    persistRequirementOverrides: boolean = false,
    options?: CommandWriteOptions
  ): Promise<ServiceResult<AssignmentOperationResult>> {
    const validationResult = await this.validateAssignment({
      teacherId,
      subjectId,
      classIds,
      classPeriodOverrides,
      persistRequirementOverrides,
    }, options);

    if (!validationResult.success) {
      return { success: false, error: validationResult.error };
    }

    if (!validationResult.data?.isValid) {
      return {
        success: true,
        data: {
          success: false,
          conflicts: validationResult.data?.conflicts ?? [],
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    }

    const subject = await this.getActiveSubject(subjectId, options?.manager);
    const classPeriodOverrideMap = buildClassPeriodOverrideMap(classPeriodOverrides);
    const operation = async (manager: EntityManager) => {
      const affectedTeacherIds = new Set<number>([teacherId]);
      const affectedClassIds = new Set<number>(classIds);

      await this.capabilityService.ensureCapability(teacherId, subjectId, 'allowed', { manager });

      for (const classId of classIds) {
        const requirement = await this.getRequirementOrThrow(classId, subjectId, manager);
        const plan = await this.resolveRequirementAssignmentPlan(
          {
            teacherId,
            subjectId,
            subjectName: subject.name,
            persistRequirementOverrides,
            classPeriodOverrideMap,
          },
          requirement,
          manager
        );
        const currentAssignments = await this.getCanonicalAssignmentsForRequirement(requirement.id, manager);

        if (!requirement.allowSplitAssignment) {
          for (const assignment of currentAssignments) {
            if (assignment.teacherId === teacherId) {
              continue;
            }
            await this.softDeleteCanonicalAssignment(assignment, requirement, manager);
            affectedTeacherIds.add(assignment.teacherId);
          }
        }

        await this.upsertCanonicalAssignment(
          requirement,
          {
            teacherId,
            assignedPeriodsPerWeek: plan.nextTeacherPeriodsPerWeek,
            isFixed: true,
          },
          manager
        );

        await this.legacyAssignmentRepository.upsertAssignment(
          {
            teacherId,
            classId,
            subjectId,
            periodsPerWeek: plan.nextTeacherPeriodsPerWeek,
            isFixed: true,
          },
          { manager, skipCache: true }
        );

        if (plan.shouldPersistRequirementOverride) {
          await this.requirementService.updateRequirementPeriods(
            classId,
            subjectId,
            plan.nextRequiredPeriodsPerWeek,
            { manager, syncMirror: false }
          );
        }
      }

      for (const affectedTeacherId of affectedTeacherIds) {
        await this.mirrorSyncService.syncTeacherAssignmentMirror(affectedTeacherId, { manager });
      }
      for (const affectedClassId of affectedClassIds) {
        await this.mirrorSyncService.syncClassRequirementMirror(affectedClassId, { manager });
      }
    };

    try {
      if (options?.manager) {
        await operation(options.manager);
      } else {
        await this.dataSource.transaction(operation);
      }

      return {
        success: true,
        data: {
          success: true,
          conflicts: [],
          warnings: validationResult.data?.warnings ?? [],
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async unassignTeacher(
    teacherId: number,
    subjectId: number,
    classIds: number[],
    options?: CommandWriteOptions
  ): Promise<ServiceResult<AssignmentOperationResult>> {
    const operation = async (manager: EntityManager) => {
      const affectedTeacherIds = new Set<number>([teacherId]);
      const affectedClassIds = new Set<number>(classIds);

      for (const classId of classIds) {
        const requirement = await this.getRequirementOrThrow(classId, subjectId, manager);
        const assignment = await manager.getRepository(TeachingAssignment).findOne({
          where: {
            classSubjectRequirementId: requirement.id,
            teacherId,
            isDeleted: false,
          },
        });

        if (assignment) {
          await this.softDeleteCanonicalAssignment(assignment, requirement, manager);
        }

        const legacyAssignment = await this.legacyAssignmentRepository.findExisting(
          teacherId,
          classId,
          subjectId,
          { manager, skipCache: true }
        );
        if (legacyAssignment) {
          await this.legacyAssignmentRepository.deleteAssignment(legacyAssignment.id, {
            manager,
            skipCache: true,
          });
        }
      }

      for (const affectedTeacherId of affectedTeacherIds) {
        await this.mirrorSyncService.syncTeacherAssignmentMirror(affectedTeacherId, { manager });
      }
      for (const affectedClassId of affectedClassIds) {
        await this.mirrorSyncService.syncClassRequirementMirror(affectedClassId, { manager });
      }
    };

    try {
      if (options?.manager) {
        await operation(options.manager);
      } else {
        await this.dataSource.transaction(operation);
      }

      return {
        success: true,
        data: {
          success: true,
          conflicts: [],
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createLegacyAssignment(
    input: TeacherClassSubjectAssignmentInput,
    options?: CommandWriteOptions
  ) {
    const operation = async (manager: EntityManager) => {
      await this.assertTeacherClassAndSubjectAreActive(
        input.teacherId,
        input.classId,
        input.subjectId,
        manager
      );
      const requirement = await this.getRequirementOrThrow(input.classId, input.subjectId, manager);
      const existingLegacyAssignment = await this.legacyAssignmentRepository.findExisting(
        input.teacherId,
        input.classId,
        input.subjectId,
        { manager, skipCache: true }
      );

      if (existingLegacyAssignment) {
        throw new Error(
          'Assignment already exists for this teacher-class-subject combination'
        );
      }

      await this.capabilityService.ensureCapability(input.teacherId, input.subjectId, 'allowed', {
        manager,
      });

      const activeAssignments = await this.getCanonicalAssignmentsForRequirement(requirement.id, manager);
      const totalAssigned = activeAssignments.reduce(
        (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
        0
      );

      if (!requirement.allowSplitAssignment && activeAssignments.length > 0) {
        throw new Error('Split assignment is disabled for this class-subject requirement');
      }

      if (totalAssigned + input.periodsPerWeek > requirement.requiredPeriodsPerWeek) {
        throw new Error('Assignment exceeds the remaining required periods for this class-subject');
      }

      await this.upsertCanonicalAssignment(
        requirement,
        {
          teacherId: input.teacherId,
          assignedPeriodsPerWeek: input.periodsPerWeek,
          isFixed: input.isFixed ?? true,
        },
        manager
      );

      const legacyAssignment = await this.legacyAssignmentRepository.createAssignment(input, {
        manager,
        skipCache: true,
      });

      await this.mirrorSyncService.syncTeacherAssignmentMirror(input.teacherId, { manager });
      await this.mirrorSyncService.syncClassRequirementMirror(input.classId, { manager });

      return legacyAssignment;
    };

    if (options?.manager) {
      return operation(options.manager);
    }

    return this.dataSource.transaction(operation);
  }

  async bulkCreateLegacyAssignments(inputs: TeacherClassSubjectAssignmentInput[]) {
    return this.dataSource.transaction(async (manager) => {
      const created = [];
      for (const input of inputs) {
        created.push(await this.createLegacyAssignment(input, { manager }));
      }
      return created;
    });
  }

  async updateLegacyAssignment(
    id: number,
    input: Partial<TeacherClassSubjectAssignmentInput>
  ) {
    return this.dataSource.transaction(async (manager) => {
      const existingLegacyAssignment = await this.legacyAssignmentRepository.getAssignment(id, {
        manager,
        skipCache: true,
      });
      if (!existingLegacyAssignment) {
        return null;
      }

      const previousTeacherId = existingLegacyAssignment.teacherId;
      const previousClassId = existingLegacyAssignment.classId;
      const previousSubjectId = existingLegacyAssignment.subjectId;

      const nextTeacherId = input.teacherId ?? existingLegacyAssignment.teacherId;
      const nextClassId = input.classId ?? existingLegacyAssignment.classId;
      const nextSubjectId = input.subjectId ?? existingLegacyAssignment.subjectId;
      const nextPeriodsPerWeek = input.periodsPerWeek ?? existingLegacyAssignment.periodsPerWeek;
      const nextIsFixed = input.isFixed ?? existingLegacyAssignment.isFixed;

      await this.assertTeacherClassAndSubjectAreActive(
        nextTeacherId,
        nextClassId,
        nextSubjectId,
        manager
      );

      const nextRequirement = await this.getRequirementOrThrow(nextClassId, nextSubjectId, manager);
      await this.capabilityService.ensureCapability(nextTeacherId, nextSubjectId, 'allowed', {
        manager,
      });

      const activeAssignments = await this.getCanonicalAssignmentsForRequirement(
        nextRequirement.id,
        manager
      );
      const assignedByOthers = activeAssignments
        .filter(
          (assignment) =>
            !(assignment.teacherId === previousTeacherId &&
              nextClassId === previousClassId &&
              nextSubjectId === previousSubjectId)
        )
        .reduce((sum, assignment) => sum + assignment.assignedPeriodsPerWeek, 0);

      if (!nextRequirement.allowSplitAssignment && assignedByOthers > 0) {
        throw new Error('Split assignment is disabled for this class-subject requirement');
      }
      if (assignedByOthers + nextPeriodsPerWeek > nextRequirement.requiredPeriodsPerWeek) {
        throw new Error('Assignment exceeds the remaining required periods for this class-subject');
      }

      if (previousClassId !== nextClassId || previousSubjectId !== nextSubjectId || previousTeacherId !== nextTeacherId) {
        const previousRequirement = await this.getRequirementOrThrow(
          previousClassId,
          previousSubjectId,
          manager
        );
        const previousCanonicalAssignment = await manager.getRepository(TeachingAssignment).findOne({
          where: {
            classSubjectRequirementId: previousRequirement.id,
            teacherId: previousTeacherId,
            isDeleted: false,
          },
        });
        if (previousCanonicalAssignment) {
          await this.softDeleteCanonicalAssignment(previousCanonicalAssignment, previousRequirement, manager);
        }
      }

      await this.upsertCanonicalAssignment(
        nextRequirement,
        {
          teacherId: nextTeacherId,
          assignedPeriodsPerWeek: nextPeriodsPerWeek,
          isFixed: nextIsFixed,
        },
        manager
      );

      const updatedLegacyAssignment = await this.legacyAssignmentRepository.updateAssignment(
        id,
        {
          teacherId: nextTeacherId,
          classId: nextClassId,
          subjectId: nextSubjectId,
          periodsPerWeek: nextPeriodsPerWeek,
          isFixed: nextIsFixed,
          schoolId: input.schoolId,
        },
        { manager, skipCache: true }
      );

      await this.mirrorSyncService.syncTeacherAssignmentMirror(previousTeacherId, { manager });
      if (previousTeacherId !== nextTeacherId) {
        await this.mirrorSyncService.syncTeacherAssignmentMirror(nextTeacherId, { manager });
      }
      await this.mirrorSyncService.syncClassRequirementMirror(previousClassId, { manager });
      if (previousClassId !== nextClassId) {
        await this.mirrorSyncService.syncClassRequirementMirror(nextClassId, { manager });
      }

      return updatedLegacyAssignment;
    });
  }

  async deleteLegacyAssignment(id: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const existingLegacyAssignment = await this.legacyAssignmentRepository.getAssignment(id, {
        manager,
        skipCache: true,
      });
      if (!existingLegacyAssignment) {
        return false;
      }

      const requirement = await this.getRequirementOrThrow(
        existingLegacyAssignment.classId,
        existingLegacyAssignment.subjectId,
        manager
      );
      const canonicalAssignment = await manager.getRepository(TeachingAssignment).findOne({
        where: {
          classSubjectRequirementId: requirement.id,
          teacherId: existingLegacyAssignment.teacherId,
          isDeleted: false,
        },
      });
      if (canonicalAssignment) {
        await this.softDeleteCanonicalAssignment(canonicalAssignment, requirement, manager);
      }

      await this.legacyAssignmentRepository.deleteAssignment(id, {
        manager,
        skipCache: true,
      });

      await this.mirrorSyncService.syncTeacherAssignmentMirror(existingLegacyAssignment.teacherId, {
        manager,
      });
      await this.mirrorSyncService.syncClassRequirementMirror(existingLegacyAssignment.classId, {
        manager,
      });

      return true;
    });
  }

  async validateLegacyAssignment(
    classId: number,
    subjectId: number,
    requiredPeriods: number,
    excludeAssignmentId?: number
  ): Promise<{ valid: boolean; remainingPeriods: number; message?: string }> {
    const requirement = await this.requirementService.getRequirementByClassAndSubject(classId, subjectId);
    const effectiveRequiredPeriods = requirement?.requiredPeriodsPerWeek ?? requiredPeriods;
    const assignments = await this.assignmentCompatibilityService.getLegacyAssignments({
      classId,
      subjectId,
    });

    const relevantAssignments = excludeAssignmentId
      ? assignments.filter((assignment) => assignment.id !== excludeAssignmentId)
      : assignments;

    const totalAssigned = relevantAssignments.reduce(
      (sum, assignment) => sum + assignment.periodsPerWeek,
      0
    );
    const remainingPeriods = effectiveRequiredPeriods - totalAssigned;

    if (remainingPeriods < 0) {
      return {
        valid: false,
        remainingPeriods: 0,
        message: `Over-assigned by ${Math.abs(remainingPeriods)} periods`,
      };
    }

    return {
      valid: true,
      remainingPeriods,
    };
  }

  async syncTeacherAssignmentsFromLegacyMirror(
    teacherId: number,
    nextAssignments: Array<{ subjectId: string | number; classIds: Array<string | number> }>,
    options?: CommandWriteOptions
  ): Promise<void> {
    const desiredKeys = new Set<string>();
    for (const assignment of nextAssignments) {
      const subjectId = toPositiveNumber(assignment.subjectId);
      if (subjectId === null) {
        continue;
      }

      for (const classIdValue of assignment.classIds) {
        const classId = toPositiveNumber(classIdValue);
        if (classId === null) {
          continue;
        }
        desiredKeys.add(`${classId}:${subjectId}`);
      }
    }

    const operation = async (manager: EntityManager) => {
      const currentAssignments = await this.legacyAssignmentRepository.findByTeacher(teacherId, {
        manager,
        skipCache: true,
      });
      const currentKeys = new Set(
        currentAssignments.map((assignment) => `${assignment.classId}:${assignment.subjectId}`)
      );

      for (const assignment of currentAssignments) {
        const key = `${assignment.classId}:${assignment.subjectId}`;
        if (!desiredKeys.has(key)) {
          const result = await this.unassignTeacher(
            teacherId,
            assignment.subjectId,
            [assignment.classId],
            { manager }
          );
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to unassign teacher from legacy mirror');
          }
        }
      }

      for (const key of desiredKeys) {
        if (currentKeys.has(key)) {
          continue;
        }
        const [classId, subjectId] = key.split(':').map(Number);
        const result = await this.assignTeacher(
          teacherId,
          subjectId,
          [classId],
          undefined,
          undefined,
          false,
          { manager }
        );
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to assign teacher from legacy mirror');
        }
      }
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await this.dataSource.transaction(operation);
  }

  async syncClassAssignmentsFromLegacyRequirements(
    classId: number,
    requirements: Array<{ subjectId: number; periodsPerWeek: number; teacherId?: number | null }>,
    options?: CommandWriteOptions
  ): Promise<void> {
    const operation = async (manager: EntityManager) => {
      const currentAssignments = await this.legacyAssignmentRepository.findByClass(classId, {
        manager,
        skipCache: true,
      });
      const currentAssignmentsBySubject = new Map<number, typeof currentAssignments>();
      for (const assignment of currentAssignments) {
        const assignmentsForSubject = currentAssignmentsBySubject.get(assignment.subjectId) ?? [];
        assignmentsForSubject.push(assignment);
        currentAssignmentsBySubject.set(assignment.subjectId, assignmentsForSubject);
      }

      for (const requirement of requirements) {
        const desiredTeacherId = toPositiveNumber(requirement.teacherId);
        const existingAssignments = currentAssignmentsBySubject.get(requirement.subjectId) ?? [];

        for (const existingAssignment of existingAssignments) {
          if (desiredTeacherId !== existingAssignment.teacherId || existingAssignments.length > 1) {
            const result = await this.unassignTeacher(
              existingAssignment.teacherId,
              requirement.subjectId,
              [classId],
              { manager }
            );
            if (!result.success) {
              throw new Error(result.error ?? 'Failed to remove legacy class assignment');
            }
          }
        }

        if (desiredTeacherId !== null) {
          const result = await this.assignTeacher(
            desiredTeacherId,
            requirement.subjectId,
            [classId],
            undefined,
            [{ classId, periodsPerWeek: requirement.periodsPerWeek }],
            false,
            { manager }
          );
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to sync class assignment from legacy requirement');
          }
        }
      }

      const desiredSubjects = new Set(requirements.map((requirement) => requirement.subjectId));
      for (const assignment of currentAssignments) {
        if (desiredSubjects.has(assignment.subjectId)) {
          continue;
        }
        const result = await this.unassignTeacher(
          assignment.teacherId,
          assignment.subjectId,
          [classId],
          { manager }
        );
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to clear removed class requirement assignment');
        }
      }
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await this.dataSource.transaction(operation);
  }

  async removeAssignmentsForTeacher(
    teacherId: number,
    options?: CommandWriteOptions
  ): Promise<void> {
    const operation = async (manager: EntityManager) => {
      const assignments = await this.legacyAssignmentRepository.findByTeacher(teacherId, {
        manager,
        skipCache: true,
      });

      for (const assignment of assignments) {
        const result = await this.unassignTeacher(
          teacherId,
          assignment.subjectId,
          [assignment.classId],
          { manager }
        );
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to remove teacher assignments');
        }
      }
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await this.dataSource.transaction(operation);
  }

  private async getActiveTeacher(teacherId: number, manager?: EntityManager) {
    const teacher = await this.teacherRepository.getTeacher(teacherId, {
      manager,
      skipCache: true,
    });
    if (!teacher || teacher.isDeleted) {
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }
    return teacher;
  }

  private async getActiveSubject(subjectId: number, manager?: EntityManager) {
    const subject = await this.subjectRepository.getSubject(subjectId, {
      manager,
      skipCache: true,
    });
    if (!subject || subject.isDeleted) {
      throw new Error(`Subject with ID ${subjectId} not found`);
    }
    return subject;
  }

  private async assertTeacherClassAndSubjectAreActive(
    teacherId: number,
    classId: number,
    subjectId: number,
    manager?: EntityManager
  ): Promise<void> {
    const teacher = await this.teacherRepository.getTeacher(teacherId, {
      manager,
      skipCache: true,
    });
    if (!teacher || teacher.isDeleted) {
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }

    const classGroup = await this.classRepository.getClass(classId, {
      manager,
      skipCache: true,
    });
    if (!classGroup || classGroup.isDeleted) {
      throw new Error(`Class with ID ${classId} not found`);
    }

    const subject = await this.subjectRepository.getSubject(subjectId, {
      manager,
      skipCache: true,
    });
    if (!subject || subject.isDeleted) {
      throw new Error(`Subject with ID ${subjectId} not found`);
    }
  }

  private async loadRequirementContexts(
    classIds: number[],
    subjectId: number,
    manager?: EntityManager
  ): Promise<CanonicalRequirementContext[]> {
    const contexts: CanonicalRequirementContext[] = [];
    const seenClassIds = new Set<number>();

    for (const classId of classIds) {
      if (seenClassIds.has(classId)) {
        continue;
      }
      seenClassIds.add(classId);

      const classGroup = await this.classRepository.getClass(classId, {
        manager,
        skipCache: true,
      });
      if (!classGroup || classGroup.isDeleted) {
        throw new Error(`Class with ID ${classId} not found`);
      }

      const requirement = await this.requirementService.getRequirementByClassAndSubject(
        classId,
        subjectId,
        { manager }
      );
      if (!requirement || requirement.isDeleted) {
        throw new Error(
          `Cannot assign subject ${subjectId} to class ${classGroup.displayName || classGroup.name} because the class does not require it`
        );
      }

      contexts.push({
        id: requirement.id,
        classId: requirement.classId,
        className: classGroup.displayName || classGroup.name,
        subjectId: requirement.subjectId,
        requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
        allowSplitAssignment: requirement.allowSplitAssignment,
      });
    }

    return contexts;
  }

  private async getRequirementOrThrow(
    classId: number,
    subjectId: number,
    manager?: EntityManager
  ): Promise<CanonicalRequirementContext> {
    const classGroup = await this.classRepository.getClass(classId, {
      manager,
      skipCache: true,
    });
    const requirement = await this.requirementService.getRequirementByClassAndSubject(
      classId,
      subjectId,
      { manager }
    );

    if (!classGroup || classGroup.isDeleted || !requirement || requirement.isDeleted) {
      throw new Error(`Class ${classId} does not require subject ${subjectId}`);
    }

    return {
      id: requirement.id,
      classId: requirement.classId,
      className: classGroup.displayName || classGroup.name,
      subjectId: requirement.subjectId,
      requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
      allowSplitAssignment: requirement.allowSplitAssignment,
    };
  }

  private async getCanonicalAssignmentsForRequirement(
    classSubjectRequirementId: number,
    manager?: EntityManager
  ): Promise<TeachingAssignment[]> {
    return (manager ?? this.dataSource.manager).getRepository(TeachingAssignment).find({
      where: {
        classSubjectRequirementId,
        isDeleted: false,
      },
      order: { teacherId: 'ASC' },
    });
  }

  private async upsertCanonicalAssignment(
    requirement: CanonicalRequirementContext,
    input: {
      teacherId: number;
      assignedPeriodsPerWeek: number;
      isFixed: boolean;
    },
    manager: EntityManager
  ): Promise<TeachingAssignment> {
    const repo = manager.getRepository(TeachingAssignment);
    const existing = await repo.findOne({
      where: {
        classSubjectRequirementId: requirement.id,
        teacherId: input.teacherId,
      },
    });

    if (existing) {
      existing.assignedPeriodsPerWeek = input.assignedPeriodsPerWeek;
      existing.isFixed = input.isFixed;
      existing.source = 'manual';
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.updatedAt = new Date();
      return repo.save(existing);
    }

    const assignment = repo.create({
      classSubjectRequirementId: requirement.id,
      teacherId: input.teacherId,
      assignedPeriodsPerWeek: input.assignedPeriodsPerWeek,
      isFixed: input.isFixed,
      source: 'manual',
    });

    return repo.save(assignment);
  }

  private async softDeleteCanonicalAssignment(
    assignment: TeachingAssignment,
    requirement: CanonicalRequirementContext,
    manager: EntityManager
  ): Promise<void> {
    assignment.isDeleted = true;
    assignment.deletedAt = new Date();
    assignment.updatedAt = new Date();
    await manager.getRepository(TeachingAssignment).save(assignment);

    const legacyAssignment = await this.legacyAssignmentRepository.findExisting(
      assignment.teacherId,
      requirement.classId,
      requirement.subjectId,
      { manager, skipCache: true }
    );
    if (legacyAssignment) {
      await this.legacyAssignmentRepository.deleteAssignment(legacyAssignment.id, {
        manager,
        skipCache: true,
      });
    }
  }

  private async resolveRequirementAssignmentPlan(
    input: {
      teacherId: number;
      subjectId: number;
      subjectName: string;
      persistRequirementOverrides: boolean;
      classPeriodOverrideMap: Map<number, number>;
    },
    requirement: CanonicalRequirementContext,
    manager?: EntityManager
  ): Promise<ResolvedRequirementAssignmentPlan> {
    const overridePeriods = input.classPeriodOverrideMap.get(requirement.classId);
    const shouldPersistRequirementOverride =
      input.persistRequirementOverrides && overridePeriods !== undefined;
    const nextRequiredPeriodsPerWeek = shouldPersistRequirementOverride
      ? overridePeriods
      : requirement.requiredPeriodsPerWeek;

    const activeAssignments = await this.getCanonicalAssignmentsForRequirement(requirement.id, manager);
    const existingTeacherAssignment =
      activeAssignments.find((assignment) => assignment.teacherId === input.teacherId) ?? null;
    const otherAssignments = activeAssignments.filter(
      (assignment) => assignment.teacherId !== input.teacherId
    );
    const assignedByOthers = otherAssignments.reduce(
      (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
      0
    );

    const warnings: AssignmentConflict[] = [];
    const conflicts: AssignmentConflict[] = [];
    let nextTeacherPeriodsPerWeek = overridePeriods ?? requirement.requiredPeriodsPerWeek;

    if (!requirement.allowSplitAssignment && otherAssignments.length > 0) {
      warnings.push({
        type: 'duplicate_assignment',
        severity: 'warning',
        message: `Existing teacher assignments for ${requirement.className} will be replaced`,
        messageFa: `تخصیص‌های فعلی معلمان برای ${requirement.className} جایگزین می‌شوند`,
        affectedEntities: {
          subjectId: input.subjectId,
          classId: requirement.classId,
        },
      });
    }

    if (requirement.allowSplitAssignment) {
      if (shouldPersistRequirementOverride) {
        if (assignedByOthers > nextRequiredPeriodsPerWeek) {
          conflicts.push({
            type: 'coverage_insufficient',
            severity: 'error',
            message: `Other teacher assignments (${assignedByOthers}) already exceed the requested requirement (${nextRequiredPeriodsPerWeek}) for ${input.subjectName} in ${requirement.className}`,
            messageFa: `تخصیص‌های سایر معلمان (${assignedByOthers}) از نیاز جدید (${nextRequiredPeriodsPerWeek}) برای مضمون ${input.subjectName} در ${requirement.className} بیشتر است`,
            affectedEntities: {
              teacherId: input.teacherId,
              subjectId: input.subjectId,
              classId: requirement.classId,
            },
            suggestedResolution:
              'Reduce or remove the other teacher assignments before lowering the requirement.',
            suggestedResolutionFa:
              'پیش از کاهش ساعات مورد نیاز، تخصیص‌های سایر معلمان را کم یا حذف کنید.',
          });
        } else {
          const remainingCapacity = nextRequiredPeriodsPerWeek - assignedByOthers;
          if (remainingCapacity < 1) {
            conflicts.push({
              type: 'coverage_insufficient',
              severity: 'error',
              message: `${requirement.className} has no remaining capacity for ${input.subjectName} after keeping the other teacher assignments`,
              messageFa: `${requirement.className} پس از حفظ تخصیص‌های سایر معلمان، ظرفیت باقی‌مانده‌ای برای مضمون ${input.subjectName} ندارد`,
              affectedEntities: {
                teacherId: input.teacherId,
                subjectId: input.subjectId,
                classId: requirement.classId,
              },
              suggestedResolution:
                'Reduce or remove the other teacher assignments before reassigning this teacher.',
              suggestedResolutionFa:
                'پیش از تخصیص دوباره این معلم، تخصیص‌های سایر معلمان را کم یا حذف کنید.',
            });
          } else {
            if (overridePeriods !== undefined && remainingCapacity < overridePeriods) {
              warnings.push({
                type: 'coverage_insufficient',
                severity: 'warning',
                message: `Teacher assignment for ${requirement.className} will be trimmed to ${remainingCapacity}/${nextRequiredPeriodsPerWeek} periods because ${assignedByOthers} periods remain assigned to other teachers`,
                messageFa: `تخصیص معلم برای ${requirement.className} به ${remainingCapacity}/${nextRequiredPeriodsPerWeek} ساعت کاهش می‌یابد چون ${assignedByOthers} ساعت نزد سایر معلمان باقی می‌ماند`,
                affectedEntities: {
                  teacherId: input.teacherId,
                  subjectId: input.subjectId,
                  classId: requirement.classId,
                },
                suggestedResolution:
                  'Remove or reduce the other assignments if this teacher should take the full requirement.',
                suggestedResolutionFa:
                  'اگر این معلم باید تمام ساعات را بگیرد، تخصیص‌های دیگر را حذف یا کاهش دهید.',
              });
            }

            nextTeacherPeriodsPerWeek = remainingCapacity;
          }
        }
      } else if (assignedByOthers + nextTeacherPeriodsPerWeek > requirement.requiredPeriodsPerWeek) {
        conflicts.push({
          type: 'coverage_insufficient',
          severity: 'error',
          message: `Assignment would exceed the class requirement for subject ${input.subjectName}`,
          messageFa: `این تخصیص از ظرفیت مورد نیاز مضمون ${input.subjectName} برای صنف بیشتر می‌شود`,
          affectedEntities: {
            teacherId: input.teacherId,
            subjectId: input.subjectId,
            classId: requirement.classId,
          },
        });
      }
    } else if (shouldPersistRequirementOverride) {
      nextTeacherPeriodsPerWeek = nextRequiredPeriodsPerWeek;
    }

    return {
      requirement,
      nextRequiredPeriodsPerWeek,
      nextTeacherPeriodsPerWeek,
      existingTeacherAssignment,
      otherAssignments,
      warnings,
      conflicts,
      shouldPersistRequirementOverride,
    };
  }
}

function buildClassPeriodOverrideMap(
  classPeriodOverrides?: ClassPeriodOverride[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const override of classPeriodOverrides ?? []) {
    map.set(override.classId, override.periodsPerWeek);
  }
  return map;
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
