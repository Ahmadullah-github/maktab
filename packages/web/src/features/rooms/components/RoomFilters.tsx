/**
 * RoomFilters Component
 *
 * Provides filtering controls for the rooms list including:
 * - Search input with debounce
 * - Room type dropdown filter
 * - Add Room button
 * - Display filtered count vs total count
 *
 * Requirements: 2.1, 2.2, 2.3, 4.1
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
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomTypeFilter } from '../types';
import { componentLogger } from '../utils/logger';

/**
 * Room type filter options
 */
const TYPE_FILTER_OPTIONS: { value: RoomTypeFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'rooms.filters.all' },
  { value: 'normal', labelKey: 'rooms.type.normal' },
  { value: 'computer_lab', labelKey: 'rooms.type.computer_lab' },
  { value: 'biology_lab', labelKey: 'rooms.type.biology_lab' },
  { value: 'chemistry_lab', labelKey: 'rooms.type.chemistry_lab' },
  { value: 'math_lab', labelKey: 'rooms.type.math_lab' },
  { value: 'physics_lab', labelKey: 'rooms.type.physics_lab' },
  { value: 'lab', labelKey: 'rooms.type.lab' },
  { value: 'library', labelKey: 'rooms.type.library' },
  { value: 'salon', labelKey: 'rooms.type.salon' },
  { value: 'gym', labelKey: 'rooms.type.gym' },
  { value: 'sport_camp', labelKey: 'rooms.type.sport_camp' },
  { value: 'other', labelKey: 'rooms.type.other' },
];

/**
 * Debounce delay for search input (ms)
 */
const SEARCH_DEBOUNCE_MS = 300;

export interface RoomFiltersProps {
  /** Current search term */
  search: string;
  /** Callback when search term changes */
  onSearchChange: (value: string) => void;
  /** Current type filter */
  typeFilter: RoomTypeFilter;
  /** Callback when type filter changes */
  onTypeFilterChange: (value: RoomTypeFilter) => void;
  /** Callback when add button is clicked */
  onAddClick: () => void;
  /** Total count of rooms (before filtering) */
  totalCount: number;
  /** Filtered count of rooms */
  filteredCount: number;
  /** Optional additional CSS classes */
  className?: string;
  /** Hide the add button (when shown in header) */
  hideAddButton?: boolean;
  /** Hide stats (when drawer is open) */
  hideStats?: boolean;
  /** Number of selected items for bulk actions */
  selectedCount?: number;
  /** Callback when deselect all is clicked */
  onDeselectAll?: () => void;
  /** Callback when bulk delete is clicked */
  onBulkDelete?: () => void;
  /** Callback when bulk edit is clicked (single selection) */
  onBulkEdit?: () => void;
}

/**
 * RoomFilters provides search and type filtering for the rooms list
 *
 * @example
 * ```tsx
 * <RoomFilters
 *   search={search}
 *   onSearchChange={setSearch}
 *   typeFilter={typeFilter}
 *   onTypeFilterChange={setTypeFilter}
 *   onAddClick={handleAddClick}
 *   totalCount={100}
 *   filteredCount={25}
 * />
 * ```
 *
 * Requirements: 2.1, 2.2, 2.3, 4.1
 */
export function RoomFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onAddClick,
  totalCount,
  filteredCount,
  className,
  hideAddButton = false,
  hideStats = false,
  selectedCount = 0,
  onDeselectAll,
  onBulkDelete,
  onBulkEdit,
}: RoomFiltersProps) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(search);

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('RoomFilters', { search, typeFilter });
    return () => componentLogger.unmount('RoomFilters');
  }, []);

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

  const handleTypeFilterChange = useCallback(
    (value: string) => {
      onTypeFilterChange(value as RoomTypeFilter);
    },
    [onTypeFilterChange]
  );

  const hasActiveFilters = typeFilter !== 'all' || search.length > 0;

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
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
          placeholder={t('rooms.filters.search')}
          value={localSearch}
          onChange={handleSearchChange}
          className="ps-9 h-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-400 transition-colors"
        />
      </div>

      {/* Type Filter Dropdown */}
      <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
        <SelectTrigger className="w-[180px] h-9 bg-slate-50 border-slate-200 focus:border-emerald-400">
          <SelectValue placeholder={t('rooms.filters.typePlaceholder')} />
        </SelectTrigger>
        <SelectContent align="end">
          {TYPE_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                {totalCount} <span className="text-slate-400">{t('rooms.unit', 'اتاق')}</span>
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

      {/* Add Room Button - conditionally hidden */}
      {!hideAddButton && (
        <Button onClick={onAddClick} className="gap-2 h-9">
          <Plus className="h-4 w-4" />
          {t('rooms.add')}
        </Button>
      )}
    </div>
  );
}

export default RoomFilters;
