/**
 * DroppableCell - A droppable wrapper for schedule grid cells
 *
 * Wraps children with dnd-kit's useDroppable hook to enable
 * drop target functionality for schedule lessons.
 *
 * Requirements: 5.1, 5.2
 */

import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { memo } from 'react';

import type { DragData } from '../../hooks/useDragDrop';
import type { DayOfWeek } from '../../types';

/**
 * Props for DroppableCell component
 */
export interface DroppableCellProps {
  /** Unique identifier for the cell (format: "${day}-${period}") */
  id: string;
  /** Day of the week for this cell */
  day: DayOfWeek;
  /** Period index for this cell */
  period: number;
  /** Child content to render inside the droppable area */
  children: React.ReactNode;
  /** Whether dropping is disabled */
  disabled?: boolean;
  /** View scope for drop validation */
  viewScope: 'class' | 'teacher';
  /** View ID for drop validation */
  viewId: string;
}

/**
 * Validate if a drop source matches the view scope
 * Drops are only valid within the same view scope
 *
 * Requirements: 5.1, 5.4
 */
export function isValidDropSource(
  dragData: DragData | undefined,
  viewScope: 'class' | 'teacher',
  viewId: string
): boolean {
  if (!dragData || dragData.type !== 'lesson') {
    return false;
  }
  return dragData.viewScope === viewScope && dragData.viewId === viewId;
}

/**
 * Custom comparison function for React.memo
 * Only re-renders when relevant props change
 */
function arePropsEqual(prevProps: DroppableCellProps, nextProps: DroppableCellProps): boolean {
  return (
    prevProps.id === nextProps.id &&
    prevProps.day === nextProps.day &&
    prevProps.period === nextProps.period &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.viewScope === nextProps.viewScope &&
    prevProps.viewId === nextProps.viewId &&
    prevProps.children === nextProps.children
  );
}

/**
 * DroppableCell - Wraps children with drop target functionality
 *
 * Features:
 * - Enables drop target for cells
 * - Tracks isOver state for hover feedback
 * - Validates drop source matches view scope
 * - Applies visual feedback when dragged item is over
 *
 * Requirements: 5.1, 5.2
 */
export const DroppableCell = memo(function DroppableCell({
  id,
  day,
  period,
  children,
  disabled = false,
  viewScope,
  viewId,
}: DroppableCellProps) {
  // Use dnd-kit's useDroppable hook
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    disabled,
    data: {
      day,
      period,
      viewScope,
      viewId,
    },
  });

  // Get drag data from active item to validate drop source
  const dragData = active?.data.current as DragData | undefined;
  const isValidSource = isValidDropSource(dragData, viewScope, viewId);

  // Only show drop target feedback if source is valid
  const showDropFeedback = isOver && isValidSource && !disabled;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Base styles
        'relative',
        // Drop target feedback - Requirement 5.2: background highlight when dragged over
        showDropFeedback && 'bg-primary/5 ring-2 ring-primary/30 rounded-sm'
      )}
      data-droppable-id={id}
      data-is-over={isOver}
      data-is-valid-source={isValidSource}
    >
      {children}
    </div>
  );
}, arePropsEqual);

export default DroppableCell;
