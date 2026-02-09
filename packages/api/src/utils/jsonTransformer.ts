/**
 * JSON Transformer utility for parsing/stringifying JSON fields
 * @module utils/jsonTransformer
 *
 * Requirements: 12.4
 * - TypeScript interfaces placed in src/types/ directory
 * - Utility for handling JSON field transformation in entities
 */

import { logger } from './logger';

/**
 * Result of a JSON parse operation
 */
export interface JsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Result of a JSON stringify operation
 */
export interface JsonStringifyResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Safely parse a JSON string with error handling
 * Also handles already-parsed objects (returns them as-is)
 * @param jsonString - The JSON string to parse (or already-parsed value)
 * @param defaultValue - Default value to return on parse failure
 * @returns Parsed value or default value
 */
export function safeJsonParse<T>(jsonString: string | T | null | undefined, defaultValue: T): T {
  if (jsonString === null || jsonString === undefined || jsonString === '') {
    return defaultValue;
  }

  // If already the expected type (not a string), return as-is
  if (typeof jsonString !== 'string') {
    return jsonString as T;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.warn('JSON parse failed, returning default value', {
      preview: jsonString.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return defaultValue;
  }
}

/**
 * Safely parse a JSON string with detailed result
 * @param jsonString - The JSON string to parse
 * @returns Parse result with success status and data or error
 */
export function parseJson<T>(jsonString: string | null | undefined): JsonParseResult<T> {
  if (jsonString === null || jsonString === undefined || jsonString === '') {
    return {
      success: false,
      error: 'Input is null, undefined, or empty',
    };
  }

  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}

/**
 * Safely stringify a value to JSON with error handling
 * @param value - The value to stringify
 * @param defaultValue - Default string to return on stringify failure
 * @returns JSON string or default value
 */
export function safeJsonStringify<T>(value: T, defaultValue: string = ''): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.warn('JSON stringify failed, returning default value', {
      valueType: typeof value,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return defaultValue;
  }
}

/**
 * Safely stringify a value to JSON with detailed result
 * @param value - The value to stringify
 * @returns Stringify result with success status and data or error
 */
export function stringifyJson<T>(value: T): JsonStringifyResult {
  if (value === null || value === undefined) {
    return {
      success: false,
      error: 'Input is null or undefined',
    };
  }

  try {
    const data = JSON.stringify(value);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown stringify error',
    };
  }
}

/**
 * Transform an entity's JSON string fields to parsed objects
 * @param entity - The entity with JSON string fields
 * @param fields - Array of field names to transform
 * @param defaults - Default values for each field
 * @returns Entity with parsed JSON fields
 */
export function parseEntityJsonFields<T extends Record<string, unknown>>(
  entity: T,
  fields: (keyof T)[],
  defaults: Partial<Record<keyof T, unknown>> = {}
): T {
  const result = { ...entity };

  for (const field of fields) {
    const value = entity[field];
    if (typeof value === 'string') {
      const defaultValue = defaults[field] ?? (value.startsWith('[') ? [] : {});
      (result as Record<string, unknown>)[field as string] = safeJsonParse(value, defaultValue);
    }
  }

  return result;
}

/**
 * Transform an entity's object fields to JSON strings for storage
 * @param entity - The entity with object fields
 * @param fields - Array of field names to transform
 * @returns Entity with stringified JSON fields
 */
export function stringifyEntityJsonFields<T extends Record<string, unknown>>(
  entity: T,
  fields: (keyof T)[]
): T {
  const result = { ...entity };

  for (const field of fields) {
    const value = entity[field];
    if (value !== null && value !== undefined && typeof value !== 'string') {
      (result as Record<string, unknown>)[field as string] = safeJsonStringify(value, '');
    }
  }

  return result;
}

/**
 * Check if a string is valid JSON
 * @param str - String to check
 * @returns true if valid JSON
 */
export function isValidJson(str: string | null | undefined): boolean {
  if (str === null || str === undefined || str === '') {
    return false;
  }

  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse JSON array string with type safety
 * @param jsonString - JSON array string
 * @returns Parsed array or empty array
 */
export function parseJsonArray<T>(jsonString: string | null | undefined): T[] {
  return safeJsonParse<T[]>(jsonString, []);
}

/**
 * Parse JSON object string with type safety
 * @param jsonString - JSON object string
 * @returns Parsed object or empty object
 */
export function parseJsonObject<T extends Record<string, unknown>>(
  jsonString: string | null | undefined
): T {
  return safeJsonParse<T>(jsonString, {} as T);
}
