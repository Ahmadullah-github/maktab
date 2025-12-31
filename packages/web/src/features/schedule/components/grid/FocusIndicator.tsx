/**
 * FocusIndicator - Visual focus ring overlay for keyboard navigation
 *
 * Renders an animated focus ring positioned absolutely over the focused cell.
 * The indicator is hidden when no cell is focused (focusedSlot is null).
 *
 * Requirements: 2.1, 2.2, 2.3
 */

import { cn } from '@/lib/utils';
import { memo, useEffect, useState } from 'react';

import type { FocusedSlot } from '../../types';

/**
 * Props for FocusIndicator component
 */
export interface FocusIndicatorProps {
  /** Currently focused slot (null when grid is not focused) */
  slot: FocusedSlot | null;
  /** Map of cell IDs to their DOM elements for positioning */
  cellRefs: Map<string, HTMLElement>;
}

/**
 * Creates a cell ID from day and period
 */
function createCellId(day: string, period: number): string {
  return `${day}-${period}`;
}

/**
 * Position state for the focus indicator
 */
interface IndicatorPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * FocusIndicator - Animated focus ring overlay
 *
 * Features:
 * - Positions absolutely over the focused cell
 * - Renders animated focus ring with sufficient contrast (3:1 ratio)
 * - Hides when focusedSlot is null
 * - Smoothly transitions between cells
 *
 * Requirements: 2.1, 2.2, 2.3
 */
export const FocusIndicator = memo(function FocusIndicator({
  slot,
  cellRefs,
}: FocusIndicatorProps) {
  const [position, setPosition] = useState<IndicatorPosition | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Update position when slot changes
  useEffect(() => {
    if (!slot) {
      setIsVisible(false);
      return;
    }

    const cellId = createCellId(slot.day, slot.period);
    const cellElement = cellRefs.get(cellId);

    if (!cellElement) {
      setIsVisible(false);
      return;
    }

    // Get the cell's position relative to its offset parent
    const rect = cellElement.getBoundingClientRect();
    const parentRect = cellElement.offsetParent?.getBoundingClientRect();

    if (!parentRect) {
      // Fallback: use absolute positioning from cell
      setPosition({
        top: cellElement.offsetTop,
        left: cellElement.offsetLeft,
        width: cellElement.offsetWidth,
        height: cellElement.offsetHeight,
      });
    } else {
      setPosition({
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    setIsVisible(true);
  }, [slot, cellRefs]);

  // Hide when focusedSlot is null - Requirement 2.3
  if (!slot || !position || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        // Positioning
        'absolute pointer-events-none z-20',
        // Focus ring styling - Requirement 2.1, 2.4 (3:1 contrast ratio)
        'ring-2 ring-ring ring-offset-2 ring-offset-background',
        // Rounded corners to match cell
        'rounded-sm',
        // Animation for smooth transitions
        'transition-all duration-150 ease-out',
        // Animated pulse effect for visibility
        'animate-pulse'
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
      }}
      role="presentation"
      aria-hidden="true"
      data-testid="focus-indicator"
      data-focused-day={slot.day}
      data-focused-period={slot.period}
    />
  );
});

export default FocusIndicator;
