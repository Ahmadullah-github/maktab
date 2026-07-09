/**
 * Types for the Classes feature module
 * Matches the API entity structure from packages/api/src/entity/ClassGroup.ts
 */

/**
 * Subject requirement configuration for a class
 * Defines which subjects are taught and how many periods per week
 */
export interface SubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  /** @deprecated Embedded assignment mirror. Canonical assignment rows will replace this field. */
  teacherId?: number | null;
}

/**
 * Grade category classification for Afghan education system
 * - alphaPrimary: Grades 1-3 (single-teacher mode)
 * - betaPrimary: Grades 4-6
 * - middle: Grades 7-9
 * - high: Grades 10-12
 */
export type GradeCategory = 'all' | 'alphaPrimary' | 'betaPrimary' | 'middle' | 'high';

/**
 * Section type for class grouping
 */
export type Section = 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';

/**
 * ClassGroup entity matching the API response structure
 */
export interface ClassGroup {
  id: number;
  schoolId: number | null;
  academicYearId: number | null;
  name: string;
  displayName: string;
  section: Section;
  grade: number | null;
  sectionIndex: string;
  studentCount: number;
  fixedRoomId: number | null;
  singleTeacherMode: boolean;
  /** Homeroom or supervisor only. This is not subject assignment truth. */
  classTeacherId: number | null;
  /** Compatibility view during cutover. Embedded teacherId is deprecated. */
  subjectRequirements: SubjectRequirement[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw API response for ClassGroup (with JSON strings)
 */
export interface ClassGroupResponse {
  id: number;
  schoolId: number | null;
  academicYearId: number | null;
  name: string;
  displayName: string;
  section: Section;
  grade: number | null;
  sectionIndex: string;
  studentCount: number;
  fixedRoomId: number | null;
  singleTeacherMode: boolean;
  /** Homeroom or supervisor only. This is not subject assignment truth. */
  classTeacherId: number | null;
  subjectRequirements: string; // JSON string
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form values for creating/editing a class
 */
export interface ClassFormValues {
  name: string;
  displayName?: string;
  grade: number | null;
  sectionIndex: string;
  studentCount: number;
  fixedRoomId: number | null;
  singleTeacherMode: boolean;
  /** Homeroom or supervisor only. This is not subject assignment truth. */
  classTeacherId: number | null;
  /** Compatibility input during cutover. Embedded teacherId is deprecated. */
  subjectRequirements: SubjectRequirement[];
}

/**
 * Status filter for teacher mode
 * - all: Show all classes
 * - singleTeacher: Classes with single-teacher mode enabled (grades 1-3)
 * - multiTeacher: Classes with multiple teachers
 */
export type ClassStatusFilter = 'all' | 'singleTeacher' | 'multiTeacher';

/**
 * Filter state for the classes list
 */
export interface ClassFiltersState {
  search: string;
  gradeCategory: GradeCategory;
  statusFilter: ClassStatusFilter;
}

/**
 * Grade category display information
 */
export interface GradeCategoryInfo {
  key: GradeCategory;
  label: string;
  gradeRange: [number, number] | null;
  colorClass: string;
}

/**
 * Statistics for classes summary card
 */
export interface ClassStats {
  total: number;
  alphaPrimary: number;
  betaPrimary: number;
  middle: number;
  high: number;
  singleTeacherMode: number;
  totalStudents: number;
  withFixedRoom: number;
  avgStudentsPerClass: number;
}
