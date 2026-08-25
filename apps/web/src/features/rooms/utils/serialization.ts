/**
 * Serialization utilities for room data
 *
 * Handles canonical API arrays/objects while retaining read compatibility
 * for legacy JSON-string fields.
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import type { Room, RoomFormValues, RoomResponse, UnavailableSlot } from '../types';

export class RoomAvailabilityDataError extends Error {
  constructor(message: string) {
    super(`Invalid room availability data: ${message}`);
    this.name = 'RoomAvailabilityDataError';
  }
}

/**
 * Safely parses a JSON string to an array of strings
 * Returns an empty array if parsing fails or input is invalid
 * Also handles already-parsed arrays (for API compatibility)
 *
 * @param json - JSON string from API or already-parsed array
 * @returns Array of strings, or empty array on error
 *
 * Requirements: 9.3
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
 * Parses persisted availability and throws when non-empty data is malformed.
 * Numeric legacy weekdays are decoded using the Saturday-first canonical order.
 *
 * @param json - JSON string from API or already-parsed array
 * @returns Canonical unavailable slots
 *
 * Requirements: 9.3
 */
export function parseUnavailableSlots(
  json: string | Array<{ day: string | number; period: number }> | null | undefined
): UnavailableSlot[] {
  // Handle null/undefined/empty
  if (!json || json === '' || json === '[]') {
    return [];
  }

  let parsed: unknown = json;
  try {
    if (typeof json === 'string') parsed = JSON.parse(json);
  } catch {
    throw new RoomAvailabilityDataError('value is not valid JSON');
  }
  if (!Array.isArray(parsed)) throw new RoomAvailabilityDataError('value is not an array');

  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new RoomAvailabilityDataError(`slot ${index + 1} is not an object`);
    }
    const raw = item as { day?: unknown; period?: unknown };
    const day =
      typeof raw.day === 'number' && Number.isInteger(raw.day)
        ? ALL_WEEK_DAYS[raw.day]
        : typeof raw.day === 'string' && ALL_WEEK_DAYS.includes(raw.day as WeekDay)
          ? (raw.day as WeekDay)
          : undefined;
    if (!day || !Number.isInteger(raw.period) || Number(raw.period) < 0) {
      throw new RoomAvailabilityDataError(
        `slot ${index + 1} must contain a valid weekday and zero-based period`
      );
    }
    return { day, period: Number(raw.period) };
  });
}

/**
 * Safely parses a JSON string to an object
 * Returns an empty object if parsing fails or input is invalid
 * Also handles already-parsed objects (for API compatibility)
 *
 * @param json - JSON string from API or already-parsed object
 * @returns Parsed object, or empty object on error
 *
 * Requirements: 9.3
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
    normalizedName: response.normalizedName,
    type: response.type,
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
 * Serializes RoomFormValues for canonical API submission.
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

  // Keep array fields structured; the API owns persistence serialization.
  if (data.features !== undefined) {
    payload.features = data.features;
  }
  if (data.unavailable !== undefined) {
    payload.unavailable = data.unavailable.map((slot) => ({ day: slot.day, period: slot.period }));
  }

  return payload;
}
