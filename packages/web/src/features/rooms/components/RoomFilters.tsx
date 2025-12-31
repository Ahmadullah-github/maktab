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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomTypeFilter } from '../types';
import { componentLogger } from '../utils/logger';

/**
 * Room type filter options
 */
const TYPE_FILTER_OPTIONS: { value: RoomTypeFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'rooms.filters.all' },
  { value: 'classroom', labelKey: 'rooms.type.classroom' },
  { value: 'lab', labelKey: 'rooms.type.lab' },
  { value: 'gym', labelKey: 'rooms.type.gym' },
  { value: 'library', labelKey: 'rooms.type.library' },
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

  return (
    <div className={cn('flex items-center gap-4 flex-wrap', className)}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('rooms.filters.search')}
          value={localSearch}
          onChange={handleSearchChange}
          className="ps-9"
        />
      </div>

      {/* Type Filter Dropdown */}
      <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('rooms.filters.typePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {TYPE_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Results Count */}
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {filteredCount === totalCount
          ? t('rooms.resultsCount', { count: totalCount })
          : t('rooms.filteredResultsCount', {
              filtered: filteredCount,
              total: totalCount,
            })}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add Room Button */}
      <Button onClick={onAddClick} className="gap-2">
        <Plus className="h-4 w-4" />
        {t('rooms.add')}
      </Button>
    </div>
  );
}

export default RoomFilters;
