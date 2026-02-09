/**
 * Assignment Cache Manager
 *
 * Provides efficient TanStack Query caching strategies for assignment data.
 * Implements optimistic updates and smart cache invalidation patterns.
 *
 * Requirements: 11.6
 */

import type { QueryClient } from '@tanstack/react-query';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  SubjectCoverage,
  TeacherCompatibility,
  TeacherWorkload,
} from '../types';

// ============================================================================
// JSON Parsing Helpers
// ============================================================================

/**
 * Safely parse JSON array from string or return as-is if already an array
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
 * Ensure subjectRequirements is always an array (handles JSON string from API)
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(requirements);
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Centralized query keys for assignment-related data
 */
export const ASSIGNMENT_QUERY_KEYS = {
  // Base entity keys
  teachers: ['teachers'] as const,
  classes: ['classes'] as const,
  subjects: ['subjects'] as const,

  // Computed data keys
  teacherWorkload: (teacherId: number) => ['teacherWorkload', teacherId] as const,
  subjectCoverage: (subjectId: number) => ['subjectCoverage', subjectId] as const,
  teacherCompatibility: (subjectId: number) => ['teacherCompatibility', subjectId] as const,
  assignmentConflicts: ['assignmentConflicts'] as const,

  // Batch keys for bulk operations
  allWorkloads: ['allWorkloads'] as const,
  allCoverages: ['allCoverages'] as const,
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Default stale times for different data types (in milliseconds)
 */
export const CACHE_STALE_TIMES = {
  /** Entity data (teachers, classes, subjects) - 5 minutes */
  entities: 5 * 60 * 1000,
  /** Computed data (workloads, coverage) - 1 minute */
  computed: 1 * 60 * 1000,
  /** Conflict data - 30 seconds (needs to be fresh) */
  conflicts: 30 * 1000,
} as const;

/**
 * Default cache times (garbage collection) in milliseconds
 */
export const CACHE_GC_TIMES = {
  /** Entity data - 30 minutes */
  entities: 30 * 60 * 1000,
  /** Computed data - 10 minutes */
  computed: 10 * 60 * 1000,
  /** Conflict data - 5 minutes */
  conflicts: 5 * 60 * 1000,
} as const;

// ============================================================================
// Cache Manager Class
// ============================================================================

/**
 * Manages assignment-related cache operations
 */
export class AssignmentCacheManager {
  constructor(private queryClient: QueryClient) {}

  // --------------------------------------------------------------------------
  // Entity Cache Operations
  // --------------------------------------------------------------------------

  /**
   * Get cached teachers
   */
  getCachedTeachers(): Teacher[] {
    const cached = this.queryClient.getQueryData<Teacher[]>(ASSIGNMENT_QUERY_KEYS.teachers);
    return cached?.filter((t) => !t.isDeleted) ?? [];
  }

  /**
   * Get cached classes
   */
  getCachedClasses(): ClassGroup[] {
    const cached = this.queryClient.getQueryData<ClassGroup[]>(ASSIGNMENT_QUERY_KEYS.classes);
    return cached?.filter((c) => !c.isDeleted) ?? [];
  }

  /**
   * Get cached subjects
   */
  getCachedSubjects(): Subject[] {
    const cached = this.queryClient.getQueryData<Subject[]>(ASSIGNMENT_QUERY_KEYS.subjects);
    return cached?.filter((s) => !s.isDeleted) ?? [];
  }

  /**
   * Get a single cached teacher by ID
   */
  getCachedTeacher(teacherId: number): Teacher | undefined {
    return this.getCachedTeachers().find((t) => t.id === teacherId);
  }

  /**
   * Get a single cached class by ID
   * Ensures subjectRequirements is properly parsed
   */
  getCachedClass(classId: number): ClassGroup | undefined {
    const classGroup = this.getCachedClasses().find((c) => c.id === classId);
    if (!classGroup) return undefined;

    // Ensure subjectRequirements is an array
    return {
      ...classGroup,
      subjectRequirements: ensureSubjectRequirements(classGroup.subjectRequirements),
    };
  }

  /**
   * Get a single cached subject by ID
   */
  getCachedSubject(subjectId: number): Subject | undefined {
    return this.getCachedSubjects().find((s) => s.id === subjectId);
  }

  // --------------------------------------------------------------------------
  // Optimistic Update Operations
  // --------------------------------------------------------------------------

  /**
   * Apply optimistic update to a teacher's assignments
   */
  applyOptimisticTeacherUpdate(
    teacherId: number,
    updater: (teacher: Teacher) => Teacher
  ): Teacher | undefined {
    let updatedTeacher: Teacher | undefined;

    this.queryClient.setQueryData<Teacher[]>(ASSIGNMENT_QUERY_KEYS.teachers, (oldTeachers) => {
      if (!oldTeachers) return oldTeachers;

      return oldTeachers.map((teacher) => {
        if (teacher.id !== teacherId) return teacher;
        updatedTeacher = updater(teacher);
        return updatedTeacher;
      });
    });

    return updatedTeacher;
  }

  /**
   * Apply optimistic update to a class's subject requirements
   */
  applyOptimisticClassUpdate(
    classId: number,
    updater: (classGroup: ClassGroup) => ClassGroup
  ): ClassGroup | undefined {
    let updatedClass: ClassGroup | undefined;

    this.queryClient.setQueryData<ClassGroup[]>(ASSIGNMENT_QUERY_KEYS.classes, (oldClasses) => {
      if (!oldClasses) return oldClasses;

      return oldClasses.map((classGroup) => {
        if (classGroup.id !== classId) return classGroup;
        updatedClass = updater(classGroup);
        return updatedClass;
      });
    });

    return updatedClass;
  }

  /**
   * Revert optimistic update by refetching
   */
  revertOptimisticUpdate(entityType: 'teachers' | 'classes' | 'subjects'): void {
    const key = ASSIGNMENT_QUERY_KEYS[entityType];
    this.queryClient.invalidateQueries({ queryKey: key });
  }

  // --------------------------------------------------------------------------
  // Computed Data Cache Operations
  // --------------------------------------------------------------------------

  /**
   * Set cached workload for a teacher
   */
  setCachedWorkload(teacherId: number, workload: TeacherWorkload): void {
    this.queryClient.setQueryData(ASSIGNMENT_QUERY_KEYS.teacherWorkload(teacherId), workload);
  }

  /**
   * Get cached workload for a teacher
   */
  getCachedWorkload(teacherId: number): TeacherWorkload | undefined {
    return this.queryClient.getQueryData<TeacherWorkload>(
      ASSIGNMENT_QUERY_KEYS.teacherWorkload(teacherId)
    );
  }

  /**
   * Set cached coverage for a subject
   */
  setCachedCoverage(subjectId: number, coverage: SubjectCoverage): void {
    this.queryClient.setQueryData(ASSIGNMENT_QUERY_KEYS.subjectCoverage(subjectId), coverage);
  }

  /**
   * Get cached coverage for a subject
   */
  getCachedCoverage(subjectId: number): SubjectCoverage | undefined {
    return this.queryClient.getQueryData<SubjectCoverage>(
      ASSIGNMENT_QUERY_KEYS.subjectCoverage(subjectId)
    );
  }

  /**
   * Set cached teacher compatibility for a subject
   */
  setCachedCompatibility(subjectId: number, compatibility: TeacherCompatibility[]): void {
    this.queryClient.setQueryData(
      ASSIGNMENT_QUERY_KEYS.teacherCompatibility(subjectId),
      compatibility
    );
  }

  /**
   * Get cached teacher compatibility for a subject
   */
  getCachedCompatibility(subjectId: number): TeacherCompatibility[] | undefined {
    return this.queryClient.getQueryData<TeacherCompatibility[]>(
      ASSIGNMENT_QUERY_KEYS.teacherCompatibility(subjectId)
    );
  }

  /**
   * Set cached conflicts
   */
  setCachedConflicts(conflicts: AssignmentConflict[]): void {
    this.queryClient.setQueryData(ASSIGNMENT_QUERY_KEYS.assignmentConflicts, conflicts);
  }

  /**
   * Get cached conflicts
   */
  getCachedConflicts(): AssignmentConflict[] | undefined {
    return this.queryClient.getQueryData<AssignmentConflict[]>(
      ASSIGNMENT_QUERY_KEYS.assignmentConflicts
    );
  }

  // --------------------------------------------------------------------------
  // Cache Invalidation Patterns
  // --------------------------------------------------------------------------

  /**
   * Invalidate all assignment-related caches
   */
  invalidateAll(): void {
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.teachers });
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.classes });
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.subjects });
    this.invalidateComputedCaches();
  }

  /**
   * Invalidate computed caches (workloads, coverage, conflicts)
   */
  invalidateComputedCaches(): void {
    // Invalidate all workload queries
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'teacherWorkload';
      },
    });

    // Invalidate all coverage queries
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'subjectCoverage';
      },
    });

    // Invalidate all compatibility queries
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'teacherCompatibility';
      },
    });

    // Invalidate conflicts
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.assignmentConflicts });
  }

  /**
   * Invalidate caches related to a specific teacher
   */
  invalidateTeacherRelated(teacherId: number): void {
    // Invalidate teacher list
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.teachers });

    // Invalidate teacher's workload
    this.queryClient.invalidateQueries({
      queryKey: ASSIGNMENT_QUERY_KEYS.teacherWorkload(teacherId),
    });

    // Invalidate conflicts (may have changed)
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.assignmentConflicts });

    // Invalidate all coverage (teacher assignments affect coverage)
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'subjectCoverage';
      },
    });
  }

  /**
   * Invalidate caches related to a specific class
   */
  invalidateClassRelated(classId: number): void {
    // Invalidate class list
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.classes });

    // Invalidate conflicts
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.assignmentConflicts });

    // Get the class to find affected subjects
    const classGroup = this.getCachedClass(classId);
    if (classGroup) {
      // Invalidate coverage for subjects in this class
      // subjectRequirements is already parsed by getCachedClass
      classGroup.subjectRequirements.forEach((req) => {
        this.queryClient.invalidateQueries({
          queryKey: ASSIGNMENT_QUERY_KEYS.subjectCoverage(req.subjectId),
        });
      });
    }
  }

  /**
   * Invalidate caches related to a specific subject
   */
  invalidateSubjectRelated(subjectId: number): void {
    // Invalidate subject list
    this.queryClient.invalidateQueries({ queryKey: ASSIGNMENT_QUERY_KEYS.subjects });

    // Invalidate subject's coverage
    this.queryClient.invalidateQueries({
      queryKey: ASSIGNMENT_QUERY_KEYS.subjectCoverage(subjectId),
    });

    // Invalidate subject's compatibility
    this.queryClient.invalidateQueries({
      queryKey: ASSIGNMENT_QUERY_KEYS.teacherCompatibility(subjectId),
    });

    // Invalidate all workloads (subject changes may affect workload calculations)
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'teacherWorkload';
      },
    });
  }

  // --------------------------------------------------------------------------
  // Prefetching
  // --------------------------------------------------------------------------

  /**
   * Prefetch workload for a teacher
   */
  async prefetchWorkload(
    teacherId: number,
    fetchFn: () => Promise<TeacherWorkload>
  ): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ASSIGNMENT_QUERY_KEYS.teacherWorkload(teacherId),
      queryFn: fetchFn,
      staleTime: CACHE_STALE_TIMES.computed,
    });
  }

  /**
   * Prefetch coverage for a subject
   */
  async prefetchCoverage(
    subjectId: number,
    fetchFn: () => Promise<SubjectCoverage>
  ): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ASSIGNMENT_QUERY_KEYS.subjectCoverage(subjectId),
      queryFn: fetchFn,
      staleTime: CACHE_STALE_TIMES.computed,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an AssignmentCacheManager instance
 */
export function createAssignmentCacheManager(queryClient: QueryClient): AssignmentCacheManager {
  return new AssignmentCacheManager(queryClient);
}

export default AssignmentCacheManager;
