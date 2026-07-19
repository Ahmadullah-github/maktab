/**
 * TeacherSelectionList Component
 *
 * A list-based teacher selector for the AssignmentDrawer with:
 * - Grouped teachers by compatibility level
 * - Inline workload bars with projected workload preview
 * - One-click assign button on each row
 * - Keyboard navigation (Arrow keys + Enter)
 *
 * Phase 1 of AssignmentDrawer refactor
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Search, User, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSmartTeacherSelection } from '../hooks/useSmartTeacherSelection';
import {
  getCompatibilityBadgeInfo,
  type SmartCompatibilityLevel,
  type SmartTeacherCompatibility,
} from '../services/teacherCompatibility';

// ============================================================================
// Types
// ============================================================================

export interface TeacherSelectionListProps {
  /** Subject ID to find teachers for */
  subjectId: number;
  /** Periods to add (for projected workload calculation) */
  periodsToAdd: number;
  /** Every subject that will be promoted to primary in this assignment command. */
  authorizationSubjectIds?: number[];
  /** Callback when teacher is assigned */
  onAssign: (teacherId: number) => void;
  /** ID of teacher currently being assigned (for loading state) */
  assigningTeacherId?: number | null;
  /** Currently assigned teacher IDs (to highlight) */
  currentTeacherIds?: number[];
  /** Additional CSS classes */
  className?: string;
}

interface TeacherWithProjection extends SmartTeacherCompatibility {
  projectedWorkload: number;
  projectedUtilization: number;
  willBeOverloaded: boolean;
  // Inherited from SmartTeacherCompatibility:
  // unavailableCount: number;
  // hasLimitedAvailability: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Compatibility badge with Farsi label
 */
function CompatibilityBadge({ level }: { level: SmartCompatibilityLevel }) {
  const info = getCompatibilityBadgeInfo(level);
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[9px] px-1.5 py-0 h-4 font-medium shrink-0',
        info.bgColor,
        info.color,
        info.borderColor
      )}
    >
      {info.labelFa}
    </Badge>
  );
}

/**
 * Workload bar with current and projected values
 */
