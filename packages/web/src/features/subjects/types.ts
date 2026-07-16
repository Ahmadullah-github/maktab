/**
 * Types for the Subjects feature module
 * Matches the API entity structure from packages/api/src/entity/Subject.ts
 *
 * Requirements: 1.2, 1.3
 */

/**
 * Section filter type for educational levels
 * - all: Show all subjects
 * - PRIMARY: Grades 1-6
 * - MIDDLE: Grades 7-9
 * - HIGH: Grades 10-12
 */
export type SectionFilter = 'all' | 'PRIMARY' | 'MIDDLE' | 'HIGH';

/**
 * Room type options for subject requirements
 * Extended to support specific lab types for better solver constraints
 */
export type RoomType = string;

/**
 * Section type for subject classification
 */
export type Section = 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';

/**
 * Subject entity matching the API response structure (deserialized)
 */
export interface Subject {
  id: number;
  schoolId: number | null;
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: Section;
  requiredRoomType: RoomType | null;
  requiredFeatures: string[]; // Parsed from JSON
  desiredFeatures: string[]; // Parsed from JSON
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: Record<string, unknown>; // Parsed from JSON
  isCustom: boolean;
  customCategory: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw API response for Subject (with JSON strings)
 */
export interface SubjectResponse {
  id: number;
  schoolId: number | null;
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: string;
  requiredRoomType: string | null;
  requiredFeatures: string | string[]; // JSON string or parsed array
  desiredFeatures: string | string[]; // JSON string or parsed array
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: string | Record<string, unknown>; // JSON string or parsed object
  isCustom: boolean;
  customCategory: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form values for creating/editing a subject
 */
export interface SubjectFormValues {
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: Section;
  requiredRoomType: RoomType | null;
  requiredFeatures: string[];
  desiredFeatures: string[];
  isDifficult: boolean;
  minRoomCapacity: number;
  isCustom?: boolean;
  customCategory?: string | null;
}

/**
 * Grade filter type - 'all' or specific grade number (1-12)
 */
export type GradeFilter = 'all' | number;

/**
 * Filter state for the subjects list
 */
export interface SubjectFiltersState {
  search: string;
  section: SectionFilter;
  grade: GradeFilter;
}
