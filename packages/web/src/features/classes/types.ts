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
  classTeacherId: number | null;
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
  classTeacherId: number | null;
  subjectRequirements: SubjectRequirement[];
}

/**
 * Filter state for the classes list
 */
export interface ClassFiltersState {
  search: string;
  gradeCategory: GradeCategory;
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
