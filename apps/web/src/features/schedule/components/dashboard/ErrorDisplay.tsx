/**
 * ErrorDisplay Component
 * Displays grouped errors from solver with retry and close actions
 *
 * Features:
 * - Group errors by category using ERROR_CATEGORIES
 * - Render ErrorGroup for each category with errors
 * - Display Retry and Close buttons
 *
 * Requirements: 11.1, 11.2, 11.10
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AffectedEntity, ErrorCategory, SolverErrorDetail } from '@/types/solver';
import { groupErrorsByCategory } from '@/types/solver';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useMemo } from 'react';
import { ErrorGroup } from './ErrorGroup';

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /** Errors from solver */
  errors: SolverErrorDetail[];
  /** Warnings from solver (optional) */
  warnings?: SolverErrorDetail[];
  /** Callback when an entity link is clicked */
  onEntityClick: (entity: AffectedEntity) => void;
  /** Callback when a quick action is clicked */
  onQuickAction?: (action: { type: string; entityId?: string }) => void;
  /** Callback when retry button is clicked */
  onRetry: () => void;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Order of categories for display
 */
const CATEGORY_ORDER: ErrorCategory[] = [
  'teacher',
  'class',
  'subject',
  'room',
  'validation',
  'solver',
];

/**
 * ErrorDisplay component for showing grouped solver errors
 *
 * Groups errors by category and displays them with ErrorGroup
 * components. Provides Retry and Close buttons for user actions.
 *
 * Requirements: 11.1, 11.2, 11.10
 */
export function ErrorDisplay({
  errors,
  warnings: _warnings = [],
  onEntityClick,
  onQuickAction,
  onRetry,
  onClose,
  className,
}: ErrorDisplayProps) {
  // Group errors by category (Requirement: 11.2)
  // Note: _warnings is available for future use when displaying warnings alongside errors
  const groupedErrors = useMemo(() => groupErrorsByCategory(errors), [errors]);

  // Get categories that have errors, in display order
  const categoriesWithErrors = useMemo(() => {
    return CATEGORY_ORDER.filter(
      (category) => groupedErrors[category] && groupedErrors[category]!.length > 0
    );
  }, [groupedErrors]);

  const totalErrors = errors.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('w-full', className)}
    >
      <Card className="p-6 bg-gradient-to-br from-red-50/50 via-background to-red-50/30 border-red-200">
        {/* Header with error icon and count */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-700 mb-1">خطا در تولید جدول زمانی</h3>
            <p className="text-sm text-muted-foreground">
              {totalErrors} خطا یافت شد. لطفاً مشکلات زیر را بررسی کنید.
            </p>
          </div>
        </div>

        {/* Scrollable error groups */}
        <ScrollArea className="max-h-[400px] pe-4">
          <div className="space-y-4">
            {categoriesWithErrors.map((category) => (
              <ErrorGroup
                key={category}
                category={category}
                errors={groupedErrors[category]!}
                onEntityClick={onEntityClick}
                onQuickAction={onQuickAction}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Action buttons (Requirement: 11.10) */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t">
          <Button onClick={onRetry} className="flex-1">
            <RefreshCw className="w-4 h-4 me-2" />
            تلاش مجدد
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="w-4 h-4 me-2" />
            بستن
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
