/**
 * StatusBadge Component
 *
 * Displays active/inactive status with appropriate colors
 * - Active: Green background with checkmark
 * - Inactive: Gray background with X mark
 *
 * Requirements: 1.1
 */

import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface StatusBadgeProps {
  /** Whether the entity is active */
  isActive: boolean;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the label text (default: true) */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * StatusBadge displays an active/inactive status indicator
 *
 * @example
 * ```tsx
 * <StatusBadge isActive={true} />
 * <StatusBadge isActive={false} showLabel={false} />
 * ```
 */
export function StatusBadge({
  isActive,
  className,
  showLabel = true,
  size = 'sm',
}: StatusBadgeProps) {
  const { t } = useTranslation();

  const label = isActive ? t('common.active') : t('common.inactive');

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  const badgeSizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const Icon = isActive ? Check : X;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
        badgeSizeClasses[size],
        className
      )}
      aria-label={label}
    >
      <Icon className={cn(sizeClasses[size], 'shrink-0')} aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export default StatusBadge;
