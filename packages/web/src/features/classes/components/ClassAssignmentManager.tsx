/**
 * ClassAssignmentManager Component
 *
 * Phase 3.3: Class Assignment Manager for Class-Centric View
 *
 * Manages multi-teacher assignments for all subjects in a class.
 * Shows assignment progress and allows assigning/unassigning teachers
 * for each subject requirement.
 *
 * Features:
 * - Assignment progress header (X% complete)
 * - List of subject requirements with assignments
 * - Each subject shows assigned teachers + add button
 * - Workload impact preview when selecting teacher
 */

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AssignmentStatusBadge } from '../../assignments/components/shared';
import {
  useAssignTeacher,
  useUnassignTeacher,
} from '../../assignments/hooks/useAssignmentMutations';
import type { TeacherCompatibilityLevel } from '../../assignments/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import type { ClassGroup, SubjectRequirement } from '../types';
import { SubjectAssignmentSection, type TeacherAssignmentInfo } from './SubjectAssignmentSection';

// ============================================================================
// Types
// ============================================================================

export interface ClassAssignmentManagerProps {
  /** The class being edited */
  classData: ClassGroup;
  /** Callback when assignment changes (for optimistic updates) */
  onAssign?: (subjectId: number, teacherId: number, periodsPerWeek: number) => Promise<void>;
  /** Callback when unassignment happens */
  onUnassign?: (assignmentId: number) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface SubjectWithAssignments {
  subjectId: number;
  subjectName: string;
  requiredPeriods: number;
  assignments: TeacherAssignmentInfo[];
  assignedPeriods: number;
  remainingPeriods: number;
  isFullyAssigned: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Get teacher compatibility level for a subject
 */
function getTeacherCompatibility(teacher: Teacher, subjectId: number): TeacherCompatibilityLevel {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);

  if (primaryIds.includes(subjectId)) {
    return 'primary';
  }
  if (!teacher.restrictToPrimarySubjects && allowedIds.includes(subjectId)) {
    return 'allowed';
  }
  return 'incompatible';
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Progress header showing assignment completion
 */
function AssignmentProgressHeader({
  totalSubjects,
  fullyAssignedCount,
  partiallyAssignedCount,
  totalPeriods,
  assignedPeriods,
}: {
  totalSubjects: number;
  fullyAssignedCount: number;
  partiallyAssignedCount: number;
  totalPeriods: number;
  assignedPeriods: number;
}) {
  const { t } = useTranslation();

  const completionPercentage =
    totalPeriods > 0 ? Math.round((assignedPeriods / totalPeriods) * 100) : 0;

  const isComplete = completionPercentage >= 100;
  const unassignedCount = totalSubjects - fullyAssignedCount - partiallyAssignedCount;

  return (
    <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {t('classes.assignmentProgress', 'پیشرفت تخصیص')}
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              isComplete ? 'text-emerald-600' : 'text-slate-600'
            )}
          >
            {completionPercentage}%
          </span>
        </div>
        <Progress
          value={completionPercentage}
          className={cn('h-2', isComplete ? '[&>div]:bg-emerald-500' : '[&>div]:bg-violet-500')}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">
            {fullyAssignedCount} {t('classes.fullyAssigned', 'کامل')}
          </span>
        </div>
        {partiallyAssignedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-600">
              {partiallyAssignedCount} {t('classes.partiallyAssigned', 'نیمه')}
            </span>
          </div>
        )}
        {unassignedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <span className="text-slate-600">
              {unassignedCount} {t('classes.unassigned', 'بدون تخصیص')}
            </span>
          </div>
        )}
      </div>

      {/* Period Summary */}
      <div className="text-xs text-slate-500 pt-1 border-t border-slate-200">
        {assignedPeriods}/{totalPeriods} {t('common.periodsAssigned', 'ساعت تخصیص داده شده')}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassAssignmentManager({
  classData,
  onAssign,
  onUnassign,
  isUpdating = false,
  className,
}: ClassAssignmentManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch data
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { data: allAssignments = [], isLoading: isLoadingAssignments } = useTeacherAssignments();

  // Mutations
  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();

  // Parse subject requirements
  const subjectRequirements = useMemo((): SubjectRequirement[] => {
    return parseJsonArray<SubjectRequirement>(classData.subjectRequirements);
  }, [classData.subjectRequirements]);

  // Build subjects with assignments data
  const subjectsWithAssignments = useMemo((): SubjectWithAssignments[] => {
    return subjectRequirements.map((req) => {
      const subject = subjects.find((s) => s.id === req.subjectId);
      const subjectName = subject?.name || `Subject ${req.subjectId}`;
      const requiredPeriods = req.periodsPerWeek;

      // Get assignments for this class-subject pair
      const classSubjectAssignments = allAssignments.filter(
        (a: TeacherClassSubjectAssignment) =>
          a.classId === classData.id && a.subjectId === req.subjectId
      );

      // Map to TeacherAssignmentInfo
      const assignments: TeacherAssignmentInfo[] = classSubjectAssignments.map((a) => {
        const teacher = teachers.find((t) => t.id === a.teacherId);
        return {
          assignmentId: a.id,
          teacherId: a.teacherId,
          teacherName: teacher?.fullName || `Teacher ${a.teacherId}`,
          periodsPerWeek: a.periodsPerWeek,
          compatibility: teacher ? getTeacherCompatibility(teacher, req.subjectId) : 'incompatible',
        };
      });

      const assignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
      const remainingPeriods = Math.max(0, requiredPeriods - assignedPeriods);
      const isFullyAssigned = remainingPeriods <= 0;

      return {
        subjectId: req.subjectId,
        subjectName,
        requiredPeriods,
        assignments,
        assignedPeriods,
        remainingPeriods,
        isFullyAssigned,
      };
    });
  }, [subjectRequirements, subjects, teachers, allAssignments, classData.id]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalSubjects = subjectsWithAssignments.length;
    const fullyAssignedCount = subjectsWithAssignments.filter((s) => s.isFullyAssigned).length;
    const partiallyAssignedCount = subjectsWithAssignments.filter(
      (s) => !s.isFullyAssigned && s.assignments.length > 0
    ).length;
    const totalPeriods = subjectsWithAssignments.reduce((sum, s) => sum + s.requiredPeriods, 0);
    const assignedPeriods = subjectsWithAssignments.reduce((sum, s) => sum + s.assignedPeriods, 0);

    return {
      totalSubjects,
      fullyAssignedCount,
      partiallyAssignedCount,
      totalPeriods,
      assignedPeriods,
    };
  }, [subjectsWithAssignments]);

  // Handle assign teacher
  const handleAssign = useCallback(
    async (subjectId: number, teacherId: number, periodsPerWeek: number) => {
      if (onAssign) {
        await onAssign(subjectId, teacherId, periodsPerWeek);
      } else {
        await assignTeacher.mutateAsync({
          teacherId,
          subjectId,
          classIds: [classData.id],
          periodsPerWeek,
        });
      }
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    },
    [classData.id, onAssign, assignTeacher, queryClient]
  );

  // Handle unassign teacher
  const handleUnassign = useCallback(
    async (assignmentId: number) => {
      if (onUnassign) {
        await onUnassign(assignmentId);
      } else {
        // Find the assignment to get teacherId and subjectId
        const assignment = allAssignments.find((a) => a.id === assignmentId);
        if (assignment) {
          await unassignTeacher.mutateAsync({
            teacherId: assignment.teacherId,
            subjectId: assignment.subjectId,
            classIds: [classData.id],
          });
        }
      }
      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    },
    [classData.id, onUnassign, unassignTeacher, allAssignments, queryClient]
  );

  const isLoading = isLoadingSubjects || isLoadingTeachers || isLoadingAssignments;
  const isMutating = assignTeacher.isPending || unassignTeacher.isPending || isUpdating;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Progress Header */}
      <div className="px-1 pb-3">
        <AssignmentProgressHeader
          totalSubjects={stats.totalSubjects}
          fullyAssignedCount={stats.fullyAssignedCount}
          partiallyAssignedCount={stats.partiallyAssignedCount}
          totalPeriods={stats.totalPeriods}
          assignedPeriods={stats.assignedPeriods}
        />
      </div>

      {/* Subject List */}
      <ScrollArea className="flex-1 px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : subjectsWithAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {t('classes.noSubjectRequirements', 'هیچ مضمونی تعریف نشده است')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {subjectsWithAssignments.map((subjectData) => (
              <div
                key={subjectData.subjectId}
                className={cn(
                  'p-3 rounded-xl border-2 transition-colors',
                  subjectData.isFullyAssigned
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : subjectData.assignments.length > 0
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200'
                )}
              >
                {/* Subject Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className={cn(
                        'w-4 h-4',
                        subjectData.isFullyAssigned ? 'text-emerald-600' : 'text-slate-500'
                      )}
                    />
                    <span className="font-medium text-sm text-slate-800">
                      {subjectData.subjectName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AssignmentStatusBadge
                      status={
                        subjectData.isFullyAssigned
                          ? 'assigned'
                          : subjectData.assignments.length > 0
                            ? 'partial'
                            : 'unassigned'
                      }
                      size="sm"
                      showTooltip
                    />
                    {!subjectData.isFullyAssigned && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200 tabular-nums"
                      >
                        {subjectData.assignedPeriods}/{subjectData.requiredPeriods}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Assignment Section */}
                <SubjectAssignmentSection
                  classId={classData.id}
                  subjectId={subjectData.subjectId}
                  requiredPeriods={subjectData.requiredPeriods}
                  assignments={subjectData.assignments}
                  onAssign={(teacherId, periods) =>
                    handleAssign(subjectData.subjectId, teacherId, periods)
                  }
                  onUnassign={handleUnassign}
                  disabled={isMutating}
                  isLoading={isMutating}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ClassAssignmentManager;
