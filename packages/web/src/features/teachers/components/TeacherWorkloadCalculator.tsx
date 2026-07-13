/**
 * TeacherWorkloadCalculator Component
 *
 * Displays teacher workload information with visual indicators.
 * Shows current/max periods, utilization percentage, and breakdown by subject.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6
 */

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { parseSubjectRequirements, type SubjectRequirement } from '@/lib/apiParsers';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, BookOpen, CheckCircle, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  calculateTeacherWorkload,
  getWorkloadProgressColor,
  getWorkloadStatusBgColor,
  getWorkloadStatusColor,
} from '../../assignments/services/workloadCalculation';
import type { Subject as FullSubject } from '../../subjects/types';
import type { Teacher } from '../types';

/**
 * Minimal subject interface for workload calculation
 */
interface MinimalSubject {
  id: number;
  name: string;
  periodsPerWeek?: number | null;
}

/**
 * Raw class from API
 */
interface ClassGroupRaw {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  subjectRequirements: string | SubjectRequirement[];
  isDeleted?: boolean;
}

/**
 * Parsed class for internal use
 */
interface ClassGroupParsed {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  subjectRequirements: SubjectRequirement[];
}

export interface TeacherWorkloadCalculatorProps {
  teacher: Teacher;
  subjects: MinimalSubject[];
  showBreakdown?: boolean;
  className?: string;
}

/**
 * Hook to fetch classes from the API
 */
function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = (await api.classes.list()) as ClassGroupRaw[];
      return response
        .filter((c) => !c.isDeleted)
        .map(
          (c): ClassGroupParsed => ({
            id: c.id,
            name: c.name,
            displayName: c.displayName,
            grade: c.grade,
            subjectRequirements: parseSubjectRequirements(c.subjectRequirements),
          })
        );
    },
  });
}

/**
 * TeacherWorkloadCalculator displays workload information with visual indicators
 */
export function TeacherWorkloadCalculator({
  teacher,
  subjects,
  showBreakdown = true,
  className,
}: TeacherWorkloadCalculatorProps) {
  const { t } = useTranslation();
  const { data: classes = [] } = useClasses();

  // Calculate workload
  const workload = useMemo(() => {
    // Convert minimal subjects to full subjects for calculation
    const fullSubjects = subjects.map((s) => ({
      ...s,
      schoolId: null,
      code: '',
      grade: null,
      periodsPerWeek: s.periodsPerWeek ?? null,
      section: '' as const,
      requiredRoomType: '' as const,
      requiredFeatures: [],
      desiredFeatures: [],
      isDifficult: false,
      minRoomCapacity: 0,
      meta: {},
      isDeleted: false,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
    })) as FullSubject[];
    return calculateTeacherWorkload(teacher, fullSubjects, classes);
  }, [teacher, subjects, classes]);

  // Get status icon
  const StatusIcon = useMemo(() => {
    switch (workload.status) {
      case 'overloaded':
        return AlertTriangle;
      case 'near_capacity':
        return TrendingUp;
      case 'optimal':
        return CheckCircle;
      default:
        return BarChart3;
    }
  }, [workload.status]);

  // Get status label
  const statusLabel = useMemo(() => {
    const key = `teachers.workload.status.${workload.status}`;
    return t(key, workload.status);
  }, [workload.status, t]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Workload Header */}
      <div className="p-4 bg-white rounded-lg border-2 border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-600" />
            <h3 className="font-medium text-sm text-slate-800">
              {t('teachers.workload.title', 'بار کاری')}
            </h3>
          </div>
          <Badge
            className={cn(
              'text-xs',
              getWorkloadStatusBgColor(workload.status),
              getWorkloadStatusColor(workload.status),
              'border-0'
            )}
          >
            <StatusIcon className="h-3 w-3 me-1" />
            {statusLabel}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              {t('teachers.workload.current', 'فعلی')}: {workload.totalPeriods}{' '}
              {t('common.period', 'ساعت')}
            </span>
            <span>
              {t('teachers.workload.maximum', 'حداکثر')}: {workload.maxPeriods}{' '}
              {t('common.period', 'ساعت')}
            </span>
          </div>
          <div className="relative">
            <Progress
              value={Math.min(workload.utilizationPercentage, 100)}
              className="h-3 bg-slate-100"
            />
            <div
              className={cn(
                'absolute inset-0 h-3 rounded-full transition-all',
                getWorkloadProgressColor(workload.utilizationPercentage)
              )}
              style={{ width: `${Math.min(workload.utilizationPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={cn('font-medium', getWorkloadStatusColor(workload.status))}>
              {Math.round(workload.utilizationPercentage)}%{' '}
              {t('teachers.workload.utilization', 'استفاده')}
            </span>
            <span className="text-slate-500">
              {t('teachers.workload.remaining', 'باقیمانده')}:{' '}
              {Math.max(0, workload.remainingCapacity)} {t('common.period', 'ساعت')}
            </span>
          </div>
        </div>
      </div>

      {/* Workload Breakdown */}
      {showBreakdown && (
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <h4 className="text-sm font-medium text-slate-700">
              {t('teachers.workload.breakdown', 'جزئیات بار کاری')}
            </h4>
          </div>

          {workload.breakdown.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              {t('teachers.workload.noBreakdown', 'هیچ تخصیصی وجود ندارد')}
            </p>
          ) : (
            <div className="space-y-2">
              {workload.breakdown.map((item) => (
                <div
                  key={item.subjectId}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-sm text-slate-700">{item.subjectName}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {item.classIds.length} {t('classes.title', 'صنف')}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-slate-800">
                    {item.totalPeriods} {t('common.period', 'ساعت')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeacherWorkloadCalculator;
