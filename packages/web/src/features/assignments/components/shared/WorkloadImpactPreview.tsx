/**
 * WorkloadImpactPreview Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Shows before/after workload comparison when making an assignment.
 * Displays current workload, projected workload, and any warnings.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkloadImpact } from '../../hooks/useWorkloadImpact';
import type { WorkloadStatus } from '../../types';

export interface WorkloadImpactPreviewProps {
  /** Workload impact data */
  impact: WorkloadImpact;
  /** Compact mode */
  compact?: boolean;
  /** Show progress bars */
  showProgressBars?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get status icon
 */
function getStatusIcon(status: WorkloadStatus) {
  switch (status) {
    case 'overloaded':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'near_capacity':
      return <Clock className="w-3.5 h-3.5" />;
    case 'optimal':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'underloaded':
    default:
      return <TrendingDown className="w-3.5 h-3.5" />;
  }
}

/**
 * Get status colors
 */
function getStatusColors(status: WorkloadStatus) {
  switch (status) {
    case 'overloaded':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        progress: 'bg-red-500',
      };
    case 'near_capacity':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        progress: 'bg-amber-500',
      };
    case 'optimal':
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        progress: 'bg-emerald-500',
      };
    case 'underloaded':
    default:
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        progress: 'bg-blue-500',
      };
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: WorkloadStatus, isFarsi: boolean): string {
  const labels: Record<WorkloadStatus, { en: string; fa: string }> = {
    overloaded: { en: 'Overloaded', fa: 'بیش از حد' },
    near_capacity: { en: 'Near Capacity', fa: 'نزدیک به حداکثر' },
    optimal: { en: 'Optimal', fa: 'بهینه' },
    underloaded: { en: 'Underloaded', fa: 'کم‌بار' },
  };
  return isFarsi ? labels[status].fa : labels[status].en;
}

export function WorkloadImpactPreview({
  impact,
  compact = false,
  showProgressBars = true,
  className,
}: WorkloadImpactPreviewProps) {
  const { t, i18n } = useTranslation();
  const isFarsi = i18n.language === 'fa';

  const currentColors = getStatusColors(impact.status);
  const projectedColors = getStatusColors(impact.projectedStatus);

  const currentPercentage =
    impact.maxPeriods > 0 ? Math.min((impact.currentPeriods / impact.maxPeriods) * 100, 100) : 0;
  const projectedPercentage =
    impact.maxPeriods > 0 ? Math.min((impact.projectedPeriods / impact.maxPeriods) * 100, 100) : 0;

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 space-y-3',
        impact.canAccept ? 'border-slate-200 bg-slate-50/50' : 'border-red-200 bg-red-50/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          {t('assignments.workloadImpact', 'تأثیر بر بار کاری')}
        </span>
        <span className="text-xs text-slate-500">{impact.teacherName}</span>
      </div>

      {/* Before/After Comparison */}
      <div className={cn('flex items-center gap-3', compact ? 'flex-col' : 'flex-row')}>
        {/* Current */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">{t('assignments.current', 'فعلی')}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1 py-0 gap-0.5',
                currentColors.bg,
                currentColors.text,
                currentColors.border
              )}
            >
              {getStatusIcon(impact.status)}
              {!compact && getStatusLabel(impact.status, isFarsi)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {impact.currentPeriods}/{impact.maxPeriods}
            </span>
            {showProgressBars && (
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', currentColors.progress)}
                  style={{ width: `${currentPercentage}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-xs font-medium text-emerald-600">
              +{impact.additionalPeriods}
            </span>
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </div>
        </div>

        {/* Projected */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">
              {t('assignments.projected', 'پیش‌بینی')}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1 py-0 gap-0.5',
                projectedColors.bg,
                projectedColors.text,
                projectedColors.border
              )}
            >
              {getStatusIcon(impact.projectedStatus)}
              {!compact && getStatusLabel(impact.projectedStatus, isFarsi)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                !impact.canAccept && 'text-red-600'
              )}
            >
              {impact.projectedPeriods}/{impact.maxPeriods}
            </span>
            {showProgressBars && (
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', projectedColors.progress)}
                  style={{ width: `${projectedPercentage}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Message */}
      {impact.warning && (
        <div
          className={cn(
            'flex items-start gap-2 p-2 rounded-md text-xs',
            impact.warningSeverity === 'error'
              ? 'bg-red-100 text-red-700'
              : impact.warningSeverity === 'warning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{impact.warning}</span>
        </div>
      )}

      {/* Remaining Capacity */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
        <span className="text-slate-500">
          {t('assignments.remainingCapacity', 'ظرفیت باقی‌مانده')}
        </span>
        <span
          className={cn(
            'font-medium tabular-nums',
            impact.remainingCapacity < 0
              ? 'text-red-600'
              : impact.remainingCapacity <= 5
                ? 'text-amber-600'
                : 'text-emerald-600'
          )}
        >
          {impact.remainingCapacity} {t('common.period', 'ساعت')}
        </span>
      </div>
    </div>
  );
}

export default WorkloadImpactPreview;
