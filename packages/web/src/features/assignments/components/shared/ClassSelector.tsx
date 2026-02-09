/**
 * ClassSelector Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Dropdown/multi-select for selecting classes with:
 * - Periods per week info
 * - Current assignment status
 * - Grade grouping
 * - Multi-select support for bulk operations
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassOption } from '../../hooks/useUnifiedAssignment';

export interface ClassSelectorProps {
  /** Currently selected class ID (single select mode) */
  value?: number | null;
  /** Currently selected class IDs (multi select mode) */
  values?: number[];
  /** Change handler for single select */
  onChange?: (classId: number | null) => void;
  /** Change handler for multi select */
  onChangeMultiple?: (classIds: number[]) => void;
  /** Available class options */
  classes: ClassOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Enable multi-select mode */
  multiSelect?: boolean;
  /** Show periods info */
  showPeriods?: boolean;
  /** Show current teacher assignment */
  showCurrentTeacher?: boolean;
  /** Filter to only unassigned classes */
  filterUnassigned?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Group classes by grade tier
 */
function groupClassesByGrade(classes: ClassOption[]) {
  const groups: Record<string, ClassOption[]> = {
    'Alpha-Primary': [],
    'Beta-Primary': [],
    Middle: [],
    High: [],
    Other: [],
  };

  for (const cls of classes) {
    if (cls.grade === null) {
      groups.Other.push(cls);
    } else if (cls.grade >= 1 && cls.grade <= 3) {
      groups['Alpha-Primary'].push(cls);
    } else if (cls.grade >= 4 && cls.grade <= 6) {
      groups['Beta-Primary'].push(cls);
    } else if (cls.grade >= 7 && cls.grade <= 9) {
      groups.Middle.push(cls);
    } else if (cls.grade >= 10 && cls.grade <= 12) {
      groups.High.push(cls);
    } else {
      groups.Other.push(cls);
    }
  }

  return groups;
}

const GRADE_LABELS: Record<string, { en: string; fa: string }> = {
  'Alpha-Primary': { en: 'Alpha-Primary (1-3)', fa: 'ابتدایی الف (۱-۳)' },
  'Beta-Primary': { en: 'Beta-Primary (4-6)', fa: 'ابتدایی ب (۴-۶)' },
  Middle: { en: 'Middle (7-9)', fa: 'متوسطه (۷-۹)' },
  High: { en: 'High (10-12)', fa: 'ثانوی (۱۰-۱۲)' },
  Other: { en: 'Other', fa: 'سایر' },
};

