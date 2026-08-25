/**
 * ClassFilters Component
 *
 * Provides filtering controls for the classes list including:
 * - Grade category tabs (All, Alpha-Primary, Beta-Primary, Middle, High)
 * - Search input field with debounce
 * - Status filter dropdown (All / Single-Teacher / Multi-Teacher)
 * - Bulk actions when items selected
 *
 * Requirements: 5.1, 1.2
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Pencil, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassStatusFilter, GradeCategory } from '../types';

/**
 * Grade category configuration with colors
 */
const GRADE_CATEGORIES: { key: GradeCategory; labelKey: string; color: string }[] = [
  {
    key: 'all',
    labelKey: 'classes.filters.all',
    color:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 data-[active=true]:bg-slate-700 data-[active=true]:text-white',
  },
  {
    key: 'alphaPrimary',
    labelKey: 'classes.filters.alphaPrimary',
    color:
      'bg-amber-50 text-amber-700 hover:bg-amber-100 data-[active=true]:bg-amber-500 data-[active=true]:text-white',
  },
  {
    key: 'betaPrimary',
    labelKey: 'classes.filters.betaPrimary',
    color:
      'bg-orange-50 text-orange-700 hover:bg-orange-100 data-[active=true]:bg-orange-500 data-[active=true]:text-white',
  },
  {
    key: 'middle',
    labelKey: 'classes.filters.middle',
    color:
      'bg-blue-50 text-blue-700 hover:bg-blue-100 data-[active=true]:bg-blue-500 data-[active=true]:text-white',
  },
  {
    key: 'high',
    labelKey: 'classes.filters.high',
    color:
      'bg-violet-50 text-violet-700 hover:bg-violet-100 data-[active=true]:bg-violet-500 data-[active=true]:text-white',
  },
];

/**
 * Status filter options for single/multi teacher mode
 */
const STATUS_FILTER_OPTIONS: { value: ClassStatusFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'classes.filters.statusAll' },
  { value: 'singleTeacher', labelKey: 'classes.filters.singleTeacher' },
  { value: 'multiTeacher', labelKey: 'classes.filters.multiTeacher' },
];

const SEARCH_DEBOUNCE_MS = 300;

export interface ClassFiltersProps {
  /** Current search term */
  search: string;
  /** Callback when search term changes */
  onSearchChange: (search: string) => void;
  /** Current grade category filter */
  gradeCategory: GradeCategory;
  /** Callback when grade category changes */
  onGradeCategoryChange: (category: GradeCategory) => void;
  /** Current status filter */
  statusFilter: ClassStatusFilter;
  /** Callback when status filter changes */
  onStatusFilterChange: (status: ClassStatusFilter) => void;
  /** Callback when add button is clicked (unused, kept for compatibility) */
  onAddClick?: () => void;
  /** Total count of classes (before filtering) */
  totalCount: number;
  /** Filtered count of classes */
  filteredCount: number;
  /** Optional additional CSS classes */
  className?: string;
  /** Hide the stats count (when drawer is open) */
  hideStats?: boolean;
  /** Number of selected items for bulk actions */
  selectedCount?: number;
  /** Callback to deselect all items */
  onDeselectAll?: () => void;
  /** Callback for bulk delete action */
  onBulkDelete?: () => void;
  /** Callback for bulk edit action (single item) */
  onBulkEdit?: () => void;
}

/**
 * ClassFilters provides search, grade category, and status filtering for the classes list
 */
export function ClassFilters({
  search,
  onSearchChange,
  gradeCategory,
  onGradeCategoryChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
  className,
  hideStats = false,
  selectedCount = 0,
  onDeselectAll,
  onBulkDelete,
  onBulkEdit,
}: ClassFiltersProps) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  // Sync local search with external search prop
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  }, []);

  const handleCategoryChange = useCallback(
    (category: GradeCategory) => {
      onGradeCategoryChange(category);
    },
    [onGradeCategoryChange]
  );

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      onStatusFilterChange(value as ClassStatusFilter);
    },
    [onStatusFilterChange]
  );

  const hasActiveFilters = gradeCategory !== 'all' || statusFilter !== 'all' || search.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Grade Category Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {GRADE_CATEGORIES.map(({ key, labelKey, color }) => (
          <button
            key={key}
            type="button"
            data-active={gradeCategory === key}
            onClick={() => handleCategoryChange(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
              'border border-transparent',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500',
              color
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Search, Status Filter, and Actions Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Bulk Actions - shown when items are selected */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 border-0 font-medium"
            >
              {selectedCount}
            </Badge>
            <span className="text-sm text-emerald-700 font-medium">
              {t('common.selected', 'انتخاب شده')}
            </span>

            <div className="h-4 w-px bg-emerald-200 mx-1" />

            <TooltipProvider delayDuration={300}>
              {/* Edit - only when single item selected */}
              {selectedCount === 1 && onBulkEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                      onClick={onBulkEdit}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{t('common.edit', 'ویرایش')}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={onBulkDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('common.delete', 'حذف')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Deselect All */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-slate-600 hover:bg-slate-100"
                    onClick={onDeselectAll}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('common.deselectAll', 'لغو انتخاب')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder={t('classes.filters.search')}
            value={localSearch}
            onChange={handleSearchChange}
            className="ps-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-400 transition-colors"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[150px] h-9 bg-slate-50 border-slate-200 focus:border-emerald-400">
              <SelectValue placeholder={t('classes.filters.statusAll')} />
            </SelectTrigger>
            <SelectContent align="end">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        {!hideStats && (
          <div className="flex items-center gap-2 text-sm text-slate-500 ms-auto">
            {hasActiveFilters && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-600 border-amber-200 text-xs"
              >
                {t('common.filtered', 'فیلتر شده')}
              </Badge>
            )}
            <span className="tabular-nums">
              {filteredCount === totalCount ? (
                <span>
                  {totalCount} <span className="text-slate-400">{t('classes.unit', 'صنف')}</span>
                </span>
              ) : (
                <span>
                  <span className="font-medium text-slate-700">{filteredCount}</span>
                  <span className="text-slate-400"> / {totalCount}</span>
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassFilters;
