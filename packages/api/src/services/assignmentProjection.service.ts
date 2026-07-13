import { DataSource, EntityManager, In } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { ClassGroup } from '../entity/ClassGroup';
import { Subject } from '../entity/Subject';
import {
  TeacherCapabilityLevel,
  TeacherSubjectCapability,
} from '../entity/TeacherSubjectCapability';
import { Teacher } from '../entity/Teacher';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import type {
  AssignmentConflict,
  SubjectCoverage,
  TeacherCoverageDetail,
  TeacherWorkload,
  WorkloadBreakdown,
  WorkloadStatus,
} from './assignment.types';

export type ProjectionCapabilityLevel = TeacherCapabilityLevel | 'incompatible';

export interface ProjectionWarningSummary {
  code:
    | 'missing_capability'
    | 'remaining_unassigned_periods'
    | 'over_assigned_periods'
    | 'split_assignment_disabled'
    | 'teacher_over_capacity';
  severity: 'warning' | 'error';
  message: string;
}

export interface ProjectionAssignmentSummary {
  assignmentId: number;
  teacherId: number;
  teacherName: string;
  assignedPeriodsPerWeek: number;
  isFixed: boolean;
  source: string;
  capabilityLevel: ProjectionCapabilityLevel;
}

export interface ProjectionRequirementSummary {
  requirementId: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  requiredPeriodsPerWeek: number;
  assignedPeriodsPerWeek: number;
  remainingPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
}

export interface ProjectionRequirementView extends ProjectionRequirementSummary {
  assignments: ProjectionAssignmentSummary[];
  warnings: ProjectionWarningSummary[];
}

export interface AssignmentMatrixClassView {
  classId: number;
  className: string;
  requirements: ProjectionRequirementView[];
}

export interface AssignmentMatrixView {
  generatedAt: string;
  classes: AssignmentMatrixClassView[];
}

export interface ClassAssignmentView {
  classId: number;
  className: string;
  classTeacherId: number | null;
  classTeacherName: string | null;
  requirements: ProjectionRequirementView[];
}

export interface SubjectCoverageView {
  subjectId: number;
  subjectName: string;
  coverage: ProjectionRequirementView[];
}

export interface TeacherWorkloadViewCapability {
  subjectId: number;
  subjectName: string;
  capabilityLevel: TeacherCapabilityLevel;
}

export interface TeacherWorkloadViewAssignment {
  assignmentId: number;
  requirementId: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  assignedPeriodsPerWeek: number;
  isFixed: boolean;
  source: string;
  warnings: ProjectionWarningSummary[];
}

export interface TeacherWorkloadView {
  teacherId: number;
  teacherName: string;
  maxPeriodsPerWeek: number;
  assignedPeriodsPerWeek: number;
  remainingCapacityPerWeek: number;
  capabilities: TeacherWorkloadViewCapability[];
  assignments: TeacherWorkloadViewAssignment[];
}

export interface TeacherAssignmentSummaryView {
  teacherId: number;
  teacherName: string;
  subjectLoad: Array<{
    subjectId: number;
    subjectName: string;
    classCount: number;
    assignedPeriodsPerWeek: number;
  }>;
  totals: {
    classCount: number;
    assignedPeriodsPerWeek: number;
  };
  warnings: ProjectionWarningSummary[];
}

interface ProjectionSnapshot {
  classById: Map<number, ClassGroup>;
  subjectById: Map<number, Subject>;
  teacherById: Map<number, Teacher>;
  requirementById: Map<number, ClassSubjectRequirement>;
  requirementsByClass: Map<number, ClassSubjectRequirement[]>;
  requirementsBySubject: Map<number, ClassSubjectRequirement[]>;
  assignmentsByRequirement: Map<number, TeachingAssignment[]>;
  assignmentsByTeacher: Map<number, TeachingAssignment[]>;
  capabilitiesByTeacherSubject: Map<string, TeacherSubjectCapability>;
}

const NEAR_CAPACITY_THRESHOLD = 5;

