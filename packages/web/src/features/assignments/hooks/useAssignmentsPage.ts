/**
 * useAssignmentsPage Hook
 *
 * Aggregates data for the Assignments page using the canonical assignment
 * matrix projection as the authoritative read model.
 */

import { useCallback, useMemo, useState } from 'react';
import { useClasses } from '../../classes/hooks/useClasses';
import type { ClassGroup } from '../../classes/types';
import { GRADE_CATEGORIES } from '../../subjects/data/curriculum';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import {
  getProjectionRequirementStatus,
  projectionWarningToConflict,
  useAssignmentMatrixView,
  type ProjectionRequirementView,
} from '../projections';
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

export interface UseAssignmentsPageOptions {
  initialFilters?: Partial<AssignmentsFilterState>;
}

export interface UseAssignmentsPageResult {
  gradeGroups: GradeGroup[];
  stats: AssignmentsPageStats;
  filters: AssignmentsFilterState;
  setSearch: (search: string) => void;
  setGradeCategory: (category: AssignmentGradeCategory | null) => void;
  setStatusFilter: (status: AssignmentStatusFilter) => void;
  resetFilters: () => void;
  isLoading: boolean;
  error: Error | null;
  rawData: {
    classes: ClassGroup[];
    teachers: Teacher[];
    subjects: Subject[];
  };
  getTeacherById: (id: number) => Teacher | undefined;
  getSubjectById: (id: number) => Subject | undefined;
  getClassById: (id: number) => ClassGroup | undefined;
}

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

function getGradeCategoryForGrade(grade: number | null): AssignmentGradeCategory | null {
  if (grade === null) return null;
  if (grade >= 1 && grade <= 3) return 'Alpha-Primary';
  if (grade >= 4 && grade <= 6) return 'Beta-Primary';
  if (grade >= 7 && grade <= 9) return 'Middle';
  if (grade >= 10 && grade <= 12) return 'High';
  return null;
}

function enhanceRequirement(requirement: ProjectionRequirementView): EnhancedSubjectRequirement {
  const teacherId =
    requirement.assignments.length === 1
      ? requirement.assignments[0].teacherId
      : (requirement.assignments[0]?.teacherId ?? null);

  return {
    subjectId: requirement.subjectId,
    periodsPerWeek: requirement.requiredPeriodsPerWeek,
    teacherId,
    assignmentStatus: getProjectionRequirementStatus(requirement),
    conflicts: requirement.warnings.map((warning) =>
      projectionWarningToConflict(warning, {
        classId: requirement.classId,
        subjectId: requirement.subjectId,
        teacherId,
      })
    ),
  };
}

function calculateClassOverallStatus(stats: ClassAssignmentStats): AssignmentStatus {
  if (stats.conflict > 0) return 'conflict';
  if (stats.total === 0) return 'unassigned';
  if (stats.unassigned === 0) return 'assigned';
  if (stats.assigned > 0) return 'partial';
  return 'unassigned';
}

function processClass(
  classGroup: ClassGroup,
  requirements: ProjectionRequirementView[],
  validSubjectIds: Set<number>
): ClassWithAssignmentStatus {
  const enhancedRequirements = requirements
    .filter((requirement) => validSubjectIds.has(requirement.subjectId))
    .map((requirement) => enhanceRequirement(requirement));

  const stats: ClassAssignmentStats = {
    total: enhancedRequirements.length,
    assigned: enhancedRequirements.filter((req) => req.assignmentStatus === 'assigned').length,
    unassigned: enhancedRequirements.filter((req) => req.assignmentStatus === 'unassigned').length,
    conflict: enhancedRequirements.filter((req) => req.assignmentStatus === 'conflict').length,
  };

  return {
    classId: classGroup.id,
    className: classGroup.name,
    displayName: classGroup.displayName || classGroup.name,
    grade: classGroup.grade,
    sectionIndex: classGroup.sectionIndex,
    singleTeacherMode: classGroup.singleTeacherMode,
    requirements: enhancedRequirements,
    stats,
    overallStatus: calculateClassOverallStatus(stats),
  };
}

