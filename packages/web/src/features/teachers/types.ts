/**
 * Types for the Teachers feature module
 * Matches the API entity structure from packages/api/src/entity/Teacher.ts
 */

/**
 * Unavailable slot representing a day-period combination when teacher cannot be scheduled
 */
export interface UnavailableSlot {
  day: number;
  period: number;
}

/**
 * Class assignment linking a subject to classes for a teacher
 */
export interface ClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Teacher entity matching the API response structure (deserialized)
 */
export interface Teacher {
  id: number;
  schoolId: number | null;
  fullName: string;
  /** @deprecated Compatibility capability mirror. Canonical capability rows will replace this field. */
  primarySubjectIds: number[];
  /** @deprecated Compatibility capability mirror. Canonical capability rows will replace this field. */
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  availability: boolean[][];
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
  preferredRoomIds: number[];
  preferredColleagues: number[];
  /** @deprecated Legacy assignment mirror. Canonical assignment projections will replace this field. */
  classAssignments: ClassAssignment[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw API response for Teacher (with JSON strings)
 */
export interface TeacherResponse {
  id: number;
  schoolId: number | null;
  fullName: string;
  /** @deprecated Compatibility capability mirror. Canonical capability rows will replace this field. */
  primarySubjectIds: string; // JSON string
  /** @deprecated Compatibility capability mirror. Canonical capability rows will replace this field. */
  allowedSubjectIds: string; // JSON string
  restrictToPrimarySubjects: boolean;
  availability: string; // JSON string
  unavailable: string; // JSON string
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: string;
  preferredRoomIds: string; // JSON string
  preferredColleagues: string; // JSON string
  /** @deprecated Legacy assignment mirror. Canonical assignment projections will replace this field. */
  classAssignments: string; // JSON string
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form values for creating/editing a teacher
 */
export interface TeacherFormValues {
  fullName: string;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
}

/**
 * Status filter options for teacher list
 */
export type TeacherStatusFilter = 'all' | 'fullTime' | 'partTime';

/**
 * Filter state for the teachers list
 */
export interface TeacherFiltersState {
  search: string;
  statusFilter: TeacherStatusFilter;
}
