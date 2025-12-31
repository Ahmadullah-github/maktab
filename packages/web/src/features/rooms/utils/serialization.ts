/**
 * Serialization utilities for room data
 *
 * Handles conversion between JSON strings (API format) and
 * JavaScript objects (UI format) for complex fields like
 * features, unavailable, and meta
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import type { Room, RoomFormValues, RoomResponse, RoomType, UnavailableSlot } from '../types';

/**
 * Safely parses a JSON string to an array of strings
 * Returns an empty array if parsing fails or input is invalid
 *
 * @param json - JSON string from API
 * @returns Array of strings, or empty array on error
 *
 * Requirements: 9.3
 */
export function parseJsonArray(json: string | null | undefined): string[] {
  if (!json || json === '' || json === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      console.warn('[rooms] parseJsonArray: value is not an array, returning empty', { json });
      return [];
    }

    // Filter to only include string values
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (error) {
    console.warn('[rooms] parseJsonArray: failed to parse JSON', { json, error });
    return [];
  }
}

/**
 * Safely parses a JSON string to an array of UnavailableSlot objects
 * Returns an empty array if parsing fails or input is invalid
 *
 * @param json - JSON string from API
 * @returns Array of UnavailableSlot objects, or empty array on error
 *
 * Requirements: 9.3
 */
export function parseUnavailableSlots(json: string | null | undefined): UnavailableSlot[] {
  if (!json || json === '' || json === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      console.warn('[rooms] parseUnavailableSlots: value is not an array, returning empty', {
        json,
      });
      return [];
    }

    // Filter and validate each slot
    return parsed.filter(
      (item): item is UnavailableSlot =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.day === 'number' &&
        typeof item.period === 'number'
    );
  } catch (error) {
    console.warn('[rooms] parseUnavailableSlots: failed to parse JSON', { json, error });
    return [];
  }
}

/**
 * Safely parses a JSON string to an object
 * Returns an empty object if parsing fails or input is invalid
 *
 * @param json - JSON string from API
 * @returns Parsed object, or empty object on error
 *
 * Requirements: 9.3
 */
export function parseJsonObject(json: string | null | undefined): Record<string, unknown> {
  if (!json || json === '' || json === '{}') {
    return {};
  }

  try {
    const parsed = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[rooms] parseJsonObject: value is not an object, returning empty', { json });
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    console.warn('[rooms] parseJsonObject: failed to parse JSON', { json, error });
    return {};
  }
}

/**
 * Deserializes a raw API response to a Room object
 * Converts JSON strings to proper arrays/objects for features,
 * unavailable, and meta fields
 *
 * @param response - Raw API response with JSON string fields
 * @returns Deserialized Room object
 *
 * Requirements: 9.2
 */
export function deserializeRoom(response: RoomResponse): Room {
  return {
    id: response.id,
    schoolId: response.schoolId,
    name: response.name,
    capacity: response.capacity,
    type: (response.type || '') as RoomType,
    features: parseJsonArray(response.features),
    unavailable: parseUnavailableSlots(response.unavailable),
    meta: parseJsonObject(response.meta),
    isDeleted: response.isDeleted,
    deletedAt: response.deletedAt,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

/**
 * Serializes RoomFormValues for API submission
 * Converts arrays to JSON strings where needed
 *
 * @param data - Form values to serialize
 * @returns Serialized payload for API
 *
 * Requirements: 9.1
 */
export function serializeRoomForApi(
  data: RoomFormValues | Partial<RoomFormValues>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Copy simple fields
  if (data.name !== undefined) payload.name = data.name;
  if (data.capacity !== undefined) payload.capacity = data.capacity;
  if (data.type !== undefined) payload.type = data.type;

  // Serialize array fields to JSON strings
  if (data.features !== undefined) {
    payload.features = JSON.stringify(data.features);
  }
  if (data.unavailable !== undefined) {
    payload.unavailable = JSON.stringify(data.unavailable);
  }

  return payload;
}
