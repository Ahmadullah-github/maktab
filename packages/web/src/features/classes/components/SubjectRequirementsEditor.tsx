/**
 * SubjectRequirementsEditor Component
 *
 * A component for managing subject requirements for a class.
 * Allows adding, removing, and editing subject-period configurations.
 *
 * Features:
 * - Display list of subject requirements with period count inputs
 * - Add/remove subject functionality
 * - Validate period counts within allowed range (1-20)
 * - Multi-teacher assignment support per subject
 * - Teacher compatibility filtering
 * - Assignment status indicators
 * - Inline conflict warnings
 * - Remaining periods display
 *
 * Enhanced for Phase 3.1: Multi-teacher assignment from Class perspective
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 8.1, 8.2, 8.3, 8.4
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AssignmentStatusBadge } from '@/features/assignments/components/shared';
import { SmartTeacherDropdown } from '@/features/assignments/components/SmartTeacherDropdown';
import {
  useAssignTeacher,
  useUnassignTeacher,
} from '@/features/assignments/hooks/useAssignmentMutations';
import {
  getCompatibleTeachersForSubject,
  getTeacherSubjectCompatibility,
} from '@/features/assignments/services/assignmentValidation';
import {
  calculateTeacherWorkload,
  determineWorkloadStatus,
} from '@/features/assignments/services/workloadCalculation';
import type {
  AssignmentConflict,
  AssignmentStatus,
  TeacherCompatibility,
  TeacherCompatibilityLevel,
} from '@/features/assignments/types';
import { useTeacherAssignments } from '@/features/teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '@/features/teacher-assignments/types';
import { teachersApi } from '@/features/teachers/api';
import type { Teacher } from '@/features/teachers/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, BookOpen, Plus, Trash2, User } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassGroup, SubjectRequirement } from '../types';
import { componentLogger, logger } from '../utils/logger';

/**
 * Subject type from the API
 */
interface Subject {
  id: number;
  name: string;
  code?: string;
  grade?: number | null;
  periodsPerWeek?: number | null;
  isDeleted?: boolean;
}

/**
 * Props for the SubjectRequirementsEditor component
 */
export interface SubjectRequirementsEditorProps {
  /** Current subject requirements */
  value: SubjectRequirement[];
  /** Callback when requirements change */
  onChange: (requirements: SubjectRequirement[]) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether to show teacher assignment column */
  showTeacherColumn?: boolean;
  /** Optional class grade to filter subjects */
  classGrade?: number | null;
  /** Optional class ID for conflict detection */
  classId?: number;
  /** Optional additional CSS classes */
  className?: string;
  /** All classes for workload calculation */
  allClasses?: ClassGroup[];
}

/**
 * Minimum and maximum periods per week
 */
const MIN_PERIODS = 1;
const MAX_PERIODS = 20;

/**
 * Parse JSON array from string or return as-is
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
 * Teacher assignment info for a subject
 */
interface TeacherAssignmentInfo {
  assignmentId: number;
  teacherId: number;
  teacherName: string;
  periodsPerWeek: number;
  compatibility: TeacherCompatibilityLevel;
}

/**
 * Hook to fetch subjects from the API
 */
function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = (await api.subjects.list()) as Subject[];
      return response.filter((subject) => !subject.isDeleted);
    },
  });
}

/**
 * Hook to fetch teachers from the API (properly deserialized)
 */
function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const teachers = await teachersApi.getAll();
      return teachers.filter((teacher) => !teacher.isDeleted);
    },
  });
}

/**
 * Hook to fetch all classes from the API
 */
function useAllClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = (await api.classes.list()) as ClassGroup[];
      return response
        .filter((c) => !c.isDeleted)
        .map((c) => ({
          ...c,
          // Parse subjectRequirements if it's a JSON string
          subjectRequirements:
            typeof c.subjectRequirements === 'string'
              ? JSON.parse(c.subjectRequirements || '[]')
              : c.subjectRequirements || [],
        }));
    },
  });
}

