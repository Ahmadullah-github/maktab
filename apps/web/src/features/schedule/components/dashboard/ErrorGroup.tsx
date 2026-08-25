/**
 * ErrorGroup Component
 * Displays a group of errors under a category header
 *
 * Features:
 * - Display category header with icon
 * - Render ErrorItem for each error in category
 *
 * Requirements: 11.2
 */

import { cn } from '@/lib/utils';
import type { AffectedEntity, ErrorCategory, SolverErrorDetail } from '@/types/solver';
import { ERROR_CATEGORY_INFO, getErrorQuickAction } from '@/types/solver';
import { AlertTriangle, BookOpen, DoorOpen, GraduationCap, ShieldAlert, User } from 'lucide-react';
import { ErrorItem } from './ErrorItem';

/**
 * Props for ErrorGroup component
 */
export interface ErrorGroupProps {
  /** Error category */
  category: ErrorCategory;
  /** Errors in this category */
  errors: SolverErrorDetail[];
  /** Callback when an entity link is clicked */
  onEntityClick: (entity: AffectedEntity) => void;
  /** Callback when a quick action is clicked */
  onQuickAction?: (action: { type: string; entityId?: string }) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon mapping for error categories
 */
const CATEGORY_ICONS: Record<ErrorCategory, React.ComponentType<{ className?: string }>> = {
  teacher: User,
  room: DoorOpen,
  class: GraduationCap,
  subject: BookOpen,
  solver: AlertTriangle,
  validation: ShieldAlert,
};

/**
 * Color mapping for error categories
 */
const CATEGORY_COLORS: Record<ErrorCategory, { bg: string; text: string; border: string }> = {
  teacher: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  room: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  class: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  subject: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  solver: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  validation: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
};

/**
 * ErrorGroup component for displaying categorized errors
 *
 * Groups errors under a category header with an icon.
 * Each error is rendered using the ErrorItem component.
 *
 * Requirements: 11.2
 */
export function ErrorGroup({
  category,
  errors,
  onEntityClick,
  onQuickAction,
  className,
}: ErrorGroupProps) {
  const categoryInfo = ERROR_CATEGORY_INFO[category];
  const Icon = CATEGORY_ICONS[category];
  const colors = CATEGORY_COLORS[category];

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Category header with icon */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          colors.bg,
          colors.border,
          'border'
        )}
      >
        <Icon className={cn('w-5 h-5', colors.text)} />
        <h4 className={cn('font-semibold text-sm', colors.text)}>{categoryInfo.labelFa}</h4>
        <span
          className={cn(
            'ms-auto text-xs px-2 py-0.5 rounded-full',
            colors.bg,
            colors.text,
            'font-medium'
          )}
        >
          {errors.length}
        </span>
      </div>

      {/* Error items */}
      <div className="space-y-2 ps-2">
        {errors.map((error, index) => {
          const quickAction = getErrorQuickAction(error.error_code, error.context);
          return (
            <ErrorItem
              key={`${error.error_code}-${index}`}
              error={error}
              onEntityClick={onEntityClick}
              quickAction={quickAction}
              onQuickAction={onQuickAction}
            />
          );
        })}
      </div>
    </div>
  );
}
