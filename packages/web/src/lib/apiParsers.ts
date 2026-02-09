/**
 * API Response Parsers
 *
 * Utilities for parsing JSON string fields from API responses.
 * The API stores arrays as JSON strings in SQLite, so we need to parse them.
 */

/**
 * Parse JSON string or return as-is if already an array
 */
export function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse JSON object or return as-is if already an object
 */
export function parseJsonObject<T extends Record<string, unknown>>(
  value: string | T | null | undefined
): T {
  if (!value) return {} as T;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : ({} as T);
  } catch {
    return {} as T;
  }
}

/**
 * Subject requirement structure
 */
export interface SubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  teacherId?: number | null;
}

/**
 * Class assignment structure
 */
export interface ClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Parse subjectRequirements from API response
 */
export function parseSubjectRequirements(
  value: string | SubjectRequirement[] | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(value);
}

/**
 * Parse classAssignments from API response
 */
export function parseClassAssignments(
  value: string | ClassAssignment[] | null | undefined
): ClassAssignment[] {
  return parseJsonArray<ClassAssignment>(value);
}

/**
 * Parse number array (for primarySubjectIds, allowedSubjectIds, etc.)
 */
export function parseNumberArray(value: string | number[] | null | undefined): number[] {
  return parseJsonArray<number>(value);
}
