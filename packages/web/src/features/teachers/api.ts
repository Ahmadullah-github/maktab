/**
 * API functions for Teachers CRUD operations
 *
 * Handles communication with the /api/teachers endpoint,
 * including serialization/deserialization of complex fields
 *
 * Requirements: 9.1, 9.2
 */

import { api } from '@/lib/api';
import type {
  Teacher,
  TeacherFormValues,
  TeacherResponse,
  UnavailableSlot,
} from './types';
import { apiLogger, logger } from './utils/logger';
import {
  parseAvailabilityMatrix,
  parseClassAssignments,
  parseJsonObject,
  parseNumberArray,
  parseUnavailableSlots,
  stringifyNumberArray,
  stringifyUnavailableSlots,
} from './utils/serialization';

/**
 * Deserializes a raw API response to a Teacher object
 * Note: Backend already parses JSON fields, so we handle both parsed and string formats
 */
function deserializeTeacher(response: TeacherResponse): Teacher {
  return {
    ...response,
    // Backend already returns these as arrays, but handle string format for safety
    primarySubjectIds: Array.isArray(response.primarySubjectIds)
      ? response.primarySubjectIds
      : parseNumberArray(response.primarySubjectIds),
    allowedSubjectIds: Array.isArray(response.allowedSubjectIds)
      ? response.allowedSubjectIds
      : parseNumberArray(response.allowedSubjectIds),
    availability: Array.isArray(response.availability)
      ? response.availability
      : parseAvailabilityMatrix(response.availability),
    unavailable: Array.isArray(response.unavailable)
      ? response.unavailable
      : parseUnavailableSlots(response.unavailable),
    timePreference: (response.timePreference as Teacher['timePreference']) || 'any',
    preferredRoomIds: Array.isArray(response.preferredRoomIds)
      ? response.preferredRoomIds
      : parseNumberArray(response.preferredRoomIds),
    preferredColleagues: Array.isArray(response.preferredColleagues)
      ? response.preferredColleagues
      : parseNumberArray(response.preferredColleagues),
    classAssignments: Array.isArray(response.classAssignments)
      ? response.classAssignments
      : parseClassAssignments(response.classAssignments),
    meta:
      typeof response.meta === 'object' && response.meta !== null
        ? response.meta
        : parseJsonObject(response.meta),
  };
}

/**
 * Serializes TeacherFormValues for API submission
 * Converts arrays/objects to JSON strings where needed
 */
function serializeTeacherForApi(
  data: TeacherFormValues | Partial<TeacherFormValues> | Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Copy simple fields
  if (data.fullName !== undefined) {
    payload.fullName = data.fullName;
  }
  if (data.restrictToPrimarySubjects !== undefined) {
    payload.restrictToPrimarySubjects = data.restrictToPrimarySubjects;
  }
  if (data.maxPeriodsPerWeek !== undefined) {
    payload.maxPeriodsPerWeek = data.maxPeriodsPerWeek;
  }
  if (data.maxPeriodsPerDay !== undefined) {
    payload.maxPeriodsPerDay = data.maxPeriodsPerDay;
  }
  if (data.maxConsecutivePeriods !== undefined) {
    payload.maxConsecutivePeriods = data.maxConsecutivePeriods;
  }
  if (data.timePreference !== undefined) {
    payload.timePreference = data.timePreference;
  }

  // Serialize array fields to JSON strings
  if (data.primarySubjectIds !== undefined) {
    payload.primarySubjectIds = stringifyNumberArray(data.primarySubjectIds as number[]);
  }
  if (data.allowedSubjectIds !== undefined) {
    payload.allowedSubjectIds = stringifyNumberArray(data.allowedSubjectIds as number[]);
  }
  if (data.unavailable !== undefined) {
    payload.unavailable = stringifyUnavailableSlots(data.unavailable as UnavailableSlot[]);
  }

  // Phase 5: assignment writes must go through canonical assignment commands.
  if ('classAssignments' in data && data.classAssignments !== undefined) {
    logger.warn('Ignoring deprecated classAssignments write in teacher payload');
  }

  return payload;
}

/**
 * Teachers API client
 *
 * Provides typed methods for all CRUD operations on teachers
 * with automatic serialization/deserialization and debug logging
 */
export const teachersApi = {
  /**
   * Fetches all non-deleted teachers
   * Requirements: 1.1
   */
  async getAll(): Promise<Teacher[]> {
    apiLogger.request('GET', '/teachers');

    try {
      const response = (await api.teachers.list()) as TeacherResponse[];
      const teachers = response.map(deserializeTeacher);

      apiLogger.response('GET', '/teachers', 200, { count: teachers.length });
      logger.debug('Fetched all teachers', { count: teachers.length });

      return teachers;
    } catch (error) {
      apiLogger.error('GET', '/teachers', error);
      throw error;
    }
  },

  /**
   * Fetches a single teacher by ID
   * Requirements: 6.1
   */
  async getById(id: number): Promise<Teacher> {
    apiLogger.request('GET', `/teachers/${id}`);

    try {
      const response = (await api.teachers.get(id)) as TeacherResponse;
      const teacher = deserializeTeacher(response);

      apiLogger.response('GET', `/teachers/${id}`, 200, { id: teacher.id });
      logger.debug('Fetched teacher', { id, name: teacher.fullName });

      return teacher;
    } catch (error) {
      apiLogger.error('GET', `/teachers/${id}`, error);
      throw error;
    }
  },

  /**
   * Creates a new teacher
   * Requirements: 2.1
   */
  async create(data: TeacherFormValues): Promise<Teacher> {
    const payload = serializeTeacherForApi(data);
    apiLogger.request('POST', '/teachers', payload);

    try {
      const response = (await api.teachers.create(payload)) as TeacherResponse;
      const teacher = deserializeTeacher(response);

      apiLogger.response('POST', '/teachers', 201, { id: teacher.id });
      logger.info('Teacher created', { id: teacher.id, name: teacher.fullName });

      return teacher;
    } catch (error) {
      apiLogger.error('POST', '/teachers', error);
      throw error;
    }
  },

  /**
   * Updates an existing teacher
   * Requirements: 2.1
   */
  async update(id: number, data: Partial<TeacherFormValues>): Promise<Teacher> {
    const payload = serializeTeacherForApi(data);
    apiLogger.request('PUT', `/teachers/${id}`, payload);

    try {
      const response = (await api.teachers.update(id, payload)) as TeacherResponse;
      const teacher = deserializeTeacher(response);

      apiLogger.response('PUT', `/teachers/${id}`, 200, { id: teacher.id });
      logger.info('Teacher updated', { id: teacher.id, name: teacher.fullName });

      return teacher;
    } catch (error) {
      apiLogger.error('PUT', `/teachers/${id}`, error);
      throw error;
    }
  },

  /**
   * Deletes a teacher (soft delete)
   * Requirements: 1.5
   */
  async delete(id: number): Promise<void> {
    apiLogger.request('DELETE', `/teachers/${id}`);

    try {
      await api.teachers.delete(id);

      apiLogger.response('DELETE', `/teachers/${id}`, 200);
      logger.info('Teacher deleted', { id });
    } catch (error) {
      apiLogger.error('DELETE', `/teachers/${id}`, error);
      throw error;
    }
  },
};
