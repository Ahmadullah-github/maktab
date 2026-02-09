/**
 * Types for Teacher-Class-Subject Assignments
 *
 * Supports multi-teacher subject assignments where different teachers
 * can teach different periods of the same subject for the same class.
 */

/**
 * Teacher-Class-Subject Assignment entity
 */
export interface TeacherClassSubjectAssignment {
  id: number;
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed: boolean;
  schoolId: number | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new assignment
 */
export interface CreateTeacherAssignmentInput {
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed?: boolean;
}

/**
 * Input for updating an existing assignment
 */
export interface UpdateTeacherAssignmentInput {
  teacherId?: number;
  classId?: number;
  subjectId?: number;
  periodsPerWeek?: number;
  isFixed?: boolean;
}

/**
 * Summary of assignments for a class-subject pair
 */
export interface AssignmentSummary {
  classId: number;
  subjectId: number;
  totalAssignedPeriods: number;
  assignments: Array<{
    id: number;
    teacherId: number;
    periodsPerWeek: number;
    isFixed: boolean;
  }>;
}

/**
 * Validation result for assignment
 */
export interface AssignmentValidation {
  valid: boolean;
  remainingPeriods: number;
  message?: string;
}
