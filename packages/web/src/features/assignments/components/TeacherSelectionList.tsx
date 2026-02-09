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
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  User,
  UserPlus,
} from 'lucide-react';
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
  /** Callback when teacher is assigned */
  onAssign: (teacherId: number) => void;
  /** ID of teacher currently being assigned (for loading state) */
  assigningTeacherId?: number | null;
  /** Currently assigned teacher ID (to highlight) */
  currentTeacherId?: number | null;
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
// Constants
// ============================================================================

const GROUP_ORDER: SmartCompatibilityLevel[] = [
  'primary',
  'allowed',
  'generalist',
  'inferred',
  'available',
];

const GROUP_LABELS: Record<SmartCompatibilityLevel, { fa: string; icon: string }> = {
  primary: { fa: 'پیشنهادی', icon: '🌟' },
  allowed: { fa: 'مجاز', icon: '✓' },
  generalist: { fa: 'عمومی', icon: '👤' },
  inferred: { fa: 'مرتبط', icon: '🔗' },
  available: { fa: 'در دسترس', icon: '📋' },
};

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

  return (
    <div className="space-y-1">
      {/* Progress bar with two segments */}
      <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
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

      {/* Labels */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">
          {current} →{' '}
          <span
            className={cn(
              'font-medium',
              isOverloaded ? 'text-red-600' : isNearCapacity ? 'text-amber-600' : 'text-emerald-600'
            )}
          >
            {projected}
          </span>
          /{max}
        </span>
        <span
          className={cn(
            'font-medium',
            isOverloaded ? 'text-red-600' : isNearCapacity ? 'text-amber-600' : 'text-emerald-600'
          )}
        >
          +{periodsToAdd}
        </span>
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

  return (
    <div
      ref={rowRef}
      className={cn(
        'p-3 rounded-lg border-2 transition-all',
        isCurrent && 'bg-violet-50 border-violet-300',
        isFocused && !isCurrent && 'bg-slate-50 border-slate-300 ring-2 ring-violet-200',
        !isCurrent && !isFocused && 'bg-white border-slate-200 hover:border-slate-300',
        teacher.willBeOverloaded && 'border-amber-200'
      )}
      onMouseEnter={onFocus}
      tabIndex={0}
      onFocus={onFocus}
    >
      <div className="flex items-start gap-3">
        {/* Teacher avatar */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            isCurrent ? 'bg-violet-200' : 'bg-slate-100'
          )}
        >
          <User className={cn('w-5 h-5', isCurrent ? 'text-violet-700' : 'text-slate-500')} />
        </div>

        {/* Teacher info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-slate-800 truncate">
              {teacher.teacherName}
            </span>
            <CompatibilityBadge level={teacher.compatibility} />
            {isCurrent && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                {t('assignments.current', 'فعلی')}
              </Badge>
            )}
            {/* Limited availability warning */}
            {teacher.hasLimitedAvailability && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 gap-0.5"
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

          {/* Current assignments summary - show subjects with class counts */}
          {teacher.currentAssignments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              {teacher.currentAssignments.slice(0, 3).map((a) => (
                <Badge
                  key={a.subjectId}
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 bg-slate-50 text-slate-600 border-slate-200"
                >
                  {a.subjectName}
                  <span className="ms-1 text-slate-400">({a.classCount})</span>
                </Badge>
              ))}
              {teacher.currentAssignments.length > 3 && (
                <span className="text-[9px] text-slate-400">
                  +{teacher.currentAssignments.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Workload bar with projection */}
          <WorkloadBarWithProjection
            current={teacher.currentWorkload}
            projected={teacher.projectedWorkload}
            max={teacher.maxWorkload}
            periodsToAdd={periodsToAdd}
          />
        </div>

        {/* Assign button */}
        <div className="shrink-0">
          {teacher.willBeOverloaded ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={onAssign}
                    disabled={isAssigning || isDisabled}
                  >
                    {isAssigning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {t('common.assign', 'تخصیص')}
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
              className="h-8 px-3 gap-1.5 bg-violet-600 hover:bg-violet-700"
              onClick={onAssign}
              disabled={isAssigning || isDisabled}
            >
              {isAssigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              {t('common.assign', 'تخصیص')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible group header
 */
function GroupHeader({
  level,
  count,
  isExpanded,
  onToggle,
}: {
  level: SmartCompatibilityLevel;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const info = GROUP_LABELS[level];
  const badgeInfo = getCompatibilityBadgeInfo(level);

  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors"
      onClick={onToggle}
    >
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-slate-400" />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-400" />
      )}
      <span className="text-sm">{info.icon}</span>
      <span className={cn('text-sm font-medium', badgeInfo.color)}>{info.fa}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ms-auto">
        {count}
      </Badge>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TeacherSelectionList({
  subjectId,
  periodsToAdd,
  onAssign,
  assigningTeacherId = null,
  currentTeacherId = null,
  className,
}: TeacherSelectionListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<SmartCompatibilityLevel>>(
    new Set(['primary', 'allowed', 'generalist'])
  );
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch teachers with smart compatibility
  const { teachers, isLoading, error } = useSmartTeacherSelection({
    subjectId,
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

  // Group filtered teachers
  const filteredGrouped = useMemo(() => {
    const result: Record<SmartCompatibilityLevel, TeacherWithProjection[]> = {
      primary: [],
      allowed: [],
      generalist: [],
      inferred: [],
      available: [],
    };

    for (const teacher of filteredTeachers) {
      result[teacher.compatibility].push(teacher);
    }

    return result;
  }, [filteredTeachers]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: TeacherWithProjection[] = [];
    for (const level of GROUP_ORDER) {
      if (expandedGroups.has(level)) {
        result.push(...filteredGrouped[level]);
      }
    }
    return result;
  }, [filteredGrouped, expandedGroups]);

  // Toggle group expansion
  const toggleGroup = useCallback((level: SmartCompatibilityLevel) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
          if (flatList[focusedIndex]) {
            onAssign(flatList[focusedIndex].teacherId);
          }
          break;
      }
    },
    [flatList, focusedIndex, onAssign]
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
    <div className={cn('flex flex-col', className)} onKeyDown={handleKeyDown}>
      {/* Search input */}
      <div className="relative mb-3">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder={t('assignments.searchTeacher', 'جستجوی معلم...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-9 h-9"
        />
      </div>

      {/* Teacher list */}
      <ScrollArea className="flex-1" ref={listRef}>
        <div className="space-y-2 pe-2">
          {GROUP_ORDER.map((level) => {
            const groupTeachers = filteredGrouped[level];
            if (groupTeachers.length === 0) return null;

            const isExpanded = expandedGroups.has(level);

            return (
              <div key={level}>
                <GroupHeader
                  level={level}
                  count={groupTeachers.length}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(level)}
                />

                {isExpanded && (
                  <div className="space-y-2 mt-2">
                    {groupTeachers.map((teacher) => {
                      const flatIndex = flatList.findIndex(
                        (t) => t.teacherId === teacher.teacherId
                      );
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
                          isCurrent={teacher.teacherId === currentTeacherId}
                          isFocused={flatIndex === focusedIndex}
                          onFocus={() => setFocusedIndex(flatIndex)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTeachers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? t('assignments.noTeachersFound', 'معلمی یافت نشد')
                  : t('assignments.noTeachersAvailable', 'معلمی موجود نیست')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default TeacherSelectionList;
