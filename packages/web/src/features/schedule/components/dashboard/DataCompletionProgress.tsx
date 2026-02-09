/**
 * DataCompletionProgress Component
 * Visual progress bar showing data completion percentage
 *
 * Features:
 * - Calculate completion percentage from readiness data
 * - Visual progress bar with percentage display
 *
 * Requirements: 8.4
 */

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ReadinessData } from '@/types/readiness';
import { CheckCircle2 } from 'lucide-react';

/**
 * Props for DataCompletionProgress component
 */
export interface DataCompletionProgressProps {
  /** Readiness data for calculating completion */
  readinessData: ReadinessData;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculate completion percentage from readiness data
 *
 * Counts how many of the 4 entity types have at least one entry.
 * Teachers, Classes, Subjects are critical (weighted more).
 * Rooms are optional but still count toward completion.
 */
export function calculateCompletionPercentage(data: ReadinessData): number {
  // Critical items (teachers, classes, subjects) = 30% each = 90%
  // Optional items (rooms) = 10%
  let percentage = 0;

  if (data.teacherCount > 0) percentage += 30;
  if (data.classCount > 0) percentage += 30;
  if (data.subjectCount > 0) percentage += 30;
  if (data.roomCount > 0) percentage += 10;

  return percentage;
}

/**
 * Get completion status text in Persian
 */
function getCompletionStatusText(percentage: number): string {
  if (percentage === 0) return 'شروع نشده';
  if (percentage < 50) return 'در حال پیشرفت';
  if (percentage < 90) return 'تقریباً آماده';
  if (percentage < 100) return 'تقریباً کامل';
  return 'آماده تولید!';
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percentage: number): string {
  if (percentage === 0) return 'bg-gray-300';
  if (percentage < 50) return 'bg-amber-500';
  if (percentage < 90) return 'bg-blue-500';
  return 'bg-green-500';
}

/**
 * DataCompletionProgress component
 *
 * Displays a progress bar showing how much of the required data
 * has been entered. Helps new users understand what's needed.
 *
 * Requirements: 8.4
 */
export function DataCompletionProgress({ readinessData, className }: DataCompletionProgressProps) {
  const percentage = calculateCompletionPercentage(readinessData);
  const statusText = getCompletionStatusText(percentage);
  const isComplete = percentage >= 90;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with percentage and status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">پیشرفت تکمیل اطلاعات</span>
        <div className="flex items-center gap-2">
          {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          <span
            className={cn('font-medium', isComplete ? 'text-green-600' : 'text-muted-foreground')}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <Progress
          value={percentage}
          className={cn('h-2', getProgressColor(percentage))}
          aria-label={`${percentage}% تکمیل شده`}
        />
      </div>

      {/* Percentage display */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{percentage}% تکمیل شده</span>
        <span>{getCompletedItemsText(readinessData)}</span>
      </div>
    </div>
  );
}

/**
 * Get text describing completed items
 */
function getCompletedItemsText(data: ReadinessData): string {
  const completed: string[] = [];

  if (data.teacherCount > 0) completed.push('استادان');
  if (data.classCount > 0) completed.push('صنف‌ها');
  if (data.subjectCount > 0) completed.push('مضامین');
  if (data.roomCount > 0) completed.push('اتاق‌ها');

  if (completed.length === 0) return 'هیچ موردی تکمیل نشده';
  if (completed.length === 4) return 'همه موارد تکمیل شده';

  return `${completed.length} از ۴ مورد`;
}
