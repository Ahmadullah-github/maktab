import { API_BASE_URL } from './apiBase';

/**
 * API client configuration and utilities
 * @module lib/api
 */

export type ApiErrorPayload =
  | string
  | {
      code?: string;
      message?: string;
      error?:
        | string
        | {
            message?: string;
            details?: Record<string, string[]>;
          };
      details?: Record<string, string[]>;
    };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: ApiErrorPayload
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get machine ID from localStorage (set by useLicense hook)
 */
function getMachineId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('maktab_machine_id');
  }
  return null;
}

function formatValidationDetails(details?: Record<string, string[]>): string | null {
  if (!details) {
    return null;
  }

  for (const messages of Object.values(details)) {
    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0];
    }
  }

  return null;
}

export function extractApiErrorMessage(payload: ApiErrorPayload, fallback: string): string {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if (typeof payload.error === 'string' && payload.error.trim() !== '') {
    return payload.error;
  }

  if (payload.error && typeof payload.error === 'object') {
    const nestedMessage = payload.error.message?.trim();
    if (nestedMessage) {
      const detailMessage = formatValidationDetails(payload.error.details);
      return detailMessage ? `${nestedMessage}: ${detailMessage}` : nestedMessage;
    }

    const nestedDetailMessage = formatValidationDetails(payload.error.details);
    if (nestedDetailMessage) {
      return nestedDetailMessage;
    }
  }

  if (payload.message?.trim()) {
    const detailMessage = formatValidationDetails(payload.details);
    return detailMessage ? `${payload.message}: ${detailMessage}` : payload.message;
  }

  const detailMessage = formatValidationDetails(payload.details);
  return detailMessage || fallback;
}

/**
 * Base fetch wrapper with error handling
 */
export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const machineId = getMachineId();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(machineId ? { 'X-Machine-Id': machineId } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const fallback = `HTTP error! status: ${response.status}`;
    const error = (await response.json().catch(() => ({
      message: response.statusText,
    }))) as ApiErrorPayload;
    throw new ApiError(extractApiErrorMessage(error, fallback), response.status, error);
  }

  // Handle empty responses (204 No Content, etc.)
  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  // Try to parse JSON, return undefined if empty
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
}

/**
 * API client with resource-specific methods
 */
