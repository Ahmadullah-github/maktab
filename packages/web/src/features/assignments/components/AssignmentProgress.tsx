/**
 * AssignmentProgress Component
 *
 * Shows overall assignment progress with:
 * - Circular progress indicator
 * - Percentage and count display
 * - Breakdown by status (assigned, unassigned, conflicts)
 * - Quick action buttons
 *
 * Requirements: Phase 4.2
 */

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Circle, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssignmentsPageStats, AssignmentStatusFilter } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentProgressProps {
  /** Overall statistics */
  stats: AssignmentsPageStats;
  /** Current status filter */
  currentFilter: AssignmentStatusFilter;
  /** Filter change handler */
  onFilterChange: (filter: AssignmentStatusFilter) => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AssignmentProgress({
  stats,
  currentFilter,
  onFilterChange,
  compact = false,
  className,
}: AssignmentProgressProps) {
  const { t } = useTranslation();

  // Progress color based on completion
  const progressColor =
    stats.completionPercentage === 100
      ? 'text-emerald-500'
      : stats.conflictCount > 0
        ? 'text-red-500'
        : stats.completionPercentage > 50
          ? 'text-amber-500'
          : 'text-slate-400';

  const strokeColor =
    stats.completionPercentage === 100
      ? 'stroke-emerald-500'
      : stats.conflictCount > 0
        ? 'stroke-red-500'
        : stats.completionPercentage > 50
          ? 'stroke-amber-500'
          : 'stroke-slate-300';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* Mini Progress Circle */}
        <div className="relative w-10 h-10">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-slate-100"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${stats.completionPercentage * 1.005} 100.5`}
              strokeLinecap="round"
              className={strokeColor}
            />
          </svg>
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-xs font-bold',
              progressColor
            )}
          >
            {stats.completionPercentage}%
          </span>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2">
          <StatusBadge
            icon={<CheckCircle2 className="w-3 h-3" />}
            count={stats.assignedCount}
            color="emerald"
            isActive={currentFilter === 'assigned'}
            onClick={() => onFilterChange(currentFilter === 'assigned' ? 'all' : 'assigned')}
            tooltip={t('assignments.progress.assigned', 'تخصیص شده')}
          />
          <StatusBadge
            icon={<Circle className="w-3 h-3" />}
            count={stats.unassignedCount}
            color="amber"
            isActive={currentFilter === 'unassigned'}
            onClick={() => onFilterChange(currentFilter === 'unassigned' ? 'all' : 'unassigned')}
            tooltip={t('assignments.progress.unassigned', 'تخصیص نشده')}
          />
          {stats.conflictCount > 0 && (
            <StatusBadge
              icon={<AlertTriangle className="w-3 h-3" />}
              count={stats.conflictCount}
              color="red"
              isActive={currentFilter === 'conflict'}
              onClick={() => onFilterChange(currentFilter === 'conflict' ? 'all' : 'conflict')}
              tooltip={t('assignments.progress.conflicts', 'تعارض')}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Progress Circle */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-slate-100"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${stats.completionPercentage * 1.76} 176`}
            strokeLinecap="round"
            className={strokeColor}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-lg font-bold', progressColor)}>
            {stats.completionPercentage}%
          </span>
        </div>
      </div>

      {/* Stats Text */}
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">
          {t('assignments.progress.summary', '{{assigned}} از {{total}} تخصیص', {
            assigned: stats.assignedCount,
            total: stats.totalRequirements,
          })}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <StatusBadge
            icon={<CheckCircle2 className="w-3 h-3" />}
            count={stats.assignedCount}
            color="emerald"
            isActive={currentFilter === 'assigned'}
            onClick={() => onFilterChange(currentFilter === 'assigned' ? 'all' : 'assigned')}
            tooltip={t('assignments.progress.filterAssigned', 'فیلتر تخصیص شده')}
            showLabel
            label={t('assignments.progress.assigned', 'تخصیص شده')}
          />
          <StatusBadge
            icon={<Circle className="w-3 h-3" />}
            count={stats.unassignedCount}
            color="amber"
            isActive={currentFilter === 'unassigned'}
            onClick={() => onFilterChange(currentFilter === 'unassigned' ? 'all' : 'unassigned')}
            tooltip={t('assignments.progress.filterUnassigned', 'فیلتر تخصیص نشده')}
            showLabel
            label={t('assignments.progress.unassigned', 'تخصیص نشده')}
          />
          {stats.conflictCount > 0 && (
            <StatusBadge
              icon={<AlertTriangle className="w-3 h-3" />}
              count={stats.conflictCount}
              color="red"
              isActive={currentFilter === 'conflict'}
              onClick={() => onFilterChange(currentFilter === 'conflict' ? 'all' : 'conflict')}
              tooltip={t('assignments.progress.filterConflicts', 'فیلتر تعارض‌ها')}
              showLabel
              label={t('assignments.progress.conflicts', 'تعارض')}
            />
          )}
        </div>
      </div>

      {/* Clear Filter Button */}
      {currentFilter !== 'all' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange('all')}
          className="text-slate-500"
        >
          <Filter className="w-4 h-4 me-1" />
          {t('assignments.progress.clearFilter', 'پاک کردن فیلتر')}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// StatusBadge Sub-component
// ============================================================================

interface StatusBadgeProps {
  icon: React.ReactNode;
  count: number;
  color: 'emerald' | 'amber' | 'red';
  isActive: boolean;
  onClick: () => void;
  tooltip: string;
  showLabel?: boolean;
  label?: string;
}

function StatusBadge({
  icon,
  count,
  color,
  isActive,
  onClick,
  tooltip,
  showLabel = false,
  label,
}: StatusBadgeProps) {
  const colorClasses = {
    emerald: {
      bg: isActive ? 'bg-emerald-100' : 'bg-emerald-50',
      text: 'text-emerald-700',
      border: isActive ? 'border-emerald-500' : 'border-transparent',
    },
    amber: {
      bg: isActive ? 'bg-amber-100' : 'bg-amber-50',
      text: 'text-amber-700',
      border: isActive ? 'border-amber-500' : 'border-transparent',
    },
    red: {
      bg: isActive ? 'bg-red-100' : 'bg-red-50',
      text: 'text-red-700',
      border: isActive ? 'border-red-500' : 'border-transparent',
    },
  };

  const classes = colorClasses[color];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md border-2 transition-all',
              'hover:scale-105 cursor-pointer',
              classes.bg,
              classes.text,
              classes.border
            )}
          >
            {icon}
            <span className="text-xs font-medium">{count}</span>
            {showLabel && label && <span className="text-xs hidden sm:inline">{label}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AssignmentProgress;
