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
import { AlertTriangle, CheckCircle2, Circle, Clock, Layers3 } from 'lucide-react';
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
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
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
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{isRTL ? group.labelFa : group.label}</p>
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

export function AssignmentsStatsCard({ stats, gradeGroups, className }: AssignmentsStatsCardProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          <div className="relative overflow-hidden border-b border-slate-200 bg-linear-to-br from-[#003366] via-[#0c4063] to-slate-900 px-5 py-5 text-white">
            <div className="absolute inset-y-0 end-0 w-36 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_70%)] blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/65">
                    {t('assignments.stats.overallProgress', 'پیشرفت کلی')}
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">
                    {stats.completionPercentage}%
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    {t(
                      'assignments.stats.heroDescription',
                      'پوشش کلی تخصیص‌ها بر اساس نیازمندی‌های فعال و وضعیت‌های جاری.'
                    )}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-center shadow-lg shadow-slate-950/20">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    {t('assignments.stats.ready', 'آماده')}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{stats.assignedCount}</p>
                  <p className="text-xs text-white/70">
                    {t('assignments.stats.complete', 'تکمیل شده')}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    stats.conflictCount > 0
                      ? 'bg-amber-300'
                      : stats.completionPercentage === 100
                        ? 'bg-emerald-300'
                        : 'bg-white'
                  )}
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-white/60">{t('assignments.stats.classes', 'صنف‌ها')}</p>
                  <p className="mt-1 text-lg font-semibold">{stats.totalClasses}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-white/60">{t('assignments.stats.remaining', 'باقیمانده')}</p>
                  <p className="mt-1 text-lg font-semibold text-amber-200">
                    {stats.unassignedCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-white/60">{t('assignments.stats.total', 'کل')}</p>
                  <p className="mt-1 text-lg font-semibold">{stats.totalRequirements}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2">
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
