/**
 * API functions for Classes CRUD operations
 *
 * Handles communication with the /api/classes endpoint,
 * including serialization/deserialization of complex fields
 *
 * Requirements: 11.1, 11.4
 */

import { api } from '@/lib/api';
import type { ClassFormValues, ClassGroup, ClassGroupResponse } from './types';
import { apiLogger, logger } from './utils/logger';
import {
  deserializeSubjectRequirements,
  serializeSubjectRequirements,
} from './utils/serialization';

/**
 * Deserializes a raw API response to a ClassGroup object
 * Converts JSON strings to proper objects for subjectRequirements and meta
 */
function deserializeClass(response: ClassGroupResponse): ClassGroup {
  return {
    ...response,
    subjectRequirements: deserializeSubjectRequirements(response.subjectRequirements),
    meta: parseMetaJson(response.meta),
  };
}

/**
 * Safely parses the meta JSON field
 * Handles both string (from DB) and object (already parsed) formats
 */
function parseMetaJson(
  meta: string | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!meta) {
    return {};
  }

  // Already an object, return as-is
  if (typeof meta === 'object') {
    return meta;
  }

  // Empty string
  if (meta === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(meta);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Serializes ClassFormValues for API submission
 * Converts arrays/objects to JSON strings where needed
 */
function serializeClassForApi(
  data: ClassFormValues | Partial<ClassFormValues>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...data };

  // Serialize subjectRequirements if present
  if (data.subjectRequirements !== undefined) {
    payload.subjectRequirements = serializeSubjectRequirements(data.subjectRequirements);
  }

  return payload;
}

/**
 * Classes API client
 *
 * Provides typed methods for all CRUD operations on classes
 * with automatic serialization/deserialization and debug logging
 */
export const classesApi = {
  /**
   * Fetches all non-deleted classes
   * Requirements: 11.4
   */
  async getAll(): Promise<ClassGroup[]> {
    apiLogger.request('GET', '/classes');

    try {
      const response = (await api.classes.list()) as ClassGroupResponse[];
      const classes = response.map(deserializeClass);

      apiLogger.response('GET', '/classes', 200, { count: classes.length });
      logger.debug('Fetched all classes', { count: classes.length });

      return classes;
    } catch (error) {
      apiLogger.error('GET', '/classes', error);
      throw error;
    }
  },

  /**
   * Fetches a single class by ID
   * Requirements: 11.4
   */
  async getById(id: number): Promise<ClassGroup> {
    apiLogger.request('GET', `/classes/${id}`);

    try {
      const response = (await api.classes.get(id)) as ClassGroupResponse;
      const classGroup = deserializeClass(response);

      apiLogger.response('GET', `/classes/${id}`, 200, { id: classGroup.id });
      logger.debug('Fetched class', { id, name: classGroup.name });

      return classGroup;
    } catch (error) {
      apiLogger.error('GET', `/classes/${id}`, error);
      throw error;
    }
  },

  /**
   * Creates a new class
   * Requirements: 11.1
   */
  async create(data: ClassFormValues): Promise<ClassGroup> {
    const payload = serializeClassForApi(data);
    apiLogger.request('POST', '/classes', payload);

    try {
      const response = (await api.classes.create(payload)) as ClassGroupResponse;
      const classGroup = deserializeClass(response);

      apiLogger.response('POST', '/classes', 201, { id: classGroup.id });
      logger.info('Class created', { id: classGroup.id, name: classGroup.name });

      return classGroup;
    } catch (error) {
      apiLogger.error('POST', '/classes', error);
      throw error;
    }
  },

  /**
   * Updates an existing class
   * Requirements: 11.1
   */
  async update(id: number, data: Partial<ClassFormValues>): Promise<ClassGroup> {
    const payload = serializeClassForApi(data);
    apiLogger.request('PUT', `/classes/${id}`, payload);

    try {
      const response = (await api.classes.update(id, payload)) as ClassGroupResponse;
      const classGroup = deserializeClass(response);

      apiLogger.response('PUT', `/classes/${id}`, 200, { id: classGroup.id });
      logger.info('Class updated', { id: classGroup.id, name: classGroup.name });

      return classGroup;
    } catch (error) {
      apiLogger.error('PUT', `/classes/${id}`, error);
      throw error;
    }
  },

  /**
   * Deletes a class (soft delete)
   * Requirements: 11.1
   */
  async delete(id: number): Promise<void> {
    apiLogger.request('DELETE', `/classes/${id}`);

    try {
      await api.classes.delete(id);

      apiLogger.response('DELETE', `/classes/${id}`, 200);
      logger.info('Class deleted', { id });
    } catch (error) {
      apiLogger.error('DELETE', `/classes/${id}`, error);
      throw error;
    }
  },

  /**
   * Bulk creates multiple classes at once
   */
  async bulkCreate(classes: ClassFormValues[]): Promise<ClassGroup[]> {
    const payload = classes.map(serializeClassForApi);
    apiLogger.request('POST', '/classes/bulk', { count: payload.length });

    try {
      const response = (await api.classes.bulkCreate(payload)) as ClassGroupResponse[];
      const createdClasses = response.map(deserializeClass);

      apiLogger.response('POST', '/classes/bulk', 201, { count: createdClasses.length });
      logger.info('Classes bulk created', { count: createdClasses.length });

      return createdClasses;
    } catch (error) {
      apiLogger.error('POST', '/classes/bulk', error);
      throw error;
    }
  },

  /**
   * Bulk apply curriculum to multiple classes
   * @param classIds - Array of class IDs, or empty array to apply to all classes without requirements
   * @param overwrite - If true, overwrite existing requirements
   */
  async bulkApplyCurriculum(
    classIds: number[],
    overwrite: boolean = false
  ): Promise<{
    updated: number;
    skipped: number;
    failed: number;
    details: Array<{
      classId: number;
      className: string;
      status: 'updated' | 'skipped' | 'failed';
      reason?: string;
    }>;
  }> {
    apiLogger.request('POST', '/classes/bulk-apply-curriculum', { classIds, overwrite });

    try {
      const response = await api.classes.bulkApplyCurriculum(classIds, overwrite);

      apiLogger.response('POST', '/classes/bulk-apply-curriculum', 200, {
        updated: response.updated,
        skipped: response.skipped,
        failed: response.failed,
      });
      logger.info('Bulk curriculum applied', {
        updated: response.updated,
        skipped: response.skipped,
        failed: response.failed,
      });

      return response;
    } catch (error) {
      apiLogger.error('POST', '/classes/bulk-apply-curriculum', error);
      throw error;
    }
  },
};
