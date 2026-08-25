/**
 * Teacher-Class-Subject Assignments feature module
 *
 * Supports multi-teacher subject assignments where different teachers
 * can teach different periods of the same subject for the same class.
 */

// Types
export type {
  AssignmentSummary,
  AssignmentValidation,
  CreateTeacherAssignmentInput,
  TeacherClassSubjectAssignment,
  UpdateTeacherAssignmentInput,
} from './types';

// API
export { teacherAssignmentsApi } from './api';

// Hooks
export {
  teacherAssignmentKeys,
  useAssignmentSummary,
  useBulkCreateTeacherAssignments,
  useCreateTeacherAssignment,
  useDeleteTeacherAssignment,
  useTeacherAssignments,
  useTeacherAssignmentsByClass,
  useTeacherAssignmentsByClassAndSubject,
  useTeacherAssignmentsByTeacher,
  useUpdateTeacherAssignment,
  useValidateAssignment,
} from './hooks';