export function ClassSelector({
  value,
  values = [],
  onChange,
  onChangeMultiple,
  classes,
  placeholder,
  disabled = false,
  multiSelect = false,
  showPeriods = true,
  showCurrentTeacher = true,
  filterUnassigned = false,
  className,
}: ClassSelectorProps) {
  const { t, i18n } = useTranslation();
  const isFarsi = i18n.language === 'fa';

  // Filter and group classes
  const { groupedClasses, selectedClass, totalSelected } = useMemo(() => {
    let filtered = classes;
    if (filterUnassigned) {
      filtered = classes.filter((c) => !c.isAssigned || values.includes(c.id) || c.id === value);
    }

    const grouped = groupClassesByGrade(filtered);
    const selected = value ? classes.find((c) => c.id === value) : null;

    return {
      groupedClasses: grouped,
      selectedClass: selected,
      totalSelected: values.length,
    };
  }, [classes, filterUnassigned, value, values]);

  // Multi-select handlers
  const handleToggle = useCallback(
    (classId: number) => {
      if (!onChangeMultiple) return;
      if (values.includes(classId)) {
        onChangeMultiple(values.filter((id) => id !== classId));
      } else {
        onChangeMultiple([...values, classId]);
      }
    },
    [values, onChangeMultiple]
  );

  const handleSelectAll = useCallback(() => {
    if (!onChangeMultiple) return;
    const allIds = classes.filter((c) => !filterUnassigned || !c.isAssigned).map((c) => c.id);
    onChangeMultiple(allIds);
  }, [classes, filterUnassigned, onChangeMultiple]);

  const handleClearAll = useCallback(() => {
    if (!onChangeMultiple) return;
    onChangeMultiple([]);
  }, [onChangeMultiple]);

  // Single select mode
  if (!multiSelect) {
    return (
      <Select
        value={value?.toString() ?? 'none'}
        onValueChange={(val) => onChange?.(val === 'none' ? null : parseInt(val, 10))}
        disabled={disabled}
      >
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder={placeholder || t('assignments.selectClass', 'انتخاب صنف')}>
            {selectedClass && (
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-400" />
                <span className="truncate">{selectedClass.displayName}</span>
                {showPeriods && selectedClass.periodsPerWeek > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {selectedClass.periodsPerWeek} {t('common.period', 'ساعت')}
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-slate-500">{t('common.none', 'هیچکدام')}</span>
          </SelectItem>

          {Object.entries(groupedClasses).map(([group, groupClasses]) => {
            if (groupClasses.length === 0) return null;
            return (
              <SelectGroup key={group}>
                <SelectLabel className="text-xs text-slate-500">
                  {isFarsi ? GRADE_LABELS[group].fa : GRADE_LABELS[group].en}
                </SelectLabel>
                {groupClasses.map((cls) => (
                  <ClassOptionItem
                    key={cls.id}
                    classOption={cls}
                    showPeriods={showPeriods}
                    showCurrentTeacher={showCurrentTeacher}
                    isFarsi={isFarsi}
                  />
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  // Multi-select mode
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {t('assignments.selectClasses', 'انتخاب صنف‌ها')}
          {totalSelected > 0 && (
            <Badge variant="secondary" className="ms-2">
              {totalSelected}
            </Badge>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSelectAll}
            disabled={disabled}
          >
            {t('common.selectAll', 'انتخاب همه')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleClearAll}
            disabled={disabled || totalSelected === 0}
          >
            {t('common.clearAll', 'پاک کردن')}
          </Button>
        </div>
      </div>

      {/* Class list */}
      <div className="border rounded-lg max-h-64 overflow-y-auto">
        {Object.entries(groupedClasses).map(([group, groupClasses]) => {
          if (groupClasses.length === 0) return null;
          return (
            <div key={group}>
              <div className="sticky top-0 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 border-b">
                {isFarsi ? GRADE_LABELS[group].fa : GRADE_LABELS[group].en}
              </div>
              {groupClasses.map((cls) => (
                <label
                  key={cls.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    checked={values.includes(cls.id)}
                    onCheckedChange={() => handleToggle(cls.id)}
                    disabled={disabled}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{cls.displayName}</span>
                      {cls.isAssigned && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {showCurrentTeacher && cls.currentTeacherName && (
                      <span className="text-xs text-slate-500 truncate block">
                        {cls.currentTeacherName}
                      </span>
                    )}
                  </div>
                  {showPeriods && cls.periodsPerWeek > 0 && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {cls.periodsPerWeek}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          );
        })}

        {classes.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            {t('assignments.noClassesAvailable', 'صنفی موجود نیست')}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual class option for single select
 */
function ClassOptionItem({
  classOption,
  showPeriods,
  showCurrentTeacher,
  isFarsi,
}: {
  classOption: ClassOption;
  showPeriods: boolean;
  showCurrentTeacher: boolean;
  isFarsi: boolean;
}) {
  return (
    <SelectItem value={classOption.id.toString()} className="py-2">
      <div className="flex items-center justify-between w-full gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="truncate block">{classOption.displayName}</span>
            {showCurrentTeacher && classOption.currentTeacherName && (
              <span className="text-xs text-slate-500 truncate block">
                {classOption.currentTeacherName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {classOption.isAssigned && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          {showPeriods && classOption.periodsPerWeek > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {classOption.periodsPerWeek}
            </Badge>
          )}
        </div>
      </div>
    </SelectItem>
  );
}

export default ClassSelector;
