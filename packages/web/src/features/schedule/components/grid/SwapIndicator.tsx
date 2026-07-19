/**
 * SwapIndicator - Visual overlay for swap validation status
 *
 * Renders a colored overlay on schedule cells to indicate whether they are
 * valid swap targets, have warnings, or are blocked.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { cn } from '@/lib/utils';
import { memo } from 'react';

import type { CellValidationStatus } from '../../types';

/**
 * Props for SwapIndicator component
 */
export interface SwapIndicatorProps {
  /** Validation status: 'valid' | 'warning' | 'blocked' | null */
  status: CellValidationStatus;
}

/**
 * CSS class mappings for each validation status
 */
const STATUS_CLASSES: Record<Exclude<CellValidationStatus, null>, string> = {
  valid: 'bg-emerald-500/5 ring-2 ring-inset ring-emerald-500/70',
  warning: 'bg-amber-500/5 ring-2 ring-inset ring-amber-500/70',
  blocked: 'bg-rose-500/5 ring-2 ring-inset ring-rose-500/70',
  checking: 'bg-sky-500/5 ring-2 ring-inset ring-sky-500/70 animate-pulse',
};

/**
 * SwapIndicator - Colored overlay for swap validation status
 *
 * Features:
 * - Green overlay for valid swap targets (bg-green-500/20, border-green-500)
 * - Yellow overlay for warnings (bg-yellow-500/20, border-yellow-500)
 * - Red overlay for blocked swaps (bg-red-500/20, border-red-500)
 * - Returns null when status is null (no overlay)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
export const SwapIndicator = memo(function SwapIndicator({ status }: SwapIndicatorProps) {
  // Return null for null status - Requirement 12.4
  if (status === null) {
    return null;
  }

  return (
    <div
      className={cn(
        // Positioning - absolute overlay covering the cell
        'absolute inset-0 pointer-events-none z-10',
        // Rounded corners to match cell
        'rounded-xl',
        // Animation for smooth appearance
        'transition-all duration-150 ease-out',
        // Status-specific styling
        STATUS_CLASSES[status]
      )}
      role="presentation"
      aria-hidden="true"
      data-testid="swap-indicator"
      data-status={status}
    />
  );
});

export default SwapIndicator;
