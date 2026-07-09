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
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-br from-white via-slate-50 to-blue-50/40 p-4 shadow-sm">
      <div className="absolute inset-y-0 end-0 w-32 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_70%)] blur-2xl" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {t('classes.assignmentProgress', 'پیشرفت تخصیص')}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {completionPercentage}%
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t(
                'classes.assignmentProgressDescription',
                'مقدار پوشش مضامین این صنف بر اساس ساعات مورد نیاز و تخصیص‌های ثبت‌شده.'
              )}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs',
              isComplete
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600'
            )}
          >
            {assignedPeriods}/{totalPeriods} {t('common.periodsShort', 'ساعت')}
          </Badge>
        </div>

        <Progress
          value={completionPercentage}
          className={cn(
            'h-2.5 bg-slate-100',
            isComplete ? '[&>div]:bg-emerald-500' : '[&>div]:bg-violet-500'
          )}
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700">{t('classes.fullyAssigned', 'کامل')}</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{fullyAssignedCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700">
              {t('classes.partiallyAssigned', 'نیمه')}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-800">{partiallyAssignedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('classes.unassigned', 'بدون تخصیص')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{unassignedCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs text-slate-500">
          <span>{totalSubjects} {t('classes.subjectRequirements', 'نیازمندی مضمون')}</span>
          <span>
            {assignedPeriods}/{totalPeriods} {t('common.periodsAssigned', 'ساعت تخصیص داده شده')}
          </span>
        </div>
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

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  // Build subjects with assignments data
  const subjectsWithAssignments = useMemo((): SubjectWithAssignments[] => {
    return subjectRequirements.flatMap((req) => {
      const subject = subjectMap.get(req.subjectId);
      if (!subject) {
        return [];
      }

      const subjectName = subject.name;
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

      return [
        {
          subjectId: req.subjectId,
          subjectName,
          requiredPeriods,
          assignments,
          assignedPeriods,
          remainingPeriods,
          isFullyAssigned,
        },
      ];
    });
  }, [subjectRequirements, subjectMap, teachers, allAssignments, classData.id]);

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
    },
    [classData.id, onAssign, assignTeacher]
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
    },
    [allAssignments, classData.id, onUnassign, unassignTeacher]
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
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 py-12 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-slate-300" />
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
                  'rounded-2xl border p-3 shadow-sm transition-colors',
                  subjectData.isFullyAssigned
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : subjectData.assignments.length > 0
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-white'
                )}
              >
                {/* Subject Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
                    <Badge
                      variant="outline"
                      className="bg-white/90 text-[10px] text-slate-600"
                    >
                      {subjectData.requiredPeriods} {t('common.periodsShort', 'ساعت')}
                    </Badge>
                    {!subjectData.isFullyAssigned && (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-[10px] tabular-nums text-slate-600"
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
