/**
 * Optimized Assignment Calculations
 *
 * Provides efficient workload calculation algorithms with memoization
 * and batch processing for bulk operations.
 *
 * Requirements: 11.2, 11.5
 */

import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { ClassAssignment, Teacher } from '../../teachers/types';
import type {
  SubjectCoverage,
  TeacherCompatibility,
  TeacherWorkload,
  WorkloadBreakdown,
  WorkloadStatus,
} from '../types';
import { NEAR_CAPACITY_THRESHOLD, OPTIMAL_UTILIZATION_MIN } from './workloadCalculation';

// ============================================================================
// Memoization Cache
// ============================================================================

/**
 * Simple LRU-like cache for memoization
 */
class MemoCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  private getKey(key: K): string {
    return JSON.stringify(key);
  }

  get(key: K): V | undefined {
    const strKey = this.getKey(key);
    const entry = this.cache.get(strKey);

    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(strKey);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    const strKey = this.getKey(key);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(strKey, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(predicate: (key: string) => boolean): void {
    for (const key of this.cache.keys()) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Global caches for memoization
const workloadCache = new MemoCache<
  { teacherId: number; assignmentsHash: string },
  TeacherWorkload
>(200, 30000);
const coverageCache = new MemoCache<{ subjectId: number; dataHash: string }, SubjectCoverage>(
  100,
  30000
);
const compatibilityCache = new MemoCache<
  { subjectId: number; teachersHash: string },
  TeacherCompatibility[]
>(100, 60000);

// ============================================================================
// Hash Functions for Cache Keys
// ============================================================================

/**
 * Create a hash for assignments array
 */
function hashAssignments(assignments: ClassAssignment[]): string {
  // Ensure assignments is an array
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  return safeAssignments
    .map((a) => {
      const classIds = Array.isArray(a.classIds) ? a.classIds : [];
      return `${a.subjectId}:${classIds.sort().join(',')}`;
    })
    .sort()
    .join('|');
}

/**
 * Parse JSON array safely
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
 * Create a hash for class requirements
 */
function hashClassRequirements(classes: ClassGroup[]): string {
  return classes
    .map((c) => {
      const reqs = parseJsonArray(c.subjectRequirements);
      return `${c.id}:${reqs.map((r) => `${r.subjectId}:${r.periodsPerWeek}`).join(',')}`;
    })
    .sort()
    .join('|');
}

/**
 * Create a hash for teachers
 */
function hashTeachers(teachers: Teacher[]): string {
  return teachers
    .map((t) => `${t.id}:${t.primarySubjectIds.join(',')}:${t.allowedSubjectIds.join(',')}`)
    .sort()
    .join('|');
}

// ============================================================================
// Optimized Workload Calculation
// ============================================================================

/**
 * Calculate workload status efficiently
 */
function calculateWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) return 'underloaded';

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  if (totalPeriods > maxPeriods) return 'overloaded';
  if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) return 'near_capacity';
  if (utilizationPercentage >= OPTIMAL_UTILIZATION_MIN) return 'optimal';
  return 'underloaded';
}

/**
 * Build lookup maps for efficient data access
 */
interface DataLookups {
  subjectMap: Map<number, Subject>;
  classMap: Map<number, ClassGroup>;
  classRequirementMap: Map<string, number>; // `${classId}:${subjectId}` -> periodsPerWeek
}

function buildDataLookups(subjects: Subject[], classes: ClassGroup[]): DataLookups {
  const subjectMap = new Map<number, Subject>();
  const classMap = new Map<number, ClassGroup>();
  const classRequirementMap = new Map<string, number>();

  for (const subject of subjects) {
    subjectMap.set(subject.id, subject);
  }

  for (const classGroup of classes) {
    classMap.set(classGroup.id, classGroup);
    const reqs = parseJsonArray(classGroup.subjectRequirements);
    for (const req of reqs) {
      classRequirementMap.set(`${classGroup.id}:${req.subjectId}`, req.periodsPerWeek);
    }
  }

  return { subjectMap, classMap, classRequirementMap };
}

/**
 * Optimized workload calculation with memoization
 */
