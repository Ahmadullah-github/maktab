/**
 * SubjectAssignmentSection Component
 *
 * Phase 3.2: Subject Assignment Section for Class-Centric View
 *
 * A compact section showing teacher assignments for a single subject
 * within a class. Used in ClassEditDrawer to display and manage
 * multi-teacher assignments per subject.
 *
 * Shows:
 * - Assigned teachers as expandable list
 * - Each teacher shows: name, periods, compatibility, remove button
 * - Remaining periods indicator
 * - Add teacher button with popover
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Plus, User, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompatibilityBadge,
  TeacherSelector,
  WorkloadImpactPreview,
} from '../../assignments/components/shared';
import { useUnifiedAssignment } from '../../assignments/hooks/useUnifiedAssignment';
import { useWorkloadImpact } from '../../assignments/hooks/useWorkloadImpact';
import type { TeacherCompatibilityLevel } from '../../assignments/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Teacher assignment for this class-subject
 */
export interface TeacherAssignmentInfo {
  assignmentId: number;
  teacherId: number;
  teacherName: string;
  periodsPerWeek: number;
  compatibility: TeacherCompatibilityLevel;
}

export interface SubjectAssignmentSectionProps {
  /** Class ID */
  classId: number;
  /** Subject ID */
  subjectId: number;
  /** Subject name for display */
  subjectName?: string;
  /** Required periods per week for this subject */
  requiredPeriods: number;
  /** Current teacher assignments */
  assignments: TeacherAssignmentInfo[];
  /** Callback when assigning a teacher */
  onAssign: (teacherId: number, periodsPerWeek: number) => Promise<void>;
  /** Callback when unassigning a teacher */
  onUnassign: (assignmentId: number) => Promise<void>;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Whether an operation is in progress */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
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
  assignment: TeacherAssignmentInfo;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all duration-200',
        'bg-white hover:shadow-sm',
        assignment.compatibility === 'primary'
          ? 'border-violet-200 hover:border-violet-300'
          : assignment.compatibility === 'allowed'
            ? 'border-blue-200 hover:border-blue-300'
            : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <User
        className={cn(
          'w-3 h-3 shrink-0',
          assignment.compatibility === 'primary'
            ? 'text-violet-500'
            : assignment.compatibility === 'allowed'
              ? 'text-blue-500'
              : 'text-slate-400'
        )}
      />
      <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">
        {assignment.teacherName}
      </span>
      <span className="text-[10px] text-slate-400">({assignment.periodsPerWeek})</span>
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
 * Add Teacher Popover for assigning new teachers
 */
function AddTeacherPopover({
  subjectId,
  classId,
  remainingPeriods,
  existingTeacherIds,
  onAssign,
  isAssigning,
  disabled,
}: {
  subjectId: number;
  classId: number;
  remainingPeriods: number;
  existingTeacherIds: number[];
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

  // Headteachers may promote any schedulable teacher to primary while assigning.
  const availableTeachers = teacherOptions.filter(
    (t) =>
      t.canAcceptAssignment &&
      !existingTeacherIds.includes(t.id)
  );
  const selectedTeacher = teacherOptions.find((teacher) => teacher.id === selectedTeacherId);
  const requiresPrimaryAuthorization = selectedTeacher?.requiresPrimaryAuthorization ?? false;

  const handleAssign = useCallback(async () => {
    if (!selectedTeacherId || periodsToAssign <= 0) return;
    await onAssign(selectedTeacherId, periodsToAssign);
    setSelectedTeacherId(null);
    setPeriodsToAssign(remainingPeriods);
    setIsOpen(false);
  }, [selectedTeacherId, periodsToAssign, onAssign, remainingPeriods]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setSelectedTeacherId(null);
        setPeriodsToAssign(remainingPeriods);
      }
    },
    [remainingPeriods]
  );

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
            'h-7 px-2 gap-1 text-xs border-dashed',
            'border-violet-300 text-violet-600 hover:bg-violet-50 hover:border-violet-400'
          )}
        >
          <Plus className="w-3 h-3" />
          {t('common.add', 'افزودن')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
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
                  className="flex-1 h-8 px-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
              <Loader2 className="w-3 h-3 animate-spin me-1" />
            ) : (
              <Plus className="w-3 h-3 me-1" />
            )}
            {requiresPrimaryAuthorization
              ? t('assignments.addAsPrimaryAndAssign', 'افزودن به مضامین اصلی و تخصیص')
              : t('common.assign', 'تخصیص')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SubjectAssignmentSection({
  classId,
  subjectId,
  subjectName,
  requiredPeriods,
  assignments,
  onAssign,
  onUnassign,
  disabled = false,
  isLoading = false,
  className,
}: SubjectAssignmentSectionProps) {
  const { t } = useTranslation();

  // Calculate assignment status
  const totalAssignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
  const remainingPeriods = Math.max(0, requiredPeriods - totalAssignedPeriods);
  const isFullyAssigned = remainingPeriods <= 0;
  const isOverAssigned = totalAssignedPeriods > requiredPeriods;
  const existingTeacherIds = assignments.map((a) => a.teacherId);

  const handleUnassign = useCallback(
    async (assignmentId: number) => {
      await onUnassign(assignmentId);
    },
    [onUnassign]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with subject name and status */}
      {subjectName && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{subjectName}</span>
          <div className="flex items-center gap-2">
            {isFullyAssigned && !isOverAssigned && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 me-0.5" />
                {t('subjects.fullyAssigned', 'کامل')}
              </Badge>
            )}
            {isOverAssigned && (
              <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border border-red-200">
                {Math.abs(remainingPeriods)} {t('subjects.periodsOver', 'ساعت اضافی')}
              </Badge>
            )}
            {!isFullyAssigned && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200"
              >
                {remainingPeriods}/{requiredPeriods}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Assigned teachers */}
      <div className="flex flex-wrap gap-1.5">
        {assignments.map((assignment) => (
          <TeacherChip
            key={assignment.assignmentId}
            assignment={assignment}
            onRemove={() => handleUnassign(assignment.assignmentId)}
            disabled={disabled || isLoading}
          />
        ))}

        {/* Add teacher button */}
        {!isFullyAssigned && (
          <AddTeacherPopover
            subjectId={subjectId}
            classId={classId}
            remainingPeriods={remainingPeriods}
            existingTeacherIds={existingTeacherIds}
            onAssign={onAssign}
            isAssigning={isLoading}
            disabled={disabled}
          />
        )}

        {/* Empty state */}
        {assignments.length === 0 && isFullyAssigned && (
          <span className="text-xs text-slate-400 italic">
            {t('subjects.noTeachersAssigned', 'هیچ معلمی اختصاص داده نشده است')}
          </span>
        )}
      </div>
    </div>
  );
}

export default SubjectAssignmentSection;
