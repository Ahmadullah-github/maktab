/**
 * VirtualizedList Component
 *
 * Provides efficient rendering for large lists using windowing technique.
 * Only renders items that are visible in the viewport plus a buffer.
 *
 * Requirements: 11.4
 */

import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Maximum height of the container */
  containerHeight: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key extractor function */
  getKey: (item: T, index: number) => string | number;
  /** Number of items to render above/below viewport */
  overscan?: number;
  /** Additional class name for container */
  className?: string;
  /** Callback when scroll position changes */
  onScroll?: (scrollTop: number) => void;
  /** Empty state component */
  emptyState?: React.ReactNode;
}

/**
 * VirtualizedList renders only visible items for performance
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  getKey,
  overscan = 3,
  className,
  onScroll,
  emptyState,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const { startIndex, visibleItems, offsetY } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);

    // Calculate start index with overscan
    const rawStartIndex = Math.floor(scrollTop / itemHeight);
    const startIndex = Math.max(0, rawStartIndex - overscan);

    // Calculate end index with overscan
    const rawEndIndex = rawStartIndex + visibleCount;
    const endIndex = Math.min(items.length, rawEndIndex + overscan);

    // Get visible items
    const visibleItems = items.slice(startIndex, endIndex);

    // Calculate offset for positioning
    const offsetY = startIndex * itemHeight;

    return { startIndex, endIndex, visibleItems, offsetY, totalHeight };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);
    },
    [onScroll]
  );

  // Reset scroll when items change significantly
  useEffect(() => {
    if (containerRef.current && scrollTop > items.length * itemHeight) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length, itemHeight, scrollTop]);

  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Spacer to maintain scroll height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Positioned container for visible items */}
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, localIndex) => {
            const globalIndex = startIndex + localIndex;
            return (
              <div key={getKey(item, globalIndex)} style={{ height: itemHeight }}>
                {renderItem(item, globalIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedList;