export function calculateWorkloadOptimized(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): TeacherWorkload {
  const assignmentsHash = hashAssignments(teacher.classAssignments);
  const cacheKey = { teacherId: teacher.id, assignmentsHash };

  // Check cache
  const cached = workloadCache.get(cacheKey);
  if (cached) return cached;

  // Build lookups for O(1) access
  const lookups = buildDataLookups(subjects, classes);

  // Calculate breakdown efficiently
  const breakdown: WorkloadBreakdown[] = [];
  let totalPeriods = 0;

  // Ensure classAssignments is an array before iterating
  const teacherAssignments = Array.isArray(teacher.classAssignments)
    ? teacher.classAssignments
    : [];
  for (const assignment of teacherAssignments) {
    const subject = lookups.subjectMap.get(assignment.subjectId);
    const subjectName = subject?.name || `Subject ${assignment.subjectId}`;
    const defaultPeriods = subject?.periodsPerWeek || 1;

    let assignmentTotal = 0;

    // Ensure classIds is an array before iterating
    const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
    for (const classId of assignmentClassIds) {
      const key = `${classId}:${assignment.subjectId}`;
      const periods = lookups.classRequirementMap.get(key) || defaultPeriods;
      assignmentTotal += periods;
    }

    totalPeriods += assignmentTotal;

    breakdown.push({
      subjectId: assignment.subjectId,
      subjectName,
      classIds: assignmentClassIds,
      periodsPerWeek: defaultPeriods,
      totalPeriods: assignmentTotal,
    });
  }

  const maxPeriods = teacher.maxPeriodsPerWeek;
  const utilizationPercentage = maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0;
  const status = calculateWorkloadStatus(totalPeriods, maxPeriods);

  const workload: TeacherWorkload = {
    teacherId: teacher.id,
    totalPeriods,
    maxPeriods,
    utilizationPercentage,
    breakdown,
    status,
    remainingCapacity: maxPeriods - totalPeriods,
  };

  // Cache result
  workloadCache.set(cacheKey, workload);

  return workload;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Calculate workloads for multiple teachers in batch
 */
export function calculateWorkloadsBatch(
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): Map<number, TeacherWorkload> {
  // Build lookups once for all teachers
  const lookups = buildDataLookups(subjects, classes);

  const results = new Map<number, TeacherWorkload>();

  for (const teacher of teachers) {
    const assignmentsHash = hashAssignments(teacher.classAssignments);
    const cacheKey = { teacherId: teacher.id, assignmentsHash };

    // Check cache first
    const cached = workloadCache.get(cacheKey);
    if (cached) {
      results.set(teacher.id, cached);
      continue;
    }

    // Calculate using shared lookups
    const breakdown: WorkloadBreakdown[] = [];
    let totalPeriods = 0;

    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      const subject = lookups.subjectMap.get(assignment.subjectId);
      const subjectName = subject?.name || `Subject ${assignment.subjectId}`;
      const defaultPeriods = subject?.periodsPerWeek || 1;

      let assignmentTotal = 0;

      // Ensure classIds is an array before iterating
      const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
      for (const classId of assignmentClassIds) {
        const key = `${classId}:${assignment.subjectId}`;
        const periods = lookups.classRequirementMap.get(key) || defaultPeriods;
        assignmentTotal += periods;
      }

      totalPeriods += assignmentTotal;

      breakdown.push({
        subjectId: assignment.subjectId,
        subjectName,
        classIds: assignmentClassIds,
        periodsPerWeek: defaultPeriods,
        totalPeriods: assignmentTotal,
      });
    }

    const maxPeriods = teacher.maxPeriodsPerWeek;
    const utilizationPercentage = maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0;
    const status = calculateWorkloadStatus(totalPeriods, maxPeriods);

    const workload: TeacherWorkload = {
      teacherId: teacher.id,
      totalPeriods,
      maxPeriods,
      utilizationPercentage,
      breakdown,
      status,
      remainingCapacity: maxPeriods - totalPeriods,
    };

    // Cache and store result
    workloadCache.set(cacheKey, workload);
    results.set(teacher.id, workload);
  }

  return results;
}

/**
 * Calculate coverage for multiple subjects in batch
 */
