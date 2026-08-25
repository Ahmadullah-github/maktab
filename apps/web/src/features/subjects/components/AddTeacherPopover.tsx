/**
 * AddTeacherPopover Component
 *
 * Phase 2.3: Add Teacher Popover for Subject-Centric View
 *
 * Popover for adding a teacher to a class-subject assignment.
 * Shows:
 * - Search input for filtering teachers
 * - Teacher list with compatibility badges and workload info
 * - Periods input (default: remainingPeriods)
 * - Workload impact preview
 * - Add button
 *
 * Mirrors AddClassPopover from teachers feature but inverted.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Plus, Search, User, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompatibilityBadge, WorkloadImpactPreview } from '../../assignments/components/shared';
import { useUnifiedAssignment } from '../../assignments/hooks/useUnifiedAssignment';
import { useWorkloadImpact } from '../../assignments/hooks/useWorkloadImpact';
import type { TeacherCompatibilityLevel } from '../../assignments/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Teacher info for display in the popover
 */
export interface AvailableTeacher {
  id: number;
  name: string;
  compatibility: TeacherCompatibilityLevel;
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
  canAcceptAssignment: boolean;
}

export interface AddTeacherPopoverProps {
  /** Subject ID for the assignment */
  subjectId: number;
  /** Class ID for the assignment */
  classId: number;
  /** Class name for display */
  className: string;
  /** Remaining periods to assign */
  remainingPeriods: number;
  /** Callback when a teacher is added */
  onAdd: (teacherId: number, periodsPerWeek: number) => Promise<void>;
  /** Whether the popover is disabled */
  disabled?: boolean;
  /** Whether an add operation is in progress */
  isAdding?: boolean;
  /** The trigger element */
  trigger: React.ReactNode;
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Additional CSS classes for the popover content */
  contentClassName?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AddTeacherPopover({
  subjectId,
  classId,
  className: classDisplayName,
  remainingPeriods,
  onAdd,
  disabled = false,
  isAdding = false,
  trigger,
  align = 'start',
  contentClassName,
}: AddTeacherPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [periodsToAssign, setPeriodsToAssign] = useState(remainingPeriods);

  // Get teacher options from unified assignment hook
  const { teacherOptions } = useUnifiedAssignment({ subjectId, classId });

  // Get workload impact for selected teacher
  const { impact } = useWorkloadImpact(selectedTeacherId, periodsToAssign);

  // Filter teachers by search query (no longer filtering by compatibility)
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teacherOptions;
    const query = searchQuery.toLowerCase();
    return teacherOptions.filter((teacher) => teacher.name.toLowerCase().includes(query));
  }, [teacherOptions, searchQuery]);

  // Assignment UI has two states: already primary, or promoted to primary atomically.
  const { primaryTeachers, authorizationTeachers } = useMemo(() => {
    return {
      primaryTeachers: filteredTeachers.filter((t) => t.compatibility === 'primary'),
      authorizationTeachers: filteredTeachers.filter((t) => t.requiresPrimaryAuthorization),
    };
  }, [filteredTeachers]);

  // Selected teacher info
  const selectedTeacher = useMemo(() => {
    return selectedTeacherId ? teacherOptions.find((t) => t.id === selectedTeacherId) : null;
  }, [selectedTeacherId, teacherOptions]);

  // Handle teacher selection
  const handleSelectTeacher = useCallback((teacherId: number) => {
    setSelectedTeacherId((prev) => (prev === teacherId ? null : teacherId));
  }, []);

  // Handle periods change
  const handlePeriodsChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) {
        setPeriodsToAssign(Math.min(num, remainingPeriods));
      }
    },
    [remainingPeriods]
  );

  // Handle add
  const handleAdd = useCallback(async () => {
    if (!selectedTeacherId || periodsToAssign <= 0) return;
    await onAdd(selectedTeacherId, periodsToAssign);
    // Reset state after adding
    setSelectedTeacherId(null);
    setPeriodsToAssign(remainingPeriods);
    setSearchQuery('');
    setIsOpen(false);
  }, [selectedTeacherId, periodsToAssign, onAdd, remainingPeriods]);

  // Handle popover open change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        // Reset state when closing
        setSelectedTeacherId(null);
        setPeriodsToAssign(remainingPeriods);
        setSearchQuery('');
      }
    },
    [remainingPeriods]
  );

  const canAdd =
    selectedTeacherId && periodsToAssign > 0 && (!impact || impact.canAccept) && !isAdding;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled || remainingPeriods <= 0}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align={align} className={cn('w-80 p-0', contentClassName)}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-sm text-slate-800">
                {t('subjects.addTeacherFor', 'افزودن معلم برای')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -me-1"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{classDisplayName}</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('subjects.searchTeachers', 'جستجوی معلم...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 ps-8 text-sm border-slate-200"
            />
          </div>
        </div>

        {/* Teacher List */}
        <ScrollArea className="max-h-[200px]">
          {filteredTeachers.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">
                {t('subjects.noTeachersFound', 'معلمی یافت نشد')}
              </p>
            </div>
          ) : (
            <div className="p-1.5 space-y-1">
              {/* Primary Teachers */}
              {primaryTeachers.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-medium text-violet-600 uppercase tracking-wide">
                    {t('subjects.primaryTeachers', 'معلمین اصلی')}
                  </div>
                  {primaryTeachers.map((teacher) => (
                    <TeacherRow
                      key={teacher.id}
                      teacher={teacher}
                      isSelected={selectedTeacherId === teacher.id}
                      onSelect={() => handleSelectTeacher(teacher.id)}
                    />
                  ))}
                </div>
              )}

              {/* Teachers promoted to primary by this assignment */}
              {authorizationTeachers.length > 0 && (
                <div>
                  <div className="mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-[10px] font-medium text-violet-600">
                    {t(
                      'assignments.needsPrimaryAuthorization',
                      'افزودن به مضامین اصلی هنگام تخصیص'
                    )}
                  </div>
                  {authorizationTeachers.map((teacher) => (
                    <TeacherRow
                      key={teacher.id}
                      teacher={teacher}
                      isSelected={selectedTeacherId === teacher.id}
                      onSelect={() => handleSelectTeacher(teacher.id)}
                    />
                  ))}
                </div>
              )}

            </div>
          )}
        </ScrollArea>

        {/* Selected Teacher Details */}
        {selectedTeacher && (
          <div className="px-3 py-2 border-t border-slate-100 space-y-3">
            {/* Periods Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                {t('subjects.periodsToAssign', 'تعداد ساعات')}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={remainingPeriods}
                  value={periodsToAssign}
                  onChange={(e) => handlePeriodsChange(e.target.value)}
                  className="flex-1 h-8 text-sm"
                  disabled={isAdding}
                />
                <span className="text-xs text-slate-500 shrink-0">/ {remainingPeriods}</span>
              </div>
            </div>

            {/* Workload Impact Preview */}
            {impact && <WorkloadImpactPreview impact={impact} compact />}
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            {/* Selection Info */}
            <div className="text-xs text-slate-600">
              {selectedTeacher && (
                <>
                  <span className="font-medium text-violet-600">{selectedTeacher.name}</span>
                  {' • '}
                  <span className="font-medium text-emerald-600">+{periodsToAssign}</span>{' '}
                  {t('common.period', 'ساعت')}
                </>
              )}
            </div>
            {/* Add Button */}
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd}
              className="h-8 px-3 gap-1.5 bg-violet-600 hover:bg-violet-700"
            >
              {isAdding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {selectedTeacher?.requiresPrimaryAuthorization
                ? t('assignments.addAsPrimaryAndAssign', 'افزودن به مضامین اصلی و تخصیص')
                : t('common.assign', 'تخصیص')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Individual teacher row in the list
 */
function TeacherRow({
  teacher,
  isSelected,
  onSelect,
}: {
  teacher: AvailableTeacher;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const utilizationPercentage =
    teacher.maxWorkload > 0
      ? Math.min(Math.round((teacher.currentWorkload / teacher.maxWorkload) * 100), 100)
      : 0;

  const isOverloaded = teacher.currentWorkload >= teacher.maxWorkload;

  return (
    <button
      onClick={onSelect}
      disabled={!teacher.canAcceptAssignment}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-start',
        isSelected
          ? 'bg-violet-50 hover:bg-violet-100 ring-1 ring-violet-300'
          : teacher.canAcceptAssignment
            ? 'hover:bg-slate-50'
            : 'opacity-50 cursor-not-allowed',
        !teacher.canAcceptAssignment && 'bg-slate-50'
      )}
    >
      {/* Teacher Icon */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          isSelected ? 'bg-violet-100' : 'bg-slate-100'
        )}
      >
        <User className={cn('w-4 h-4', isSelected ? 'text-violet-600' : 'text-slate-500')} />
      </div>

      {/* Teacher Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-slate-800 truncate">{teacher.name}</span>
          <CompatibilityBadge compatibility={teacher.compatibility} size="sm" iconOnly />
        </div>
        {/* Workload Bar */}
        <div className="flex items-center gap-2 mt-1">
          <Progress value={utilizationPercentage} className="h-1 flex-1" />
          <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
            {teacher.currentWorkload}/{teacher.maxWorkload}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        {isOverloaded ? (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200"
          >
            <AlertTriangle className="w-2.5 h-2.5 me-0.5" />
            {t('subjects.full', 'پر')}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200 tabular-nums"
          >
            +{teacher.availableCapacity}
          </Badge>
        )}
      </div>
    </button>
  );
}

export default AddTeacherPopover;
