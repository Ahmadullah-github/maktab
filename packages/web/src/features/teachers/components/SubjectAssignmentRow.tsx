/**
 * SubjectAssignmentRow Component
 *
 * Collapsible row for a single subject showing:
 * - Checkbox for enabling/disabling subject capability
 * - Subject name + periods badge
 * - Primary/Allowed toggle
 * - Assigned classes as chips (when expanded)
 * - Add class button
 * - Total periods for this subject
 *
 * Phase 1.1 of SubjectManager Refactoring
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronDown, GraduationCap, Plus, Star, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Subject info for display
 */
export interface SubjectInfo {
  id: number;
  name: string;
  code?: string;
  periodsPerWeek?: number | null;
  grade?: number | null;
}

/**
 * Class info for display
 */
export interface ClassInfo {
  id: number;
  name: string;
  displayName?: string;
  grade?: number | null;
  periodsPerWeek: number; // Periods for this subject in this class
}

export interface SubjectAssignmentRowProps {
  /** Subject data */
  subject: SubjectInfo;
  /** Whether subject is in primarySubjectIds or allowedSubjectIds */
  isEnabled: boolean;
  /** Whether subject is in primarySubjectIds (vs allowedSubjectIds) */
  isPrimary: boolean;
  /** Classes assigned for this subject */
  assignedClasses: ClassInfo[];
  /** Total periods for all assigned classes */
  totalPeriods: number;
  /** Callback when checkbox is toggled */
  onToggleEnabled: (enabled: boolean) => void;
  /** Callback when Primary/Allowed is toggled */
  onTogglePrimary: (isPrimary: boolean) => void;
  /** Callback when add class button is clicked */
  onAddClassClick: () => void;
  /** Callback when a class is removed */
  onRemoveClass: (classId: number) => void;
  /** Whether the row is disabled */
  disabled?: boolean;
  /** Whether restrict to primary is enabled (disables Allowed option) */
  restrictToPrimary?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get background color based on assignment state
 */
function getRowBackground(isEnabled: boolean, hasAssignments: boolean, isPrimary: boolean): string {
  if (!isEnabled) {
    return 'bg-slate-50 hover:bg-slate-100';
  }
  if (hasAssignments) {
    return isPrimary
      ? 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-200'
      : 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200';
  }
  return isPrimary
    ? 'bg-blue-50/40 hover:bg-blue-50/60 border-blue-100'
    : 'bg-amber-50/40 hover:bg-amber-50/60 border-amber-100';
}

/**
 * SubjectAssignmentRow - Collapsible row for subject capability and assignments
 */
export function SubjectAssignmentRow({
  subject,
  isEnabled,
  isPrimary,
  assignedClasses,
  totalPeriods,
  onToggleEnabled,
  onTogglePrimary,
  onAddClassClick,
  onRemoveClass,
  disabled = false,
  restrictToPrimary = false,
  className,
}: SubjectAssignmentRowProps) {
  const { t } = useTranslation();
  const hasAssignments = assignedClasses.length > 0;

  // Auto-expand if has assignments, collapse if not
  const [isOpen, setIsOpen] = useState(hasAssignments);
  const previousStateRef = useRef({
    assignedCount: assignedClasses.length,
    totalPeriods,
  });

  useEffect(() => {
    const previousState = previousStateRef.current;
    const assignmentCountChanged = assignedClasses.length !== previousState.assignedCount;
    const totalPeriodsChanged = totalPeriods !== previousState.totalPeriods;

    if (!isEnabled || !hasAssignments) {
      setIsOpen(false);
    } else if (assignmentCountChanged || totalPeriodsChanged) {
      setIsOpen(true);
    }

    previousStateRef.current = {
      assignedCount: assignedClasses.length,
      totalPeriods,
    };
  }, [assignedClasses.length, hasAssignments, isEnabled, totalPeriods]);

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      if (disabled) return;
      onToggleEnabled(checked);
      // Auto-expand when enabling
      if (checked && !isOpen) {
        setIsOpen(true);
      }
    },
    [disabled, onToggleEnabled, isOpen]
  );

  const handlePrimaryToggle = useCallback(() => {
    if (disabled || !isEnabled || restrictToPrimary) return;
    onTogglePrimary(!isPrimary);
  }, [disabled, isEnabled, restrictToPrimary, isPrimary, onTogglePrimary]);

  const handleRemoveClass = useCallback(
    (classId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      onRemoveClass(classId);
    },
    [disabled, onRemoveClass]
  );

  const rowBackground = getRowBackground(isEnabled, hasAssignments, isPrimary);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div
        className={cn(
          'rounded-lg border-2 transition-all duration-200',
          rowBackground,
          !isEnabled && 'opacity-60',
          className
        )}
      >
        {/* Header Row - Always visible */}
        <div className="flex items-center gap-3 p-3">
          {/* Checkbox */}
          <Checkbox
            checked={isEnabled}
            onCheckedChange={handleCheckboxChange}
            disabled={disabled}
            className={cn(
              'shrink-0',
              isEnabled && isPrimary && 'border-blue-500 data-[state=checked]:bg-blue-600',
              isEnabled && !isPrimary && 'border-amber-500 data-[state=checked]:bg-amber-600'
            )}
            aria-label={t('teachers.toggleSubject', 'Toggle subject')}
          />

          {/* Collapse Trigger - Subject Info */}
          <CollapsibleTrigger asChild disabled={!isEnabled}>
            <button
              className={cn(
                'flex-1 flex items-center gap-2 text-start min-w-0',
                isEnabled ? 'cursor-pointer' : 'cursor-default'
              )}
              disabled={!isEnabled}
            >
              {/* Subject Icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  isEnabled
                    ? isPrimary
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-amber-100 text-amber-600'
                    : 'bg-slate-200 text-slate-400'
                )}
              >
                <BookOpen className="w-4 h-4" />
              </div>

              {/* Subject Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium truncate',
                      isEnabled ? 'text-slate-800' : 'text-slate-500'
                    )}
                  >
                    {subject.name}
                  </span>
                  {subject.code && (
                    <span className="text-xs text-slate-400 shrink-0">({subject.code})</span>
                  )}
                </div>
                {subject.grade && (
                  <span className="text-xs text-slate-500">
                    {t('common.grade', 'صنف')} {subject.grade}
                  </span>
                )}
              </div>

              {/* Expand Icon */}
              {isEnabled && (
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0',
                    isOpen && 'rotate-180'
                  )}
                />
              )}
            </button>
          </CollapsibleTrigger>

          {/* Right Side - Badges & Stats */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Primary/Allowed Badge */}
            {isEnabled && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handlePrimaryToggle}
                      disabled={disabled || restrictToPrimary}
                      className={cn('transition-colors', restrictToPrimary && 'cursor-not-allowed')}
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] px-2 py-0.5 gap-1',
                          isPrimary
                            ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                            : 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200',
                          (disabled || restrictToPrimary) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Star className="w-3 h-3" />
                        {isPrimary ? t('teachers.primary', 'اصلی') : t('teachers.allowed', 'مجاز')}
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {restrictToPrimary
                      ? t('teachers.restrictedToPrimary', 'محدود به مضامین اصلی')
                      : isPrimary
                        ? t('teachers.clickToMakeAllowed', 'کلیک برای تغییر به مجاز')
                        : t('teachers.clickToMakePrimary', 'کلیک برای تغییر به اصلی')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Periods Badge */}
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] px-2 py-0.5 tabular-nums',
                hasAssignments
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}
            >
              {totalPeriods} {t('common.period', 'ساعت')}
            </Badge>
          </div>
        </div>

        {/* Collapsible Content - Assigned Classes */}
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
          <div className="px-3 pb-3 pt-0">
            <div className="border-t border-slate-200/50 pt-3">
              {/* Classes Grid */}
              <div className="flex flex-wrap gap-2">
                {assignedClasses.map((cls, index) => (
                  <div
                    key={cls.id}
                    className={cn(
                      'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 transition-all duration-200',
                      'animate-in fade-in-0 slide-in-from-left-2',
                      isPrimary
                        ? 'bg-white border-blue-200 hover:border-blue-300 hover:shadow-sm'
                        : 'bg-white border-amber-200 hover:border-amber-300 hover:shadow-sm'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <GraduationCap
                      className={cn(
                        'w-3.5 h-3.5 shrink-0',
                        isPrimary ? 'text-blue-500' : 'text-amber-500'
                      )}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {cls.displayName || cls.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({cls.periodsPerWeek} {t('common.period', 'ساعت')})
                    </span>
                    {/* Remove Button */}
                    <button
                      onClick={(e) => handleRemoveClass(cls.id, e)}
                      disabled={disabled}
                      className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center',
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        'hover:bg-red-100 text-slate-400 hover:text-red-500',
                        disabled && 'cursor-not-allowed'
                      )}
                      aria-label={t('common.remove', 'حذف')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Add Class Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddClassClick}
                  disabled={disabled}
                  className={cn(
                    'h-8 px-3 gap-1.5 border-dashed',
                    isPrimary
                      ? 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
                      : 'border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-400'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('teachers.addClass', 'افزودن صنف')}
                </Button>
              </div>

              {/* Empty State */}
              {assignedClasses.length === 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  {t('teachers.noClassesAssigned', 'هیچ صنفی اختصاص داده نشده است')}
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default SubjectAssignmentRow;
