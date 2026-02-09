/**
 * TeacherStatsCard Component
 *
 * Stats sidebar showing teacher statistics summary
 * Inspired by RoomStatsCard pattern
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BookOpen, Clock, Hash, Layers, TrendingUp, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Teacher } from '../types';
import { ensureArray } from '../utils/serialization';

export interface TeacherStatsCardProps {
  teachers: Teacher[];
  selectedCount: number;
  maxPeriodsPerWeek: number;
  className?: string;
}

interface TeacherStats {
  total: number;
  fullTime: number;
  partTime: number;
  totalSubjects: number;
  avgPeriodsPerWeek: number;
  withAvailabilityRestrictions: number;
}

const FULL_TIME_THRESHOLD = 0.8;

function calculateStats(teachers: Teacher[], maxPeriodsPerWeek: number): TeacherStats {
  let fullTime = 0;
  let partTime = 0;
  let totalSubjects = 0;
  let totalPeriods = 0;
  let withRestrictions = 0;

  teachers.forEach((teacher) => {
    const isFullTime = teacher.maxPeriodsPerWeek >= maxPeriodsPerWeek * FULL_TIME_THRESHOLD;
    if (isFullTime) {
      fullTime++;
    } else {
      partTime++;
    }

    const primaryCount = ensureArray(teacher.primarySubjectIds).length;
    const allowedCount = teacher.restrictToPrimarySubjects
      ? 0
      : ensureArray(teacher.allowedSubjectIds).length;
    totalSubjects += primaryCount + allowedCount;

    totalPeriods += teacher.maxPeriodsPerWeek || 0;

    const unavailable = ensureArray(teacher.unavailable);
    if (unavailable.length > 0) {
      withRestrictions++;
    }
  });

  return {
    total: teachers.length,
    fullTime,
    partTime,
    totalSubjects,
    avgPeriodsPerWeek: teachers.length > 0 ? Math.round(totalPeriods / teachers.length) : 0,
    withAvailabilityRestrictions: withRestrictions,
  };
}

export function TeacherStatsCard({
  teachers,
  selectedCount,
  maxPeriodsPerWeek,
  className,
}: TeacherStatsCardProps) {
  const { t } = useTranslation();
  const stats = useMemo(
    () => calculateStats(teachers, maxPeriodsPerWeek),
    [teachers, maxPeriodsPerWeek]
  );

  return (
    <div className={cn('h-full overflow-auto p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">{t('teachers.stats.summary', 'خلاصه آمار')}</span>
        </div>
        {selectedCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            {selectedCount} {t('common.selected', 'انتخاب شده')}
          </Badge>
        )}
      </div>

      {/* Total Teachers */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('teachers.stats.totalTeachers', 'کل معلمین')}
            </p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Total Subjects */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <BookOpen className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('teachers.stats.totalSubjects', 'مجموع مضامین')}
            </p>
            <p className="text-2xl font-bold text-violet-700">{stats.totalSubjects}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs bg-gray-100">
          ~{stats.avgPeriodsPerWeek} {t('teachers.stats.periodsAvg', 'ساعت/هفته')}
        </Badge>
      </div>

      {/* With Restrictions */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('teachers.stats.withRestrictions', 'دارای محدودیت زمانی')}
            </p>
            <p className="text-2xl font-bold text-amber-700">
              {stats.withAvailabilityRestrictions}
            </p>
          </div>
        </div>
      </div>

      {/* Employment Type Breakdown */}
      <div className="p-3 bg-slate-700 rounded-lg text-white">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-slate-300" />
          <p className="text-xs text-slate-300">
            {t('teachers.stats.byType', 'بر اساس نوع استخدام')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('teachers.filterFullTime', 'تمام وقت')}</span>
            <span className="font-bold">{stats.fullTime}</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('teachers.filterPartTime', 'نیمه وقت')}</span>
            <span className="font-bold">{stats.partTime}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Hash className="h-3 w-3 me-1" />
          {stats.total} {t('teachers.stats.teachers', 'معلم')}
        </Badge>
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <BookOpen className="h-3 w-3 me-1" />
          {stats.totalSubjects} {t('teachers.stats.subjects', 'مضمون')}
        </Badge>
      </div>
    </div>
  );
}

export default TeacherStatsCard;
