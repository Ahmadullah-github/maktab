/**
 * PaginatedList Component
 *
 * Provides pagination for large lists with efficient rendering.
 * Supports customizable page sizes and navigation.
 *
 * Requirements: 11.4
 */

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export interface PaginatedListProps<T> {
  /** Array of items to paginate */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key extractor function */
  getKey: (item: T, index: number) => string | number;
  /** Default page size */
  defaultPageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Whether to show page size selector */
  showPageSizeSelector?: boolean;
  /** Whether to show item count */
  showItemCount?: boolean;
  /** Additional class name for container */
  className?: string;
  /** Class name for items container */
  itemsClassName?: string;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Loading skeleton count */
  loadingSkeletonCount?: number;
  /** Render loading skeleton */
  renderSkeleton?: () => React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

// ============================================================================
// Component
// ============================================================================

export function PaginatedList<T>({
  items,
  renderItem,
  getKey,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showPageSizeSelector = true,
  showItemCount = true,
  className,
  itemsClassName,
  emptyState,
  isLoading = false,
  loadingSkeletonCount = 3,
  renderSkeleton,
}: PaginatedListProps<T>) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Calculate pagination
  const { totalPages, startIndex, endIndex, currentItems } = useMemo(() => {
    const totalPages = Math.ceil(items.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, items.length);
    const currentItems = items.slice(startIndex, endIndex);

    return { totalPages, startIndex, endIndex, currentItems };
  }, [items, currentPage, pageSize]);

  // Reset to page 1 when items change significantly
  useMemo(() => {
    if (currentPage > Math.ceil(items.length / pageSize)) {
      setCurrentPage(1);
    }
  }, [items.length, pageSize, currentPage]);

  // Navigation handlers
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(validPage);
    },
    [totalPages]
  );

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);
  const goToPrevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const goToNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);

  // Handle page size change
  const handlePageSizeChange = useCallback((value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {renderSkeleton
          ? Array.from({ length: loadingSkeletonCount }).map((_, i) => (
              <div key={i}>{renderSkeleton()}</div>
            ))
          : Array.from({ length: loadingSkeletonCount }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Items */}
      <div className={cn('space-y-2', itemsClassName)}>
        {currentItems.map((item, localIndex) => {
          const globalIndex = startIndex + localIndex;
          return <div key={getKey(item, globalIndex)}>{renderItem(item, globalIndex)}</div>;
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200">
          {/* Item Count */}
          {showItemCount && (
            <div className="text-xs text-slate-500">
              {t('common.showing', 'نمایش')} {startIndex + 1}-{endIndex} {t('common.of', 'از')}{' '}
              {items.length}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToFirstPage}
              disabled={currentPage === 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="px-2 text-sm text-slate-600">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Page Size Selector */}
          {showPageSizeSelector && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('common.perPage', 'در هر صفحه')}:</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={size.toString()} className="text-xs">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PaginatedList;
