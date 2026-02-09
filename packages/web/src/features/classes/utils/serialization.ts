/**
 * Serialization utilities for class data
 *
 * Handles conversion between JSON strings (API format) and
 * JavaScript objects (UI format) for complex fields like subjectRequirements
 *
 * Requirements: 12.1, 12.2, 12.4
 */

import type { SubjectRequirement } from '../types';
import { logger } from './logger';

/**
 * Serializes an array of SubjectRequirement objects to a JSON string
 * for API storage
 *
 * @param requirements - Array of subject requirements
 * @returns JSON string representation
 *
 * Requirements: 12.1
 */
export function serializeSubjectRequirements(requirements: SubjectRequirement[]): string {
  return JSON.stringify(requirements);
}

/**
 * Deserializes a JSON string or array to an array of SubjectRequirement objects
 * Handles both string (from DB) and array (already parsed) formats
 * Handles malformed JSON gracefully by returning an empty array
 *
 * @param json - JSON string from API or already-parsed array
 * @returns Array of subject requirements, or empty array on error
 *
 * Requirements: 12.2, 12.4
 */
export function deserializeSubjectRequirements(
  json: string | SubjectRequirement[] | null | undefined
): SubjectRequirement[] {
  // Handle null/undefined/empty
  if (!json || json === '') {
    return [];
  }

  // Already an array - just normalize and return
  if (Array.isArray(json)) {
    return json.map((item: unknown) => normalizeSubjectRequirement(item));
  }

  // String - parse as JSON
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);

      if (!Array.isArray(parsed)) {
        logger.warn('subjectRequirements is not an array, returning empty', {
          json,
        });
        return [];
      }

      // Validate and normalize each requirement
      return parsed.map((item: unknown) => normalizeSubjectRequirement(item));
    } catch (error) {
      logger.warn('Failed to parse subjectRequirements JSON', { json, error });
      return [];
    }
  }

  // Unknown type
  logger.warn('subjectRequirements has unexpected type', { type: typeof json });
  return [];
}

/**
 * Normalizes a parsed subject requirement object to ensure correct types
 *
 * @param item - Parsed JSON item
 * @returns Normalized SubjectRequirement
 */
function normalizeSubjectRequirement(item: unknown): SubjectRequirement {
  if (typeof item !== 'object' || item === null) {
    return { subjectId: 0, periodsPerWeek: 0, teacherId: null };
  }

  const obj = item as Record<string, unknown>;

  return {
    subjectId: typeof obj.subjectId === 'number' ? obj.subjectId : 0,
    periodsPerWeek: typeof obj.periodsPerWeek === 'number' ? obj.periodsPerWeek : 0,
    teacherId: typeof obj.teacherId === 'number' ? obj.teacherId : null,
  };
}