/**
 * Calculate assignment status for a subject requirement
 * Requirements: 3.6
 */
function calculateAssignmentStatus(
  requirement: SubjectRequirement,
  teacher: Teacher | undefined
): AssignmentStatus {
  if (!requirement.teacherId) {
    return 'unassigned';
  }

  if (!teacher) {
    return 'conflict';
  }

  // Check teacher-subject compatibility
  const compatibility = getTeacherSubjectCompatibility(teacher, requirement.subjectId);
  if (compatibility === 'incompatible') {
    return 'conflict';
  }

  return 'assigned';
}

/**
 * Convert simplified Subject to full Subject format for workload calculation
 */
function toFullSubject(subject: Subject): import('@/features/subjects/types').Subject {
  return {
    id: subject.id,
    name: subject.name,
    code: subject.code || '',
    grade: subject.grade ?? null,
    periodsPerWeek: subject.periodsPerWeek ?? null,
    schoolId: null,
    section: '',
    requiredRoomType: '',
    requiredFeatures: [],
    desiredFeatures: [],
    isDifficult: false,
    minRoomCapacity: 0,
    meta: {},
    isDeleted: subject.isDeleted || false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * Detect conflicts for a subject requirement
 * Requirements: 3.3, 3.4
 */
function detectRequirementConflicts(
  requirement: SubjectRequirement,
  teacher: Teacher | undefined,
  subjects: Subject[],
  allClasses: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  if (!requirement.teacherId || !teacher) {
    return conflicts;
  }

  const subject = subjects.find((s) => s.id === requirement.subjectId);

  // Check teacher-subject compatibility
  const compatibility = getTeacherSubjectCompatibility(teacher, requirement.subjectId);
  if (compatibility === 'incompatible') {
    conflicts.push({
      type: 'subject_incompatible',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" cannot teach "${subject?.name || 'this subject'}"`,
      messageFa: `معلم "${teacher.fullName}" مجاز به تدریس "${subject?.name || 'این مضمون'}" نیست`,
      affectedEntities: {
        teacherId: teacher.id,
        subjectId: requirement.subjectId,
      },
      suggestedResolution: `Select a different teacher or add this subject to the teacher's allowed subjects`,
      suggestedResolutionFa: `معلم دیگری انتخاب کنید یا این مضمون را به لیست مجاز معلم اضافه کنید`,
    });
  }

  // Check workload - convert subjects to full format
  const fullSubjects = subjects.map(toFullSubject);
  const workload = calculateTeacherWorkload(teacher, fullSubjects, allClasses);
  const workloadStatus = determineWorkloadStatus(workload.totalPeriods, workload.maxPeriods);

  if (workloadStatus === 'overloaded') {
    conflicts.push({
      type: 'workload_exceeded',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" is overloaded (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
      },
      suggestedResolution: `Reduce teacher's assignments or select a different teacher`,
      suggestedResolutionFa: `تخصیص‌های معلم را کاهش دهید یا معلم دیگری انتخاب کنید`,
    });
  } else if (workloadStatus === 'near_capacity') {
    conflicts.push({
      type: 'workload_exceeded',
      severity: 'warning',
      message: `Teacher "${teacher.fullName}" is near capacity (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" نزدیک به حداکثر ظرفیت است (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
      },
    });
  }

  return conflicts;
}

/**
 * SubjectRequirementsEditor provides an interface for managing subject requirements
 *
 * @example
 * ```tsx
 * <SubjectRequirementsEditor
 *   value={subjectRequirements}
 *   onChange={setSubjectRequirements}
 *   showTeacherColumn={!singleTeacherMode}
 * />
 * ```
 */
export function SubjectRequirementsEditor({
  value,
  onChange,
  disabled = false,
  showTeacherColumn = false,
  classGrade,
  classId,
  className,
  allClasses: providedClasses,
}: SubjectRequirementsEditorProps) {
  const { t } = useTranslation();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { data: fetchedClasses = [] } = useAllClasses();

  // Fetch multi-teacher assignments
  const { data: allAssignments = [] } = useTeacherAssignments();

  // Assignment mutations
  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();

  // Use provided classes or fetched classes
  const allClasses = providedClasses || fetchedClasses;

  // Normalize value to always be an array (defensive handling for JSON string or undefined)
  const normalizedValue = useMemo((): SubjectRequirement[] => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [value]);

  const validSubjectIds = useMemo(() => {
    return new Set(subjects.map((subject) => subject.id));
  }, [subjects]);

  const visibleRequirements = useMemo((): SubjectRequirement[] => {
    return normalizedValue.filter((requirement) => validSubjectIds.has(requirement.subjectId));
  }, [normalizedValue, validSubjectIds]);

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectRequirementsEditor', {
      requirementsCount: visibleRequirements.length,
      showTeacherColumn,
    });
    return () => componentLogger.unmount('SubjectRequirementsEditor');
  }, [visibleRequirements.length, showTeacherColumn]);

  // Filter subjects that are not already added
  const availableSubjects = useMemo(() => {
    const addedSubjectIds = new Set(visibleRequirements.map((req) => req.subjectId));
    return subjects.filter((subject) => {
      // Exclude already added subjects
      if (addedSubjectIds.has(subject.id)) return false;
      // Optionally filter by grade if classGrade is provided
      if (classGrade !== null && classGrade !== undefined && subject.grade !== null) {
        // Allow subjects that match the class grade or have no grade restriction
        return subject.grade === classGrade || subject.grade === null;
      }
      return true;
    });
  }, [subjects, visibleRequirements, classGrade]);

  // Get subject name by ID
  const getSubjectName = useCallback(
    (subjectId: number): string => {
      const subject = subjects.find((s) => s.id === subjectId);
      return subject?.name || '';
    },
    [subjects]
  );

  // Get teacher by ID
  const getTeacher = useCallback(
    (teacherId: number | null | undefined): Teacher | undefined => {
      if (!teacherId) return undefined;
      return teachers.find((t) => t.id === teacherId);
    },
    [teachers]
  );

  // Get compatible teachers for a subject
  const getCompatibleTeachers = useCallback(
    (subjectId: number): TeacherCompatibility[] => {
      return getCompatibleTeachersForSubject(teachers, subjectId);
    },
    [teachers]
  );

  // Get multi-teacher assignments for a class-subject pair
  const getSubjectAssignments = useCallback(
    (subjectId: number): TeacherAssignmentInfo[] => {
      if (!classId) return [];

      return allAssignments
        .filter(
          (a: TeacherClassSubjectAssignment) => a.classId === classId && a.subjectId === subjectId
        )
        .map((a: TeacherClassSubjectAssignment) => {
          const teacher = teachers.find((t) => t.id === a.teacherId);
          const primaryIds = parseJsonArray<number>(teacher?.primarySubjectIds);
          const allowedIds = parseJsonArray<number>(teacher?.allowedSubjectIds);

          let compatibility: TeacherCompatibilityLevel = 'incompatible';
          if (primaryIds.includes(subjectId)) {
            compatibility = 'primary';
          } else if (!teacher?.restrictToPrimarySubjects && allowedIds.includes(subjectId)) {
            compatibility = 'allowed';
          }

          return {
            assignmentId: a.id,
            teacherId: a.teacherId,
            teacherName: teacher?.fullName || `Teacher ${a.teacherId}`,
            periodsPerWeek: a.periodsPerWeek,
            compatibility,
          };
        });
    },
    [classId, allAssignments, teachers]
  );

  // Calculate assigned and remaining periods for a subject
  const getSubjectPeriodInfo = useCallback(
    (subjectId: number, requiredPeriods: number) => {
      const assignments = getSubjectAssignments(subjectId);
      const assignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
      const remainingPeriods = Math.max(0, requiredPeriods - assignedPeriods);
      const isFullyAssigned = remainingPeriods <= 0;

      return { assignments, assignedPeriods, remainingPeriods, isFullyAssigned };
    },
    [getSubjectAssignments]
  );

  // Handle assigning a teacher via the new multi-teacher system
  const handleAssignTeacher = useCallback(
    async (subjectId: number, teacherId: number, periodsPerWeek: number) => {
      if (!classId) return;

      await assignTeacher.mutateAsync({
        teacherId,
        subjectId,
        classIds: [classId],
        periodsPerWeek,
      });
    },
    [classId, assignTeacher]
  );

  // Handle unassigning a teacher
  const handleUnassignTeacher = useCallback(
    async (subjectId: number, teacherId: number) => {
      if (!classId) return;

      await unassignTeacher.mutateAsync({
        teacherId,
        subjectId,
        classIds: [classId],
      });
    },
    [classId, unassignTeacher]
  );

  // Handle adding a new subject requirement
  const handleAddSubject = useCallback(
    (subjectId: number) => {
      const subject = subjects.find((s) => s.id === subjectId);
      const defaultPeriods = subject?.periodsPerWeek || 3;

      logger.debug('Adding subject requirement', { subjectId, defaultPeriods });

      const newRequirement: SubjectRequirement = {
        subjectId,
        periodsPerWeek: Math.min(Math.max(defaultPeriods, MIN_PERIODS), MAX_PERIODS),
      };

      onChange([...visibleRequirements, newRequirement]);
    },
    [subjects, visibleRequirements, onChange]
  );

  // Handle removing a subject requirement
  const handleRemoveSubject = useCallback(
    (subjectId: number) => {
      logger.debug('Removing subject requirement', { subjectId });
      onChange(visibleRequirements.filter((req) => req.subjectId !== subjectId));
    },
    [visibleRequirements, onChange]
  );

  // Handle updating periods for a subject
  const handlePeriodsChange = useCallback(
    (subjectId: number, periods: number) => {
      // Clamp periods to valid range
      const clampedPeriods = Math.min(Math.max(periods, MIN_PERIODS), MAX_PERIODS);

      logger.debug('Updating periods for subject', { subjectId, periods: clampedPeriods });

      onChange(
        visibleRequirements.map((req) =>
          req.subjectId === subjectId ? { ...req, periodsPerWeek: clampedPeriods } : req
        )
      );
    },
    [visibleRequirements, onChange]
  );

  const handleTeacherChange = useCallback(
    async (subjectId: number, teacherId: number | null) => {
      if (!classId) {
        logger.warn('Skipping canonical teacher change without classId', { subjectId, teacherId });
        return;
      }

      const requirement = visibleRequirements.find((req) => req.subjectId === subjectId);
      if (!requirement) {
        return;
      }

      const existingAssignments = getSubjectAssignments(subjectId);
      const existingTeacherIds = Array.from(
        new Set(existingAssignments.map((assignment) => assignment.teacherId))
      );

      const hasTargetAssignment =
        teacherId !== null && existingTeacherIds.includes(teacherId);

      logger.debug('Updating teacher for subject', { subjectId, teacherId });

      await Promise.all(
        existingTeacherIds
          .filter((existingTeacherId) => teacherId === null || existingTeacherId !== teacherId)
          .map((existingTeacherId) => handleUnassignTeacher(subjectId, existingTeacherId))
      );

      if (teacherId !== null && !hasTargetAssignment) {
        await handleAssignTeacher(subjectId, teacherId, requirement.periodsPerWeek);
      }
    },
    [classId, getSubjectAssignments, handleAssignTeacher, handleUnassignTeacher, visibleRequirements]
  );

  const isLoading = isLoadingSubjects || isLoadingTeachers;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{t('classes.subjectRequirements.title')}</Label>
      </div>

      {/* Subject Requirements List */}
      <div className="space-y-2">
        {visibleRequirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <BookOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('classes.noClasses')}</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {/* Table Header */}
            <div
              className={cn(
                'grid gap-4 px-4 py-2 bg-muted/50 text-sm font-medium',
                showTeacherColumn
                  ? 'grid-cols-[1fr,80px,1fr,60px,40px]'
                  : 'grid-cols-[1fr,100px,40px]'
              )}
            >
              <span>{t('classes.subjectRequirements.subject')}</span>
              <span>{t('classes.subjectRequirements.periodsPerWeek')}</span>
              {showTeacherColumn && (
                <>
                  <span>{t('classes.subjectRequirements.teacher')}</span>
                  <span>{t('classes.subjectRequirements.status', 'وضعیت')}</span>
                </>
              )}
              <span className="sr-only">{t('common.actions')}</span>
            </div>

            {/* Subject Rows */}
            {visibleRequirements.map((requirement) => {
              const teacher = getTeacher(requirement.teacherId);
              const status = showTeacherColumn
                ? calculateAssignmentStatus(requirement, teacher)
                : 'assigned';
              const conflicts = showTeacherColumn
                ? detectRequirementConflicts(requirement, teacher, subjects, allClasses)
                : [];
              const compatibleTeachers = getCompatibleTeachers(requirement.subjectId);

              // Multi-teacher assignment info
              const periodInfo = getSubjectPeriodInfo(
                requirement.subjectId,
                requirement.periodsPerWeek
              );
              const {
                assignments: multiTeacherAssignments,
                remainingPeriods,
                isFullyAssigned,
              } = periodInfo;
              const hasMultiTeacherAssignments = multiTeacherAssignments.length > 0;

              return (
                <div
                  key={requirement.subjectId}
                  className={cn(
                    'grid gap-4 px-4 py-3 items-center',
                    showTeacherColumn
                      ? 'grid-cols-[1fr,80px,1fr,60px,40px]'
                      : 'grid-cols-[1fr,100px,40px]',
                    conflicts.some((c) => c.severity === 'error') && 'bg-red-50/50',
                    isFullyAssigned && 'bg-emerald-50/30'
                  )}
                >
                  {/* Subject Name */}
                  <span className="font-medium truncate">
                    {getSubjectName(requirement.subjectId)}
                  </span>

                  {/* Periods Input */}
                  <Input
                    type="number"
                    min={MIN_PERIODS}
                    max={MAX_PERIODS}
                    value={requirement.periodsPerWeek}
                    onChange={(e) =>
                      handlePeriodsChange(requirement.subjectId, parseInt(e.target.value, 10) || 1)
                    }
                    disabled={disabled}
                    className="w-full h-9"
                  />

                  {/* Teacher Selector (optional) - Requirements: 3.1, 3.2 */}
                  {showTeacherColumn && (
                    <>
                      <div className="flex flex-col gap-1">
                        {/* Multi-teacher assignments display */}
                        {hasMultiTeacherAssignments ? (
                          <div className="space-y-2">
                            {/* Assigned teachers as chips */}
                            <div className="flex flex-wrap gap-1.5">
                              {multiTeacherAssignments.map((assignment) => (
                                <div
                                  key={assignment.assignmentId}
                                  className={cn(
                                    'group flex items-center gap-1 px-2 py-1 rounded-md border text-xs',
                                    assignment.compatibility === 'primary'
                                      ? 'bg-violet-50 border-violet-200 text-violet-700'
                                      : 'bg-blue-50 border-blue-200 text-blue-700'
                                  )}
                                >
                                  <User className="h-3 w-3" />
                                  <span className="font-medium truncate max-w-[100px]">
                                    {assignment.teacherName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ({assignment.periodsPerWeek})
                                  </span>
                                  {/* Remove button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUnassignTeacher(
                                        requirement.subjectId,
                                        assignment.teacherId
                                      )
                                    }
                                    disabled={disabled || unassignTeacher.isPending}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                                    aria-label={t('common.remove', 'حذف')}
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            {/* Remaining periods and add button */}
                            {!isFullyAssigned && (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  {remainingPeriods}{' '}
                                  {t('subjects.periodsRemaining', 'ساعت باقی‌مانده')}
                                </Badge>
                                <Select
                                  value=""
                                  onValueChange={(val: string) => {
                                    if (val) {
                                      const teacherId = parseInt(val, 10);
                                      handleAssignTeacher(
                                        requirement.subjectId,
                                        teacherId,
                                        remainingPeriods
                                      );
                                    }
                                  }}
                                  disabled={disabled || assignTeacher.isPending}
                                >
                                  <SelectTrigger className="h-7 w-auto text-xs border-dashed">
                                    <Plus className="h-3 w-3 me-1" />
                                    {t('subjects.addTeacher', 'افزودن')}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {compatibleTeachers
                                      .filter(
                                        (tc) =>
                                          !multiTeacherAssignments.some(
                                            (a) => a.teacherId === tc.teacherId
                                          )
                                      )
                                      .map((tc) => (
                                        <SelectItem
                                          key={tc.teacherId}
                                          value={tc.teacherId.toString()}
                                        >
                                          <span>{tc.teacherName}</span>
                                          <span className="text-xs text-muted-foreground ms-2">
                                            ({tc.currentWorkload}/{tc.maxWorkload})
                                          </span>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Smart teacher selector with rich compatibility info */
                          <SmartTeacherDropdown
                            subjectId={requirement.subjectId}
                            value={requirement.teacherId ?? null}
                            onChange={(teacherId) =>
                              handleTeacherChange(requirement.subjectId, teacherId)
                            }
                            disabled={
                              disabled ||
                              isLoadingTeachers ||
                              !classId ||
                              assignTeacher.isPending ||
                              unassignTeacher.isPending
                            }
                            className={cn(
                              'h-9',
                              conflicts.some((c) => c.severity === 'error') &&
                                'border-red-300 focus:ring-red-200'
                            )}
                          />
                        )}

                        {/* Inline conflict warnings - Requirements: 3.4 */}
                        {conflicts.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-xs">
                                  {conflicts.some((c) => c.severity === 'error') ? (
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  )}
                                  <span
                                    className={cn(
                                      conflicts.some((c) => c.severity === 'error')
                                        ? 'text-red-600'
                                        : 'text-amber-600'
                                    )}
                                  >
                                    {conflicts[0].messageFa}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="space-y-1">
                                  {conflicts.map((conflict, idx) => (
                                    <div key={idx} className="text-xs">
                                      <p className="font-medium">{conflict.messageFa}</p>
                                      {conflict.suggestedResolutionFa && (
                                        <p className="text-muted-foreground">
                                          {conflict.suggestedResolutionFa}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {/* Assignment Status Indicator - Requirements: 3.6 */}
                      <AssignmentStatusBadge
                        status={
                          isFullyAssigned
                            ? 'assigned'
                            : hasMultiTeacherAssignments
                              ? 'partial'
                              : status
                        }
                        size="sm"
                        iconOnly
                        showTooltip
                      />
                    </>
                  )}

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSubject(requirement.subjectId)}
                    disabled={disabled}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('classes.subjectRequirements.remove')}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Subject Selector */}
      <div className="flex gap-2">
        <Select
          value=""
          onValueChange={(val: string) => {
            if (val) handleAddSubject(parseInt(val, 10));
          }}
          disabled={disabled || isLoading || availableSubjects.length === 0}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('classes.subjectRequirements.addSubject')} />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id.toString()}>
                {subject.name}
                {subject.periodsPerWeek && (
                  <span className="text-muted-foreground ml-2">
                    ({subject.periodsPerWeek} {t('common.hoursPerWeek')})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || isLoading || availableSubjects.length === 0}
          onClick={() => {
            if (availableSubjects.length > 0) {
              handleAddSubject(availableSubjects[0].id);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">{t('classes.subjectRequirements.addSubject')}</span>
        </Button>
      </div>
    </div>
  );
}

export default SubjectRequirementsEditor;
