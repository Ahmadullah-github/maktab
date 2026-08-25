import type { AssignmentConflict, AssignmentStatus, CoverageStatus } from '../types';

export type ProjectionCapabilityLevel = 'primary' | 'allowed' | 'incompatible';

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

export interface ProjectionRequirementView {
  requirementId: number;
  assignmentVersion: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  requiredPeriodsPerWeek: number;
  periodMode?: 'inherited' | 'class_override';
  assignedPeriodsPerWeek: number;
  remainingPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
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
  capabilityLevel: 'primary' | 'allowed';
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
  contractedMaxPeriodsPerWeek: number;
  effectiveCapacityPerWeek: number;
  bindingCapacityConstraint: 'contract' | 'calendar';
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

function warningCodeToConflictType(
  code: ProjectionWarningSummary['code']
): AssignmentConflict['type'] {
  switch (code) {
    case 'teacher_over_capacity':
      return 'workload_exceeded';
    case 'missing_capability':
      return 'subject_incompatible';
    case 'remaining_unassigned_periods':
    case 'over_assigned_periods':
      return 'coverage_insufficient';
    case 'split_assignment_disabled':
      return 'duplicate_assignment';
    default:
      return 'duplicate_assignment';
  }
}

export function projectionWarningToConflict(
  warning: ProjectionWarningSummary,
  entities: AssignmentConflict['affectedEntities'] = {}
): AssignmentConflict {
  return {
    type: warningCodeToConflictType(warning.code),
    severity: warning.severity,
    message: warning.message,
    messageFa: warning.message,
    affectedEntities: entities,
  };
}

export function getProjectionRequirementStatus(
  requirement: ProjectionRequirementView
): AssignmentStatus {
  if (requirement.warnings.some((warning) => warning.severity === 'error')) {
    return 'conflict';
  }
  if (requirement.assignedPeriodsPerWeek <= 0) {
    return 'unassigned';
  }
  if (requirement.remainingPeriodsPerWeek > 0) {
    return 'partial';
  }
  return 'assigned';
}

export function getProjectionCoverageStatus(
  requirements: ProjectionRequirementView[]
): CoverageStatus {
  if (requirements.length === 0) {
    return 'uncovered';
  }

  const fullyAssignedCount = requirements.filter(
    (requirement) => requirement.assignedPeriodsPerWeek > 0 && requirement.remainingPeriodsPerWeek <= 0
  ).length;

  if (fullyAssignedCount === requirements.length) {
    return 'complete';
  }
  if (fullyAssignedCount > 0) {
    return 'partial';
  }
  return 'uncovered';
}
