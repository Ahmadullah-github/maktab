/**
 * SubjectFilters Component
 *
 * Provides filtering controls for the subjects list including:
 * - Section filter tabs (همه/ابتدایی/متوسطه/لیسه)
 * - Search input field with debounce
 * - Add new subject button
 * - Insert curriculum dropdown button
 *
 * Requirements: 2.1, 2.2, 2.4, 4.1, 9.1
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectionFilter } from '../types';
import { componentLogger } from '../utils/logger';

/**
 * Section filter tab configuration
 */
const SECTION_FILTERS: { key: SectionFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'subjects.filters.all' },
  { key: 'PRIMARY', labelKey: 'subjects.filters.primary' },
  { key: 'MIDDLE', labelKey: 'subjects.filters.middle' },
  { key: 'HIGH', labelKey: 'subjects.filters.high' },
];

export interface SubjectFiltersProps {
  /** Current search term */
  search: string;
  /** Callback when search term changes */
  onSearchChange: (value: string) => void;
  /** Current section filter */
  section: SectionFilter;
  /** Callback when section filter changes */
  onSectionChange: (value: SectionFilter) => void;
  /** Callback when add button is clicked */
  onAddClick: () => void;
  /** Callback when insert curriculum is clicked */
  onInsertCurriculumClick: () => void;
  /** Callback when clear grade subjects is clicked */
  onClearGradeClick: () => void;
  /** Total count of subjects (before filtering) */
  totalCount: number;
  /** Filtered count of subjects */
  filteredCount: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Debounce delay for search input (ms)
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * SubjectFilters provides search and section filtering for the subjects list
 *
 * @example
 * ```tsx
 * <SubjectFilters
 *   search={search}
 *   onSearchChange={setSearch}
 *   section={section}
 *   onSectionChange={setSection}
 *   onAddClick={handleAddClick}
 *   onInsertCurriculumClick={handleInsertCurriculum}
 *   onClearGradeClick={handleClearGrade}
 *   totalCount={100}
 *   filteredCount={25}
 * />
 * ```
 */
export function SubjectFilters({
  search,
  onSearchChange,
  section,
  onSectionChange,
  onAddClick,
  onInsertCurriculumClick,
  onClearGradeClick,
  totalCount,
  filteredCount,
  className,
}: SubjectFiltersProps) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(search);

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectFilters', { search, section });
    return () => componentLogger.unmount('SubjectFilters');
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

  const handleSectionChange = useCallback(
    (value: string) => {
      onSectionChange(value as SectionFilter);
    },
    [onSectionChange]
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Section Filter Tabs */}
      <Tabs value={section} onValueChange={handleSectionChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {SECTION_FILTERS.map(({ key, labelKey }) => (
            <TabsTrigger key={key} value={key} className="whitespace-nowrap">
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search, Count, and Actions Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('subjects.filters.search')}
            value={localSearch}
            onChange={handleSearchChange}
            className="ps-9"
          />
        </div>

        {/* Results Count */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredCount === totalCount
            ? t('subjects.resultsCount', { count: totalCount })
            : t('subjects.filteredResultsCount', {
                filtered: filteredCount,
                total: totalCount,
              })}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Curriculum Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <BookOpen className="h-4 w-4" />
              {t('subjects.curriculum.button')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onInsertCurriculumClick}>
              <Plus className="h-4 w-4 me-2" />
              {t('subjects.curriculum.insert')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onClearGradeClick}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 me-2" />
              {t('subjects.curriculum.clear')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add Subject Button */}
        <Button onClick={onAddClick} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('subjects.add')}
        </Button>
      </div>
    </div>
  );
}

export default SubjectFilters;