export function calculateCoveragesBatch(
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[]
): Map<number, SubjectCoverage> {
  const results = new Map<number, SubjectCoverage>();
  const dataHash = hashClassRequirements(classes);

  // Build teacher assignment index: subjectId -> teacherId -> classIds
  const teacherAssignmentIndex = new Map<number, Map<number, number[]>>();

  for (const teacher of teachers) {
    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      if (!teacherAssignmentIndex.has(assignment.subjectId)) {
        teacherAssignmentIndex.set(assignment.subjectId, new Map());
      }
      // Ensure classIds is an array
      const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
      teacherAssignmentIndex.get(assignment.subjectId)!.set(teacher.id, assignmentClassIds);
    }
  }

  // Build class requirement index: subjectId -> classId[]
  const classRequirementIndex = new Map<number, number[]>();

  for (const classGroup of classes) {
    const reqs = parseJsonArray(classGroup.subjectRequirements);
    for (const req of reqs) {
      if (!classRequirementIndex.has(req.subjectId)) {
        classRequirementIndex.set(req.subjectId, []);
      }
      classRequirementIndex.get(req.subjectId)!.push(classGroup.id);
    }
  }

  for (const subject of subjects) {
    const cacheKey = { subjectId: subject.id, dataHash };

    // Check cache
    const cached = coverageCache.get(cacheKey);
    if (cached) {
      results.set(subject.id, cached);
      continue;
    }

    const classesRequiring = classRequirementIndex.get(subject.id) || [];
    const teacherAssignments = teacherAssignmentIndex.get(subject.id) || new Map();

    // Calculate assigned classes
    const assignedClassIds = new Set<number>();
    for (const classIds of teacherAssignments.values()) {
      for (const classId of classIds) {
        assignedClassIds.add(classId);
      }
    }

    const totalClassesRequiring = classesRequiring.length;
    const assignedClasses = assignedClassIds.size;
    const coveragePercentage =
      totalClassesRequiring > 0 ? (assignedClasses / totalClassesRequiring) * 100 : 100;

    let status: 'complete' | 'partial' | 'uncovered';
    if (coveragePercentage >= 100) {
      status = 'complete';
    } else if (coveragePercentage > 0) {
      status = 'partial';
    } else {
      status = 'uncovered';
    }

    const coverage: SubjectCoverage = {
      subjectId: subject.id,
      subjectName: subject.name,
      totalClassesRequiring,
      assignedClasses,
      unassignedClasses: [],
      teacherDistribution: [],
      coveragePercentage,
      status,
    };

    coverageCache.set(cacheKey, coverage);
    results.set(subject.id, coverage);
  }

  return results;
}

/**
 * Calculate teacher compatibility for a subject with memoization
 */
export function calculateCompatibilityOptimized(
  subjectId: number,
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): TeacherCompatibility[] {
  const teachersHash = hashTeachers(teachers);
  const cacheKey = { subjectId, teachersHash };

  // Check cache
  const cached = compatibilityCache.get(cacheKey);
  if (cached) return cached;

  const result: TeacherCompatibility[] = [];

  for (const teacher of teachers) {
    const isPrimary = teacher.primarySubjectIds.includes(subjectId);

    // Include ALL teachers - primary/allowed are preferences, not restrictions
    // Calculate workload efficiently
    const workload = calculateWorkloadOptimized(teacher, subjects, classes);

    // Determine compatibility level for sorting/display
    const compatibility: 'primary' | 'allowed' = isPrimary ? 'primary' : 'allowed';

    result.push({
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      subjectId,
      compatibility,
      currentWorkload: workload.totalPeriods,
      maxWorkload: workload.maxPeriods,
      availableCapacity: workload.remainingCapacity,
      canAcceptAssignment: workload.remainingCapacity > 0,
    });
  }

  // Sort by compatibility (primary first) then by available capacity
  result.sort((a, b) => {
    if (a.compatibility !== b.compatibility) {
      return a.compatibility === 'primary' ? -1 : 1;
    }
    return b.availableCapacity - a.availableCapacity;
  });

  compatibilityCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all calculation caches
 */
export function clearCalculationCaches(): void {
  workloadCache.clear();
  coverageCache.clear();
  compatibilityCache.clear();
}

/**
 * Invalidate caches for a specific teacher
 */
export function invalidateTeacherCache(teacherId: number): void {
  workloadCache.invalidate((key) => key.includes(`"teacherId":${teacherId}`));
}

/**
 * Invalidate caches for a specific subject
 */
export function invalidateSubjectCache(subjectId: number): void {
  coverageCache.invalidate((key) => key.includes(`"subjectId":${subjectId}`));
  compatibilityCache.invalidate((key) => key.includes(`"subjectId":${subjectId}`));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick check if teacher can accept more assignments
 */
export function canAcceptMoreAssignments(
  teacher: Teacher,
  additionalPeriods: number,
  subjects: Subject[],
  classes: ClassGroup[]
): boolean {
  const workload = calculateWorkloadOptimized(teacher, subjects, classes);
  return workload.remainingCapacity >= additionalPeriods;
}

/**
 * Get teachers sorted by available capacity for a subject
 */
export function getTeachersByCapacity(
  subjectId: number,
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): Teacher[] {
  const compatibility = calculateCompatibilityOptimized(subjectId, teachers, subjects, classes);
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  return compatibility
    .filter((c) => c.canAcceptAssignment)
    .map((c) => teacherMap.get(c.teacherId)!)
    .filter(Boolean);
}
