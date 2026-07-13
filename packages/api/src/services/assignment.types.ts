export type AssignmentStatus = 'assigned' | 'unassigned' | 'partial' | 'conflict';
export type ConflictType =
  | 'workload_exceeded'
  | 'subject_incompatible'
  | 'availability_conflict'
  | 'coverage_insufficient'
  | 'duplicate_assignment';
export type ConflictSeverity = 'warning' | 'error';
export type WorkloadStatus = 'underloaded' | 'optimal' | 'near_capacity' | 'overloaded';
export type TeacherCompatibilityLevel = 'primary' | 'allowed' | 'incompatible';

export interface AffectedEntities {
  teacherId?: number;
  subjectId?: number;
  classId?: number;
}

export interface AssignmentConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  messageFa: string;
  affectedEntities: AffectedEntities;
  suggestedResolution?: string;
  suggestedResolutionFa?: string;
}

export interface ClassPeriodOverride {
  classId: number;
  periodsPerWeek: number;
}

export interface AssignmentValidationRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek?: number;
  classPeriodOverrides?: ClassPeriodOverride[];
  persistRequirementOverrides?: boolean;
}

export interface AssignmentValidationResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentConflict[];
}

export interface WorkloadBreakdown {
  subjectId: number;
  subjectName: string;
  classIds: number[];
  periodsPerWeek: number;
  totalPeriods: number;
}

export interface TeacherWorkload {
  teacherId: number;
  totalPeriods: number;
  maxPeriods: number;
  utilizationPercentage: number;
  breakdown: WorkloadBreakdown[];
  status: WorkloadStatus;
  remainingCapacity: number;
}

export interface ClassCoverageDetail {
  classId: number;
  className: string;
  periodsPerWeek: number;
  assignmentStatus: AssignmentStatus;
  assignedTeacherId: number | null;
  assignedTeacherName: string | null;
  conflicts: AssignmentConflict[];
}

export interface TeacherCoverageDetail {
  teacherId: number;
  teacherName: string;
  assignedClassIds: number[];
  totalPeriods: number;
  compatibility: TeacherCompatibilityLevel;
}

export interface SubjectCoverage {
  subjectId: number;
  subjectName: string;
  totalClassesRequiring: number;
  assignedClasses: number;
  unassignedClasses: ClassCoverageDetail[];
  teacherDistribution: TeacherCoverageDetail[];
  coveragePercentage: number;
  status: 'complete' | 'partial' | 'uncovered';
}

export interface AssignmentOperationResult {
  success: boolean;
  conflicts: AssignmentConflict[];
  warnings?: AssignmentConflict[];
  updatedTeacherId?: number;
  updatedClassIds?: number[];
}
