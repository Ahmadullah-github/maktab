/**
 * SmartTeacherDropdown Component
 *
 * A rich teacher selection dropdown that shows ALL teachers with:
 * - Compatibility badges (اصلی/مجاز/عمومی/پیشنهادی/موجود)
 * - Workload info (current/max periods)
 * - Current assignments summary
 * - Smart grouping by compatibility level
 *
 * Replaces the old dropdown that only showed "compatible" teachers.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, BookOpen, Check, ChevronDown, Loader2, User } from 'lucide-react';
import { useCallback, useState } from 'react';
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

export interface SmartTeacherDropdownProps {
  /** Subject ID to find teachers for */
  subjectId: number;
  /** Currently selected teacher ID */
  value: number | null;
  /** Callback when teacher is selected */
  onChange: (teacherId: number | null) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Compatibility badge component
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
 * Workload bar component
 */
function WorkloadBar({
  current,
  max,
  compact = false,
}: {
  current: number;
  max: number;
  compact?: boolean;
}) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isOverloaded = current >= max;
  const isNearCapacity = percentage >= 80;

  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'w-16' : 'w-24')}>
      <Progress
        value={percentage}
        className={cn(
          'h-1.5 flex-1',
          isOverloaded && '[&>div]:bg-red-500',
          isNearCapacity && !isOverloaded && '[&>div]:bg-amber-500'
        )}
      />
      <span
        className={cn(
          'text-[10px] tabular-nums shrink-0',
          isOverloaded ? 'text-red-600' : isNearCapacity ? 'text-amber-600' : 'text-slate-500'
        )}
      >
        {current}/{max}
      </span>
    </div>
  );
}

/**
 * Teacher row in the dropdown
 */
function TeacherRow({
  teacher,
  isSelected,
  onSelect,
}: {
  teacher: SmartTeacherCompatibility;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <CommandItem
      value={`${teacher.teacherId}-${teacher.teacherName}`}
      onSelect={onSelect}
      disabled={!teacher.canAcceptAssignment}
      className={cn(
        'flex items-center gap-2 px-2 py-2 cursor-pointer',
        !teacher.canAcceptAssignment && 'opacity-50'
      )}
    >
      {/* Selection indicator */}
      <div className="w-4 shrink-0">
        {isSelected && <Check className="h-4 w-4 text-violet-600" />}
      </div>

      {/* Teacher icon */}
      <div
        className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          isSelected ? 'bg-violet-100' : 'bg-slate-100'
        )}
      >
        <User className={cn('w-3.5 h-3.5', isSelected ? 'text-violet-600' : 'text-slate-500')} />
      </div>

      {/* Teacher info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{teacher.teacherName}</span>
          <CompatibilityBadge level={teacher.compatibility} />
        </div>

        {/* Assignments summary */}
        {teacher.currentAssignments.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <BookOpen className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-500 truncate">
              {teacher.currentAssignments
                .slice(0, 2)
                .map((a) => a.subjectName)
                .join('، ')}
              {teacher.currentAssignments.length > 2 &&
                ` +${teacher.currentAssignments.length - 2}`}
            </span>
          </div>
        )}

        {/* Reason for compatibility */}
        {teacher.compatibility === 'inferred' && teacher.relatedSubjectsTaught.length > 0 && (
          <div className="text-[10px] text-amber-600 mt-0.5">{teacher.reasonFa}</div>
        )}
      </div>

      {/* Workload */}
      <div className="shrink-0 flex items-center gap-2">
        <WorkloadBar current={teacher.currentWorkload} max={teacher.maxWorkload} compact />
        {!teacher.canAcceptAssignment && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t('assignments.teacherOverloaded', 'ظرفیت پر است')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </CommandItem>
  );
}

/**
 * Group header in the dropdown
 */
