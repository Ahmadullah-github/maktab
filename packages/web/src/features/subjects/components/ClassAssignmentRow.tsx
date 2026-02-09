/**
 * ClassAssignmentRow Component (Subject View)
 *
 * Phase 2.2: Class Assignment Row for Subject-Centric View
 *
 * Shows a class that requires a subject with:
 * - Class info (name, grade, required periods)
 * - Assigned teachers as chips (with periods each)
 * - Remaining periods badge
 * - Add teacher popover for assigning additional teachers
 *
 * Supports multi-teacher assignments where multiple teachers
 * can share the periods for a single class-subject combination.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Loader2,
  Plus,
  User,
  X,
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
import type { ClassCoverageDetail } from '../../assignments/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Teacher assignment for this class-subject
 */
export interface TeacherAssignment {
  teacherId: number;
  teacherName: string;
  periodsPerWeek: number;
  compatibility: 'primary' | 'allowed';
}

export interface ClassAssignmentRowProps {
  /** Class coverage detail */
  classDetail: ClassCoverageDetail;
  /** Subject ID this row belongs to */
  subjectId: number;
  /** Teachers currently assigned to this class-subject */
  assignments: TeacherAssignment[];
  /** Callback when assigning a teacher */
  onAssign: (teacherId: number, periodsPerWeek: number) => Promise<void>;
  /** Callback when unassigning a teacher */
  onUnassign: (teacherId: number) => Promise<void>;
  /** Whether an assignment operation is in progress */
  isAssigning?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get row background based on assignment status
 */
function getRowBackground(
  isFullyAssigned: boolean,
  hasPartialAssignment: boolean,
  hasConflict: boolean
): string {
  if (hasConflict) {
    return 'bg-red-50/70 border-red-200 hover:border-red-300';
  }
  if (isFullyAssigned) {
    return 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300';
  }
  if (hasPartialAssignment) {
    return 'bg-amber-50/70 border-amber-200 hover:border-amber-300';
  }
  return 'bg-white border-slate-200 hover:border-violet-300';
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Teacher chip showing assigned teacher with periods
 */
function TeacherChip({
  assignment,
  onRemove,
  disabled,
}: {
  assignment: TeacherAssignment;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 transition-all duration-200',
        'bg-white hover:shadow-sm',
        assignment.compatibility === 'primary'
          ? 'border-violet-200 hover:border-violet-300'
          : 'border-blue-200 hover:border-blue-300'
      )}
    >
      <User
        className={cn(
          'w-3.5 h-3.5 shrink-0',
          assignment.compatibility === 'primary' ? 'text-violet-500' : 'text-blue-500'
        )}
      />
      <span className="text-sm font-medium text-slate-700">{assignment.teacherName}</span>
      <span className="text-xs text-slate-400">
        ({assignment.periodsPerWeek} {t('common.period', 'ساعت')})
      </span>
      <CompatibilityBadge compatibility={assignment.compatibility} size="sm" iconOnly />
      {/* Remove Button */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'hover:bg-red-100 text-slate-400 hover:text-red-500',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label={t('common.remove', 'حذف')}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/**
 * Add Teacher Popover
 */
function AddTeacherPopover({
  subjectId,
  classId,
  remainingPeriods,
  onAssign,
  isAssigning,
  disabled,
}: {
  subjectId: number;
  classId: number;
  remainingPeriods: number;
  onAssign: (teacherId: number, periodsPerWeek: number) => Promise<void>;
  isAssigning?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [periodsToAssign, setPeriodsToAssign] = useState(remainingPeriods);

  // Get teacher options from unified assignment hook
  const { teacherOptions } = useUnifiedAssignment({ subjectId, classId });

  // Get workload impact for selected teacher
  const { impact } = useWorkloadImpact(selectedTeacherId, periodsToAssign);

  // Show all teachers who can accept assignments (no compatibility filter)
  // Primary/allowed are preferences for sorting, not restrictions
  const availableTeachers = teacherOptions.filter((t) => t.canAcceptAssignment);

  const handleAssign = useCallback(async () => {
    if (!selectedTeacherId || periodsToAssign <= 0) return;
    await onAssign(selectedTeacherId, periodsToAssign);
    setSelectedTeacherId(null);
    setPeriodsToAssign(remainingPeriods);
    setIsOpen(false);
  }, [selectedTeacherId, periodsToAssign, onAssign, remainingPeriods]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedTeacherId(null);
    }
  }, []);

  // Reset periods when remaining changes
  const handlePeriodsChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) {
        setPeriodsToAssign(Math.min(num, remainingPeriods));
      }
    },
    [remainingPeriods]
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || remainingPeriods <= 0}
          className={cn(
            'h-8 px-3 gap-1.5 border-dashed',
            'border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('subjects.addTeacher', 'افزودن معلم')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-slate-100">
          <h4 className="font-medium text-sm text-slate-800">
            {t('subjects.assignTeacherTitle', 'تخصیص معلم')}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {remainingPeriods} {t('subjects.periodsRemaining', 'ساعت باقی‌مانده')}
          </p>
        </div>

        <div className="p-3 space-y-3">
          {/* Teacher Selector */}
          <TeacherSelector
            teachers={availableTeachers}
            value={selectedTeacherId}
            onChange={setSelectedTeacherId}
            placeholder={t('subjects.selectTeacher', 'انتخاب معلم')}
            disabled={isAssigning}
          />

          {/* Periods Input */}
          {selectedTeacherId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                {t('subjects.periodsToAssign', 'تعداد ساعات')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={remainingPeriods}
                  value={periodsToAssign}
                  onChange={(e) => handlePeriodsChange(e.target.value)}
                  className="flex-1 h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  disabled={isAssigning}
                />
                <span className="text-xs text-slate-500">/ {remainingPeriods}</span>
              </div>
            </div>
          )}

          {/* Workload Impact Preview */}
          {impact && <WorkloadImpactPreview impact={impact} compact />}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isAssigning}>
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button
            size="sm"
            onClick={handleAssign}
            disabled={
              !selectedTeacherId ||
              periodsToAssign <= 0 ||
              isAssigning ||
              (impact ? !impact.canAccept : false)
            }
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isAssigning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
            ) : (
              <Plus className="w-3.5 h-3.5 me-1.5" />
            )}
            {t('common.assign', 'تخصیص')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClassAssignmentRow({
  classDetail,
  subjectId,
  assignments,
  onAssign,
  onUnassign,
  isAssigning = false,
  className,
}: ClassAssignmentRowProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(assignments.length > 0);

  // Calculate assignment status
  const totalAssignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
  const remainingPeriods = classDetail.periodsPerWeek - totalAssignedPeriods;
  const isFullyAssigned = remainingPeriods <= 0;
  const hasPartialAssignment = assignments.length > 0 && !isFullyAssigned;
  const hasConflict = classDetail.conflicts && classDetail.conflicts.length > 0;
  const isOverAssigned = remainingPeriods < 0;

  const rowBackground = getRowBackground(isFullyAssigned, hasPartialAssignment, hasConflict);

  const handleUnassign = useCallback(
    async (teacherId: number) => {
      await onUnassign(teacherId);
    },
    [onUnassign]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className={cn('rounded-xl border-2 transition-all duration-200', rowBackground)}>
        {/* Header Row */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 text-start">
            {/* Class Icon */}
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                isFullyAssigned
                  ? 'bg-emerald-100 text-emerald-600'
                  : hasPartialAssignment
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
              )}
            >
              <GraduationCap className="w-4.5 h-4.5" />
            </div>

            {/* Class Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 truncate">{classDetail.className}</span>
                {isFullyAssigned && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                {hasConflict && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {classDetail.periodsPerWeek} {t('common.periodsPerWeek', 'ساعت در هفته')}
              </p>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Teachers Count */}
              {assignments.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200"
                >
                  <User className="w-3 h-3 me-1" />
                  {assignments.length}
                </Badge>
              )}

              {/* Remaining Periods */}
              {!isFullyAssigned && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 tabular-nums',
                    isOverAssigned
                      ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                  )}
                >
                  {isOverAssigned ? (
                    <>
                      {Math.abs(remainingPeriods)} {t('subjects.periodsOver', 'ساعت اضافی')}
                    </>
                  ) : (
                    <>
                      {remainingPeriods} {t('subjects.periodsRemaining', 'ساعت باقی‌مانده')}
                    </>
                  )}
                </Badge>
              )}

              {/* Fully Assigned Badge */}
              {isFullyAssigned && !isOverAssigned && (
                <Badge className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {t('subjects.fullyAssigned', 'کامل')}
                </Badge>
              )}

              {/* Expand Icon */}
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-400 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Collapsible Content - Assigned Teachers */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <div className="border-t border-slate-200/50 pt-3">
              {/* Teachers Grid */}
              <div className="flex flex-wrap gap-2">
                {assignments.map((assignment) => (
                  <TeacherChip
                    key={assignment.teacherId}
                    assignment={assignment}
                    onRemove={() => handleUnassign(assignment.teacherId)}
                    disabled={isAssigning}
                  />
                ))}

                {/* Add Teacher Button */}
                {!isFullyAssigned && (
                  <AddTeacherPopover
                    subjectId={subjectId}
                    classId={classDetail.classId}
                    remainingPeriods={remainingPeriods}
                    onAssign={onAssign}
                    isAssigning={isAssigning}
                    disabled={isAssigning}
                  />
                )}
              </div>

              {/* Empty State */}
              {assignments.length === 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs text-slate-500">
                    {t('subjects.noTeachersAssigned', 'هیچ معلمی اختصاص داده نشده است')}
                  </p>
                  {!isFullyAssigned && (
                    <AddTeacherPopover
                      subjectId={subjectId}
                      classId={classDetail.classId}
                      remainingPeriods={remainingPeriods}
                      onAssign={onAssign}
                      isAssigning={isAssigning}
                      disabled={isAssigning}
                    />
                  )}
                </div>
              )}

              {/* Conflict Warning */}
              {hasConflict && classDetail.conflicts && (
                <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700">
                      <p className="font-medium">
                        {t('subjects.conflictDetected', 'تعارض شناسایی شد')}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {classDetail.conflicts.map((conflict, idx) => (
                          <li key={idx}>{conflict.messageFa || conflict.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default ClassAssignmentRow;
