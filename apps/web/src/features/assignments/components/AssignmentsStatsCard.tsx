/**
 * AssignmentsStatsCard Component
 *
 * Statistics panel showing assignment progress:
 * - Overall completion percentage
 * - Breakdown by status (assigned, unassigned, conflict)
 * - Per-grade-group progress
 *
 * Requirements: Phase 3.1
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertTriangle, Layers3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AssignmentsPageStats, GradeGroup } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentsStatsCardProps {
  /** Overall page statistics */
  stats: AssignmentsPageStats;
  /** Grade groups with their stats */
  gradeGroups: GradeGroup[];
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

interface GradeProgressProps {
  group: GradeGroup;
}

function GradeProgress({ group }: GradeProgressProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  const progressColor =
    group.stats.completionPercentage === 100
      ? 'bg-emerald-500'
      : group.stats.conflictCount > 0
        ? 'bg-red-500'
        : group.stats.completionPercentage > 50
          ? 'bg-amber-500'
          : 'bg-slate-300';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {isRTL ? group.labelFa : group.label}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {group.stats.totalClasses} {group.stats.totalClasses === 1 ? 'class' : 'classes'}
          </p>
        </div>
        <span className="font-semibold text-slate-900">{group.stats.completionPercentage}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-300', progressColor)}
          style={{ width: `${group.stats.completionPercentage}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {group.stats.assignedCount}/{group.stats.totalRequirements}
        </span>
        <div className="flex items-center gap-2">
          {group.stats.unassignedCount > 0 && (
            <span className="text-amber-600">{group.stats.unassignedCount} open</span>
          )}
          {group.stats.conflictCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-3 h-3" />
              {group.stats.conflictCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AssignmentsStatsCard({ gradeGroups, className }: AssignmentsStatsCardProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-900">
            <Layers3 className="h-4 w-4 text-blue-600" />
            {t('assignments.stats.byGrade', 'بر اساس پایه')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gradeGroups.map((group) => (
            <GradeProgress key={group.category} group={group} />
          ))}

          {gradeGroups.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              {t('assignments.stats.noData', 'داده‌ای موجود نیست')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AssignmentsStatsCard;
