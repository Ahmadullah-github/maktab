import { DataSource, EntityManager, In } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { ClassRepository } from '../database/repositories/class.repository';
import { SubjectRepository } from '../database/repositories/subject.repository';
import {
  TeacherClassSubjectAssignmentInput,
  TeacherClassSubjectAssignmentRepository,
} from '../database/repositories/teacherClassSubjectAssignment.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TimetableRepository } from '../database/repositories/timetable.repository';
import { ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import type {
  AssignmentConflict,
  AssignmentBatchChangeInput,
  AssignmentBatchResult,
  AssignmentOperationResult,
  AssignmentValidationResult,
  ClassPeriodOverride,
} from './assignment.types';
import { AssignmentCompatibilityService } from './assignmentCompatibility.service';
import { AssignmentMirrorSyncService } from './assignmentMirrorSync.service';
import { RequirementService } from './requirement.service';
import { TeacherCapabilityService } from './teacherCapability.service';
import { SchoolConfigService } from './schoolConfig.service';
import type { ParsedTeacher } from '../database/repositories/teacher.repository';

interface CommandWriteOptions {
  manager?: EntityManager;
}

interface CanonicalRequirementContext {
  id: number;
  assignmentVersion: number;
  classId: number;
  className: string;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
  schoolId: number | null;
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
  private readonly teacherRepository: TeacherRepository;
  private readonly classRepository: ClassRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly legacyAssignmentRepository: TeacherClassSubjectAssignmentRepository;
  private readonly requirementService: RequirementService;
  private readonly capabilityService: TeacherCapabilityService;
  private readonly mirrorSyncService: AssignmentMirrorSyncService;
  private readonly assignmentCompatibilityService: AssignmentCompatibilityService;
  private readonly schoolConfigService: SchoolConfigService;
  private readonly timetableRepository: TimetableRepository;
  private readonly cacheManager: CacheManager;
  private batchWriteQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.cacheManager = cache;
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
    this.schoolConfigService = SchoolConfigService.getInstance(dataSource, cache);
    this.timetableRepository = TimetableRepository.getInstance(dataSource, cache);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): AssignmentCommandService {
    return getDataSourceScopedInstance(
      dataSource,
      AssignmentCommandService,
      () => new AssignmentCommandService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(AssignmentCommandService);
  }

  private runTransaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return runCommittedTransaction(this.dataSource, this.cacheManager, operation);
  }

  private async serializeBatchWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.batchWriteQueue;
    let release!: () => void;
    this.batchWriteQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  /** Validate complete desired allocation states without mutating storage. */
  async validateBatch(
    changes: AssignmentBatchChangeInput[]
  ): Promise<ServiceResult<AssignmentBatchResult>> {
    try {
      return {
        success: true,
        data: await this.evaluateBatch(changes, this.dataSource.manager, false),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Atomically replace the complete allocation state of every requested requirement. */
  async applyBatch(
    changes: AssignmentBatchChangeInput[]
  ): Promise<ServiceResult<AssignmentBatchResult>> {
    try {
      const data = await this.serializeBatchWrite(() =>
        this.runTransaction((manager) => this.evaluateBatch(changes, manager, true))
      );
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Keep the grade 1–3 instructional policy derived and canonical after class writes. */
  async reconcileClassPolicy(classId: number, manager: EntityManager): Promise<void> {
    const classGroup = await this.classRepository.getClass(classId, { manager, skipCache: true });
    if (!classGroup || classGroup.isDeleted) throw new Error(`Class ${classId} not found`);
    const requirements = await manager.getRepository(ClassSubjectRequirement).find({
      where: { classId, isDeleted: false },
      order: { id: 'ASC' },
    });
    if (requirements.length === 0) return;

    const requirementIds = requirements.map((requirement) => requirement.id);
    const current = await manager.getRepository(TeachingAssignment).find({
      where: { classSubjectRequirementId: In(requirementIds), isDeleted: false },
    });
    const currentByRequirement = new Map<number, TeachingAssignment[]>();
    for (const assignment of current) {
      const list = currentByRequirement.get(assignment.classSubjectRequirementId) ?? [];
      list.push(assignment);
      currentByRequirement.set(assignment.classSubjectRequirementId, list);
    }

    const isAlphaPrimary = classGroup.grade !== null && classGroup.grade >= 1 && classGroup.grade <= 3;
    const changes: AssignmentBatchChangeInput[] = requirements.map((requirement) => ({
      requirementId: requirement.id,
      expectedVersion: requirement.assignmentVersion,
      allocations: isAlphaPrimary && classGroup.classTeacherId !== null
        ? [{ teacherId: classGroup.classTeacherId, periodsPerWeek: requirement.requiredPeriodsPerWeek }]
        : (currentByRequirement.get(requirement.id) ?? [])
            .filter((assignment) => assignment.source !== 'single_teacher' && !isAlphaPrimary)
            .map((assignment) => ({
              teacherId: assignment.teacherId,
              periodsPerWeek: assignment.assignedPeriodsPerWeek,
            })),
    }));

    // An alpha-primary class may remain a draft without a class teacher. Clear
    // instructional rows directly because the normal command correctly rejects
    // an incomplete alpha allocation.
    if (isAlphaPrimary && classGroup.classTeacherId === null) {
      let changed = false;
      for (const requirement of requirements) {
        const assignments = currentByRequirement.get(requirement.id) ?? [];
        if (assignments.length === 0) continue;
        changed = true;
        for (const assignment of assignments) {
          assignment.isDeleted = true;
          assignment.deletedAt = new Date();
          assignment.updatedAt = new Date();
          await manager.getRepository(TeachingAssignment).save(assignment);
        }
        requirement.assignmentVersion += 1;
        requirement.updatedAt = new Date();
        await manager.getRepository(ClassSubjectRequirement).save(requirement);
      }
      if (changed) {
        await this.timetableRepository.markStaleForSchool(
          classGroup.schoolId,
          'ASSIGNMENTS_CHANGED',
          { manager, skipCache: true }
        );
      }
      return;
    }

    const result = await this.evaluateBatch(changes, manager, true);
    if (!result.isValid) {
      throw new Error(result.conflicts.map((conflict) => conflict.message).join('; '));
    }
  }

  private async evaluateBatch(
    changes: AssignmentBatchChangeInput[],
    manager: EntityManager,
    persist: boolean
  ): Promise<AssignmentBatchResult> {
    const requirementIds = [...new Set(changes.map((change) => change.requirementId))];
    if (requirementIds.length !== changes.length) {
      throw new Error('Each requirement can appear only once per assignment batch');
    }

    const requirements = await manager.getRepository(ClassSubjectRequirement).find({
      where: { id: In(requirementIds), isDeleted: false },
      order: { id: 'ASC' },
    });
    if (requirements.length !== requirementIds.length) {
      const found = new Set(requirements.map((requirement) => requirement.id));
      const missing = requirementIds.find((id) => !found.has(id));
      throw new Error(`Assignment requirement ${missing} not found`);
    }

    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    const classIds = [...new Set(requirements.map((requirement) => requirement.classId))];
    const subjectIds = [...new Set(requirements.map((requirement) => requirement.subjectId))];
    const desiredTeacherIds = [
      ...new Set(changes.flatMap((change) => change.allocations.map((item) => item.teacherId))),
    ];
    const [classes, subjects, teachers, existingAssignments, capabilities] = await Promise.all([
      Promise.all(classIds.map((classId) =>
        this.classRepository.getClass(classId, { manager, skipCache: true })
      )),
      Promise.all(subjectIds.map((subjectId) =>
        this.subjectRepository.getSubject(subjectId, { manager, skipCache: true })
      )),
      Promise.all(desiredTeacherIds.map((teacherId) =>
        this.teacherRepository.getTeacher(teacherId, { manager, skipCache: true })
      )),
      manager.getRepository(TeachingAssignment).find({
        where: { classSubjectRequirementId: In(requirementIds), isDeleted: false },
        order: { teacherId: 'ASC' },
      }),
      desiredTeacherIds.length
        ? manager.getRepository(TeacherSubjectCapability).find({
            where: { teacherId: In(desiredTeacherIds), isDeleted: false },
          })
        : Promise.resolve([]),
    ]);

    if (classes.some((item) => !item || item.isDeleted)) throw new Error('An assignment class is not active');
    if (subjects.some((item) => !item || item.isDeleted)) throw new Error('An assignment subject is not active');
    if (teachers.some((item) => !item || item.isDeleted)) throw new Error('An assignment teacher is not active');

    const classById = new Map(classes.map((item) => [item!.id, item!]));
    const subjectById = new Map(subjects.map((item) => [item!.id, item!]));
    const teacherById = new Map(teachers.map((item) => [item!.id, item!]));
    const capabilityKeys = new Set(
      capabilities.map((capability) => `${capability.teacherId}:${capability.subjectId}`)
    );
    const existingByRequirement = new Map<number, TeachingAssignment[]>();
    for (const assignment of existingAssignments) {
      const list = existingByRequirement.get(assignment.classSubjectRequirementId) ?? [];
      list.push(assignment);
      existingByRequirement.set(assignment.classSubjectRequirementId, list);
    }

    const conflicts: AssignmentConflict[] = [];
    const warnings: AssignmentConflict[] = [];
    const changedRequirementIds = new Set<number>();
    const affectedTeacherIds = new Set<number>();
    const affectedClassIds = new Set<number>();
    const schoolIds = new Set<number | null>();

    for (const change of changes) {
      const requirement = requirementById.get(change.requirementId)!;
      const classGroup = classById.get(requirement.classId)!;
      const subject = subjectById.get(requirement.subjectId)!;
      const current = existingByRequirement.get(requirement.id) ?? [];
      const currentState = current
        .map((assignment) => `${assignment.teacherId}:${assignment.assignedPeriodsPerWeek}`)
        .sort();
      const desiredState = change.allocations
        .map((allocation) => `${allocation.teacherId}:${allocation.periodsPerWeek}`)
        .sort();
      const allocationTeacherIds = change.allocations.map((allocation) => allocation.teacherId);
      if (new Set(allocationTeacherIds).size !== allocationTeacherIds.length) {
        conflicts.push(this.batchConflict(
          'class_policy',
          'A teacher can appear only once in a requirement allocation',
          requirement.classId,
          requirement.subjectId
        ));
      }
      if (change.allocations.some((allocation) =>
        !Number.isInteger(allocation.periodsPerWeek) || allocation.periodsPerWeek <= 0
      )) {
        conflicts.push(this.batchConflict(
          'coverage_insufficient',
          'Every teacher allocation must contain a positive whole number of periods',
          requirement.classId,
          requirement.subjectId
        ));
      }
      const isSameState =
        currentState.length === desiredState.length &&
        currentState.every((value, index) => value === desiredState[index]);

      if (requirement.assignmentVersion !== change.expectedVersion && !isSameState) {
        conflicts.push(this.batchConflict(
          'stale_assignment',
          `Assignments for ${classGroup.displayName || classGroup.name} / ${subject.name} changed since this page was loaded`,
          requirement.classId,
          requirement.subjectId
        ));
      }

      const total = change.allocations.reduce((sum, allocation) => sum + allocation.periodsPerWeek, 0);
      if (!requirement.allowSplitAssignment && change.allocations.length > 1) {
        conflicts.push(this.batchConflict(
          'class_policy',
          'Split assignment is disabled for this class-subject requirement',
          requirement.classId,
          requirement.subjectId
        ));
      }
      if (!requirement.allowSplitAssignment && change.allocations.length === 1 && total !== requirement.requiredPeriodsPerWeek) {
        conflicts.push(this.batchConflict(
          'coverage_insufficient',
          `A non-split assignment must cover all ${requirement.requiredPeriodsPerWeek} periods`,
          requirement.classId,
          requirement.subjectId
        ));
      }
      if (total > requirement.requiredPeriodsPerWeek) {
        conflicts.push(this.batchConflict(
          'coverage_insufficient',
          `Assigned periods (${total}) exceed the requirement (${requirement.requiredPeriodsPerWeek})`,
          requirement.classId,
          requirement.subjectId
        ));
      }

      const isAlphaPrimary = classGroup.grade !== null && classGroup.grade >= 1 && classGroup.grade <= 3;
      if (isAlphaPrimary) {
        const soleTeacherId = classGroup.classTeacherId;
        if (
          soleTeacherId === null ||
          change.allocations.length !== 1 ||
          change.allocations[0]?.teacherId !== soleTeacherId ||
          total !== requirement.requiredPeriodsPerWeek
        ) {
          conflicts.push(this.batchConflict(
            'class_policy',
            'Grades 1–3 must allocate every subject completely to the designated class teacher',
            requirement.classId,
            requirement.subjectId
          ));
        }
      }

      for (const allocation of change.allocations) {
        const teacher = teacherById.get(allocation.teacherId)!;
        this.assertMatchingSchoolScope([
          { label: 'class', id: classGroup.id, schoolId: classGroup.schoolId },
          { label: 'subject', id: subject.id, schoolId: subject.schoolId },
          { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
        ]);
        if (!isAlphaPrimary && !capabilityKeys.has(`${teacher.id}:${subject.id}`)) {
          conflicts.push({
            ...this.batchConflict(
              'subject_incompatible',
              `${teacher.fullName} is not primary or allowed for ${subject.name}`,
              requirement.classId,
              requirement.subjectId
            ),
            affectedEntities: {
              classId: requirement.classId,
              subjectId: requirement.subjectId,
              teacherId: teacher.id,
            },
          });
        }
        affectedTeacherIds.add(teacher.id);
      }
      current.forEach((assignment) => affectedTeacherIds.add(assignment.teacherId));
      affectedClassIds.add(requirement.classId);
      if (!isSameState) {
        schoolIds.add(classGroup.schoolId);
        changedRequirementIds.add(requirement.id);
      }
    }

    const unchangedRequirementIds = new Set(requirementIds);
    const desiredLoadByTeacher = new Map<number, number>();
    for (const change of changes) {
      for (const allocation of change.allocations) {
        desiredLoadByTeacher.set(
          allocation.teacherId,
          (desiredLoadByTeacher.get(allocation.teacherId) ?? 0) + allocation.periodsPerWeek
        );
      }
    }
    if (desiredTeacherIds.length) {
      const unaffected = await manager.getRepository(TeachingAssignment)
        .createQueryBuilder('assignment')
        .where('assignment.teacher_id IN (:...teacherIds)', { teacherIds: desiredTeacherIds })
        .andWhere('assignment.is_deleted = 0')
        .andWhere('assignment.class_subject_requirement_id NOT IN (:...requirementIds)', {
          requirementIds: [...unchangedRequirementIds],
        })
        .getMany();
      const unaffectedLoad = new Map<number, number>();
      for (const assignment of unaffected) {
        unaffectedLoad.set(
          assignment.teacherId,
          (unaffectedLoad.get(assignment.teacherId) ?? 0) + assignment.assignedPeriodsPerWeek
        );
      }
      for (const teacherId of desiredTeacherIds) {
        const teacher = teacherById.get(teacherId)!;
        const capacity = await this.calculateEffectiveWeeklyCapacity(teacher);
        const nextLoad = (unaffectedLoad.get(teacherId) ?? 0) + (desiredLoadByTeacher.get(teacherId) ?? 0);
        if (nextLoad > capacity) {
          conflicts.push({
            ...this.batchConflict(
              'workload_exceeded',
              `${teacher.fullName} would exceed schedulable capacity (${nextLoad}/${capacity})`
            ),
            affectedEntities: { teacherId },
          });
        } else if (capacity > 0 && capacity - nextLoad <= NEAR_CAPACITY_THRESHOLD) {
          warnings.push({
            ...this.batchConflict(
              'workload_exceeded',
              `${teacher.fullName} is approaching schedulable capacity (${nextLoad}/${capacity})`
            ),
            severity: 'warning',
            affectedEntities: { teacherId },
          });
        }
      }
    }

    const resultRequirements = changes.map((change) => {
      const requirement = requirementById.get(change.requirementId)!;
      const changed = changedRequirementIds.has(requirement.id);
      return {
        requirementId: requirement.id,
        version: requirement.assignmentVersion + (persist && changed ? 1 : 0),
        changed,
      };
    });

    if (conflicts.length > 0 || !persist) {
      return {
        isValid: conflicts.length === 0,
        conflicts,
        warnings,
        requirements: resultRequirements,
        affectedTeacherIds: [...affectedTeacherIds].sort((a, b) => a - b),
        affectedClassIds: [...affectedClassIds].sort((a, b) => a - b),
      };
    }

    const assignmentRepo = manager.getRepository(TeachingAssignment);
    for (const change of changes) {
      const requirement = requirementById.get(change.requirementId)!;
      if (!changedRequirementIds.has(requirement.id)) continue;
      const classGroup = classById.get(requirement.classId)!;
      const current = existingByRequirement.get(requirement.id) ?? [];
      const desiredByTeacher = new Map(change.allocations.map((item) => [item.teacherId, item]));

      for (const assignment of current) {
        if (!desiredByTeacher.has(assignment.teacherId)) {
          assignment.isDeleted = true;
          assignment.deletedAt = new Date();
          assignment.updatedAt = new Date();
          await assignmentRepo.save(assignment);
        }
      }
      const isAlphaPrimary = classGroup.grade !== null && classGroup.grade >= 1 && classGroup.grade <= 3;
      for (const allocation of change.allocations) {
        const existing = current.find((assignment) => assignment.teacherId === allocation.teacherId)
          ?? await assignmentRepo.findOne({
            where: {
              classSubjectRequirementId: requirement.id,
              teacherId: allocation.teacherId,
            },
          });
        const assignment = existing ?? assignmentRepo.create({
          classSubjectRequirementId: requirement.id,
          teacherId: allocation.teacherId,
        });
        assignment.assignedPeriodsPerWeek = allocation.periodsPerWeek;
        assignment.isFixed = true;
        assignment.source = isAlphaPrimary ? 'single_teacher' : 'manual';
        assignment.isDeleted = false;
        assignment.deletedAt = null;
        assignment.updatedAt = new Date();
        await assignmentRepo.save(assignment);
      }
      requirement.assignmentVersion += 1;
      requirement.updatedAt = new Date();
      await manager.getRepository(ClassSubjectRequirement).save(requirement);
    }

    for (const schoolId of schoolIds) {
      await this.timetableRepository.markStaleForSchool(
        schoolId,
        'ASSIGNMENTS_CHANGED',
        { manager, skipCache: true }
      );
    }

    return {
      isValid: true,
      conflicts: [],
      warnings,
      requirements: resultRequirements,
      affectedTeacherIds: [...affectedTeacherIds].sort((a, b) => a - b),
      affectedClassIds: [...affectedClassIds].sort((a, b) => a - b),
    };
  }

  private batchConflict(
    type: AssignmentConflict['type'],
    message: string,
    classId?: number,
    subjectId?: number
  ): AssignmentConflict {
    return {
      type,
      severity: 'error',
      message,
      messageFa: message,
      affectedEntities: { classId, subjectId },
    };
  }

  async validateAssignment(
    input: {
      teacherId: number;
      subjectId: number;
      classIds: number[];
      classPeriodOverrides?: ClassPeriodOverride[];
      persistRequirementOverrides?: boolean;
    },
    options?: CommandWriteOptions
  ): Promise<ServiceResult<AssignmentValidationResult>> {
    try {
      const teacher = await this.getActiveTeacher(input.teacherId, options?.manager);
      const subject = await this.getActiveSubject(input.subjectId, options?.manager);
      const classPeriodOverrideMap = buildClassPeriodOverrideMap(input.classPeriodOverrides);
      const requirementContexts = await this.loadRequirementContexts(
        input.classIds,
        input.subjectId,
        options?.manager
      );
      this.assertMatchingSchoolScope([
        { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
        { label: 'subject', id: subject.id, schoolId: subject.schoolId },
        ...requirementContexts.map((requirement) => ({
          label: 'class',
          id: requirement.classId,
          schoolId: requirement.schoolId,
        })),
      ]);

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
          plan.nextTeacherPeriodsPerWeek -
          (plan.existingTeacherAssignment?.assignedPeriodsPerWeek ?? 0);
        conflicts.push(...plan.conflicts);
        warnings.push(...plan.warnings);

        if (
          plan.existingTeacherAssignment &&
          plan.otherAssignments.length === 0 &&
          plan.existingTeacherAssignment.assignedPeriodsPerWeek ===
            plan.nextTeacherPeriodsPerWeek &&
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
      const effectiveWeeklyCapacity = await this.calculateEffectiveWeeklyCapacity(teacher);
      if (newWorkload > effectiveWeeklyCapacity) {
        conflicts.push({
          type: 'workload_exceeded',
          severity: 'error',
          message: `Assignment would exceed teacher schedulable capacity (${newWorkload}/${effectiveWeeklyCapacity})`,
          messageFa: `این تخصیص از ظرفیت قابل برنامه‌ریزی معلم بیشتر می‌شود (${newWorkload}/${effectiveWeeklyCapacity})`,
          affectedEntities: { teacherId: teacher.id },
        });
      } else if (
        effectiveWeeklyCapacity > 0 &&
        effectiveWeeklyCapacity - newWorkload <= NEAR_CAPACITY_THRESHOLD
      ) {
        warnings.push({
          type: 'workload_exceeded',
          severity: 'warning',
          message: `Teacher is approaching schedulable capacity (${newWorkload}/${effectiveWeeklyCapacity})`,
          messageFa: `معلم به حداکثر ظرفیت قابل برنامه‌ریزی نزدیک می‌شود (${newWorkload}/${effectiveWeeklyCapacity})`,
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
    void persistRequirementOverrides;
    try {
      const operation = async (manager: EntityManager) => {
        const overrideMap = buildClassPeriodOverrideMap(classPeriodOverrides);
        const changes: AssignmentBatchChangeInput[] = [];
        for (const classId of classIds) {
          const requirement = await this.getRequirementOrThrow(classId, subjectId, manager);
          const current = await this.getCanonicalAssignmentsForRequirement(requirement.id, manager);
          const existing = current.find((assignment) => assignment.teacherId === teacherId);
          const currentlyAssigned = current.reduce(
            (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
            0
          );
          const requested = overrideMap.get(classId) ?? _periodsPerWeek;
          const allocation = requested ?? (requirement.allowSplitAssignment
            ? Math.max(0, requirement.requiredPeriodsPerWeek - currentlyAssigned)
            : requirement.requiredPeriodsPerWeek);
          const allocations = requirement.allowSplitAssignment
            ? [
                ...current
                  .filter((assignment) => assignment.teacherId !== teacherId)
                  .map((assignment) => ({
                    teacherId: assignment.teacherId,
                    periodsPerWeek: assignment.assignedPeriodsPerWeek,
                  })),
                {
                  teacherId,
                  periodsPerWeek: (existing?.assignedPeriodsPerWeek ?? 0) + allocation,
                },
              ]
            : [{ teacherId, periodsPerWeek: requirement.requiredPeriodsPerWeek }];
          changes.push({
            requirementId: requirement.id,
            expectedVersion: requirement.assignmentVersion,
            allocations,
          });
        }
        return this.evaluateBatch(changes, manager, true);
      };
      const batch = options?.manager
        ? await operation(options.manager)
        : await this.serializeBatchWrite(() => this.runTransaction(operation));
      return {
        success: true,
        data: {
          success: batch.isValid,
          conflicts: batch.conflicts,
          warnings: batch.warnings,
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async unassignTeacher(
    teacherId: number,
    subjectId: number,
    classIds: number[],
    options?: CommandWriteOptions
  ): Promise<ServiceResult<AssignmentOperationResult>> {
    try {
      const operation = async (manager: EntityManager) => {
        const changes: AssignmentBatchChangeInput[] = [];
        for (const classId of classIds) {
          const requirement = await this.getRequirementOrThrow(classId, subjectId, manager);
          const current = await this.getCanonicalAssignmentsForRequirement(requirement.id, manager);
          changes.push({
            requirementId: requirement.id,
            expectedVersion: requirement.assignmentVersion,
            allocations: current
              .filter((assignment) => assignment.teacherId !== teacherId)
              .map((assignment) => ({
                teacherId: assignment.teacherId,
                periodsPerWeek: assignment.assignedPeriodsPerWeek,
              })),
          });
        }
        return this.evaluateBatch(changes, manager, true);
      };
      const batch = options?.manager
        ? await operation(options.manager)
        : await this.serializeBatchWrite(() => this.runTransaction(operation));
      return {
        success: true,
        data: {
          success: batch.isValid,
          conflicts: batch.conflicts,
          warnings: batch.warnings,
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Atomically change a subject capability and remove dependent assignments when requested. */
  async updateTeacherCapability(input: {
    teacherId: number;
    subjectId: number;
    capabilityLevel: 'primary' | 'allowed' | null;
    removeAssignments: boolean;
  }): Promise<ServiceResult<{ teacherId: number; subjectId: number; capabilityLevel: 'primary' | 'allowed' | null }>> {
    try {
      const data = await this.runTransaction(async (manager) => {
        const teacher = await this.getActiveTeacher(input.teacherId, manager);
        const subject = await this.getActiveSubject(input.subjectId, manager);
        this.assertMatchingSchoolScope([
          { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
          { label: 'subject', id: subject.id, schoolId: subject.schoolId },
        ]);

        const rows = (await manager
          .getRepository(TeachingAssignment)
          .createQueryBuilder('assignment')
          .innerJoin(
            'class_subject_requirement',
            'requirement',
            'requirement.id = assignment.class_subject_requirement_id AND requirement.is_deleted = 0'
          )
          .innerJoin(
            'class_group',
            'classGroup',
            'classGroup.id = requirement.class_id AND classGroup.isDeleted = 0'
          )
          .select('requirement.class_id', 'classId')
          .where('assignment.teacher_id = :teacherId', { teacherId: input.teacherId })
          .andWhere('requirement.subject_id = :subjectId', { subjectId: input.subjectId })
          .andWhere('(classGroup.grade IS NULL OR classGroup.grade < 1 OR classGroup.grade > 3)')
          .andWhere('assignment.is_deleted = 0')
          .getRawMany()) as Array<{ classId: number | string }>;
        const classIds = [...new Set(rows.map((row) => Number(row.classId)))];

        if (input.capabilityLevel === null && classIds.length > 0) {
          if (!input.removeAssignments) {
            throw new Error('Capability has active assignments; removeAssignments must be true');
          }
          const result = await this.unassignTeacher(
            input.teacherId,
            input.subjectId,
            classIds,
            { manager }
          );
          if (!result.success || !result.data?.success) {
            throw new Error(result.error ?? 'Failed to remove dependent assignments');
          }
        }

        const capabilities = await this.capabilityService.getCapabilities(input.teacherId, {
          manager,
        });
        const primarySubjectIds = capabilities
          .filter((capability) => capability.capabilityLevel === 'primary')
          .map((capability) => capability.subjectId)
          .filter((subjectId) => subjectId !== input.subjectId);
        const allowedSubjectIds = capabilities
          .filter((capability) => capability.capabilityLevel === 'allowed')
          .map((capability) => capability.subjectId)
          .filter((subjectId) => subjectId !== input.subjectId);
        if (input.capabilityLevel === 'primary') primarySubjectIds.push(input.subjectId);
        if (input.capabilityLevel === 'allowed') allowedSubjectIds.push(input.subjectId);

        await this.capabilityService.syncTeacherCapabilities(
          input.teacherId,
          { primarySubjectIds, allowedSubjectIds },
          { manager }
        );
        return {
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          capabilityLevel: input.capabilityLevel,
        };
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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
        throw new Error('Assignment already exists for this teacher-class-subject combination');
      }

      await this.capabilityService.ensureCapability(input.teacherId, input.subjectId, 'allowed', {
        manager,
      });

      const activeAssignments = await this.getCanonicalAssignmentsForRequirement(
        requirement.id,
        manager
      );
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

    return this.runTransaction(operation);
  }

  async bulkCreateLegacyAssignments(inputs: TeacherClassSubjectAssignmentInput[]) {
    return this.runTransaction(async (manager) => {
      const created = [];
      for (const input of inputs) {
        created.push(await this.createLegacyAssignment(input, { manager }));
      }
      return created;
    });
  }

  async updateLegacyAssignment(id: number, input: Partial<TeacherClassSubjectAssignmentInput>) {
    return this.runTransaction(async (manager) => {
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
            !(
              assignment.teacherId === previousTeacherId &&
              nextClassId === previousClassId &&
              nextSubjectId === previousSubjectId
            )
        )
        .reduce((sum, assignment) => sum + assignment.assignedPeriodsPerWeek, 0);

      if (!nextRequirement.allowSplitAssignment && assignedByOthers > 0) {
        throw new Error('Split assignment is disabled for this class-subject requirement');
      }
      if (assignedByOthers + nextPeriodsPerWeek > nextRequirement.requiredPeriodsPerWeek) {
        throw new Error('Assignment exceeds the remaining required periods for this class-subject');
      }

      if (
        previousClassId !== nextClassId ||
        previousSubjectId !== nextSubjectId ||
        previousTeacherId !== nextTeacherId
      ) {
        const previousRequirement = await this.getRequirementOrThrow(
          previousClassId,
          previousSubjectId,
          manager
        );
        const previousCanonicalAssignment = await manager
          .getRepository(TeachingAssignment)
          .findOne({
            where: {
              classSubjectRequirementId: previousRequirement.id,
              teacherId: previousTeacherId,
              isDeleted: false,
            },
          });
        if (previousCanonicalAssignment) {
          await this.softDeleteCanonicalAssignment(
            previousCanonicalAssignment,
            previousRequirement,
            manager
          );
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
    return this.runTransaction(async (manager) => {
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
    const requirement = await this.requirementService.getRequirementByClassAndSubject(
      classId,
      subjectId
    );
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

    await this.runTransaction(operation);
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
            throw new Error(
              result.error ?? 'Failed to sync class assignment from legacy requirement'
            );
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

    await this.runTransaction(operation);
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

    await this.runTransaction(operation);
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

  private async calculateEffectiveWeeklyCapacity(teacher: ParsedTeacher): Promise<number> {
    const config = await this.schoolConfigService.getConfig(teacher.schoolId);
    const unavailable = new Set(
      teacher.unavailable.map((slot) => `${slot.day.toLowerCase()}:${slot.period}`)
    );
    let calendarCapacity = 0;
    for (const day of config.daysOfWeek) {
      const periods = config.dynamicPeriodsEnabled
        ? (config.periodsPerDayMap[day] ?? config.defaultPeriodsPerDay)
        : config.defaultPeriodsPerDay;
      const available = Array.from(
        { length: periods },
        (_, period) => !unavailable.has(`${day.toLowerCase()}:${period}`)
      );
      let consecutiveCapacity = 0;
      let segmentLength = 0;
      const consecutiveLimit = teacher.maxConsecutivePeriods;
      for (const isAvailable of [...available, false]) {
        if (isAvailable) {
          segmentLength += 1;
          continue;
        }
        consecutiveCapacity += consecutiveLimit > 0
          ? segmentLength - Math.floor(segmentLength / (consecutiveLimit + 1))
          : segmentLength;
        segmentLength = 0;
      }
      calendarCapacity += Math.min(
        available.filter(Boolean).length,
        teacher.maxPeriodsPerDay > 0
          ? teacher.maxPeriodsPerDay
          : available.filter(Boolean).length,
        consecutiveCapacity
      );
    }
    return Math.min(teacher.maxPeriodsPerWeek, calendarCapacity);
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
    this.assertMatchingSchoolScope([
      { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
      { label: 'class', id: classGroup.id, schoolId: classGroup.schoolId },
      { label: 'subject', id: subject.id, schoolId: subject.schoolId },
    ]);
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
        assignmentVersion: requirement.assignmentVersion,
        classId: requirement.classId,
        className: classGroup.displayName || classGroup.name,
        subjectId: requirement.subjectId,
        requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
        allowSplitAssignment: requirement.allowSplitAssignment,
        schoolId: classGroup.schoolId,
      });
    }

    return contexts;
  }

  private assertMatchingSchoolScope(
    rows: Array<{ label: string; id: number; schoolId: number | null }>
  ): void {
    if (rows.length < 2) return;
    const expected = rows[0].schoolId;
    const conflict = rows.find((row) => row.schoolId !== expected);
    if (conflict) {
      throw new Error(
        `School scope conflict: ${rows[0].label} ${rows[0].id} and ${conflict.label} ${conflict.id} do not belong to the same school`
      );
    }
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
      assignmentVersion: requirement.assignmentVersion,
      classId: requirement.classId,
      className: classGroup.displayName || classGroup.name,
      subjectId: requirement.subjectId,
      requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
      allowSplitAssignment: requirement.allowSplitAssignment,
      schoolId: classGroup.schoolId,
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

    const activeAssignments = await this.getCanonicalAssignmentsForRequirement(
      requirement.id,
      manager
    );
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
      } else if (
        assignedByOthers + nextTeacherPeriodsPerWeek >
        requirement.requiredPeriodsPerWeek
      ) {
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
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
