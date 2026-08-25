import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock3,
  GraduationCap,
  School,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectAssignmentSummary } from '../hooks/useSubjectAssignments';
import type { Subject } from '../types';
import { calculateSubjectStatistics } from '../utils/subjectStatistics';

export interface SubjectStatsCardProps {
  subjects: Subject[];
  totalSubjectCount: number;
  selectedSubjects?: Subject[];
  assignmentSummaryBySubjectId?: ReadonlyMap<number, SubjectAssignmentSummary>;
  isCoverageLoading?: boolean;
  className?: string;
}

const EMPTY_SELECTED_SUBJECTS: Subject[] = [];
const EMPTY_ASSIGNMENT_SUMMARIES = new Map<number, SubjectAssignmentSummary>();

export function SubjectStatsCard({
  subjects,
  totalSubjectCount,
  selectedSubjects = EMPTY_SELECTED_SUBJECTS,
  assignmentSummaryBySubjectId = EMPTY_ASSIGNMENT_SUMMARIES,
  isCoverageLoading = false,
  className,
}: SubjectStatsCardProps) {
  const { t } = useTranslation();
  const stats = useMemo(
    () => calculateSubjectStatistics(subjects, assignmentSummaryBySubjectId, selectedSubjects),
    [assignmentSummaryBySubjectId, selectedSubjects, subjects]
  );
  const isFiltered = subjects.length !== totalSubjectCount;
  const hasDataQualityIssues = stats.missingGradeCount > 0 || stats.missingPeriodsCount > 0;

  return (
    <aside className={cn('h-full overflow-auto p-4 space-y-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-slate-700">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-semibold">{t('subjects.stats.title')}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {isFiltered
              ? t('subjects.stats.showingFiltered', {
                  visible: stats.totalSubjects,
                  total: totalSubjectCount,
                })
              : t('subjects.stats.allSubjectsIncluded')}
          </p>
        </div>
        {stats.selectedCount > 0 ? (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700">
            {t('subjects.stats.selectedCount', { count: stats.selectedCount })}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <BookOpen className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span className="text-2xl font-bold text-violet-800">{stats.totalSubjects}</span>
          </div>
          <p className="text-xs font-medium text-violet-700">{t('subjects.stats.total')}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Clock3 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="text-2xl font-bold text-blue-800">{stats.totalPeriods}</span>
          </div>
          <p className="text-xs font-medium text-blue-700">
            {t('subjects.stats.weeklyPeriods')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-white p-2 text-center">
          <p className="text-lg font-bold text-slate-800">{stats.averagePeriods}</p>
          <p className="text-[10px] text-muted-foreground">{t('subjects.stats.average')}</p>
        </div>
        <div className="rounded-lg border bg-white p-2 text-center">
          <p className="text-lg font-bold text-amber-700">{stats.difficultCount}</p>
          <p className="text-[10px] text-muted-foreground">{t('subjects.stats.difficult')}</p>
        </div>
        <div className="rounded-lg border bg-white p-2 text-center">
          <p className="text-lg font-bold text-emerald-700">{stats.specialRoomCount}</p>
          <p className="text-[10px] text-muted-foreground">{t('subjects.stats.specialRoom')}</p>
        </div>
      </div>

      {stats.selectedCount > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-800">{t('subjects.stats.selectedPeriods')}</span>
          <span className="font-bold text-blue-900">
            {stats.selectedPeriods} {t('subjects.stats.periodShort')}
          </span>
        </div>
      ) : null}

      <section className="rounded-xl border bg-white p-3" aria-labelledby="subject-coverage-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <h3 id="subject-coverage-title" className="text-xs font-semibold text-slate-700">
              {t('subjects.stats.assignmentCoverage')}
            </h3>
          </div>
          <span className="text-sm font-bold text-emerald-700">
            {isCoverageLoading
              ? '…'
              : stats.totalRequiredPeriods > 0
                ? `${stats.coveragePercentage}%`
                : '—'}
          </span>
        </div>
        <Progress value={isCoverageLoading ? 0 : stats.coveragePercentage} className="h-2" />
        {stats.totalRequiredPeriods > 0 ? (
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{t('subjects.stats.requiredPeriods', { count: stats.totalRequiredPeriods })}</span>
            <span>{t('subjects.stats.assignedPeriods', { count: stats.totalAssignedPeriods })}</span>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-muted-foreground">
            {t('subjects.stats.noCoverageDemand')}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-white" aria-labelledby="grade-summary-title">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <h3 id="grade-summary-title" className="text-xs font-semibold text-slate-700">
              {t('subjects.stats.byGrade')}
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {t('subjects.stats.gradeCount', { count: stats.byGrade.length })}
          </span>
        </div>
        {stats.byGrade.length > 0 ? (
          <div className="divide-y">
            {stats.byGrade.map((grade) => (
              <div key={grade.grade} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                      {grade.grade}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700">
                        {t('subjects.stats.gradeLabel', { grade: grade.grade })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('subjects.stats.subjectsAndAverage', {
                          subjects: grade.subjectCount,
                          average: grade.averagePeriods,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-bold text-blue-700">{grade.totalPeriods}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('subjects.stats.periodShort')}
                    </p>
                  </div>
                </div>
                {grade.configuredSubjectCount < grade.subjectCount ? (
                  <p className="mt-1 text-[10px] text-amber-700">
                    {t('subjects.stats.gradeMissingPeriods', {
                      count: grade.subjectCount - grade.configuredSubjectCount,
                    })}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t('subjects.stats.noGrades')}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-slate-700 p-3 text-white" aria-labelledby="section-summary-title">
        <div className="mb-3 flex items-center gap-2">
          <School className="h-4 w-4 text-slate-300" aria-hidden="true" />
          <h3 id="section-summary-title" className="text-xs text-slate-200">
            {t('subjects.stats.bySection')}
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['PRIMARY', 'MIDDLE', 'HIGH'] as const).map((section) => (
            <div key={section} className="rounded bg-white/10 px-2 py-1.5 text-center">
              <p className="text-[10px] text-slate-300">
                {t(`subjects.section.${section.toLowerCase()}`)}
              </p>
              <p className="font-bold">{stats.bySection[section].subjectCount}</p>
              <p className="text-[9px] text-slate-300">
                {stats.bySection[section].totalPeriods} {t('subjects.stats.periodShort')}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
          <Sparkles className="h-4 w-4 text-fuchsia-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-slate-800">{stats.customCount}</p>
            <p className="text-[10px] text-muted-foreground">{t('subjects.stats.custom')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
          <Clock3 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-slate-800">{stats.configuredPeriodCount}</p>
            <p className="text-[10px] text-muted-foreground">{t('subjects.stats.configured')}</p>
          </div>
        </div>
      </div>

      {hasDataQualityIssues ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold">{t('subjects.stats.incompleteData')}</p>
              <p className="mt-1 text-[10px]">
                {t('subjects.stats.incompleteDataDetail', {
                  grades: stats.missingGradeCount,
                  periods: stats.missingPeriodsCount,
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default SubjectStatsCard;
