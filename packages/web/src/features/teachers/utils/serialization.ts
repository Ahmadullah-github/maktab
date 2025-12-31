/**
 * Serialization utilities for Teachers feature
 *
 * Handles conversion between JSON strings (API format) and
 * JavaScript arrays/objects (frontend format)
 */

import type { ClassAssignment, UnavailableSlot } from '../types';
import { logger } from './logger';

/**
 * Safely parses a JSON string to an array
 * Returns empty array if parsing fails or input is null/empty
 *
 * @param jsonString - JSON string to parse
 * @returns Parsed array or empty array
 */
export function parseJsonArray<T>(jsonString: string | null | undefined): T[] {
  if (!jsonString || jsonString === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn('Failed to parse JSON array', { jsonString, error });
    return [];
  }
}

/**
 * Safely parses a JSON string to an object
 * Returns empty object if parsing fails or input is null/empty
 *
 * @param jsonString - JSON string to parse
 * @returns Parsed object or empty object
 */
export function parseJsonObject<T extends Record<string, unknown>>(
  jsonString: string | null | undefined
): T {
  if (!jsonString || jsonString === '') {
    return {} as T;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch (error) {
    logger.warn('Failed to parse JSON object', { jsonString, error });
    return {} as T;
  }
}

/**
 * Converts an array to a JSON string for API storage
 *
 * @param array - Array to stringify
 * @returns JSON string representation
 */
export function stringifyArray<T>(array: T[] | null | undefined): string {
  if (!array || !Array.isArray(array)) {
    return '[]';
  }
  return JSON.stringify(array);
}

/**
 * Converts an object to a JSON string for API storage
 *
 * @param obj - Object to stringify
 * @returns JSON string representation
 */
export function stringifyObject<T extends Record<string, unknown>>(
  obj: T | null | undefined
): string {
  if (!obj || typeof obj !== 'object') {
    return '{}';
  }
  return JSON.stringify(obj);
}

/**
 * Parses unavailable slots from JSON string
 *
 * @param jsonString - JSON string of unavailable slots
 * @returns Array of UnavailableSlot objects
 */
export function parseUnavailableSlots(jsonString: string | null | undefined): UnavailableSlot[] {
  return parseJsonArray<UnavailableSlot>(jsonString);
}

/**
 * Serializes unavailable slots to JSON string
 *
 * @param slots - Array of UnavailableSlot objects
 * @returns JSON string representation
 */
export function stringifyUnavailableSlots(slots: UnavailableSlot[] | null | undefined): string {
  return stringifyArray(slots);
}

/**
 * Parses class assignments from JSON string
 *
 * @param jsonString - JSON string of class assignments
 * @returns Array of ClassAssignment objects
 */
export function parseClassAssignments(jsonString: string | null | undefined): ClassAssignment[] {
  return parseJsonArray<ClassAssignment>(jsonString);
}

/**
 * Serializes class assignments to JSON string
 *
 * @param assignments - Array of ClassAssignment objects
 * @returns JSON string representation
 */
export function stringifyClassAssignments(
  assignments: ClassAssignment[] | null | undefined
): string {
  return stringifyArray(assignments);
}

/**
 * Parses number array from JSON string (for subject IDs, room IDs, etc.)
 *
 * @param jsonString - JSON string of number array
 * @returns Array of numbers
 */
export function parseNumberArray(jsonString: string | null | undefined): number[] {
  return parseJsonArray<number>(jsonString);
}

/**
 * Serializes number array to JSON string
 *
 * @param numbers - Array of numbers
 * @returns JSON string representation
 */
export function stringifyNumberArray(numbers: number[] | null | undefined): string {
  return stringifyArray(numbers);
}

/**
 * Parses 2D boolean array from JSON string (for availability matrix)
 *
 * @param jsonString - JSON string of 2D boolean array
 * @returns 2D boolean array
 */
export function parseAvailabilityMatrix(jsonString: string | null | undefined): boolean[][] {
  return parseJsonArray<boolean[]>(jsonString);
}

/**
 * Serializes 2D boolean array to JSON string
 *
 * @param matrix - 2D boolean array
 * @returns JSON string representation
 */
export function stringifyAvailabilityMatrix(matrix: boolean[][] | null | undefined): string {
  return stringifyArray(matrix);
}