export const api = {
  curriculum: {
    effective: () =>
      fetchAPI<Record<string, {
        category: string | null;
        subjects: Array<{
          name: string;
          nameEn: string;
          code: string;
          periodsPerWeek: number;
          isDifficult?: boolean;
          requiredRoomType?: string | null;
          isCore?: boolean;
        }>;
        totalPeriods: number;
        expectedPeriods: number;
      }>>('/curriculum/effective'),
  },
  assignmentProjections: {
    getAssignmentMatrix: () => fetchAPI<unknown>('/assignment-matrix'),
    getClassAssignmentView: (classId: number) =>
      fetchAPI<unknown>(`/classes/${classId}/assignment-view`),
    getSubjectCoverageView: (subjectId: number) =>
      fetchAPI<unknown>(`/subjects/${subjectId}/coverage-view`),
    getTeacherWorkloadView: (teacherId: number) =>
      fetchAPI<unknown>(`/teachers/${teacherId}/workload-view`),
    getTeacherWorkloadViews: () => fetchAPI<unknown[]>('/teachers/workload-views'),
    getTeacherAssignmentSummary: (teacherId: number) =>
      fetchAPI<unknown>(`/teachers/${teacherId}/assignment-summary`),
  },
  assignmentCommands: {
    updateTeacherCapability: (data: {
      teacherId: number;
      subjectId: number;
      capabilityLevel: 'primary' | 'allowed' | null;
      removeAssignments: boolean;
    }) =>
      fetchAPI<unknown>('/assignments/capability', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  teachers: {
    list: () => fetchAPI<unknown[]>('/teachers'),
    get: (id: number) => fetchAPI<unknown>(`/teachers/${id}`),
    create: (data: unknown) =>
      fetchAPI<unknown>('/teachers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchAPI<unknown>(`/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/teachers/${id}`, {
        method: 'DELETE',
      }),
    bulkCreate: (teachers: unknown[]) =>
      fetchAPI<unknown[]>('/teachers/bulk', {
        method: 'POST',
        body: JSON.stringify({ teachers }),
      }),
    bulkDelete: (ids: number[]) =>
      fetchAPI<{ deletedCount: number }>('/teachers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  },
  subjects: {
    list: () => fetchAPI<unknown[]>('/subjects'),
    get: (id: number) => fetchAPI<unknown>(`/subjects/${id}`),
    create: (data: unknown) =>
      fetchAPI<unknown>('/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchAPI<unknown>(`/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/subjects/${id}`, {
        method: 'DELETE',
      }),
    bulkDelete: (ids: number[]) =>
      fetchAPI<{ deleted: number; deletedIds: number[] }>('/subjects/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    syncCurriculum: (grades: number[], schoolId: number | null = null) =>
      fetchAPI<{
        grades: number[];
        createdOrUpdatedSubjects: number;
        removedSubjects: number;
        synchronizedClasses: number;
        subjects: unknown[];
      }>('/subjects/curriculum/sync', {
        method: 'POST',
        body: JSON.stringify({ grades, schoolId }),
      }),
    clearCurriculum: (grades: number[], schoolId: number | null = null) =>
      fetchAPI<{ count: number; deletedIds: number[] }>('/subjects/curriculum/clear', {
        method: 'POST',
        body: JSON.stringify({ grades, schoolId }),
      }),
    insertCurriculum: (grade: number, schoolId: number | null = null) =>
      fetchAPI<{ count: number; subjects: unknown[] }>(
        `/subjects/grade/${grade}/insert-curriculum`,
        { method: 'POST', body: JSON.stringify({ schoolId }) }
      ),
    clearGrade: (grade: number) =>
      fetchAPI<{ count: number }>(`/subjects/grade/${grade}`, { method: 'DELETE' }),
  },
  classes: {
    list: () => fetchAPI<unknown[]>('/classes'),
    get: (id: number) => fetchAPI<unknown>(`/classes/${id}`),
    create: (data: unknown) =>
      fetchAPI<unknown>('/classes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchAPI<unknown>(`/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/classes/${id}`, {
        method: 'DELETE',
      }),
    bulkCreate: (classes: unknown[]) =>
      fetchAPI<unknown[]>('/classes/bulk', {
        method: 'POST',
        body: JSON.stringify({ classes }),
      }),
    bulkApplyCurriculum: (classIds: number[], overwrite: boolean = false) =>
      fetchAPI<{
        updated: number;
        skipped: number;
        failed: number;
        details: Array<{
          classId: number;
          className: string;
          status: 'updated' | 'skipped' | 'failed';
          reason?: string;
        }>;
      }>('/classes/bulk-apply-curriculum', {
        method: 'POST',
        body: JSON.stringify({ classIds, overwrite }),
      }),
  },
  rooms: {
    list: () => fetchAPI<unknown[]>('/rooms'),
    get: (id: number) => fetchAPI<unknown>(`/rooms/${id}`),
    create: (data: unknown) =>
      fetchAPI<unknown>('/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchAPI<unknown>(`/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/rooms/${id}`, {
        method: 'DELETE',
      }),
    bulkCreate: (rooms: unknown[]) =>
      fetchAPI<unknown[]>('/rooms/bulk', {
        method: 'POST',
        body: JSON.stringify({ rooms }),
      }),
    bulkDelete: (ids: number[]) =>
      fetchAPI<{ deletedIds: number[] }>('/rooms/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    listDeleted: () => fetchAPI<unknown[]>('/rooms/deleted'),
    restore: (id: number) =>
      fetchAPI<unknown>(`/rooms/${id}/restore`, { method: 'POST' }),
  },
  config: {
    getSchoolConfig: () => fetchAPI<unknown>('/config/school-config'),
    updateGeneralSchoolConfig: (data: unknown) =>
      fetchAPI<unknown>('/config/school-config/general', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updatePeriodStructure: (data: unknown) =>
      fetchAPI<unknown>('/config/school-config/periods', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    get: (key: string) => fetchAPI<{ key: string; value: unknown }>(`/config/${key}`),
    save: (key: string, value: unknown) =>
      fetchAPI<unknown>(`/config/${key}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      }),
  },
  roomTypes: {
    list: () => fetchAPI<unknown[]>('/room-types'),
    listArchived: () => fetchAPI<unknown[]>('/room-types/archived'),
    get: (id: number) => fetchAPI<unknown>(`/room-types/${id}`),
    create: (data: unknown) =>
      fetchAPI<unknown>('/room-types', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchAPI<unknown>(`/room-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/room-types/${id}`, {
        method: 'DELETE',
      }),
    restore: (id: number) =>
      fetchAPI<unknown>(`/room-types/${id}/restore`, { method: 'POST' }),
  },
};
