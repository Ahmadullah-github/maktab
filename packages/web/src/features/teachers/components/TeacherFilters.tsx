/**
 * TeacherFilters Component
 *
 * Provides filtering controls for the teachers list including:
 * - Search input with debounce
 * - Status filter buttons (all, full-time, part-time)
 * - Display filtered/total count
 *
 * Requirements: 1.2, 1.3
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeacherStatusFilter } from '../types';
import { componentLogger } from '../utils/logger';

/**
 * Status filter button configuration
 */
const STATUS_FILTERS: { key: TeacherStatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'teachers.filterAll' },
  { key: 'fullTime', labelKey: 'teachers.filterFullTime' },
  { key: 'partTime', labelKey: 'teachers.filterPartTime' },
];

/**
 * Default debounce delay in milliseconds
 */
const DEBOUNCE_DELAY = 300;

export interface TeacherFiltersProps {
  /** Current search term */
  search: string;
  /** Current status filter */
  statusFilter: TeacherStatusFilter;
  /** Callback when search term changes (debounced) */
  onSearchChange: (value: string) => void;
  /** Callback when status filter changes */
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  /** Total count of teachers (before filtering) */
  totalCount: number;
  /** Filtered count of teachers */
  filteredCount: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * TeacherFilters provides search and status filtering for the teachers list
 *
 * @example
 * ```tsx
 * <TeacherFilters
 *   search={search}
 *   statusFilter={statusFilter}
 *   onSearchChange={setSearch}
 *   onStatusFilterChange={setStatusFilter}
 *   totalCount={teachers.length}
 *   filteredCount={filteredTeachers.length}
 * />
 * ```
 */
export function TeacherFilters({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  totalCount,
  filteredCount,
  className,
}: TeacherFiltersProps) {
  const { t } = useTranslation();

  // Local state for immediate input feedback
  const [localSearch, setLocalSearch] = useState(search);

  // Sync local state when external search changes
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('TeacherFilters', { search, statusFilter });
    return () => componentLogger.unmount('TeacherFilters');
  }, []);

  // Debounced search handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
        componentLogger.interaction('TeacherFilters', 'search', { term: localSearch });
      }
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  }, []);

  const handleStatusChange = useCallback(
    (status: TeacherStatusFilter) => {
      onStatusFilterChange(status);
      componentLogger.interaction('TeacherFilters', 'statusFilter', { status });
    },
    [onStatusFilterChange]
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Status Filter Buttons */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map(({ key, labelKey }) => (
          <Button
            key={key}
            variant={statusFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(key)}
            className="whitespace-nowrap"
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {/* Search and Count Row */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('teachers.searchPlaceholder')}
            value={localSearch}
            onChange={handleSearchChange}
            className="ps-9"
          />
        </div>

        {/* Results Count */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredCount === totalCount
            ? t('teachers.activeCount', { count: totalCount })
            : `${filteredCount} ${t('common.of')} ${totalCount}`}
        </span>
      </div>
    </div>
  );
}

export default TeacherFilters;