function WorkloadBarWithProjection({
  current,
  projected,
  max,
  periodsToAdd,
}: {
  current: number;
  projected: number;
  max: number;
  periodsToAdd: number;
}) {
  const currentPercent = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const projectedPercent = max > 0 ? Math.min((projected / max) * 100, 100) : 0;
  const addedPercent = projectedPercent - currentPercent;

  const isOverloaded = projected > max;
  const isNearCapacity = projectedPercent >= 80 && !isOverloaded;
  const { t } = useTranslation();
  const workloadAccent = isOverloaded
    ? 'text-red-600'
    : isNearCapacity
      ? 'text-amber-600'
      : 'text-emerald-600';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] leading-none">
        <span className="flex items-center gap-1 text-slate-500">
          <span>{t('assignments.workload.current', 'فعلی')}</span>
          <span className="font-medium tabular-nums text-slate-700">{current}</span>
          <span>/</span>
          <span className="tabular-nums">{max}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500">
            {t('assignments.workload.afterAssign', 'بعد از تخصیص')}
          </span>
          <span className={cn('font-medium tabular-nums', workloadAccent)}>{projected}</span>
          <span className={cn('tabular-nums', workloadAccent)}>+{periodsToAdd}</span>
        </span>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200">
        {/* Current workload */}
        <div
          className="absolute inset-y-0 start-0 bg-slate-400 rounded-full transition-all"
          style={{ width: `${currentPercent}%` }}
        />
        {/* Added workload (projected) */}
        <div
          className={cn(
            'absolute inset-y-0 rounded-full transition-all',
            isOverloaded ? 'bg-red-500' : isNearCapacity ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{
            insetInlineStart: `${currentPercent}%`,
            width: `${Math.max(0, addedPercent)}%`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Single teacher row with assign button
 */
function TeacherRow({
  teacher,
  periodsToAdd,
  onAssign,
  isAssigning,
  isDisabled,
  isCurrent,
  isFocused,
  onFocus,
}: {
  teacher: TeacherWithProjection;
  periodsToAdd: number;
  onAssign: () => void;
  isAssigning: boolean;
  isDisabled: boolean;
  isCurrent: boolean;
  isFocused: boolean;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);

  const assignLabel = teacher.requiresPrimaryAuthorization
    ? t('assignments.addAsPrimaryAndAssign', 'افزودن به مضامین اصلی و تخصیص')
    : t('common.assign', 'تخصیص');

  return (
    <div
      ref={rowRef}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white p-2.5 transition-all duration-200',
        '[content-visibility:auto] [contain-intrinsic-size:0_112px] hover:shadow-md',
        isCurrent &&
          'border-blue-300 bg-linear-to-br from-blue-50 via-white to-white shadow-sm shadow-blue-100/80',
        isFocused && !isCurrent && 'border-slate-300 bg-slate-50/80 ring-2 ring-blue-100 shadow-sm',
        !isCurrent && !isFocused && 'border-slate-200 hover:border-slate-300',
        teacher.willBeOverloaded && 'border-amber-200'
      )}
      onMouseEnter={onFocus}
      tabIndex={0}
      onFocus={onFocus}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-px',
          isCurrent ? 'bg-blue-300' : teacher.willBeOverloaded ? 'bg-amber-300' : 'bg-slate-100'
        )}
      />

      <div className="flex items-start gap-1.5">
        {/* Teacher info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm text-slate-800 truncate">
              {teacher.teacherName}
            </span>
            <CompatibilityBadge level={teacher.compatibility} />
            {/* {isCurrent && (
              <Badge
                variant="outline"
                className="h-4 border-blue-200 bg-blue-100 px-1.5 py-0 text-[9px] text-blue-700"
              >
                {t('assignments.current', 'فعلی')}
              </Badge>
            )} */}
            {/* Limited availability warning */}
            {teacher.hasLimitedAvailability && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 gap-0.5"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {teacher.unavailableCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {t(
                        'assignments.limitedAvailability',
                        '{{count}} ساعت غیرفعال - ممکن است برنامه‌ریزی مشکل شود',
                        {
                          count: teacher.unavailableCount,
                        }
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <p className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-slate-500">
            {teacher.reasonFa}
          </p>

          {/* Current assignments summary - show subjects with class counts */}
          {teacher.currentAssignments.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {teacher.currentAssignments.slice(0, 2).map((a) => (
                <Badge
                  key={a.subjectId}
                  variant="outline"
                  className="h-4 border-slate-200 bg-slate-50 px-1.5 py-0 text-[9px] text-slate-600"
                >
                  {a.subjectName}
                  <span className="ms-1 text-slate-400">({a.classCount})</span>
                </Badge>
              ))}
              {teacher.currentAssignments.length > 2 && (
                <span className="text-[9px] text-slate-400">
                  +{teacher.currentAssignments.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Workload bar with projection */}
          <div className="mt-2">
            <WorkloadBarWithProjection
              current={teacher.currentWorkload}
              projected={teacher.projectedWorkload}
              max={teacher.maxWorkload}
              periodsToAdd={periodsToAdd}
            />
          </div>
        </div>

        {/* Assign button */}
        <div className="shrink-0 self-center">
          {teacher.willBeOverloaded ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 rounded-lg border-amber-300 bg-amber-50 px-2.5 text-xs text-amber-800 shadow-sm hover:bg-amber-100"
                    onClick={onAssign}
                    disabled={isAssigning || isDisabled || teacher.willBeOverloaded}
                  >
                    {isAssigning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {assignLabel}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    {t('assignments.willExceedCapacity', 'ظرفیت بیش از حد مجاز می‌شود')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1 rounded-lg bg-[#003366] px-2.5 text-xs text-white shadow-sm hover:bg-[#002952]"
              onClick={onAssign}
              disabled={isAssigning || isDisabled || teacher.willBeOverloaded}
            >
              {isAssigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              {assignLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TeacherSelectionList({
  subjectId,
  periodsToAdd,
  authorizationSubjectIds,
  onAssign,
  assigningTeacherId = null,
  currentTeacherIds = [],
  className,
}: TeacherSelectionListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch teachers with smart compatibility
  const { teachers, isLoading, error } = useSmartTeacherSelection({
    subjectId,
    authorizationSubjectIds,
    includeOverloaded: true,
  });

  // Add projected workload to each teacher
  const teachersWithProjection: TeacherWithProjection[] = useMemo(() => {
    return teachers.map((teacher) => ({
      ...teacher,
      projectedWorkload: teacher.currentWorkload + periodsToAdd,
      projectedUtilization:
        teacher.maxWorkload > 0
          ? ((teacher.currentWorkload + periodsToAdd) / teacher.maxWorkload) * 100
          : 0,
      willBeOverloaded: teacher.currentWorkload + periodsToAdd > teacher.maxWorkload,
    }));
  }, [teachers, periodsToAdd]);

  // Filter by search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachersWithProjection;
    const query = searchQuery.toLowerCase();
    return teachersWithProjection.filter((t) => t.teacherName.toLowerCase().includes(query));
  }, [teachersWithProjection, searchQuery]);

  const currentTeacherIdSet = useMemo(() => new Set(currentTeacherIds), [currentTeacherIds]);

  const recommendedCount = useMemo(
    () => filteredTeachers.filter((teacher) => !teacher.requiresPrimaryAuthorization).length,
    [filteredTeachers]
  );

  const overloadedCount = useMemo(
    () => filteredTeachers.filter((teacher) => teacher.willBeOverloaded).length,
    [filteredTeachers]
  );

  const authorizationCount = useMemo(
    () => filteredTeachers.filter((teacher) => teacher.requiresPrimaryAuthorization).length,
    [filteredTeachers]
  );

  // The hook already ranks candidates by assignability, compatibility and
  // available capacity. Keep one continuous list so every teacher stays visible.
  const flatList = filteredTeachers;

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, button, a, select, textarea, [contenteditable="true"], [role="button"]'
        )
      )
        return;
      if (flatList.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (
            flatList[focusedIndex] &&
            !flatList[focusedIndex].willBeOverloaded &&
            assigningTeacherId === null
          ) {
            onAssign(flatList[focusedIndex].teacherId);
          }
          break;
      }
    },
    [assigningTeacherId, flatList, focusedIndex, onAssign]
  );

  // Reset focus when search changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <AlertTriangle className="w-8 h-8 mx-auto text-red-400 mb-2" />
        <p className="text-sm text-red-600">{t('common.error', 'خطا در بارگذاری')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)} onKeyDown={handleKeyDown}>
      <div className="mb-1 flex min-h-8 items-center gap-1.5 px-1">
        <p className="min-w-0 truncate text-xs font-semibold text-slate-700">
          {t('assignments.teacherSelection.title', 'انتخاب معلم')}
        </p>
        <Badge
          variant="secondary"
          className="h-5 shrink-0 rounded-full bg-slate-100 px-1.5 text-[9px] text-slate-500"
        >
          {filteredTeachers.length} {t('common.items', 'مورد')}
        </Badge>
        <div className="ms-auto flex shrink-0 items-center gap-1 text-[9px]">
          <Badge
            variant="secondary"
            className="h-5 rounded-full bg-emerald-50 px-1.5 text-[9px] text-emerald-700"
          >
            {recommendedCount} {t('assignments.teacherSelection.recommended', 'پیشنهادی')}
          </Badge>
          {overloadedCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 rounded-full bg-amber-50 px-1.5 text-[9px] text-amber-700"
            >
              {overloadedCount} {t('assignments.teacherSelection.overCapacity', 'بیش از ظرفیت')}
            </Badge>
          )}
          {authorizationCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 rounded-full bg-violet-50 px-1.5 text-[9px] text-violet-700"
            >
              {authorizationCount}{' '}
              {t('assignments.teacherSelection.needsPrimary', 'نیازمند ثبت اصلی')}
            </Badge>
          )}
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          aria-label={t('assignments.searchTeacher', 'جستجوی معلم')}
          placeholder={t('assignments.searchTeacher', 'جستجوی معلم...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 border-slate-200 bg-white ps-9 shadow-sm focus-visible:border-blue-300 focus-visible:ring-blue-200"
        />
        {searchQuery.trim() && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {filteredTeachers.length}
          </span>
        )}
      </div>

      {/* Teacher list */}
      <ScrollArea className="min-h-0 flex-1" ref={listRef}>
        <div className="space-y-1.5 pe-2 pb-2">
          {flatList.map((teacher, flatIndex) => {
            const isThisTeacherAssigning = assigningTeacherId === teacher.teacherId;
            const isAnyTeacherAssigning = assigningTeacherId !== null;
            return (
              <TeacherRow
                key={teacher.teacherId}
                teacher={teacher}
                periodsToAdd={periodsToAdd}
                onAssign={() => onAssign(teacher.teacherId)}
                isAssigning={isThisTeacherAssigning}
                isDisabled={isAnyTeacherAssigning && !isThisTeacherAssigning}
                isCurrent={currentTeacherIdSet.has(teacher.teacherId)}
                isFocused={flatIndex === focusedIndex}
                onFocus={() => setFocusedIndex(flatIndex)}
              />
            );
          })}

          {filteredTeachers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 py-12 text-center">
              <User className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-600">
                {searchQuery
                  ? t('assignments.noTeachersFound', 'معلمی یافت نشد')
                  : t('assignments.noTeachersAvailable', 'معلمی موجود نیست')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {searchQuery
                  ? t(
                      'assignments.teacherSelection.tryDifferentSearch',
                      'نام دیگری را جستجو کنید یا فیلترهای جاری را بازبینی کنید.'
                    )
                  : t(
                      'assignments.teacherSelection.noTeachersHint',
                      'برای این مضمون هنوز معلم سازگار یا فعال تعریف نشده است.'
                    )}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default TeacherSelectionList;
