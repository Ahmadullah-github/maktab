/**
 * SubjectAssignmentManager Component
 *
 * Phase 2.1: Subject-Centric Assignment Manager
 *
 * Enables assigning teachers to classes from the Subject perspective.
 * Shows coverage progress and allows quick teacher assignment per class.
 *
 * Features:
 * - Coverage progress header with live updates
 * - List of classes requiring this subject
 * - Each class row shows: class name + grade, required periods,
 *   assigned teacher(s), remaining periods, add teacher button
 * - Teacher selector with workload preview
 * - Compatibility badges
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompatibilityBadge,
  TeacherSelector,
  WorkloadImpactPreview,
} from '../../assignments/components/shared';
import { useUnifiedAssignment } from '../../assignments/hooks/useUnifiedAssignment';
import { useWorkloadImpact } from '../../assignments/hooks/useWorkloadImpact';
import type { CoverageStatus, TeacherCompatibilityLevel } from '../../assignments/types';
import { useSubjectCoverage } from '../hooks/useSubjectCoverage';
import type { Subject } from '../types';
import { ClassAssignmentRow as MultiTeacherClassAssignmentRow } from './ClassAssignmentRow';

// ============================================================================
// Types
// ============================================================================

export interface SubjectAssignmentManagerProps {
  /** The subject being managed */
  subject: Subject;
  /** Callback when assignment changes */
  onAssignmentChange?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface ClassRowProps {
  classId: number;
  className: string;
  grade: number | null;
  periodsPerWeek: number;
  assignedTeacherId: number | null;
  assignedTeacherName: string | null;
  subjectId: number;
  onAssign: (classId: number, teacherId: number) => Promise<void>;
  isAssigning: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Get status color classes based on coverage status
 */
function getStatusColors(status: CoverageStatus): {
  bg: string;
  text: string;
  border: string;
  progress: string;
} {
  switch (status) {
    case 'complete':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        progress: 'bg-emerald-500',
      };
    case 'partial':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        progress: 'bg-amber-500',
      };
    case 'uncovered':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        progress: 'bg-red-500',
      };
  }
}

/**
 * Get status icon based on coverage status
 */
function StatusIcon({ status }: { status: CoverageStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case 'partial':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    case 'uncovered':
      return <XCircle className="h-4 w-4 text-red-600" />;
  }
}

/**
 * Coverage Progress Header
 */
