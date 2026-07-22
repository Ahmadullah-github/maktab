/**
 * API functions for Subjects CRUD operations
 *
 * Handles communication with the /api/subjects endpoint,
 * including serialization/deserialization of complex fields
 *
 * Requirements: 1.1, 3.4, 4.3, 5.2, 9.3, 10.2
 */

import { api } from '@/lib/api';
import type { Subject, SubjectFormValues, SubjectResponse } from './types';
import { apiLogger, logger } from './utils/logger';
import { deserializeSubject, serializeSubjectForApi } from './utils/serialization';

/**
 * Subjects API client
 *
 * Provides typed methods for all CRUD operations on subjects
 * with automatic serialization/deserialization and debug logging
 */
export const subjectsApi = {
  getEffectiveCurriculum: () => api.curriculum.effective(),
  updateGradeSubjectPeriods: (
    grade: number,
    subjectId: number,
    periodsPerWeek: number,
    schoolId: number | null = null
  ) => api.curriculum.updateGradeSubjectPeriods(grade, subjectId, periodsPerWeek, schoolId),
  /**
   * Fetches all non-deleted subjects
   * Requirements: 1.1
   */
  async getAll(): Promise<Subject[]> {
    apiLogger.request('GET', '/subjects');

    try {
      const response = (await api.subjects.list()) as SubjectResponse[];
      const subjects = response.map(deserializeSubject);

      apiLogger.response('GET', '/subjects', 200, { count: subjects.length });
      logger.debug('Fetched all subjects', { count: subjects.length });

      return subjects;
    } catch (error) {
      apiLogger.error('GET', '/subjects', error);
      throw error;
    }
  },

  /**
   * Fetches a single subject by ID
   * Requirements: 3.4
   */
  async getById(id: number): Promise<Subject> {
    apiLogger.request('GET', `/subjects/${id}`);

    try {
      const response = (await api.subjects.get(id)) as SubjectResponse;
      const subject = deserializeSubject(response);

      apiLogger.response('GET', `/subjects/${id}`, 200, { id: subject.id });
      logger.debug('Fetched subject', { id, name: subject.name });

      return subject;
    } catch (error) {
      apiLogger.error('GET', `/subjects/${id}`, error);
      throw error;
    }
  },

  /**
   * Creates a new subject
   * Requirements: 4.3
   */
  async create(data: SubjectFormValues): Promise<Subject> {
    const payload = serializeSubjectForApi(data);
    apiLogger.request('POST', '/subjects', payload);

    try {
      const response = (await api.subjects.create(payload)) as SubjectResponse;
      const subject = deserializeSubject(response);

      apiLogger.response('POST', '/subjects', 201, { id: subject.id });
      logger.info('Subject created', { id: subject.id, name: subject.name });

      return subject;
    } catch (error) {
      apiLogger.error('POST', '/subjects', error);
      throw error;
    }
  },

  /**
   * Updates an existing subject
   * Requirements: 3.4
   */
  async update(id: number, data: Partial<SubjectFormValues>): Promise<Subject> {
    const payload = serializeSubjectForApi(data);
    apiLogger.request('PUT', `/subjects/${id}`, payload);

    try {
      const response = (await api.subjects.update(id, payload)) as SubjectResponse;
      const subject = deserializeSubject(response);

      apiLogger.response('PUT', `/subjects/${id}`, 200, { id: subject.id });
      logger.info('Subject updated', { id: subject.id, name: subject.name });

      return subject;
    } catch (error) {
      apiLogger.error('PUT', `/subjects/${id}`, error);
      throw error;
    }
  },

  /**
   * Permanently deletes a subject and dependent assignment data
   * Requirements: 5.2
   */
  async delete(id: number): Promise<void> {
    apiLogger.request('DELETE', `/subjects/${id}`);

    try {
      await api.subjects.delete(id);

      apiLogger.response('DELETE', `/subjects/${id}`, 200);
      logger.info('Subject deleted', { id });
    } catch (error) {
      apiLogger.error('DELETE', `/subjects/${id}`, error);
      throw error;
    }
  },

  async bulkDelete(ids: number[]): Promise<{ deleted: number; deletedIds: number[] }> {
    apiLogger.request('POST', '/subjects/bulk-delete', { ids });
    const result = await api.subjects.bulkDelete(ids);
    apiLogger.response('POST', '/subjects/bulk-delete', 200, { deleted: result.deleted });
    return result;
  },

  /**
   * Inserts curriculum subjects for a specific grade (bulk upsert)
   * Requirements: 9.3
   *
   * The backend materializes its saved school curriculum.
   */
  async insertCurriculum(grade: number): Promise<{ count: number; subjects: Subject[] }> {
    const url = `/subjects/grade/${grade}/insert-curriculum`;
    apiLogger.request('POST', url, { grade });

    try {
      const result = await api.subjects.insertCurriculum(grade);

      apiLogger.response('POST', url, 200, { count: result.count });
      logger.info('Curriculum inserted', { grade, count: result.count });

      return { ...result, subjects: result.subjects as Subject[] };
    } catch (error) {
      apiLogger.error('POST', url, error);
      throw error;
    }
  },

  async syncCurriculum(grades: number[]) {
    apiLogger.request('POST', '/subjects/curriculum/sync', { grades });
    const result = await api.subjects.syncCurriculum(grades);
    apiLogger.response('POST', '/subjects/curriculum/sync', 200, {
      count: result.createdOrUpdatedSubjects,
    });
    return { ...result, subjects: result.subjects as Subject[] };
  },

  async clearCurriculum(grades: number[]) {
    apiLogger.request('POST', '/subjects/curriculum/clear', { grades });
    const result = await api.subjects.clearCurriculum(grades);
    apiLogger.response('POST', '/subjects/curriculum/clear', 200, { count: result.count });
    return result;
  },

  /**
   * Clears all subjects for a specific grade (bulk delete)
   * Requirements: 10.2
   */
  async clearGradeSubjects(grade: number): Promise<{ count: number }> {
    const url = `/subjects/grade/${grade}`;
    apiLogger.request('DELETE', url);

    try {
      const result = await api.subjects.clearGrade(grade);

      apiLogger.response('DELETE', url, 200, { count: result.count });
      logger.info('Grade subjects cleared', { grade, count: result.count });

      return result;
    } catch (error) {
      apiLogger.error('DELETE', url, error);
      throw error;
    }
  },
};
