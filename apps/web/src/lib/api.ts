import { API_BASE_URL } from './apiBase';

/**
 * API client configuration and utilities
 * @module lib/api
 */

export type LocalApiErrorCode = string;

export interface LocalApiErrorDetails extends Record<string, unknown> {}

export interface LocalApiErrorPayload {
  code: LocalApiErrorCode;
  message: string;
  correlationId: string;
  retryable: boolean;
  details?: LocalApiErrorDetails;
}

export interface LocalApiErrorResponse {
  success: false;
  error: LocalApiErrorPayload;
}

export type ApiErrorPayload = LocalApiErrorPayload;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: ApiErrorPayload,
    readonly response?: LocalApiErrorResponse
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function formatValidationDetails(details?: Record<string, unknown>): string | null {
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
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const fallback = `HTTP error! status: ${response.status}`;
    const body = (await response.json().catch(() => null)) as LocalApiErrorResponse | null;
    const error = body?.success === false && body.error
      ? body.error
      : {
          code: 'INTERNAL_ERROR',
          message: response.statusText || fallback,
          correlationId: response.headers.get('x-correlation-id') ?? 'unavailable',
          retryable: response.status >= 500,
        };
    throw new ApiError(extractApiErrorMessage(error, fallback), response.status, error, body ?? undefined);
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
    validateBatch: (data: {
      changes: Array<{
        requirementId: number;
        expectedVersion: number;
        allocations: Array<{ teacherId: number; periodsPerWeek: number }>;
      }>;
      primaryCapabilityGrants?: Array<{ teacherId: number; subjectId: number }>;
    }) =>
      fetchAPI<unknown>('/assignments/batch/validate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    applyBatch: (data: {
      changes: Array<{
        requirementId: number;
        expectedVersion: number;
        allocations: Array<{ teacherId: number; periodsPerWeek: number }>;
      }>;
      primaryCapabilityGrants?: Array<{ teacherId: number; subjectId: number }>;
    }) =>
      fetchAPI<unknown>('/assignments/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
    updateSubjectPeriods: (classId: number, subjectId: number, periodsPerWeek: number) =>
      fetchAPI<unknown>(`/classes/${classId}/requirements/${subjectId}/periods`, {
        method: 'PUT',
        body: JSON.stringify({ periodsPerWeek }),
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
    getOptimizationPreferences: (schoolId: number | null = null) =>
      fetchAPI<unknown>(
        `/config/optimization-preferences${schoolId === null ? '' : `?schoolId=${schoolId}`}`
      ),
    updateOptimizationPreferences: (data: unknown) =>
      fetchAPI<unknown>('/config/optimization-preferences', {
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
