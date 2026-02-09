/**
 * API functions for Teacher-Class-Subject Assignments
 *
 * Handles communication with the /api/teacher-assignments endpoint
 */

import type {
  AssignmentSummary,
  AssignmentValidation,
  CreateTeacherAssignmentInput,
  TeacherClassSubjectAssignment,
  UpdateTeacherAssignmentInput,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Base fetch wrapper
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
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
}

/**
 * Teacher Assignments API client
 */
export const teacherAssignmentsApi = {
  /**
   * Get all assignments
   */
  async getAll(): Promise<TeacherClassSubjectAssignment[]> {
    return fetchAPI<TeacherClassSubjectAssignment[]>('/teacher-assignments');
  },

  /**
   * Get assignment by ID
   */
  async getById(id: number): Promise<TeacherClassSubjectAssignment> {
    return fetchAPI<TeacherClassSubjectAssignment>(`/teacher-assignments/${id}`);
  },

  /**
   * Get assignments for a specific class
   */
  async getByClass(classId: number): Promise<TeacherClassSubjectAssignment[]> {
    return fetchAPI<TeacherClassSubjectAssignment[]>(`/teacher-assignments/class/${classId}`);
  },

  /**
   * Get assignments for a specific teacher
   */
  async getByTeacher(teacherId: number): Promise<TeacherClassSubjectAssignment[]> {
    return fetchAPI<TeacherClassSubjectAssignment[]>(`/teacher-assignments/teacher/${teacherId}`);
  },

  /**
   * Get assignments for a specific class-subject pair
   */
  async getByClassAndSubject(
    classId: number,
    subjectId: number
  ): Promise<TeacherClassSubjectAssignment[]> {
    return fetchAPI<TeacherClassSubjectAssignment[]>(
      `/teacher-assignments/class/${classId}/subject/${subjectId}`
    );
  },

  /**
   * Get assignment summary for a class-subject pair
   */
  async getSummary(classId: number, subjectId: number): Promise<AssignmentSummary> {
    return fetchAPI<AssignmentSummary>(`/teacher-assignments/summary/${classId}/${subjectId}`);
  },

  /**
   * Create a new assignment
   */
  async create(data: CreateTeacherAssignmentInput): Promise<TeacherClassSubjectAssignment> {
    return fetchAPI<TeacherClassSubjectAssignment>('/teacher-assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Bulk create assignments
   */
  async bulkCreate(
    assignments: CreateTeacherAssignmentInput[]
  ): Promise<TeacherClassSubjectAssignment[]> {
    return fetchAPI<TeacherClassSubjectAssignment[]>('/teacher-assignments/bulk', {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    });
  },

  /**
   * Update an existing assignment
   */
  async update(
    id: number,
    data: UpdateTeacherAssignmentInput
  ): Promise<TeacherClassSubjectAssignment> {
    return fetchAPI<TeacherClassSubjectAssignment>(`/teacher-assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete an assignment
   */
  async delete(id: number): Promise<void> {
    return fetchAPI<void>(`/teacher-assignments/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Validate if an assignment can be made
   */
  async validate(
    classId: number,
    subjectId: number,
    requiredPeriods: number,
    excludeAssignmentId?: number
  ): Promise<AssignmentValidation> {
    return fetchAPI<AssignmentValidation>('/teacher-assignments/validate', {
      method: 'POST',
      body: JSON.stringify({
        classId,
        subjectId,
        requiredPeriods,
        excludeAssignmentId,
      }),
    });
  },
};
