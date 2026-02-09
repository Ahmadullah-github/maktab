/**
 * useAssignmentsPage Hook
 *
 * Aggregates data from classes, teachers, and subjects to provide
 * a unified view for the Assignments Page. Groups classes by grade tier
 * and calculates assignment statistics.
 *
 * Requirements: Phase 2.2
 *
 * REAL-TIME FIX: Now uses useTeacherAssignments() for real-time assignment data
 * instead of reading from class.subjectRequirements[].teacherId
 */

import { useCallback, useMemo, useState } from 'react';
import { useClasses } from '../../classes/hooks/useClasses';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import { GRADE_CATEGORIES } from '../../subjects/data/curriculum';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentGradeCategory,
  AssignmentsFilterState,
  AssignmentsPageStats,
  AssignmentStatus,
  AssignmentStatusFilter,
  ClassAssignmentStats,
  ClassWithAssignmentStatus,
  EnhancedSubjectRequirement,
  GradeGroup,
  GradeGroupStats,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentsPageOptions {
  /** Initial filter state */
  initialFilters?: Partial<AssignmentsFilterState>;
}

export interface UseAssignmentsPageResult {
  /** Grade groups with classes and assignment status */
  gradeGroups: GradeGroup[];
  /** Overall page statistics */
  stats: AssignmentsPageStats;
  /** Current filter state */
  filters: AssignmentsFilterState;
  /** Update search filter */
  setSearch: (search: string) => void;
  /** Update grade category filter */
  setGradeCategory: (category: AssignmentGradeCategory | null) => void;
  /** Update status filter */
  setStatusFilter: (status: AssignmentStatusFilter) => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Raw data for drawer operations */
  rawData: {
    classes: ClassGroup[];
    teachers: Teacher[];
    subjects: Subject[];
  };
  /** Lookup helpers */
  getTeacherById: (id: number) => Teacher | undefined;
  getSubjectById: (id: number) => Subject | undefined;
  getClassById: (id: number) => ClassGroup | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FILTERS: AssignmentsFilterState = {
  search: '',
  gradeCategory: null,
  statusFilter: 'all',
};

const GRADE_CATEGORY_ORDER: AssignmentGradeCategory[] = [
  'Alpha-Primary',
  'Beta-Primary',
  'Middle',
  'High',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get grade category for a given grade number
 */
function getGradeCategoryForGrade(grade: number | null): AssignmentGradeCategory | null {
  if (grade === null) return null;
  if (grade >= 1 && grade <= 3) return 'Alpha-Primary';
  if (grade >= 4 && grade <= 6) return 'Beta-Primary';
  if (grade >= 7 && grade <= 9) return 'Middle';
  if (grade >= 10 && grade <= 12) return 'High';
  return null;
}

/**
 * Calculate assignment status for a single requirement
 * REAL-TIME FIX: Now accepts assignments from the assignments table
 *
 * IMPORTANT: The assignment table is the source of truth.
 * Primary/allowed subjects are for solver optimization, not UI validation.
 * If an assignment exists, it's valid - the admin made that decision.
 */
function calculateRequirementStatus(
  requirement: SubjectRequirement,
  classId: number,
  teachers: Teacher[],
  assignments: TeacherClassSubjectAssignment[]
): AssignmentStatus {
  // REAL-TIME FIX: Check assignments table for the actual assignment
  const assignment = assignments.find(
    (a) => a.classId === classId && a.subjectId === requirement.subjectId && !a.isDeleted
  );

  if (!assignment) {
    return 'unassigned';
  }

  const teacher = teachers.find((t) => t.id === assignment.teacherId);
  if (!teacher) {
    return 'conflict'; // Teacher assigned but doesn't exist (deleted?)
  }

  // If assignment exists and teacher exists, it's valid
  // Primary/allowed subjects are solver preferences, not hard restrictions
  return 'assigned';
}

/**
 * Enhance a subject requirement with assignment status
 * REAL-TIME FIX: Now uses assignments table data
 */
function enhanceRequirement(
  requirement: SubjectRequirement,
  classId: number,
  teachers: Teacher[],
  assignments: TeacherClassSubjectAssignment[]
): EnhancedSubjectRequirement {
  const status = calculateRequirementStatus(requirement, classId, teachers, assignments);

  // REAL-TIME FIX: Get teacherId from assignments table
  const assignment = assignments.find(
    (a) => a.classId === classId && a.subjectId === requirement.subjectId && !a.isDeleted
  );

  return {
    subjectId: requirement.subjectId,
    periodsPerWeek: requirement.periodsPerWeek,
    teacherId: assignment?.teacherId ?? null,
    assignmentStatus: status,
    conflicts: [], // Conflicts calculated separately if needed
  };
}

/**
 * Calculate overall status for a class based on its requirements
 */
function calculateClassOverallStatus(stats: ClassAssignmentStats): AssignmentStatus {
  if (stats.conflict > 0) return 'conflict';
  if (stats.total === 0) return 'unassigned';
  if (stats.unassigned === 0) return 'assigned';
  if (stats.assigned > 0) return 'partial';
  return 'unassigned';
}

/**
 * Process a class into ClassWithAssignmentStatus
 * REAL-TIME FIX: Now uses assignments table data
 */
function processClass(
  classGroup: ClassGroup,
  teachers: Teacher[],
  assignments: TeacherClassSubjectAssignment[]
): ClassWithAssignmentStatus {
  const subjectReqs = Array.isArray(classGroup.subjectRequirements)
    ? classGroup.subjectRequirements
    : [];
  const requirements = subjectReqs.map((req) =>
    enhanceRequirement(req, classGroup.id, teachers, assignments)
  );

  const stats: ClassAssignmentStats = {
    total: requirements.length,
    assigned: requirements.filter((r) => r.assignmentStatus === 'assigned').length,
    unassigned: requirements.filter((r) => r.assignmentStatus === 'unassigned').length,
    conflict: requirements.filter((r) => r.assignmentStatus === 'conflict').length,
  };

  return {
    classId: classGroup.id,
    className: classGroup.name,
    displayName: classGroup.displayName || classGroup.name,
    grade: classGroup.grade,
    sectionIndex: classGroup.sectionIndex,
    singleTeacherMode: classGroup.singleTeacherMode,
    requirements,
    stats,
    overallStatus: calculateClassOverallStatus(stats),
  };
}

/**
 * Calculate stats for a grade group
 */
function calculateGradeGroupStats(classes: ClassWithAssignmentStatus[]): GradeGroupStats {
  const totalRequirements = classes.reduce((sum, c) => sum + c.stats.total, 0);
  const assignedCount = classes.reduce((sum, c) => sum + c.stats.assigned, 0);
  const unassignedCount = classes.reduce((sum, c) => sum + c.stats.unassigned, 0);
  const conflictCount = classes.reduce((sum, c) => sum + c.stats.conflict, 0);

  return {
    totalClasses: classes.length,
    totalRequirements,
    assignedCount,
    unassignedCount,
    conflictCount,
    completionPercentage:
      totalRequirements > 0 ? Math.round((assignedCount / totalRequirements) * 100) : 0,
  };
}

/**
 * Filter classes based on filter state
 */
function filterClasses(
  classes: ClassWithAssignmentStatus[],
  filters: AssignmentsFilterState
): ClassWithAssignmentStatus[] {
  return classes.filter((c) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName =
        c.className.toLowerCase().includes(searchLower) ||
        c.displayName.toLowerCase().includes(searchLower);
      if (!matchesName) return false;
    }

    // Status filter
    if (filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'unassigned' && c.overallStatus !== 'unassigned') return false;
      if (filters.statusFilter === 'assigned' && c.overallStatus !== 'assigned') return false;
      if (filters.statusFilter === 'partial' && c.overallStatus !== 'partial') return false;
      if (filters.statusFilter === 'conflict' && c.overallStatus !== 'conflict') return false;
    }

    return true;
  });
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAssignmentsPage(
  options: UseAssignmentsPageOptions = {}
): UseAssignmentsPageResult {
  // Filter state
  const [filters, setFilters] = useState<AssignmentsFilterState>({
    ...DEFAULT_FILTERS,
    ...options.initialFilters,
  });

  // Fetch data
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();

  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();

  const { data: subjects = [], isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();

  // REAL-TIME FIX: Fetch assignments from the assignments table
  const {
    data: allAssignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError,
  } = useTeacherAssignments();

  // Combined loading/error state
  const isLoading =
    isLoadingClasses || isLoadingTeachers || isLoadingSubjects || isLoadingAssignments;
  const error = classesError || teachersError || subjectsError || assignmentsError;

  // Lookup maps for performance
  const teacherMap = useMemo(() => {
    const map = new Map<number, Teacher>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map = new Map<number, ClassGroup>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Process classes into grade groups
  const gradeGroups = useMemo((): GradeGroup[] => {
    // Filter out deleted classes
    const activeClasses = classes.filter((c) => !c.isDeleted);

    // REAL-TIME FIX: Filter out deleted assignments
    const activeAssignments = allAssignments.filter((a) => !a.isDeleted);

    // Process each class with real-time assignment data
    const processedClasses = activeClasses.map((c) => processClass(c, teachers, activeAssignments));

    // Group by grade category
    const groupedByCategory = new Map<AssignmentGradeCategory, ClassWithAssignmentStatus[]>();

    for (const processedClass of processedClasses) {
      const category = getGradeCategoryForGrade(processedClass.grade);
      if (!category) continue;

      // Apply grade category filter
      if (filters.gradeCategory && filters.gradeCategory !== category) continue;

      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, []);
      }
      groupedByCategory.get(category)!.push(processedClass);
    }

    // Build grade groups in order
    const groups: GradeGroup[] = [];

    for (const category of GRADE_CATEGORY_ORDER) {
      const categoryClasses = groupedByCategory.get(category) || [];
      if (categoryClasses.length === 0 && filters.gradeCategory !== category) continue;

      // Apply filters to classes
      const filteredClasses = filterClasses(categoryClasses, filters);

      // Sort classes by grade, then by section index
      filteredClasses.sort((a, b) => {
        if (a.grade !== b.grade) return (a.grade || 0) - (b.grade || 0);
        return a.sectionIndex.localeCompare(b.sectionIndex);
      });

      const categoryInfo = GRADE_CATEGORIES[category];

      groups.push({
        category,
        label: categoryInfo.description,
        labelFa: categoryInfo.descriptionFa,
        grades: categoryInfo.grades,
        classes: filteredClasses,
        stats: calculateGradeGroupStats(filteredClasses),
        isExpanded: true, // Default expanded
      });
    }

    return groups;
  }, [classes, teachers, filters, allAssignments]);

  // Calculate overall stats
  const stats = useMemo((): AssignmentsPageStats => {
    const allClasses = gradeGroups.flatMap((g) => g.classes);
    const totalRequirements = allClasses.reduce((sum, c) => sum + c.stats.total, 0);
    const assignedCount = allClasses.reduce((sum, c) => sum + c.stats.assigned, 0);
    const unassignedCount = allClasses.reduce((sum, c) => sum + c.stats.unassigned, 0);
    const conflictCount = allClasses.reduce((sum, c) => sum + c.stats.conflict, 0);

    return {
      totalClasses: allClasses.length,
      totalRequirements,
      assignedCount,
      unassignedCount,
      conflictCount,
      completionPercentage:
        totalRequirements > 0 ? Math.round((assignedCount / totalRequirements) * 100) : 0,
    };
  }, [gradeGroups]);

  // Filter setters
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setGradeCategory = useCallback((gradeCategory: AssignmentGradeCategory | null) => {
    setFilters((prev) => ({ ...prev, gradeCategory }));
  }, []);

  const setStatusFilter = useCallback((statusFilter: AssignmentStatusFilter) => {
    setFilters((prev) => ({ ...prev, statusFilter }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Lookup helpers
  const getTeacherById = useCallback((id: number) => teacherMap.get(id), [teacherMap]);

  const getSubjectById = useCallback((id: number) => subjectMap.get(id), [subjectMap]);

  const getClassById = useCallback((id: number) => classMap.get(id), [classMap]);

  return {
    gradeGroups,
    stats,
    filters,
    setSearch,
    setGradeCategory,
    setStatusFilter,
    resetFilters,
    isLoading,
    error: error as Error | null,
    rawData: {
      classes,
      teachers,
      subjects,
    },
    getTeacherById,
    getSubjectById,
    getClassById,
  };
}

export default useAssignmentsPage;
