/**
 * UnsavedBadge component
 *
 * Displays a small badge showing the count of unsaved changes.
 * Hidden when count is 0, animates on count change.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { cn } from '@/lib/utils';
import type { ReactElement } from 'react';

/**
 * Props for UnsavedBadge component
 */
export interface UnsavedBadgeProps {
  /** Number of unsaved changes */
  count: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Small badge showing unsaved changes count
 *
 * - Hidden when count is 0 (Requirement: 12.3)
 * - Displays count in badge (Requirement: 12.1)
 * - Positioned at top-right with absolute positioning (Requirement: 12.2)
 * - Animates on count change (Requirement: 12.4)
 *
 * @param props - Component props
 * @returns Badge element or null if count is 0
 */
export function UnsavedBadge({ count, className }: UnsavedBadgeProps): ReactElement | null {
  // Hide when count is 0 (Requirement: 12.3)
  if (count === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        // Base styles
        'absolute -top-1 -end-1',
        'flex h-4 min-w-4 items-center justify-center',
        'rounded-full bg-destructive px-1',
        'text-[10px] font-medium text-destructive-foreground',
        // Animation on change (Requirement: 12.4)
        'animate-in zoom-in-50 duration-200',
        className
      )}
      aria-label={`${count} تغییر ذخیره نشده`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
