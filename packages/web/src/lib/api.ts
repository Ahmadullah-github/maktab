/**
 * API client configuration and utilities
 * @module lib/api
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type ApiErrorPayload =
  | string
  | {
      message?: string;
      error?:
        | string
        | {
            message?: string;
            details?: Record<string, string[]>;
          };
      details?: Record<string, string[]>;
    };

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
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
    throw new Error(extractApiErrorMessage(error, fallback));
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
    getTeacherAssignmentSummary: (teacherId: number) =>
      fetchAPI<unknown>(`/teachers/${teacherId}/assignment-summary`),
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
  },
  config: {
    getSchoolConfig: () => fetchAPI<unknown>('/config/school-config'),
    updateSchoolConfig: (data: unknown) =>
      fetchAPI<unknown>('/config/school-config', {
        method: 'PUT',
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
  },
};
