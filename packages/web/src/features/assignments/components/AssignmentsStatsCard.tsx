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
import { AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react';
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

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
          {icon}
        </div>
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-lg font-semibold text-slate-800">{value}</span>
    </div>
  );
}

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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{isRTL ? group.labelFa : group.label}</span>
        <span className="text-slate-800 font-medium">{group.stats.completionPercentage}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', progressColor)}
          style={{ width: `${group.stats.completionPercentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {group.stats.assignedCount}/{group.stats.totalRequirements}
        </span>
        {group.stats.conflictCount > 0 && (
          <span className="text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {group.stats.conflictCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AssignmentsStatsCard({ stats, gradeGroups, className }: AssignmentsStatsCardProps) {
  const { t } = useTranslation();

  const completionColor =
    stats.completionPercentage === 100
      ? 'text-emerald-600'
      : stats.completionPercentage > 50
        ? 'text-amber-600'
        : 'text-slate-600';

  return (
    <div className={cn('p-4 space-y-4', className)}>
      {/* Overall Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            {t('assignments.stats.overallProgress', 'پیشرفت کلی')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Circular Progress Indicator */}
          <div className="flex items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-slate-100"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${stats.completionPercentage * 3.52} 352`}
                  strokeLinecap="round"
                  className={completionColor}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-3xl font-bold', completionColor)}>
                  {stats.completionPercentage}%
                </span>
                <span className="text-xs text-slate-500">
                  {t('assignments.stats.complete', 'تکمیل شده')}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Breakdown */}
          <div className="space-y-1 divide-y">
            <StatItem
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              label={t('assignments.stats.assigned', 'تخصیص شده')}
              value={stats.assignedCount}
              color="bg-emerald-50"
            />
            <StatItem
              icon={<Circle className="w-4 h-4 text-amber-600" />}
              label={t('assignments.stats.unassigned', 'تخصیص نشده')}
              value={stats.unassignedCount}
              color="bg-amber-50"
            />
            <StatItem
              icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
              label={t('assignments.stats.conflicts', 'تعارض')}
              value={stats.conflictCount}
              color="bg-red-50"
            />
            <StatItem
              icon={<Clock className="w-4 h-4 text-slate-600" />}
              label={t('assignments.stats.totalRequirements', 'کل نیازمندی‌ها')}
              value={stats.totalRequirements}
              color="bg-slate-100"
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-Grade Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            {t('assignments.stats.byGrade', 'بر اساس پایه')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gradeGroups.map((group) => (
            <GradeProgress key={group.category} group={group} />
          ))}

          {gradeGroups.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              {t('assignments.stats.noData', 'داده‌ای موجود نیست')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AssignmentsStatsCard;