export class AssignmentProjectionService {
  private constructor(
    private readonly dataSource: DataSource,
    _cacheManager?: CacheManager
  ) {}

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): AssignmentProjectionService {
    return getDataSourceScopedInstance(
      dataSource,
      AssignmentProjectionService,
      () => new AssignmentProjectionService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(AssignmentProjectionService);
  }

  async getAssignmentMatrix(): Promise<ServiceResult<AssignmentMatrixView>> {
    try {
      const snapshot = await this.loadFullSnapshot();
      const classes = Array.from(snapshot.classById.values())
        .sort(compareClasses)
        .map((classGroup) => ({
          classId: classGroup.id,
          className: getClassName(classGroup),
          requirements: this.buildRequirementViews(
            snapshot.requirementsByClass.get(classGroup.id) ?? [],
            snapshot
          ),
        }));

      return {
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          classes,
        },
      };
    } catch (error) {
      logger.error(
        'AssignmentProjectionService: Failed to build assignment matrix',
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getClassAssignmentView(classId: number): Promise<ServiceResult<ClassAssignmentView>> {
    try {
      const manager = this.dataSource.manager;
      const classGroup = await manager.getRepository(ClassGroup).findOne({
        where: { id: classId, isDeleted: false },
      });

      if (!classGroup) {
        return { success: false, error: `Class with ID ${classId} not found` };
      }

      const requirements = await manager.getRepository(ClassSubjectRequirement).find({
        where: { classId, isDeleted: false },
        order: { subjectId: 'ASC' },
      });
      const requirementIds = requirements.map((requirement) => requirement.id);
      const assignments = requirementIds.length
        ? await manager.getRepository(TeachingAssignment).find({
            where: { classSubjectRequirementId: In(requirementIds), isDeleted: false },
            order: { teacherId: 'ASC' },
          })
        : [];
      const subjectIds = uniqueNumbers(requirements.map((requirement) => requirement.subjectId));
      const teacherIds = uniqueNumbers([
        ...assignments.map((assignment) => assignment.teacherId),
        ...(classGroup.classTeacherId ? [classGroup.classTeacherId] : []),
      ]);

      const [subjects, teachers, capabilities] = await Promise.all([
        subjectIds.length
          ? manager.getRepository(Subject).find({
              where: { id: In(subjectIds), isDeleted: false },
            })
          : Promise.resolve([]),
        teacherIds.length
          ? manager.getRepository(Teacher).find({
              where: { id: In(teacherIds), isDeleted: false },
            })
          : Promise.resolve([]),
        teacherIds.length
          ? manager.getRepository(TeacherSubjectCapability).find({
              where: { teacherId: In(teacherIds), isDeleted: false },
            })
          : Promise.resolve([]),
      ]);

      const snapshot = buildProjectionSnapshot({
        classes: [classGroup],
        subjects,
        teachers,
        requirements,
        assignments,
        capabilities,
      });

      return {
        success: true,
        data: {
          classId: classGroup.id,
          className: getClassName(classGroup),
          classTeacherId: classGroup.classTeacherId ?? null,
          classTeacherName: classGroup.classTeacherId
            ? (snapshot.teacherById.get(classGroup.classTeacherId)?.fullName ?? null)
            : null,
          requirements: this.buildRequirementViews(requirements, snapshot),
        },
      };
    } catch (error) {
      logger.error(
        'AssignmentProjectionService: Failed to build class assignment view',
        error instanceof Error ? error : new Error(String(error)),
        { classId }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getSubjectCoverageView(subjectId: number): Promise<ServiceResult<SubjectCoverageView>> {
    try {
      const manager = this.dataSource.manager;
      const subject = await manager.getRepository(Subject).findOne({
        where: { id: subjectId, isDeleted: false },
      });

      if (!subject) {
        return { success: false, error: `Subject with ID ${subjectId} not found` };
      }

      const requirements = await manager.getRepository(ClassSubjectRequirement).find({
        where: { subjectId, isDeleted: false },
        order: { classId: 'ASC' },
      });
      const requirementIds = requirements.map((requirement) => requirement.id);
      const assignments = requirementIds.length
        ? await manager.getRepository(TeachingAssignment).find({
            where: { classSubjectRequirementId: In(requirementIds), isDeleted: false },
            order: { teacherId: 'ASC' },
          })
        : [];
      const classIds = uniqueNumbers(requirements.map((requirement) => requirement.classId));
      const teacherIds = uniqueNumbers(assignments.map((assignment) => assignment.teacherId));

      const [classes, teachers, capabilities] = await Promise.all([
        classIds.length
          ? manager.getRepository(ClassGroup).find({
              where: { id: In(classIds), isDeleted: false },
            })
          : Promise.resolve([]),
        teacherIds.length
          ? manager.getRepository(Teacher).find({
              where: { id: In(teacherIds), isDeleted: false },
            })
          : Promise.resolve([]),
        teacherIds.length
          ? manager.getRepository(TeacherSubjectCapability).find({
              where: { teacherId: In(teacherIds), isDeleted: false },
            })
          : Promise.resolve([]),
      ]);

      const snapshot = buildProjectionSnapshot({
        classes,
        subjects: [subject],
        teachers,
        requirements,
        assignments,
        capabilities,
      });

      return {
        success: true,
        data: {
          subjectId: subject.id,
          subjectName: subject.name,
          coverage: this.buildRequirementViews(requirements, snapshot),
        },
      };
    } catch (error) {
      logger.error(
        'AssignmentProjectionService: Failed to build subject coverage view',
        error instanceof Error ? error : new Error(String(error)),
        { subjectId }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTeacherWorkloadView(teacherId: number): Promise<ServiceResult<TeacherWorkloadView>> {
    try {
      const snapshot = await this.loadTeacherSnapshot(teacherId);
      const teacher = snapshot.teacherById.get(teacherId);

      if (!teacher) {
        return { success: false, error: `Teacher with ID ${teacherId} not found` };
      }

      const teacherAssignments = (snapshot.assignmentsByTeacher.get(teacherId) ?? []).sort(
        compareAssignments
      );
      const assignedPeriodsPerWeek = teacherAssignments.reduce(
        (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
        0
      );
      const capabilities = Array.from(snapshot.capabilitiesByTeacherSubject.values())
        .filter((capability) => capability.teacherId === teacherId)
        .sort((left, right) => {
          const leftName =
            snapshot.subjectById.get(left.subjectId)?.name ?? `Subject ${left.subjectId}`;
          const rightName =
            snapshot.subjectById.get(right.subjectId)?.name ?? `Subject ${right.subjectId}`;
          return leftName.localeCompare(rightName) || left.subjectId - right.subjectId;
        })
        .map((capability) => ({
          subjectId: capability.subjectId,
          subjectName:
            snapshot.subjectById.get(capability.subjectId)?.name ??
            `Subject ${capability.subjectId}`,
          capabilityLevel: capability.capabilityLevel,
        }));

      const assignments = teacherAssignments.flatMap((assignment) => {
        const requirement = snapshot.requirementById.get(assignment.classSubjectRequirementId);
        if (!requirement) {
          return [];
        }

        return [
          {
            assignmentId: assignment.id,
            requirementId: requirement.id,
            classId: requirement.classId,
            className:
              getClassName(snapshot.classById.get(requirement.classId)) ||
              `Class ${requirement.classId}`,
            subjectId: requirement.subjectId,
            subjectName:
              snapshot.subjectById.get(requirement.subjectId)?.name ??
              `Subject ${requirement.subjectId}`,
            assignedPeriodsPerWeek: assignment.assignedPeriodsPerWeek,
            isFixed: assignment.isFixed,
            source: assignment.source,
            warnings: this.buildAssignmentWarnings(assignment, requirement, snapshot),
          },
        ];
      });

      return {
        success: true,
        data: {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
          assignedPeriodsPerWeek,
          remainingCapacityPerWeek: teacher.maxPeriodsPerWeek - assignedPeriodsPerWeek,
          capabilities,
          assignments,
        },
      };
    } catch (error) {
      logger.error(
        'AssignmentProjectionService: Failed to build teacher workload view',
        error instanceof Error ? error : new Error(String(error)),
        { teacherId }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTeacherAssignmentSummary(
    teacherId: number
  ): Promise<ServiceResult<TeacherAssignmentSummaryView>> {
    const workloadViewResult = await this.getTeacherWorkloadView(teacherId);
    if (!workloadViewResult.success || !workloadViewResult.data) {
      return { success: false, error: workloadViewResult.error };
    }

    const workloadView = workloadViewResult.data;
    const subjectLoadMap = new Map<
      number,
      { subjectName: string; classIds: Set<number>; assignedPeriodsPerWeek: number }
    >();

    for (const assignment of workloadView.assignments) {
      const existing = subjectLoadMap.get(assignment.subjectId) ?? {
        subjectName: assignment.subjectName,
        classIds: new Set<number>(),
        assignedPeriodsPerWeek: 0,
      };
      existing.classIds.add(assignment.classId);
      existing.assignedPeriodsPerWeek += assignment.assignedPeriodsPerWeek;
      subjectLoadMap.set(assignment.subjectId, existing);
    }

    const subjectLoad = Array.from(subjectLoadMap.entries())
      .sort((left, right) => left[1].subjectName.localeCompare(right[1].subjectName))
      .map(([subjectId, entry]) => ({
        subjectId,
        subjectName: entry.subjectName,
        classCount: entry.classIds.size,
        assignedPeriodsPerWeek: entry.assignedPeriodsPerWeek,
      }));

    const warnings = dedupeWarnings([
      ...this.buildTeacherCapacityWarnings(
        workloadView.teacherName,
        workloadView.maxPeriodsPerWeek,
        workloadView.assignedPeriodsPerWeek
      ),
      ...workloadView.assignments.flatMap((assignment) => assignment.warnings),
    ]);

    return {
      success: true,
      data: {
        teacherId: workloadView.teacherId,
        teacherName: workloadView.teacherName,
        subjectLoad,
        totals: {
          classCount: new Set(workloadView.assignments.map((assignment) => assignment.classId))
            .size,
          assignedPeriodsPerWeek: workloadView.assignedPeriodsPerWeek,
        },
        warnings,
      },
    };
  }

  async calculateTeacherWorkload(teacherId: number): Promise<ServiceResult<TeacherWorkload>> {
    const workloadViewResult = await this.getTeacherWorkloadView(teacherId);
    if (!workloadViewResult.success || !workloadViewResult.data) {
      return { success: false, error: workloadViewResult.error };
    }

    const workloadView = workloadViewResult.data;
    const breakdownMap = new Map<
      number,
      { subjectName: string; classIds: number[]; periods: number[]; totalPeriods: number }
    >();

    for (const assignment of workloadView.assignments) {
      const existing = breakdownMap.get(assignment.subjectId) ?? {
        subjectName: assignment.subjectName,
        classIds: [],
        periods: [],
        totalPeriods: 0,
      };
      existing.classIds.push(assignment.classId);
      existing.periods.push(assignment.assignedPeriodsPerWeek);
      existing.totalPeriods += assignment.assignedPeriodsPerWeek;
      breakdownMap.set(assignment.subjectId, existing);
    }

    const breakdown: WorkloadBreakdown[] = Array.from(breakdownMap.entries())
      .sort((left, right) => left[1].subjectName.localeCompare(right[1].subjectName))
      .map(([subjectId, entry]) => ({
        subjectId,
        subjectName: entry.subjectName,
        classIds: entry.classIds,
        periodsPerWeek: entry.periods[0] ?? 0,
        totalPeriods: entry.totalPeriods,
      }));

    const utilizationPercentage =
      workloadView.maxPeriodsPerWeek > 0
        ? (workloadView.assignedPeriodsPerWeek / workloadView.maxPeriodsPerWeek) * 100
        : 0;

    return {
      success: true,
      data: {
        teacherId: workloadView.teacherId,
        totalPeriods: workloadView.assignedPeriodsPerWeek,
        maxPeriods: workloadView.maxPeriodsPerWeek,
        utilizationPercentage,
        breakdown,
        status: determineWorkloadStatus(
          workloadView.assignedPeriodsPerWeek,
          workloadView.maxPeriodsPerWeek
        ),
        remainingCapacity: workloadView.remainingCapacityPerWeek,
      },
    };
  }

  async calculateSubjectCoverage(subjectId: number): Promise<ServiceResult<SubjectCoverage>> {
    const coverageViewResult = await this.getSubjectCoverageView(subjectId);
    if (!coverageViewResult.success || !coverageViewResult.data) {
      return { success: false, error: coverageViewResult.error };
    }

    const coverageView = coverageViewResult.data;
    const unassignedClasses = coverageView.coverage
      .filter((requirement) => requirement.assignments.length === 0)
      .map((requirement) => ({
        classId: requirement.classId,
        className: requirement.className,
        periodsPerWeek: requirement.requiredPeriodsPerWeek,
        assignmentStatus: 'unassigned' as const,
        assignedTeacherId: null,
        assignedTeacherName: null,
        conflicts: [],
      }));

    const teacherDistributionMap = new Map<
      number,
      {
        teacherName: string;
        assignedClassIds: number[];
        totalPeriods: number;
        compatibility: ProjectionCapabilityLevel;
      }
    >();

    for (const requirement of coverageView.coverage) {
      for (const assignment of requirement.assignments) {
        const existing = teacherDistributionMap.get(assignment.teacherId) ?? {
          teacherName: assignment.teacherName,
          assignedClassIds: [],
          totalPeriods: 0,
          compatibility: assignment.capabilityLevel,
        };
        existing.assignedClassIds.push(requirement.classId);
        existing.totalPeriods += assignment.assignedPeriodsPerWeek;
        existing.compatibility = assignment.capabilityLevel;
        teacherDistributionMap.set(assignment.teacherId, existing);
      }
    }

    const teacherDistribution: TeacherCoverageDetail[] = Array.from(
      teacherDistributionMap.entries()
    )
      .sort((left, right) => left[1].teacherName.localeCompare(right[1].teacherName))
      .map(([teacherId, entry]) => ({
        teacherId,
        teacherName: entry.teacherName,
        assignedClassIds: entry.assignedClassIds,
        totalPeriods: entry.totalPeriods,
        compatibility: entry.compatibility,
      }));

    const totalClassesRequiring = coverageView.coverage.length;
    const assignedClasses = coverageView.coverage.filter(
      (requirement) => requirement.assignments.length > 0
    ).length;
    const coveragePercentage =
      totalClassesRequiring > 0 ? (assignedClasses / totalClassesRequiring) * 100 : 100;

    return {
      success: true,
      data: {
        subjectId: coverageView.subjectId,
        subjectName: coverageView.subjectName,
        totalClassesRequiring,
        assignedClasses,
        unassignedClasses,
        teacherDistribution,
        coveragePercentage,
        status:
          coveragePercentage === 100
            ? 'complete'
            : coveragePercentage > 0
              ? 'partial'
              : 'uncovered',
      },
    };
  }

  async detectAllConflicts(): Promise<ServiceResult<AssignmentConflict[]>> {
    try {
      const snapshot = await this.loadFullSnapshot();
      const conflicts: AssignmentConflict[] = [];

      for (const teacher of snapshot.teacherById.values()) {
        const teacherAssignments = snapshot.assignmentsByTeacher.get(teacher.id) ?? [];
        const assignedPeriodsPerWeek = teacherAssignments.reduce(
          (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
          0
        );

        if (assignedPeriodsPerWeek > teacher.maxPeriodsPerWeek) {
          conflicts.push({
            type: 'workload_exceeded',
            severity: 'error',
            message: `Teacher "${teacher.fullName}" is overloaded (${assignedPeriodsPerWeek}/${teacher.maxPeriodsPerWeek})`,
            messageFa: `معلم "${teacher.fullName}" بیش از ظرفیت تعیین‌شده بار دارد (${assignedPeriodsPerWeek}/${teacher.maxPeriodsPerWeek})`,
            affectedEntities: { teacherId: teacher.id },
            suggestedResolution: 'Reduce assigned periods or increase the weekly capacity',
            suggestedResolutionFa: 'ساعات تخصیص‌یافته را کاهش دهید یا ظرفیت هفتگی را افزایش دهید',
          });
        }
      }

      for (const requirement of snapshot.requirementById.values()) {
        const subject = snapshot.subjectById.get(requirement.subjectId);
        const classGroup = snapshot.classById.get(requirement.classId);
        const assignments = snapshot.assignmentsByRequirement.get(requirement.id) ?? [];
        const assignedPeriodsPerWeek = assignments.reduce(
          (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
          0
        );
        const remainingPeriodsPerWeek = requirement.requiredPeriodsPerWeek - assignedPeriodsPerWeek;

        if (remainingPeriodsPerWeek > 0) {
          conflicts.push({
            type: 'coverage_insufficient',
            severity: 'warning',
            message: `Subject "${subject?.name ?? requirement.subjectId}" in class "${getClassName(classGroup) || requirement.classId}" is missing ${remainingPeriodsPerWeek} periods`,
            messageFa: `مضمون "${subject?.name ?? requirement.subjectId}" در صنف "${getClassName(classGroup) || requirement.classId}" هنوز ${remainingPeriodsPerWeek} ساعت بدون تخصیص دارد`,
            affectedEntities: {
              classId: requirement.classId,
              subjectId: requirement.subjectId,
            },
            suggestedResolution: 'Assign more periods to complete the requirement',
            suggestedResolutionFa: 'برای تکمیل نیاز، ساعات بیشتری تخصیص دهید',
          });
        }

        if (
          remainingPeriodsPerWeek < 0 ||
          (!requirement.allowSplitAssignment && assignments.length > 1)
        ) {
          conflicts.push({
            type: 'duplicate_assignment',
            severity: 'error',
            message: `Subject "${subject?.name ?? requirement.subjectId}" in class "${getClassName(classGroup) || requirement.classId}" has conflicting teacher assignments`,
            messageFa: `برای مضمون "${subject?.name ?? requirement.subjectId}" در صنف "${getClassName(classGroup) || requirement.classId}" تخصیص معلمان با هم تعارض دارد`,
            affectedEntities: {
              classId: requirement.classId,
              subjectId: requirement.subjectId,
            },
            suggestedResolution: 'Keep assignments within the required periods and split rules',
            suggestedResolutionFa: 'تخصیص‌ها را مطابق ساعات موردنیاز و قانون تقسیم نگه دارید',
          });
        }

        for (const assignment of assignments) {
          const capability = snapshot.capabilitiesByTeacherSubject.get(
            capabilityKey(assignment.teacherId, requirement.subjectId)
          );
          if (!capability) {
            const teacher = snapshot.teacherById.get(assignment.teacherId);
            conflicts.push({
              type: 'subject_incompatible',
              severity: 'warning',
              message: `Teacher "${teacher?.fullName ?? assignment.teacherId}" is assigned without an active capability for "${subject?.name ?? requirement.subjectId}"`,
              messageFa: `معلم "${teacher?.fullName ?? assignment.teacherId}" بدون صلاحیت فعال برای "${subject?.name ?? requirement.subjectId}" تخصیص شده است`,
              affectedEntities: {
                teacherId: assignment.teacherId,
                subjectId: requirement.subjectId,
                classId: requirement.classId,
              },
              suggestedResolution:
                'Create or restore the missing capability row for this teacher-subject pair',
              suggestedResolutionFa: 'ردیف صلاحیت معلم برای این مضمون را ایجاد یا دوباره فعال کنید',
            });
          }
        }
      }

      return {
        success: true,
        data: conflicts,
      };
    } catch (error) {
      logger.error(
        'AssignmentProjectionService: Failed to detect canonical assignment conflicts',
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async loadFullSnapshot(manager?: EntityManager): Promise<ProjectionSnapshot> {
    const currentManager = manager ?? this.dataSource.manager;
    const [classes, subjects, teachers, requirements, assignments, capabilities] =
      await Promise.all([
        currentManager.getRepository(ClassGroup).find({
          where: { isDeleted: false },
        }),
        currentManager.getRepository(Subject).find({
          where: { isDeleted: false },
        }),
        currentManager.getRepository(Teacher).find({
          where: { isDeleted: false },
        }),
        currentManager.getRepository(ClassSubjectRequirement).find({
          where: { isDeleted: false },
        }),
        currentManager.getRepository(TeachingAssignment).find({
          where: { isDeleted: false },
        }),
        currentManager.getRepository(TeacherSubjectCapability).find({
          where: { isDeleted: false },
        }),
      ]);

    return buildProjectionSnapshot({
      classes,
      subjects,
      teachers,
      requirements,
      assignments,
      capabilities,
    });
  }

  private async loadTeacherSnapshot(teacherId: number): Promise<ProjectionSnapshot> {
    const manager = this.dataSource.manager;
    const teacher = await manager.getRepository(Teacher).findOne({
      where: { id: teacherId, isDeleted: false },
    });

    if (!teacher) {
      return buildProjectionSnapshot({
        classes: [],
        subjects: [],
        teachers: [],
        requirements: [],
        assignments: [],
        capabilities: [],
      });
    }

    const assignments = await manager.getRepository(TeachingAssignment).find({
      where: { teacherId, isDeleted: false },
      order: { classSubjectRequirementId: 'ASC' },
    });
    const requirementIds = uniqueNumbers(
      assignments.map((assignment) => assignment.classSubjectRequirementId)
    );
    const requirements = requirementIds.length
      ? await manager.getRepository(ClassSubjectRequirement).find({
          where: { id: In(requirementIds), isDeleted: false },
        })
      : [];
    const capabilities = await manager.getRepository(TeacherSubjectCapability).find({
      where: { teacherId, isDeleted: false },
    });
    const classIds = uniqueNumbers(requirements.map((requirement) => requirement.classId));
    const subjectIds = uniqueNumbers([
      ...requirements.map((requirement) => requirement.subjectId),
      ...capabilities.map((capability) => capability.subjectId),
    ]);
    const [classes, subjects] = await Promise.all([
      classIds.length
        ? manager.getRepository(ClassGroup).find({
            where: { id: In(classIds), isDeleted: false },
          })
        : Promise.resolve([]),
      subjectIds.length
        ? manager.getRepository(Subject).find({
            where: { id: In(subjectIds), isDeleted: false },
          })
        : Promise.resolve([]),
    ]);

    return buildProjectionSnapshot({
      classes,
      subjects,
      teachers: [teacher],
      requirements,
      assignments,
      capabilities,
    });
  }

  private buildRequirementViews(
    requirements: ClassSubjectRequirement[],
    snapshot: ProjectionSnapshot
  ): ProjectionRequirementView[] {
    return requirements
      .slice()
      .sort(compareRequirements)
      .map((requirement) => this.buildRequirementView(requirement, snapshot));
  }

  private buildRequirementView(
    requirement: ClassSubjectRequirement,
    snapshot: ProjectionSnapshot
  ): ProjectionRequirementView {
    const classGroup = snapshot.classById.get(requirement.classId);
    const subject = snapshot.subjectById.get(requirement.subjectId);
    const assignments = (snapshot.assignmentsByRequirement.get(requirement.id) ?? [])
      .slice()
      .sort(compareAssignments);
    const assignedPeriodsPerWeek = assignments.reduce(
      (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
      0
    );
    const remainingPeriodsPerWeek = requirement.requiredPeriodsPerWeek - assignedPeriodsPerWeek;

    return {
      requirementId: requirement.id,
      classId: requirement.classId,
      className: getClassName(classGroup) || `Class ${requirement.classId}`,
      subjectId: requirement.subjectId,
      subjectName: subject?.name ?? `Subject ${requirement.subjectId}`,
      requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
      assignedPeriodsPerWeek,
      remainingPeriodsPerWeek,
      allowSplitAssignment: requirement.allowSplitAssignment,
      assignments: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        teacherId: assignment.teacherId,
        teacherName:
          snapshot.teacherById.get(assignment.teacherId)?.fullName ??
          `Teacher ${assignment.teacherId}`,
        assignedPeriodsPerWeek: assignment.assignedPeriodsPerWeek,
        isFixed: assignment.isFixed,
        source: assignment.source,
        capabilityLevel: getCapabilityLevel(
          snapshot.capabilitiesByTeacherSubject,
          assignment.teacherId,
          requirement.subjectId
        ),
      })),
      warnings: this.buildRequirementWarnings(requirement, assignments, snapshot),
    };
  }

  private buildRequirementWarnings(
    requirement: ClassSubjectRequirement,
    assignments: TeachingAssignment[],
    snapshot: ProjectionSnapshot
  ): ProjectionWarningSummary[] {
    const warnings: ProjectionWarningSummary[] = [];
    const assignedPeriodsPerWeek = assignments.reduce(
      (sum, assignment) => sum + assignment.assignedPeriodsPerWeek,
      0
    );
    const remainingPeriodsPerWeek = requirement.requiredPeriodsPerWeek - assignedPeriodsPerWeek;

    if (!requirement.allowSplitAssignment && assignments.length > 1) {
      warnings.push({
        code: 'split_assignment_disabled',
        severity: 'error',
        message: 'Split assignment is disabled but multiple teachers are assigned.',
      });
    }

    if (remainingPeriodsPerWeek > 0) {
      warnings.push({
        code: 'remaining_unassigned_periods',
        severity: 'warning',
        message: `${remainingPeriodsPerWeek} periods are still unassigned.`,
      });
    }

    if (remainingPeriodsPerWeek < 0) {
      warnings.push({
        code: 'over_assigned_periods',
        severity: 'error',
        message: `${Math.abs(remainingPeriodsPerWeek)} extra periods are assigned beyond the requirement.`,
      });
    }

    for (const assignment of assignments) {
      if (
        !snapshot.capabilitiesByTeacherSubject.has(
          capabilityKey(assignment.teacherId, requirement.subjectId)
        )
      ) {
        const teacherName =
          snapshot.teacherById.get(assignment.teacherId)?.fullName ??
          `Teacher ${assignment.teacherId}`;
        warnings.push({
          code: 'missing_capability',
          severity: 'warning',
          message: `${teacherName} is assigned without an active capability row.`,
        });
      }
    }

    return dedupeWarnings(warnings);
  }

  private buildAssignmentWarnings(
    assignment: TeachingAssignment,
    requirement: ClassSubjectRequirement,
    snapshot: ProjectionSnapshot
  ): ProjectionWarningSummary[] {
    const warnings = this.buildRequirementWarnings(
      requirement,
      snapshot.assignmentsByRequirement.get(requirement.id) ?? [],
      snapshot
    ).filter((warning) => warning.code !== 'teacher_over_capacity');

    const capabilityExists = snapshot.capabilitiesByTeacherSubject.has(
      capabilityKey(assignment.teacherId, requirement.subjectId)
    );
    if (!capabilityExists) {
      const teacherName =
        snapshot.teacherById.get(assignment.teacherId)?.fullName ??
        `Teacher ${assignment.teacherId}`;
      warnings.push({
        code: 'missing_capability',
        severity: 'warning',
        message: `${teacherName} is assigned without an active capability row.`,
      });
    }

    return dedupeWarnings(warnings);
  }

  private buildTeacherCapacityWarnings(
    teacherName: string,
    maxPeriodsPerWeek: number,
    assignedPeriodsPerWeek: number
  ): ProjectionWarningSummary[] {
    if (assignedPeriodsPerWeek > maxPeriodsPerWeek) {
      return [
        {
          code: 'teacher_over_capacity',
          severity: 'error',
          message: `${teacherName} is overloaded (${assignedPeriodsPerWeek}/${maxPeriodsPerWeek}).`,
        },
      ];
    }

    if (
      maxPeriodsPerWeek > 0 &&
      maxPeriodsPerWeek - assignedPeriodsPerWeek <= NEAR_CAPACITY_THRESHOLD
    ) {
      return [
        {
          code: 'teacher_over_capacity',
          severity: 'warning',
          message: `${teacherName} is near capacity (${assignedPeriodsPerWeek}/${maxPeriodsPerWeek}).`,
        },
      ];
    }

    return [];
  }
}

function buildProjectionSnapshot(input: {
  classes: ClassGroup[];
  subjects: Subject[];
  teachers: Teacher[];
  requirements: ClassSubjectRequirement[];
  assignments: TeachingAssignment[];
  capabilities: TeacherSubjectCapability[];
}): ProjectionSnapshot {
  return {
    classById: new Map(input.classes.map((classGroup) => [classGroup.id, classGroup])),
    subjectById: new Map(input.subjects.map((subject) => [subject.id, subject])),
    teacherById: new Map(input.teachers.map((teacher) => [teacher.id, teacher])),
    requirementById: new Map(
      input.requirements.map((requirement) => [requirement.id, requirement])
    ),
    requirementsByClass: groupBy(input.requirements, (requirement) => requirement.classId),
    requirementsBySubject: groupBy(input.requirements, (requirement) => requirement.subjectId),
    assignmentsByRequirement: groupBy(
      input.assignments,
      (assignment) => assignment.classSubjectRequirementId
    ),
    assignmentsByTeacher: groupBy(input.assignments, (assignment) => assignment.teacherId),
    capabilitiesByTeacherSubject: new Map(
      input.capabilities.map((capability) => [
        capabilityKey(capability.teacherId, capability.subjectId),
        capability,
      ])
    ),
  };
}

function groupBy<T>(rows: T[], getKey: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  }
  return map;
}

function capabilityKey(teacherId: number, subjectId: number): string {
  return `${teacherId}:${subjectId}`;
}

function getCapabilityLevel(
  capabilityLookup: Map<string, TeacherSubjectCapability>,
  teacherId: number,
  subjectId: number
): ProjectionCapabilityLevel {
  return (
    capabilityLookup.get(capabilityKey(teacherId, subjectId))?.capabilityLevel ?? 'incompatible'
  );
}

function determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) {
    return 'underloaded';
  }

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  if (totalPeriods > maxPeriods) {
    return 'overloaded';
  }
  if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) {
    return 'near_capacity';
  }
  if (utilizationPercentage >= 50) {
    return 'optimal';
  }
  return 'underloaded';
}

function dedupeWarnings(warnings: ProjectionWarningSummary[]): ProjectionWarningSummary[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.severity}:${warning.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function compareClasses(left: ClassGroup, right: ClassGroup): number {
  return getClassName(left).localeCompare(getClassName(right)) || left.id - right.id;
}

function compareRequirements(
  left: ClassSubjectRequirement,
  right: ClassSubjectRequirement
): number {
  return left.subjectId - right.subjectId || left.classId - right.classId || left.id - right.id;
}

function compareAssignments(left: TeachingAssignment, right: TeachingAssignment): number {
  return left.teacherId - right.teacherId || left.id - right.id;
}

function getClassName(classGroup?: ClassGroup): string {
  if (!classGroup) {
    return '';
  }

  return classGroup.displayName || classGroup.name || '';
}
