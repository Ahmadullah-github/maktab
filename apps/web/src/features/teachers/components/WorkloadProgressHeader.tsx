/**
 * WorkloadProgressHeader Component
 *
 * Compact workload bar for the top of the SubjectAssignmentManager.
 * Shows:
 * - Progress bar with color coding (green/yellow/red)
 * - Current/max periods text
 * - Utilization percentage
 * - Status badge (Optimal, Near Capacity, Overloaded)
 *
 * Phase 1.3 of SubjectManager Refactoring
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkloadStatus } from '../../assignments/types';

export interface WorkloadProgressHeaderProps {
  /** Current total periods assigned */
  currentPeriods: number;
  /** Maximum periods allowed per week (effective max = min of contracted and available) */
  maxPeriods: number;
  /** Workload status */
  status: WorkloadStatus;
  /** Remaining capacity (can be negative if overloaded) */
  remainingCapacity?: number;
  /** Contracted maximum periods (from teacher settings) */
  contractedMaxPeriods?: number;
  /** Available slots (total school periods minus unavailable slots) */
  availableSlots?: number;
  /** Compact mode - hides status badge, smaller text */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get progress bar color based on utilization
 */
function getProgressColor(utilizationPercentage: number): string {
  if (utilizationPercentage > 100) {
    return 'bg-red-500';
  }
  if (utilizationPercentage > 85) {
    return 'bg-amber-500';
  }
  if (utilizationPercentage >= 50) {
    return 'bg-emerald-500';
  }
  return 'bg-blue-500';
}

/**
 * Get status badge styling
 */
function getStatusBadgeStyle(status: WorkloadStatus): {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'overloaded':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: <AlertTriangle className="w-3 h-3" />,
      };
    case 'near_capacity':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <Clock className="w-3 h-3" />,
      };
    case 'optimal':
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case 'underloaded':
    default:
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: <TrendingDown className="w-3 h-3" />,
      };
  }
}

/**
 * Get status label in Farsi
 */
function getStatusLabel(
  status: WorkloadStatus,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case 'overloaded':
      return t('teachers.workload.overloaded', 'بیش از حد');
    case 'near_capacity':
      return t('teachers.workload.nearCapacity', 'نزدیک به حداکثر');
    case 'optimal':
      return t('teachers.workload.optimal', 'بهینه');
    case 'underloaded':
    default:
      return t('teachers.workload.underloaded', 'کم‌بار');
  }
}

/**
 * WorkloadProgressHeader - Compact workload display bar
 */
export function WorkloadProgressHeader({
  currentPeriods,
  maxPeriods,
  status,
  remainingCapacity,
  contractedMaxPeriods,
  availableSlots,
  compact = false,
  className,
}: WorkloadProgressHeaderProps) {
  const { t } = useTranslation();

  const utilizationPercentage = useMemo(() => {
    if (maxPeriods <= 0) return 0;
    return (currentPeriods / maxPeriods) * 100;
  }, [currentPeriods, maxPeriods]);

  const progressColor = getProgressColor(utilizationPercentage);
  const statusStyle = getStatusBadgeStyle(status);
  const statusLabel = getStatusLabel(status, t);

  // Calculate remaining capacity if not provided
  const remaining = remainingCapacity ?? maxPeriods - currentPeriods;

  // Check if effective max is limited by availability
  const isLimitedByAvailability =
    availableSlots !== undefined &&
    contractedMaxPeriods !== undefined &&
    availableSlots < contractedMaxPeriods;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 transition-colors',
        compact ? 'p-2' : 'p-3',
        status === 'overloaded'
          ? 'bg-red-50/50 border-red-200'
          : status === 'near_capacity'
            ? 'bg-amber-50/50 border-amber-200'
            : status === 'optimal'
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-blue-50/50 border-blue-200',
        className
      )}
    >
      {/* Progress Bar Section */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          {!compact && (
            <span className="text-xs font-medium text-slate-600">
              {t('teachers.workload.title', 'بار کاری')}
            </span>
          )}
          <div className={cn('flex items-center gap-2', compact && 'w-full justify-between')}>
            {/* Periods Display */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'font-semibold tabular-nums cursor-help',
                      compact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    <span
                      className={cn(status === 'overloaded' ? 'text-red-600' : 'text-slate-800')}
                    >
                      {currentPeriods}
                    </span>
                    <span className="text-slate-400">/{maxPeriods}</span>
                    <span className="text-xs text-slate-500 ms-1">
                      {t('common.period', 'ساعت')}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>{t('teachers.workload.assigned', 'اختصاص داده شده')}:</span>
                      <span className="font-medium">{currentPeriods}</span>
                    </div>
                    {/* Show contracted max if different from effective max */}
                    {contractedMaxPeriods !== undefined && contractedMaxPeriods !== maxPeriods && (
                      <div className="flex justify-between gap-4 text-slate-400">
                        <span>{t('teachers.workload.contracted', 'قرارداد')}:</span>
                        <span className="font-medium">{contractedMaxPeriods}</span>
                      </div>
                    )}
                    {/* Show available slots if provided */}
                    {availableSlots !== undefined && (
                      <div className="flex justify-between gap-4 text-slate-400">
                        <span>{t('teachers.workload.availableSlots', 'در دسترس')}:</span>
                        <span className="font-medium">{availableSlots}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <span>
                        {t('teachers.workload.effectiveMax', 'حداکثر مؤثر')}:
                        {isLimitedByAvailability && <span className="text-amber-500 ms-1">*</span>}
                      </span>
                      <span className="font-medium">{maxPeriods}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-1">
                      <span>{t('teachers.workload.remaining', 'باقی‌مانده')}:</span>
                      <span
                        className={cn(
                          'font-medium',
                          remaining < 0
                            ? 'text-red-500'
                            : remaining <= 5
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        )}
                      >
                        {remaining}
                      </span>
                    </div>
                    {isLimitedByAvailability && (
                      <div className="text-[10px] text-amber-500 border-t pt-1">
                        *{' '}
                        {t(
                          'teachers.workload.limitedByAvailability',
                          'محدود شده توسط در دسترس بودن'
                        )}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Percentage */}
            <span
              className={cn(
                'text-xs font-medium tabular-nums px-1.5 py-0.5 rounded',
                status === 'overloaded'
                  ? 'bg-red-100 text-red-700'
                  : status === 'near_capacity'
                    ? 'bg-amber-100 text-amber-700'
                    : status === 'optimal'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
              )}
            >
              {Math.round(utilizationPercentage)}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className={cn(
            'w-full bg-slate-200/70 rounded-full overflow-hidden',
            compact ? 'h-1.5' : 'h-2'
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              progressColor
            )}
            style={{
              width: `${Math.min(utilizationPercentage, 100)}%`,
            }}
          />
          {/* Overflow indicator for overloaded */}
          {utilizationPercentage > 100 && (
            <div
              className={cn(
                'bg-red-300 rounded-full animate-pulse',
                compact ? 'h-1.5 -mt-1.5' : 'h-2 -mt-2'
              )}
              style={{
                width: `${Math.min(utilizationPercentage - 100, 100)}%`,
                marginInlineStart: '100%',
                transform: 'translateX(-100%)',
              }}
            />
          )}
        </div>
      </div>

      {/* Status Badge - Hidden in compact mode */}
      {!compact && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 gap-1 text-[10px] px-2 py-1',
            statusStyle.bg,
            statusStyle.text,
            statusStyle.border
          )}
        >
          {statusStyle.icon}
          {statusLabel}
        </Badge>
      )}
    </div>
  );
}

export default WorkloadProgressHeader;
