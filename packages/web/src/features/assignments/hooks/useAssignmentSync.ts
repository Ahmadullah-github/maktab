/**
 * useAssignmentSync Hook
 *
 * Provides real-time assignment status synchronization across
 * teacher, class, and subject views with status change animations.
 *
 * Requirements: 8.5
 */

import { invalidateAssignmentCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { ClassAssignment } from '../../teachers/types';
import type { AssignmentStatus } from '../types';

/**
 * Parse JSON string or return as-is if already an array
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Raw teacher from API (with JSON strings)
 */
interface TeacherRaw {
  id: number;
  classAssignments: string | ClassAssignment[];
  isDeleted?: boolean;
}

/**
 * Raw class from API (with JSON strings)
 */
interface ClassGroupRaw {
  id: number;
  subjectRequirements: string | SubjectRequirement[];
  isDeleted?: boolean;
}

/**
 * Parsed teacher for internal use
 */
interface TeacherParsed {
  id: number;
  classAssignments: ClassAssignment[];
}

/**
 * Parsed class for internal use
 */
interface ClassGroupParsed {
  id: number;
  subjectRequirements: SubjectRequirement[];
}

/**
 * Status change event for animations
 */
export interface StatusChangeEvent {
  entityType: 'teacher' | 'class' | 'subject';
  entityId: number;
  previousStatus: AssignmentStatus;
  newStatus: AssignmentStatus;
  timestamp: number;
}

/**
 * Assignment sync state for an entity
 */
export interface AssignmentSyncState {
  status: AssignmentStatus;
  lastUpdated: number;
  isAnimating: boolean;
}

/**
 * Options for the useAssignmentSync hook
 */
export interface UseAssignmentSyncOptions {
  /** Duration of status change animation in ms */
  animationDuration?: number;
  /** Callback when status changes */
  onStatusChange?: (event: StatusChangeEvent) => void;
  /** Enable status change animations */
  enableAnimations?: boolean;
}

/**
 * Result of the useAssignmentSync hook
 */
export interface UseAssignmentSyncResult {
  /** Get sync state for a teacher */
  getTeacherSyncState: (teacherId: number) => AssignmentSyncState | null;
  /** Get sync state for a class */
  getClassSyncState: (classId: number) => AssignmentSyncState | null;
  /** Get sync state for a subject */
  getSubjectSyncState: (subjectId: number) => AssignmentSyncState | null;
  /** Update teacher assignment status */
  updateTeacherStatus: (teacherId: number, status: AssignmentStatus) => void;
  /** Update class assignment status */
  updateClassStatus: (classId: number, status: AssignmentStatus) => void;
  /** Update subject assignment status */
  updateSubjectStatus: (subjectId: number, status: AssignmentStatus) => void;
  /** Sync all statuses from current data */
  syncAllStatuses: () => void;
  /** Get recent status changes for animations */
  recentChanges: StatusChangeEvent[];
  /** Clear animation state for an entity */
  clearAnimation: (entityType: 'teacher' | 'class' | 'subject', entityId: number) => void;
  /** Check if any entity is currently animating */
  isAnyAnimating: boolean;
  /** Invalidate and refresh all assignment data */
  refreshAssignments: () => void;
}

/**
 * Calculate assignment status for a teacher
 */
function calculateTeacherStatus(teacher: TeacherParsed): AssignmentStatus {
  if (!teacher.classAssignments || teacher.classAssignments.length === 0) {
    return 'unassigned';
  }

  // Check if all assignments have classes
  const hasEmptyAssignments = teacher.classAssignments.some(
    (a) => !a.classIds || a.classIds.length === 0
  );

  if (hasEmptyAssignments) {
    return 'partial';
  }

  return 'assigned';
}

/**
 * Calculate assignment status for a class
 */
function calculateClassStatus(classGroup: ClassGroupParsed): AssignmentStatus {
  if (!classGroup.subjectRequirements || classGroup.subjectRequirements.length === 0) {
    return 'unassigned';
  }

  const assignedCount = classGroup.subjectRequirements.filter((r) => r.teacherId).length;
  const totalCount = classGroup.subjectRequirements.length;

  if (assignedCount === 0) {
    return 'unassigned';
  }

  if (assignedCount < totalCount) {
    return 'partial';
  }

  return 'assigned';
}

/**
 * Calculate assignment status for a subject based on coverage
 */
function calculateSubjectStatus(subject: Subject, classes: ClassGroupParsed[]): AssignmentStatus {
  // Find classes that require this subject
  const classesRequiring = classes.filter((c) =>
    c.subjectRequirements?.some((r) => r.subjectId === subject.id)
  );

  if (classesRequiring.length === 0) {
    return 'unassigned';
  }

  // Count assigned classes
  const assignedCount = classesRequiring.filter((c) => {
    const req = c.subjectRequirements?.find((r) => r.subjectId === subject.id);
    return req?.teacherId;
  }).length;

  if (assignedCount === 0) {
    return 'unassigned';
  }

  if (assignedCount < classesRequiring.length) {
    return 'partial';
  }

  return 'assigned';
}

/**
 * Hook for real-time assignment status synchronization
 *
 * Provides status synchronization across teacher, class, and subject views
 * with status change animations and feedback.
 *
 * @param options - Configuration options
 * @returns Status synchronization functions and state
 */
export function useAssignmentSync(options: UseAssignmentSyncOptions = {}): UseAssignmentSyncResult {
  const { animationDuration = 500, onStatusChange, enableAnimations = true } = options;

  const queryClient = useQueryClient();

  // State for tracking sync states
  const [teacherStates, setTeacherStates] = useState<Map<number, AssignmentSyncState>>(new Map());
  const [classStates, setClassStates] = useState<Map<number, AssignmentSyncState>>(new Map());
  const [subjectStates, setSubjectStates] = useState<Map<number, AssignmentSyncState>>(new Map());
  const [recentChanges, setRecentChanges] = useState<StatusChangeEvent[]>([]);

  // Refs for animation timeouts
  const animationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Get cached data from query cache
   */
  const getCachedData = useCallback(() => {
    const teachersRaw = queryClient.getQueryData<TeacherRaw[]>(QUERY_KEYS.teachers) ?? [];
    const subjects = queryClient.getQueryData<Subject[]>(QUERY_KEYS.subjects) ?? [];
    const classesRaw = queryClient.getQueryData<ClassGroupRaw[]>(QUERY_KEYS.classes) ?? [];

    // Parse teachers
    const teachers: TeacherParsed[] = teachersRaw
      .filter((t) => !t.isDeleted)
      .map((t) => ({
        id: t.id,
        classAssignments: parseJsonArray<ClassAssignment>(t.classAssignments),
      }));

    // Parse classes
    const classes: ClassGroupParsed[] = classesRaw
      .filter((c) => !c.isDeleted)
      .map((c) => ({
        id: c.id,
        subjectRequirements: parseJsonArray<SubjectRequirement>(c.subjectRequirements),
      }));

    return {
      teachers,
      subjects: subjects.filter((s) => !s.isDeleted),
      classes,
    };
  }, [queryClient]);

  /**
   * Create a status change event
   */
  const createStatusChangeEvent = useCallback(
    (
      entityType: 'teacher' | 'class' | 'subject',
      entityId: number,
      previousStatus: AssignmentStatus,
      newStatus: AssignmentStatus
    ): StatusChangeEvent => {
      const event: StatusChangeEvent = {
        entityType,
        entityId,
        previousStatus,
        newStatus,
        timestamp: Date.now(),
      };

      // Add to recent changes
      setRecentChanges((prev) => {
        const updated = [event, ...prev].slice(0, 10); // Keep last 10 changes
        return updated;
      });

      // Trigger callback
      if (onStatusChange) {
        onStatusChange(event);
      }

      return event;
    },
    [onStatusChange]
  );

  /**
   * Set animation state for an entity
   */
  const setAnimating = useCallback(
    (entityType: 'teacher' | 'class' | 'subject', entityId: number, isAnimating: boolean) => {
      if (!enableAnimations) return;

      const key = `${entityType}-${entityId}`;

      // Clear existing timeout
      const existingTimeout = animationTimeouts.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set animation state
      const setStateFn =
        entityType === 'teacher'
          ? setTeacherStates
          : entityType === 'class'
            ? setClassStates
            : setSubjectStates;

      setStateFn((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(entityId);
        if (existing) {
          newMap.set(entityId, { ...existing, isAnimating });
        }
        return newMap;
      });

      // Auto-clear animation after duration
      if (isAnimating) {
        const timeout = setTimeout(() => {
          setStateFn((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(entityId);
            if (existing) {
              newMap.set(entityId, { ...existing, isAnimating: false });
            }
            return newMap;
          });
          animationTimeouts.current.delete(key);
        }, animationDuration);

        animationTimeouts.current.set(key, timeout);
      }
    },
    [enableAnimations, animationDuration]
  );

  /**
   * Update teacher assignment status
   */
  const updateTeacherStatus = useCallback(
    (teacherId: number, status: AssignmentStatus) => {
      setTeacherStates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(teacherId);
        const previousStatus = existing?.status ?? 'unassigned';

        if (previousStatus !== status) {
          createStatusChangeEvent('teacher', teacherId, previousStatus, status);
          setAnimating('teacher', teacherId, true);
        }

        newMap.set(teacherId, {
          status,
          lastUpdated: Date.now(),
          isAnimating: previousStatus !== status && enableAnimations,
        });

        return newMap;
      });
    },
    [createStatusChangeEvent, setAnimating, enableAnimations]
  );

  /**
   * Update class assignment status
   */
  const updateClassStatus = useCallback(
    (classId: number, status: AssignmentStatus) => {
      setClassStates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(classId);
        const previousStatus = existing?.status ?? 'unassigned';

        if (previousStatus !== status) {
          createStatusChangeEvent('class', classId, previousStatus, status);
          setAnimating('class', classId, true);
        }

        newMap.set(classId, {
          status,
          lastUpdated: Date.now(),
          isAnimating: previousStatus !== status && enableAnimations,
        });

        return newMap;
      });
    },
    [createStatusChangeEvent, setAnimating, enableAnimations]
  );

  /**
   * Update subject assignment status
   */
  const updateSubjectStatus = useCallback(
    (subjectId: number, status: AssignmentStatus) => {
      setSubjectStates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(subjectId);
        const previousStatus = existing?.status ?? 'unassigned';

        if (previousStatus !== status) {
          createStatusChangeEvent('subject', subjectId, previousStatus, status);
          setAnimating('subject', subjectId, true);
        }

        newMap.set(subjectId, {
          status,
          lastUpdated: Date.now(),
          isAnimating: previousStatus !== status && enableAnimations,
        });

        return newMap;
      });
    },
    [createStatusChangeEvent, setAnimating, enableAnimations]
  );

  /**
   * Sync all statuses from current data
   */
  const syncAllStatuses = useCallback(() => {
    const { teachers, subjects, classes } = getCachedData();

    // Sync teacher statuses
    for (const teacher of teachers) {
      const status = calculateTeacherStatus(teacher);
      updateTeacherStatus(teacher.id, status);
    }

    // Sync class statuses
    for (const classGroup of classes) {
      const status = calculateClassStatus(classGroup);
      updateClassStatus(classGroup.id, status);
    }

    // Sync subject statuses
    for (const subject of subjects) {
      const status = calculateSubjectStatus(subject, classes);
      updateSubjectStatus(subject.id, status);
    }
  }, [getCachedData, updateTeacherStatus, updateClassStatus, updateSubjectStatus]);

  /**
   * Get sync state for a teacher
   */
  const getTeacherSyncState = useCallback(
    (teacherId: number): AssignmentSyncState | null => {
      return teacherStates.get(teacherId) ?? null;
    },
    [teacherStates]
  );

  /**
   * Get sync state for a class
   */
  const getClassSyncState = useCallback(
    (classId: number): AssignmentSyncState | null => {
      return classStates.get(classId) ?? null;
    },
    [classStates]
  );

  /**
   * Get sync state for a subject
   */
  const getSubjectSyncState = useCallback(
    (subjectId: number): AssignmentSyncState | null => {
      return subjectStates.get(subjectId) ?? null;
    },
    [subjectStates]
  );

  /**
   * Clear animation state for an entity
   */
  const clearAnimation = useCallback(
    (entityType: 'teacher' | 'class' | 'subject', entityId: number) => {
      setAnimating(entityType, entityId, false);
    },
    [setAnimating]
  );

  /**
   * Check if any entity is currently animating
   */
  const isAnyAnimating = useMemo(() => {
    const checkMap = (map: Map<number, AssignmentSyncState>) => {
      for (const state of map.values()) {
        if (state.isAnimating) return true;
      }
      return false;
    };

    return checkMap(teacherStates) || checkMap(classStates) || checkMap(subjectStates);
  }, [teacherStates, classStates, subjectStates]);

  /**
   * Invalidate and refresh all assignment data
   */
  const refreshAssignments = useCallback(() => {
    invalidateAssignmentCaches(queryClient);
  }, [queryClient]);

  // Cleanup animation timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of animationTimeouts.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return useMemo(
    () => ({
      getTeacherSyncState,
      getClassSyncState,
      getSubjectSyncState,
      updateTeacherStatus,
      updateClassStatus,
      updateSubjectStatus,
      syncAllStatuses,
      recentChanges,
      clearAnimation,
      isAnyAnimating,
      refreshAssignments,
    }),
    [
      getTeacherSyncState,
      getClassSyncState,
      getSubjectSyncState,
      updateTeacherStatus,
      updateClassStatus,
      updateSubjectStatus,
      syncAllStatuses,
      recentChanges,
      clearAnimation,
      isAnyAnimating,
      refreshAssignments,
    ]
  );
}

export default useAssignmentSync;