function calculateGradeGroupStats(classes: ClassWithAssignmentStatus[]): GradeGroupStats {
  const totalRequirements = classes.reduce((sum, classData) => sum + classData.stats.total, 0);
  const assignedCount = classes.reduce((sum, classData) => sum + classData.stats.assigned, 0);
  const unassignedCount = classes.reduce((sum, classData) => sum + classData.stats.unassigned, 0);
  const conflictCount = classes.reduce((sum, classData) => sum + classData.stats.conflict, 0);

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

function filterClasses(
  classes: ClassWithAssignmentStatus[],
  filters: AssignmentsFilterState
): ClassWithAssignmentStatus[] {
  return classes.filter((classData) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesName =
        classData.className.toLowerCase().includes(search) ||
        classData.displayName.toLowerCase().includes(search);
      if (!matchesName) {
        return false;
      }
    }

    if (filters.statusFilter !== 'all' && classData.overallStatus !== filters.statusFilter) {
      return false;
    }

    return true;
  });
}

export function useAssignmentsPage(
  options: UseAssignmentsPageOptions = {}
): UseAssignmentsPageResult {
  const [filters, setFilters] = useState<AssignmentsFilterState>({
    ...DEFAULT_FILTERS,
    ...options.initialFilters,
  });

  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();
  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const { data: subjects = [], isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();
  const {
    data: assignmentMatrix,
    isLoading: isLoadingAssignmentMatrix,
    error: assignmentMatrixError,
  } = useAssignmentMatrixView();

  const isLoading =
    isLoadingClasses || isLoadingTeachers || isLoadingSubjects || isLoadingAssignmentMatrix;
  const error = classesError || teachersError || subjectsError || assignmentMatrixError;

  const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const classMap = useMemo(() => new Map(classes.map((classGroup) => [classGroup.id, classGroup])), [classes]);
  const validSubjectIds = useMemo(() => new Set(subjects.map((subject) => subject.id)), [subjects]);
  const matrixRequirementsByClass = useMemo(
    () =>
      new Map(
        (assignmentMatrix?.classes ?? []).map((classView) => [classView.classId, classView.requirements])
      ),
    [assignmentMatrix]
  );

  const gradeGroups = useMemo((): GradeGroup[] => {
    const processedClasses = classes
      .filter((classGroup) => !classGroup.isDeleted)
      .flatMap((classGroup) => {
        const requirements = matrixRequirementsByClass.get(classGroup.id);
        if (!requirements) {
          return [];
        }

        return [processClass(classGroup, requirements, validSubjectIds)];
      });

    const groupedByCategory = new Map<AssignmentGradeCategory, ClassWithAssignmentStatus[]>();

    for (const processedClass of processedClasses) {
      const category = getGradeCategoryForGrade(processedClass.grade);
      if (!category) continue;
      if (filters.gradeCategory && filters.gradeCategory !== category) continue;

      const existing = groupedByCategory.get(category) ?? [];
      existing.push(processedClass);
      groupedByCategory.set(category, existing);
    }

    const groups: GradeGroup[] = [];

    for (const category of GRADE_CATEGORY_ORDER) {
      const categoryClasses = groupedByCategory.get(category) ?? [];
      if (categoryClasses.length === 0 && filters.gradeCategory !== category) {
        continue;
      }

      const filteredClasses = filterClasses(categoryClasses, filters).sort((left, right) => {
        if (left.grade !== right.grade) {
          return (left.grade || 0) - (right.grade || 0);
        }
        return left.sectionIndex.localeCompare(right.sectionIndex);
      });

      const categoryInfo = GRADE_CATEGORIES[category];
      groups.push({
        category,
        label: categoryInfo.description,
        labelFa: categoryInfo.descriptionFa,
        grades: categoryInfo.grades,
        classes: filteredClasses,
        stats: calculateGradeGroupStats(filteredClasses),
        isExpanded: true,
      });
    }

    return groups;
  }, [classes, filters, matrixRequirementsByClass, validSubjectIds]);

  const stats = useMemo((): AssignmentsPageStats => {
    const allClasses = gradeGroups.flatMap((group) => group.classes);
    const totalRequirements = allClasses.reduce((sum, classData) => sum + classData.stats.total, 0);
    const assignedCount = allClasses.reduce((sum, classData) => sum + classData.stats.assigned, 0);
    const unassignedCount = allClasses.reduce((sum, classData) => sum + classData.stats.unassigned, 0);
    const conflictCount = allClasses.reduce((sum, classData) => sum + classData.stats.conflict, 0);

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

  const setSearch = useCallback((search: string) => {
    setFilters((previous) => ({ ...previous, search }));
  }, []);

  const setGradeCategory = useCallback((gradeCategory: AssignmentGradeCategory | null) => {
    setFilters((previous) => ({ ...previous, gradeCategory }));
  }, []);

  const setStatusFilter = useCallback((statusFilter: AssignmentStatusFilter) => {
    setFilters((previous) => ({ ...previous, statusFilter }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

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
    error: (error as Error | null) ?? null,
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
