/**
 * API client configuration and utilities
 * @module lib/api
 */

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

  return response.json();
}

/**
 * API client with resource-specific methods
 */
export const api = {
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
  },
  config: {
    getSchoolConfig: () => fetchAPI<unknown>('/config/school-config'),
    updateSchoolConfig: (data: unknown) =>
      fetchAPI<unknown>('/config/school-config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
};
