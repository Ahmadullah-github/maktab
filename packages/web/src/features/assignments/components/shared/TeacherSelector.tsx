/**
 * TeacherSelector Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Dropdown for selecting a teacher with:
 * - Workload preview (current/max periods)
 * - Compatibility badges (Primary/Allowed)
 * - Capacity indicators
 * - Filtering by subject compatibility
 */

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, User } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeacherOption } from '../../hooks/useUnifiedAssignment';
import { CompatibilityBadge } from './CompatibilityBadge';

export interface TeacherSelectorProps {
  /** Currently selected teacher ID */
  value: number | null;
  /** Change handler */
  onChange: (teacherId: number | null) => void;
  /** Available teacher options */
  teachers: TeacherOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Show workload info */
  showWorkload?: boolean;
  /** Show compatibility badges */
  showCompatibility?: boolean;
  /** Filter out teachers who can't accept assignments */
  filterByCapacity?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function TeacherSelector({
  value,
  onChange,
  teachers,
  placeholder,
  disabled = false,
  showWorkload = true,
  showCompatibility = true,
  filterByCapacity = false,
  className,
}: TeacherSelectorProps) {
  const { t } = useTranslation();

  // Filter and group teachers
  const { primaryTeachers, allowedTeachers, selectedTeacher } = useMemo(() => {
    let filtered = teachers;
    if (filterByCapacity) {
      filtered = teachers.filter((t) => t.canAcceptAssignment || t.id === value);
    }

    const primary = filtered.filter((t) => t.compatibility === 'primary');
    const allowed = filtered.filter((t) => t.compatibility === 'allowed');
    const selected = value ? teachers.find((t) => t.id === value) : null;

    return {
      primaryTeachers: primary,
      allowedTeachers: allowed,
      selectedTeacher: selected,
    };
  }, [teachers, filterByCapacity, value]);

  const handleChange = (val: string) => {
    if (val === 'none') {
      onChange(null);
    } else {
      onChange(parseInt(val, 10));
    }
  };

  return (
    <Select value={value?.toString() ?? 'none'} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder || t('assignments.selectTeacher', 'انتخاب معلم')}>
          {selectedTeacher && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="truncate">{selectedTeacher.name}</span>
              {showWorkload && (
                <span className="text-xs text-slate-500 tabular-nums">
                  ({selectedTeacher.currentWorkload}/{selectedTeacher.maxWorkload})
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* No selection option */}
        <SelectItem value="none">
          <span className="text-slate-500">{t('common.none', 'هیچکدام')}</span>
        </SelectItem>

        {/* Primary teachers */}
        {primaryTeachers.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-emerald-600">
              {t('assignments.primaryTeachers', 'معلمین اصلی')}
            </SelectLabel>
            {primaryTeachers.map((teacher) => (
              <TeacherOption
                key={teacher.id}
                teacher={teacher}
                showWorkload={showWorkload}
                showCompatibility={showCompatibility}
              />
            ))}
          </SelectGroup>
        )}

        {/* Allowed teachers */}
        {allowedTeachers.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-blue-600">
              {t('assignments.allowedTeachers', 'معلمین مجاز')}
            </SelectLabel>
            {allowedTeachers.map((teacher) => (
              <TeacherOption
                key={teacher.id}
                teacher={teacher}
                showWorkload={showWorkload}
                showCompatibility={showCompatibility}
              />
            ))}
          </SelectGroup>
        )}

        {/* Empty state */}
        {primaryTeachers.length === 0 && allowedTeachers.length === 0 && (
          <div className="py-4 text-center text-sm text-slate-500">
            {t('assignments.noCompatibleTeachers', 'معلم سازگاری یافت نشد')}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Individual teacher option in the dropdown
 */
function TeacherOption({
  teacher,
  showWorkload,
  showCompatibility,
}: {
  teacher: TeacherOption;
  showWorkload: boolean;
  showCompatibility: boolean;
}) {
  const utilizationPercentage =
    teacher.maxWorkload > 0 ? Math.round((teacher.currentWorkload / teacher.maxWorkload) * 100) : 0;

  const isOverloaded = teacher.currentWorkload >= teacher.maxWorkload;
  const isNearCapacity = teacher.availableCapacity <= 5 && !isOverloaded;

  return (
    <SelectItem
      value={teacher.id.toString()}
      disabled={!teacher.canAcceptAssignment}
      className="py-2"
    >
      <div className="flex items-center justify-between w-full gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{teacher.name}</span>
          {teacher.isCurrentlyAssigned && (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showCompatibility && (
            <CompatibilityBadge
              compatibility={teacher.compatibility}
              iconOnly
              showTooltip={false}
              size="sm"
            />
          )}

          {showWorkload && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'text-xs tabular-nums',
                  isOverloaded
                    ? 'text-red-600'
                    : isNearCapacity
                      ? 'text-amber-600'
                      : 'text-slate-500'
                )}
              >
                {teacher.currentWorkload}/{teacher.maxWorkload}
              </span>

              {/* Mini progress bar */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isOverloaded ? 'bg-red-500' : isNearCapacity ? 'bg-amber-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
                />
              </div>

              {isOverloaded && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            </div>
          )}
        </div>
      </div>
    </SelectItem>
  );
}

export default TeacherSelector;
