/**
 * SingleTeacherBadge Component
 *
 * Displays a visual indicator for classes in single-teacher mode
 * where one teacher teaches all subjects (typically for grades 1-3)
 *
 * Requirements: 6.4
 */

import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { componentLogger } from '../../utils/logger';

export interface SingleTeacherBadgeProps {
  /** Whether single-teacher mode is enabled */
  enabled: boolean;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the label text (default: false, icon only) */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * SingleTeacherBadge displays an indicator for single-teacher mode
 *
 * @example
 * ```tsx
 * <SingleTeacherBadge enabled={true} />
 * <SingleTeacherBadge enabled={true} showLabel />
 * ```
 */
export function SingleTeacherBadge({
  enabled,
  className,
  showLabel = false,
  size = 'sm',
}: SingleTeacherBadgeProps) {
  const { t } = useTranslation();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SingleTeacherBadge', { enabled, showLabel, size });
    return () => componentLogger.unmount('SingleTeacherBadge');
  }, [enabled, showLabel, size]);

  // Don't render anything if not enabled
  if (!enabled) {
    return null;
  }

  const tooltipText = t('classes.form.singleTeacherModeDesc');
  const labelText = t('classes.form.singleTeacherMode');

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  const badgeSizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        'bg-amber-100 text-amber-800',
        badgeSizeClasses[size],
        className
      )}
      title={tooltipText}
      aria-label={tooltipText}
    >
      <User className={cn(sizeClasses[size], 'shrink-0')} aria-hidden="true" />
      {showLabel && <span>{labelText}</span>}
    </span>
  );
}

export default SingleTeacherBadge;
