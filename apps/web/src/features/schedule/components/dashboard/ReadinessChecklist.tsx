/**
 * ReadinessChecklist Component
 * Horizontal display of data readiness with real counts
 *
 * Features:
 * - Render four ReadinessItems (Teachers, Classes, Subjects, Rooms)
 * - Display skeleton placeholders when loading
 * - Show validation warnings from useReadinessValidation
 *
 * Requirements: 1.4, 3.8, 14.2, 14.3, 14.4
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  READINESS_ITEMS,
  getReadinessCount,
  type ReadinessData,
  type ValidationWarning,
} from '@/types/readiness';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { ReadinessItem } from './ReadinessItem';

/**
 * Props for ReadinessChecklist component
 */
export interface ReadinessChecklistProps {
  /** Readiness data with entity counts */
  data: ReadinessData;
  /** Whether data is loading */
  isLoading: boolean;
  /** Validation warnings to display */
  validationWarnings?: ValidationWarning[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton placeholder for loading state
 */
function ReadinessChecklistSkeleton() {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-3 min-w-[100px]">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-8 h-5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Warning banner for validation warnings
 */
function ValidationWarningBanner({ warnings }: { warnings: ValidationWarning[] }) {
  if (warnings.length === 0) return null;

  // Group warnings by type for cleaner display
  const warningCount = warnings.length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.2 }}
    >
      <Alert variant="default" className="bg-amber-50 border-amber-200 mt-4">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <span className="font-medium">{warningCount} هشدار یافت شد:</span>
          <ul className="mt-1 list-disc list-inside text-sm">
            {warnings.slice(0, 3).map((warning, index) => (
              <li key={`${warning.type}-${warning.entityId}-${index}`}>
                {warning.entityName}: {warning.messageFa}
              </li>
            ))}
            {warnings.length > 3 && (
              <li className="text-amber-600">و {warnings.length - 3} هشدار دیگر...</li>
            )}
          </ul>
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}

/**
 * ReadinessChecklist component for displaying entity readiness
 *
 * Shows four items (Teachers, Classes, Subjects, Rooms) with their counts
 * and status indicators. Displays validation warnings when present.
 *
 * Requirements: 1.4, 3.8, 14.2, 14.3, 14.4
 */
export function ReadinessChecklist({
  data,
  isLoading,
  validationWarnings = [],
  className,
}: ReadinessChecklistProps) {
  // Show skeleton during loading (Requirement: 3.8)
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <ReadinessChecklistSkeleton />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Readiness items in horizontal row (Requirement: 1.4) */}
      <div className="flex items-center justify-center gap-4 md:gap-6 py-2">
        {READINESS_ITEMS.map((item, index) => {
          const count = getReadinessCount(data, item.key);

          // Find warnings for this entity type
          const entityWarnings = validationWarnings.filter(
            (w) => w.entityType === item.key.slice(0, -1) // Remove 's' from plural
          );

          // Build warning message from validation warnings
          const warningMessage =
            entityWarnings.length > 0
              ? entityWarnings.map((w) => w.messageFa).join('، ')
              : undefined;

          return (
            <ReadinessItem
              key={item.key}
              icon={item.icon}
              labelFa={item.labelFa}
              count={count}
              isLoading={false}
              navigateTo={item.navigationPath}
              isCritical={item.isCritical}
              warningMessage={warningMessage}
              animationDelay={index * 0.1}
            />
          );
        })}
      </div>

      {/* Validation warnings banner (Requirements: 14.2, 14.3, 14.4) */}
      <ValidationWarningBanner warnings={validationWarnings} />
    </div>
  );
}
