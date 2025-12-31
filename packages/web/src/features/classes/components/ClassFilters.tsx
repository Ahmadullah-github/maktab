/**
 * ClassFilters Component
 *
 * Provides filtering controls for the classes list including:
 * - Grade category tabs (All, Alpha-Primary, Beta-Primary, Middle, High)
 * - Search input field
 *
 * Requirements: 5.1, 1.2
 */

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GradeCategory } from '../types';
import { componentLogger } from '../utils/logger';

/**
 * Grade category tab configuration
 */
const GRADE_CATEGORIES: { key: GradeCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'classes.filters.all' },
  { key: 'alphaPrimary', labelKey: 'classes.filters.alphaPrimary' },
  { key: 'betaPrimary', labelKey: 'classes.filters.betaPrimary' },
  { key: 'middle', labelKey: 'classes.filters.middle' },
  { key: 'high', labelKey: 'classes.filters.high' },
];

export interface ClassFiltersProps {
  /** Current search term */
  search: string;
  /** Callback when search term changes */
  onSearchChange: (search: string) => void;
  /** Current grade category filter */
  gradeCategory: GradeCategory;
  /** Callback when grade category changes */
  onGradeCategoryChange: (category: GradeCategory) => void;
  /** Total count of classes (before filtering) */
  totalCount?: number;
  /** Filtered count of classes */
  filteredCount?: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * ClassFilters provides search and grade category filtering for the classes list
 *
 * @example
 * ```tsx
 * <ClassFilters
 *   search={search}
 *   onSearchChange={setSearch}
 *   gradeCategory={gradeCategory}
 *   onGradeCategoryChange={setGradeCategory}
 * />
 * ```
 */
export function ClassFilters({
  search,
  onSearchChange,
  gradeCategory,
  onGradeCategoryChange,
  totalCount,
  filteredCount,
  className,
}: ClassFiltersProps) {
  const { t } = useTranslation();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('ClassFilters', { search, gradeCategory });
    return () => componentLogger.unmount('ClassFilters');
  }, [search, gradeCategory]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const handleCategoryChange = (value: string) => {
    onGradeCategoryChange(value as GradeCategory);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Grade Category Tabs */}
      <Tabs value={gradeCategory} onValueChange={handleCategoryChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {GRADE_CATEGORIES.map(({ key, labelKey }) => (
            <TabsTrigger key={key} value={key} className="whitespace-nowrap">
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search and Count Row */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('classes.filters.search')}
            value={search}
            onChange={handleSearchChange}
            className="ps-9"
          />
        </div>

        {/* Results Count */}
        {totalCount !== undefined && filteredCount !== undefined && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredCount === totalCount
              ? t('classes.resultsCount', { count: totalCount, defaultValue: `${totalCount} صنف` })
              : t('classes.filteredResultsCount', {
                  filtered: filteredCount,
                  total: totalCount,
                  defaultValue: `${filteredCount} از ${totalCount}`,
                })}
          </span>
        )}
      </div>
    </div>
  );
}

export default ClassFilters;
