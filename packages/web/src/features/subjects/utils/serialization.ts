/**
 * Serialization utilities for subject data
 *
 * Handles conversion between JSON strings (API format) and
 * JavaScript objects (UI format) for complex fields like
 * requiredFeatures, desiredFeatures, and meta
 *
 * Requirements: 1.3, 6.5
 */

import type { RoomType, Section, Subject, SubjectFormValues, SubjectResponse } from '../types';

/**
 * Safely parses a JSON string to an array of strings
 * Returns an empty array if parsing fails or input is invalid
 * Also handles already-parsed arrays (for API compatibility)
 *
 * @param json - JSON string from API or already-parsed array
 * @returns Array of strings, or empty array on error
 */
export function parseJsonArray(json: string | string[] | null | undefined): string[] {
  // Handle null/undefined/empty
  if (!json || json === '' || json === '[]') {
    return [];
  }

  // If already an array, return it directly (filter to strings only)
  if (Array.isArray(json)) {
    return json.filter((item): item is string => typeof item === 'string');
  }

  // If not a string at this point, return empty
  if (typeof json !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      console.warn('[subjects] parseJsonArray: value is not an array, returning empty', { json });
      return [];
    }

    // Filter to only include string values
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (error) {
    console.warn('[subjects] parseJsonArray: failed to parse JSON', { json, error });
    return [];
  }
}

/**
 * Safely parses a JSON string to an object
 * Returns an empty object if parsing fails or input is invalid
 * Also handles already-parsed objects (for API compatibility)
 *
 * @param json - JSON string from API or already-parsed object
 * @returns Parsed object, or empty object on error
 */
export function parseJsonObject(
  json: string | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  // Handle null/undefined/empty
  if (!json || json === '' || json === '{}') {
    return {};
  }

  // If already an object (not array, not null), return it directly
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    return json as Record<string, unknown>;
  }

  // If not a string at this point, return empty
  if (typeof json !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[subjects] parseJsonObject: value is not an object, returning empty', { json });
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    console.warn('[subjects] parseJsonObject: failed to parse JSON', { json, error });
    return {};
  }
}

/**
 * Deserializes a raw API response to a Subject object
 * Converts JSON strings to proper arrays/objects for requiredFeatures,
 * desiredFeatures, and meta fields
 *
 * @param response - Raw API response with JSON string fields
 * @returns Deserialized Subject object
 *
 * Requirements: 1.3
 */
export function deserializeSubject(response: SubjectResponse): Subject {
  return {
    id: response.id,
    schoolId: response.schoolId,
    name: response.name,
    code: response.code,
    grade: response.grade,
    periodsPerWeek: response.periodsPerWeek,
    section: (response.section || '') as Section,
    requiredRoomType: (response.requiredRoomType || '') as RoomType,
    requiredFeatures: parseJsonArray(response.requiredFeatures),
    desiredFeatures: parseJsonArray(response.desiredFeatures),
    isDifficult: response.isDifficult,
    minRoomCapacity: response.minRoomCapacity,
    meta: parseJsonObject(response.meta),
    isDeleted: response.isDeleted,
    deletedAt: response.deletedAt,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

/**
 * Serializes SubjectFormValues for API submission
 * Converts arrays to JSON strings where needed
 *
 * @param data - Form values to serialize
 * @returns Serialized payload for API
 *
 * Requirements: 6.5
 */
export function serializeSubjectForApi(
  data: SubjectFormValues | Partial<SubjectFormValues>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Copy simple fields
  if (data.name !== undefined) payload.name = data.name;
  if (data.code !== undefined) payload.code = data.code;
  if (data.grade !== undefined) payload.grade = data.grade;
  if (data.periodsPerWeek !== undefined) payload.periodsPerWeek = data.periodsPerWeek;
  if (data.section !== undefined) payload.section = data.section;
  if (data.requiredRoomType !== undefined) payload.requiredRoomType = data.requiredRoomType;
  if (data.isDifficult !== undefined) payload.isDifficult = data.isDifficult;
  if (data.minRoomCapacity !== undefined) payload.minRoomCapacity = data.minRoomCapacity;

  // Serialize array fields to JSON strings
  if (data.requiredFeatures !== undefined) {
    payload.requiredFeatures = JSON.stringify(data.requiredFeatures);
  }
  if (data.desiredFeatures !== undefined) {
    payload.desiredFeatures = JSON.stringify(data.desiredFeatures);
  }

  return payload;
}
