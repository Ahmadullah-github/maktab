/**
 * CategoryPeriodsMatrix Component
 *
 * Renders a toggle with tooltip for enabling category-based periods
 * Shows grade category × day matrix when enabled
 * Uses translated category names
 *
 * Requirements: 4.1, 4.2, 7.5, 10.2
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GRADE_CATEGORIES, PERIOD_LIMITS, type GradeCategoryKey } from '../constants/defaults';
import type { CategoryPeriodsMap } from '../types';

interface CategoryPeriodsMatrixProps {
  /** Whether category-based periods is enabled */
  enabled: boolean;
  /** Callback when enabled state changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Map of category to day-period mapping */
  categoryPeriodsMap: CategoryPeriodsMap;
  /** Callback when category periods map changes */
  onCategoryPeriodsMapChange: (map: CategoryPeriodsMap) => void;
  /** Active school days from school settings */
  activeDays: WeekDay[];
  /** Default periods per day (used as initial value) */
  defaultPeriods: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Validation errors for specific category-day combinations */
  errors?: Partial<Record<GradeCategoryKey, Partial<Record<WeekDay, string>>>>;
}

/**
 * CategoryPeriodsMatrix - Toggle and grade category × day matrix
 *
 * When enabled, shows a matrix with 4 rows (grade categories) and N columns (active days)
 * Uses translated category names from i18n
 *
 * Requirements: 4.1, 4.2, 7.5, 10.2
 */
export function CategoryPeriodsMatrix({
  enabled,
  onEnabledChange,
  categoryPeriodsMap,
  onCategoryPeriodsMapChange,
  activeDays,
  defaultPeriods,
  disabled = false,
  className,
  errors,
}: CategoryPeriodsMatrixProps) {
  const { t } = useTranslation();

  const handleCategoryDayChange = (category: GradeCategoryKey, day: WeekDay, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const currentCategoryMap = categoryPeriodsMap[category] || {};
      onCategoryPeriodsMapChange({
        ...categoryPeriodsMap,
        [category]: {
          ...currentCategoryMap,
          [day]: numValue,
        },
      });
    }
  };

  const getCategoryDayPeriods = (category: GradeCategoryKey, day: WeekDay): number => {
    return categoryPeriodsMap[category]?.[day] ?? defaultPeriods;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toggle with tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="category-periods-toggle" className="text-sm font-medium">
            {t('periodStructure.labels.categoryPeriods')}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{t('periodStructure.tooltips.categoryPeriods')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="category-periods-toggle"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-describedby="category-periods-description"
        />
      </div>

      {/* Help text when enabled */}
      {enabled && (
        <p id="category-periods-description" className="text-sm text-muted-foreground">
          {t('periodStructure.help.categoryPeriods')}
        </p>
      )}

      {/* Category × Day matrix when enabled */}
      {enabled && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-start text-sm font-medium border-b">
                  {t('periodStructure.labels.gradeCategory')}
                </th>
                {activeDays.map((day) => (
                  <th key={day} className="p-2 text-center text-sm font-medium border-b">
                    {t(`days.${day.toLowerCase()}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADE_CATEGORIES.map((category) => {
                const categoryErrors = errors?.[category.key];
                return (
                  <tr key={category.key} className="border-b last:border-b-0">
                    <td className="p-2 text-sm">
                      {t(`gradeCategories.${category.labelKey}`)}
                      <span className="text-xs text-muted-foreground ms-1">
                        ({category.grades.join('-')})
                      </span>
                    </td>
                    {activeDays.map((day) => {
                      const error = categoryErrors?.[day];
                      return (
                        <td key={`${category.key}-${day}`} className="p-2">
                          <div className="flex flex-col items-center gap-1">
                            <Input
                              type="number"
                              value={getCategoryDayPeriods(category.key, day)}
                              onChange={(e) =>
                                handleCategoryDayChange(category.key, day, e.target.value)
                              }
                              min={PERIOD_LIMITS.MIN}
                              max={PERIOD_LIMITS.MAX}
                              disabled={disabled}
                              className={cn('w-16 text-center', error && 'border-destructive')}
                              aria-label={`${t(`gradeCategories.${category.labelKey}`)} - ${t(`days.${day.toLowerCase()}`)}`}
                              aria-invalid={!!error}
                            />
                            {error && (
                              <span className="text-xs text-destructive text-center">{error}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