function CoverageProgressHeader({
  coveragePercentage,
  status,
  assignedCount,
  unassignedCount,
  totalClasses,
}: {
  coveragePercentage: number;
  status: CoverageStatus;
  assignedCount: number;
  unassignedCount: number;
  totalClasses: number;
}) {
  const { t } = useTranslation();
  const statusColors = getStatusColors(status);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border bg-linear-to-br p-4 shadow-sm',
        statusColors.bg,
        statusColors.border
      )}
    >
      <div className="absolute inset-y-0 end-0 w-32 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.24),transparent_70%)] blur-2xl" />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
          <StatusIcon status={status} />
            <div>
              <h4 className={cn('font-semibold text-sm', statusColors.text)}>
                {status === 'complete' && t('subjects.coverage.complete', 'پوشش کامل')}
                {status === 'partial' && t('subjects.coverage.partial', 'پوشش ناقص')}
                {status === 'uncovered' && t('subjects.coverage.uncovered', 'بدون پوشش')}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  'subjects.coverage.description',
                  'نمای کلی از صنف‌های نیازمند این مضمون و مواردی که هنوز معلم نگرفته‌اند.'
                )}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('border bg-white/70 text-xs font-bold', statusColors.text, statusColors.border)}
          >
            {coveragePercentage}%
          </Badge>
        </div>

        <Progress value={coveragePercentage} className={cn('mb-3 h-2.5', statusColors.progress)} />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('subjects.coverage.total', 'کل')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{totalClasses}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('subjects.coverage.assigned', 'تخصیص یافته')}
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-700">{assignedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('subjects.coverage.needsAssignment', 'نیاز به تخصیص')}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-700">{unassignedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Class Assignment Row - Shows a class and its teacher assignment
 */
export function LegacySingleTeacherClassAssignmentRow({
  classId,
  className,
  grade,
  periodsPerWeek,
  assignedTeacherId,
  assignedTeacherName,
  subjectId,
  onAssign,
  isAssigning,
}: ClassRowProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

  // Get unified assignment data for teacher options
  const { teacherOptions, getTeacherCompatibility } = useUnifiedAssignment({ subjectId, classId });

  // Get workload impact for selected teacher
  const { impact } = useWorkloadImpact(selectedTeacherId, periodsPerWeek);

  const isAssigned = !!assignedTeacherId;

  // Get compatibility for assigned teacher
  const assignedTeacherCompatibility: TeacherCompatibilityLevel | null = assignedTeacherId
    ? getTeacherCompatibility(assignedTeacherId, subjectId)
    : null;

  const handleAssign = useCallback(async () => {
    if (!selectedTeacherId) return;
    await onAssign(classId, selectedTeacherId);
    setSelectedTeacherId(null);
    setIsExpanded(false);
  }, [selectedTeacherId, classId, onAssign]);

  // Compatibility is advisory; the command layer validates and records an allowed capability.
  const availableTeachers = teacherOptions;

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200 shadow-sm',
        isAssigned
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-md'
      )}
    >
      {/* Main Row */}
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Class Icon */}
          <div
            className={cn(
              'shrink-0 rounded-xl p-2',
              isAssigned ? 'bg-emerald-100' : 'bg-slate-100'
            )}
          >
            <GraduationCap
              className={cn('h-4 w-4', isAssigned ? 'text-emerald-600' : 'text-slate-500')}
            />
          </div>

          {/* Class Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm text-slate-800 truncate">{className}</span>
              {grade && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  {t('common.grade', 'صنف')} {grade}
                </Badge>
              )}
              <Badge variant="outline" className="bg-white text-[10px] text-slate-600">
                {periodsPerWeek} {t('common.periodsShort', 'ساعت')}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAssigned
                ? t('subjects.coverage.classAssignedHint', 'این صنف در حال حاضر پوشش دارد')
                : t('subjects.coverage.classNeedsTeacher', 'برای این صنف هنوز معلم انتخاب نشده است')}
            </p>
          </div>
        </div>

        {/* Assignment Status / Action */}
        <div className="flex items-center gap-2 shrink-0">
          {isAssigned ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-100 px-2.5 py-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">{assignedTeacherName}</span>
              </div>
              {assignedTeacherCompatibility && (
                <CompatibilityBadge compatibility={assignedTeacherCompatibility} size="sm" />
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'h-8 gap-1.5 rounded-xl border-violet-300 px-3 text-xs text-violet-600 hover:bg-violet-50',
                isExpanded && 'bg-violet-50'
              )}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t('subjects.assignTeacher', 'تخصیص معلم')}
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 ms-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ms-1" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Teacher Selection */}
      {isExpanded && !isAssigned && (
        <div className="mt-0 border-t border-slate-100 px-3 pb-3 pt-0">
          <div className="space-y-3 pt-3">
            {/* Teacher Selector */}
            <TeacherSelector
              teachers={availableTeachers}
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              placeholder={t('subjects.selectTeacher', 'انتخاب معلم')}
              disabled={isAssigning}
            />

            {/* Workload Impact Preview */}
            {impact && <WorkloadImpactPreview impact={impact} compact />}

            {/* Assign Button */}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={!selectedTeacherId || isAssigning || (impact ? !impact.canAccept : false)}
                className="h-8 gap-1.5 rounded-xl bg-violet-600 px-4 hover:bg-violet-700"
              >
                {isAssigning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {t('common.assign', 'تخصیص')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SubjectAssignmentManager({
  subject,
  onAssignmentChange,
  className,
}: SubjectAssignmentManagerProps) {
  const { t } = useTranslation();

  // Get coverage data
  const {
    classesRequiring,
    coveragePercentage,
    status,
    assignedCount,
    unassignedCount,
    totalClasses,
    isLoading,
  } = useSubjectCoverage(subject);

  // Get assignment operations
  const { assign, unassign, isAssigning, invalidateAllCaches } = useUnifiedAssignment({
    subjectId: subject.id,
  });

  // Handle assignment
  const handleAssign = useCallback(
    async (classId: number, teacherId: number, periodsPerWeek: number) => {
      await assign({
        teacherId,
        subjectId: subject.id,
        classIds: [classId],
        periodsPerWeek,
        classPeriodOverrides: [{ classId, periodsPerWeek }],
      });
      invalidateAllCaches();
      onAssignmentChange?.();
    },
    [assign, subject.id, invalidateAllCaches, onAssignmentChange]
  );

  const handleUnassign = useCallback(
    async (classId: number, teacherId: number) => {
      await unassign({ teacherId, subjectId: subject.id, classIds: [classId] });
      invalidateAllCaches();
      onAssignmentChange?.();
    },
    [invalidateAllCaches, onAssignmentChange, subject.id, unassign]
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Coverage Progress Header */}
      <div className="pb-4">
        <CoverageProgressHeader
          coveragePercentage={coveragePercentage}
          status={status}
          assignedCount={assignedCount}
          unassignedCount={unassignedCount}
          totalClasses={totalClasses}
        />
      </div>

      {/* Classes List */}
      {totalClasses > 0 ? (
        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-violet-600" />
            <h4 className="text-sm font-medium text-slate-700">
              {t('subjects.coverage.classesRequiring', 'صنف‌های نیازمند این مضمون')}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {totalClasses}
            </Badge>
          </div>

          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-2 pe-2">
              {classesRequiring.map((classDetail) => (
                <MultiTeacherClassAssignmentRow
                  key={classDetail.classId}
                  classDetail={classDetail}
                  subjectId={subject.id}
                  assignments={classDetail.assignments}
                  onAssign={(teacherId, periodsPerWeek) =>
                    handleAssign(classDetail.classId, teacherId, periodsPerWeek)
                  }
                  onUnassign={(teacherId) => handleUnassign(classDetail.classId, teacherId)}
                  isAssigning={isAssigning}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <GraduationCap className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {t('subjects.coverage.noClassesRequire', 'هیچ صنفی این مضمون را در برنامه ندارد')}
          </p>
        </div>
      )}
    </div>
  );
}

export default SubjectAssignmentManager;
