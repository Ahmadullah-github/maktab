/**
 * CategoryPeriodsMatrix Component
 *
 * Shows grade category × day matrix when enabled
 * Uses translated category names
 *
 * Requirements: 4.1, 4.2, 7.5, 10.2
 */

import { Input } from '@/components/ui/input';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { GRADE_CATEGORIES, PERIOD_LIMITS, type GradeCategoryKey } from '../constants/defaults';
import type { CategoryPeriodsMap } from '../types';

interface CategoryPeriodsMatrixProps {
  /** Whether category-based periods is enabled */
  enabled: boolean;
  /** Map of category to day-period mapping */
  categoryPeriodsMap: CategoryPeriodsMap;
  /** Callback when category periods map changes */
  onCategoryPeriodsMapChange: (map: CategoryPeriodsMap) => void;
  /** Active school days from school settings */
  activeDays: WeekDay[];
  /** Default periods per day (used as initial value) */
  defaultPeriods: number;
  /** Filtered categories based on enabled grade levels from school settings */
  filteredCategories?: ReadonlyArray<(typeof GRADE_CATEGORIES)[number]>;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Validation errors for specific category-day combinations */
  errors?: Partial<Record<GradeCategoryKey, Partial<Record<WeekDay, string>>>>;
}

/**
 * CategoryPeriodsMatrix - Grade category × day matrix
 *
 * Shows a matrix with 4 rows (grade categories) and N columns (active days)
 * Uses translated category names from i18n
 *
 * Requirements: 4.1, 4.2, 7.5, 10.2
 */
export function CategoryPeriodsMatrix({
  enabled,
  categoryPeriodsMap,
  onCategoryPeriodsMapChange,
  activeDays,
  defaultPeriods,
  filteredCategories = GRADE_CATEGORIES,
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

  // Don't render anything if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Help text */}
      <p className="text-sm text-muted-foreground">{t('periodStructure.help.categoryPeriods')}</p>

      {/* Category × Day matrix */}
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
            {filteredCategories.map((category) => {
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
    </div>
  );
}