function GroupHeader({ level, count }: { level: SmartCompatibilityLevel; count: number }) {
  const info = getCompatibilityBadgeInfo(level);
  return (
    <div className="flex items-center justify-between px-2 py-1.5">
      <span className={cn('text-xs font-medium', info.color)}>{info.labelFa}</span>
      <span className="text-[10px] text-slate-400">{count}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SmartTeacherDropdown({
  subjectId,
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
}: SmartTeacherDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { teachers, grouped, isLoading } = useSmartTeacherSelection({
    subjectId,
    includeOverloaded: true,
  });

  // Find selected teacher
  const selectedTeacher = teachers.find((t) => t.teacherId === value);

  // Handle selection
  const handleSelect = useCallback(
    (teacherId: number) => {
      onChange(teacherId === value ? null : teacherId);
      setOpen(false);
    },
    [onChange, value]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    onChange(null);
    setOpen(false);
  }, [onChange]);

  const defaultPlaceholder = t('classes.form.selectTeacher', 'انتخاب معلم...');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('w-full justify-between font-normal', className)}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading', 'در حال بارگذاری...')}
            </span>
          ) : selectedTeacher ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="truncate">{selectedTeacher.teacherName}</span>
              <CompatibilityBadge level={selectedTeacher.compatibility} />
            </span>
          ) : (
            <span className="text-slate-500">{placeholder || defaultPlaceholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('assignments.searchTeacher', 'جستجوی معلم...')} />

          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="py-6 text-center">
                <User className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">
                  {t('assignments.noTeachersFound', 'معلمی یافت نشد')}
                </p>
              </div>
            </CommandEmpty>

            {/* None option */}
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={handleClear}
                className="flex items-center gap-2 px-2 py-2"
              >
                <div className="w-4 shrink-0">
                  {!value && <Check className="h-4 w-4 text-violet-600" />}
                </div>
                <span className="text-slate-500">{t('common.none', 'هیچکدام')}</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* Primary teachers */}
            {grouped.primary.length > 0 && (
              <CommandGroup
                heading={<GroupHeader level="primary" count={grouped.primary.length} />}
              >
                {grouped.primary.map((teacher) => (
                  <TeacherRow
                    key={teacher.teacherId}
                    teacher={teacher}
                    isSelected={value === teacher.teacherId}
                    onSelect={() => handleSelect(teacher.teacherId)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Allowed teachers */}
            {grouped.allowed.length > 0 && (
              <CommandGroup
                heading={<GroupHeader level="allowed" count={grouped.allowed.length} />}
              >
                {grouped.allowed.map((teacher) => (
                  <TeacherRow
                    key={teacher.teacherId}
                    teacher={teacher}
                    isSelected={value === teacher.teacherId}
                    onSelect={() => handleSelect(teacher.teacherId)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Generalist teachers */}
            {grouped.generalist.length > 0 && (
              <CommandGroup
                heading={<GroupHeader level="generalist" count={grouped.generalist.length} />}
              >
                {grouped.generalist.map((teacher) => (
                  <TeacherRow
                    key={teacher.teacherId}
                    teacher={teacher}
                    isSelected={value === teacher.teacherId}
                    onSelect={() => handleSelect(teacher.teacherId)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Inferred teachers */}
            {grouped.inferred.length > 0 && (
              <CommandGroup
                heading={<GroupHeader level="inferred" count={grouped.inferred.length} />}
              >
                {grouped.inferred.map((teacher) => (
                  <TeacherRow
                    key={teacher.teacherId}
                    teacher={teacher}
                    isSelected={value === teacher.teacherId}
                    onSelect={() => handleSelect(teacher.teacherId)}
                  />
                ))}
              </CommandGroup>
            )}

            {/* Available teachers */}
            {grouped.available.length > 0 && (
              <CommandGroup
                heading={<GroupHeader level="available" count={grouped.available.length} />}
              >
                {grouped.available.map((teacher) => (
                  <TeacherRow
                    key={teacher.teacherId}
                    teacher={teacher}
                    isSelected={value === teacher.teacherId}
                    onSelect={() => handleSelect(teacher.teacherId)}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default SmartTeacherDropdown;
