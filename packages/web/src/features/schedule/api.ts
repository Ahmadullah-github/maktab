/**
 * API functions for Schedule CRUD operations
 *
 * Handles communication with the /api/timetables endpoint,
 * including transformation of schedule data
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { NormalizedSchedule, TimetableApiResponse } from './types';
import { apiLogger, logger } from './utils/logger';
import { normalizeSchedule } from './utils/scheduleTransformer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  // Handle empty responses (e.g., DELETE)
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Input type for saving a schedule
 */
export interface SaveScheduleInput {
  name: string;
  description?: string;
  data: string; // JSON string containing solver output
  schoolId?: number | null;
  academicYearId?: number | null;
  termId?: number | null;
}

/**
 * Schedule API response with normalized data
 */
export interface ScheduleApiResult {
  id: number;
  name: string;
  description: string;
  normalized: NormalizedSchedule;
  createdAt: string;
  updatedAt: string;
}

/**
 * Schedule API client
 *
 * Provides typed methods for all CRUD operations on schedules
 * with automatic transformation and debug logging
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export const scheduleApi = {
  /**
   * Fetches a single schedule by ID and returns normalized data
   * Requirements: 5.1
   */
  async getById(id: number): Promise<ScheduleApiResult> {
    apiLogger.request('GET', `/timetables/${id}`);

    try {
      const response = await fetchAPI<TimetableApiResponse>(`/timetables/${id}`);
      const normalized = normalizeSchedule(response);

      apiLogger.response('GET', `/timetables/${id}`, 200, { id: response.id });
      logger.debug('Fetched schedule', { id, name: response.name });

      return {
        id: response.id,
        name: response.name,
        description: response.description,
        normalized,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
    } catch (error) {
      apiLogger.error('GET', `/timetables/${id}`, error);
      throw error;
    }
  },

  /**
   * Fetches all schedules (without normalizing data for list view)
   * Requirements: 5.2
   */
  async getAll(): Promise<TimetableApiResponse[]> {
    apiLogger.request('GET', '/timetables');

    try {
      const response = await fetchAPI<TimetableApiResponse[]>('/timetables');

      apiLogger.response('GET', '/timetables', 200, { count: response.length });
      logger.debug('Fetched all schedules', { count: response.length });

      return response;
    } catch (error) {
      apiLogger.error('GET', '/timetables', error);
      throw error;
    }
  },

  /**
   * Saves a new schedule or updates an existing one
   * Requirements: 5.3
   */
  async save(data: SaveScheduleInput): Promise<TimetableApiResponse> {
    apiLogger.request('POST', '/timetables', { name: data.name });

    try {
      const response = await fetchAPI<TimetableApiResponse>('/timetables', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      apiLogger.response('POST', '/timetables', 201, { id: response.id });
      logger.info('Schedule saved', { id: response.id, name: response.name });

      return response;
    } catch (error) {
      apiLogger.error('POST', '/timetables', error);
      throw error;
    }
  },

  /**
   * Deletes a schedule by ID
   * Requirements: 5.4
   */
  async delete(id: number): Promise<void> {
    apiLogger.request('DELETE', `/timetables/${id}`);

    try {
      await fetchAPI<void>(`/timetables/${id}`, {
        method: 'DELETE',
      });

      apiLogger.response('DELETE', `/timetables/${id}`, 200);
      logger.info('Schedule deleted', { id });
    } catch (error) {
      apiLogger.error('DELETE', `/timetables/${id}`, error);
      throw error;
    }
  },
};
