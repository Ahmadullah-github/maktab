/**
 * AssignmentsFilters Component
 *
 * Filter bar for the assignments page with:
 * - Search input
 * - Grade category filter
 * - Assignment status filter
 * - Expand/collapse all controls
 * - Bulk selection indicator
 * - Clear selection button
 *
 * Requirements: Phase 3.1, Phase 4.1
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckSquare, ChevronDown, ChevronUp, RotateCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssignmentGradeCategory, AssignmentStatusFilter } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentsFiltersProps {
  /** Current search query */
  search: string;
  /** Search change handler */
  onSearchChange: (search: string) => void;
  /** Current grade category filter */
  gradeCategory: AssignmentGradeCategory | null;
  /** Grade category change handler */
  onGradeCategoryChange: (category: AssignmentGradeCategory | null) => void;
  /** Current status filter */
  statusFilter: AssignmentStatusFilter;
  /** Status filter change handler */
  onStatusFilterChange: (status: AssignmentStatusFilter) => void;
  /** Reset all filters */
  onResetFilters: () => void;
  /** Total classes count */
  totalClasses: number;
  /** Filtered classes count */
  filteredClasses: number;
  /** Number of expanded groups */
  expandedCount: number;
  /** Total number of groups */
  totalGroups: number;
  /** Expand all groups */
  onExpandAll: () => void;
  /** Collapse all groups */
  onCollapseAll: () => void;
  /** Number of selected cells (for bulk operations) */
  selectedCount?: number;
  /** Clear selection handler */
  onClearSelection?: () => void;
  /** Enter bulk selection mode */
  onEnterBulkMode?: () => void;
  /** Whether bulk mode is active */
  isBulkMode?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const GRADE_CATEGORIES: { value: AssignmentGradeCategory; label: string; labelFa: string }[] = [
  { value: 'Alpha-Primary', label: 'Alpha-Primary (1-3)', labelFa: 'ابتدایی الف (۱-۳)' },
  { value: 'Beta-Primary', label: 'Beta-Primary (4-6)', labelFa: 'ابتدایی ب (۴-۶)' },
  { value: 'Middle', label: 'Middle (7-9)', labelFa: 'متوسطه (۷-۹)' },
  { value: 'High', label: 'High (10-12)', labelFa: 'لیسه (۱۰-۱۲)' },
];

const STATUS_FILTERS: { value: AssignmentStatusFilter; label: string; labelFa: string }[] = [
  { value: 'all', label: 'All', labelFa: 'همه' },
  { value: 'unassigned', label: 'Unassigned', labelFa: 'تخصیص نشده' },
  { value: 'assigned', label: 'Assigned', labelFa: 'تخصیص شده' },
  { value: 'partial', label: 'Partial', labelFa: 'نیمه‌کاره' },
  { value: 'conflict', label: 'Conflict', labelFa: 'تعارض' },
];

// ============================================================================
// Component
// ============================================================================

export function AssignmentsFilters({
  search,
  onSearchChange,
  gradeCategory,
  onGradeCategoryChange,
  statusFilter,
  onStatusFilterChange,
  onResetFilters,
  totalClasses,
  filteredClasses,
  expandedCount,
  totalGroups,
  onExpandAll,
  onCollapseAll,
  selectedCount = 0,
  onClearSelection,
  onEnterBulkMode: _onEnterBulkMode,
  isBulkMode = false,
}: AssignmentsFiltersProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  const hasActiveFilters = search || gradeCategory || statusFilter !== 'all';
  const hasSelection = selectedCount > 0;

  return (
    <div className="space-y-3">
      {/* Main Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search
            className={cn(
              'absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground',
              isRTL ? 'right-3' : 'left-3'
            )}
          />
          <Input
            placeholder={t('assignments.filters.searchPlaceholder', 'جستجوی صنف...')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn('h-9', isRTL ? 'pr-9' : 'pl-9')}
          />
        </div>

        {/* Grade Category Filter */}
        <Select
          value={gradeCategory ?? 'all'}
          onValueChange={(value: string) =>
            onGradeCategoryChange(value === 'all' ? null : (value as AssignmentGradeCategory))
          }
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder={t('assignments.filters.gradeCategory', 'دسته‌بندی')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('assignments.filters.allGrades', 'همه صنف‌ها')}</SelectItem>
            {GRADE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {isRTL ? cat.labelFa : cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(value: string) => onStatusFilterChange(value as AssignmentStatusFilter)}
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder={t('assignments.filters.status', 'وضعیت')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {isRTL ? status.labelFa : status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-9 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('assignments.filters.reset', 'پاک کردن')}
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Results Count */}
        <Badge variant="secondary" className="h-7">
          {filteredClasses === totalClasses
            ? t('assignments.filters.totalClasses', '{{count}} صنف', { count: totalClasses })
            : t('assignments.filters.filteredClasses', '{{filtered}} از {{total}} صنف', {
                filtered: filteredClasses,
                total: totalClasses,
              })}
        </Badge>

        {/* Expand/Collapse Controls */}
        <div className="flex items-center gap-1 border-s ps-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpandAll}
            disabled={expandedCount === totalGroups}
            className="h-8 px-2"
            title={t('assignments.filters.expandAll', 'باز کردن همه')}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseAll}
            disabled={expandedCount === 0}
            className="h-8 px-2"
            title={t('assignments.filters.collapseAll', 'بستن همه')}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Mode Indicator */}
      {isBulkMode && !hasSelection && (
        <>
          <Separator />
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2 shadow-sm">
            <CheckSquare className="w-4 h-4 text-[#003366]" />
            <p className="text-sm text-blue-700">
              {t(
                'assignments.filters.bulkModeActive',
                'حالت انتخاب گروهی فعال است. روی سلول‌ها کلیک کنید.'
              )}
            </p>
            <div className="flex-1" />
            {onClearSelection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-[#003366] hover:bg-slate-50"
              >
                {t('assignments.filters.exitBulkMode', 'خروج')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AssignmentsFilters;
