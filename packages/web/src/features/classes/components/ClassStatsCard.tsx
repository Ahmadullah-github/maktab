/**
 * ClassStatsCard Component
 *
 * Stats sidebar showing class statistics summary
 * Follows TeacherStatsCard / SubjectStatsCard pattern
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Building, GraduationCap, Hash, Layers, TrendingUp, User, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassGroup, ClassStats } from '../types';
import { isGradeInCategory } from '../utils/gradeCategory';

export interface ClassStatsCardProps {
  classes: ClassGroup[];
  selectedCount: number;
  className?: string;
}

function calculateStats(classes: ClassGroup[]): ClassStats {
  let alphaPrimary = 0;
  let betaPrimary = 0;
  let middle = 0;
  let high = 0;
  let singleTeacherMode = 0;
  let totalStudents = 0;
  let withFixedRoom = 0;

  classes.forEach((classGroup) => {
    // Count by grade category
    if (isGradeInCategory(classGroup.grade, 'alphaPrimary')) {
      alphaPrimary++;
    } else if (isGradeInCategory(classGroup.grade, 'betaPrimary')) {
      betaPrimary++;
    } else if (isGradeInCategory(classGroup.grade, 'middle')) {
      middle++;
    } else if (isGradeInCategory(classGroup.grade, 'high')) {
      high++;
    }

    // Count single-teacher mode
    if (classGroup.singleTeacherMode) {
      singleTeacherMode++;
    }

    // Sum students
    totalStudents += classGroup.studentCount || 0;

    // Count with fixed room
    if (classGroup.fixedRoomId !== null) {
      withFixedRoom++;
    }
  });

  return {
    total: classes.length,
    alphaPrimary,
    betaPrimary,
    middle,
    high,
    singleTeacherMode,
    totalStudents,
    withFixedRoom,
    avgStudentsPerClass: classes.length > 0 ? Math.round(totalStudents / classes.length) : 0,
  };
}

export function ClassStatsCard({ classes, selectedCount, className }: ClassStatsCardProps) {
  const { t } = useTranslation();
  const stats = useMemo(() => calculateStats(classes), [classes]);

  return (
    <div className={cn('h-full overflow-auto p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">{t('classes.stats.summary', 'خلاصه آمار')}</span>
        </div>
        {selectedCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            {selectedCount} {t('common.selected', 'انتخاب شده')}
          </Badge>
        )}
      </div>

      {/* Total Classes */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('classes.stats.totalClasses', 'کل صنف‌ها')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Total Students */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('classes.stats.totalStudents', 'مجموع شاگردان')}
            </p>
            <p className="text-2xl font-bold text-emerald-700">{stats.totalStudents}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs bg-gray-100">
          ~{stats.avgStudentsPerClass} {t('classes.stats.avgPerClass', 'نفر/صنف')}
        </Badge>
      </div>

      {/* Single Teacher Mode */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <User className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('classes.stats.singleTeacher', 'معلم واحد')}</p>
            <p className="text-2xl font-bold text-violet-700">{stats.singleTeacherMode}</p>
          </div>
        </div>
      </div>

      {/* With Fixed Room */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Building className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('classes.stats.withFixedRoom', 'دارای اتاق ثابت')}
            </p>
            <p className="text-2xl font-bold text-amber-700">{stats.withFixedRoom}</p>
          </div>
        </div>
      </div>

      {/* Grade Category Breakdown */}
      <div className="p-3 bg-slate-700 rounded-lg text-white">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-slate-300" />
          <p className="text-xs text-slate-300">
            {t('classes.stats.byGrade', 'بر اساس مقطع تحصیلی')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('classes.filters.alphaPrimary', 'ابتدایی الف')}</span>
            <span className="font-bold">{stats.alphaPrimary}</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('classes.filters.betaPrimary', 'ابتدایی ب')}</span>
            <span className="font-bold">{stats.betaPrimary}</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('classes.filters.middle', 'متوسطه')}</span>
            <span className="font-bold">{stats.middle}</span>
          </div>
          <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5">
            <span className="text-xs">{t('classes.filters.high', 'لیسه')}</span>
            <span className="font-bold">{stats.high}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Hash className="h-3 w-3 me-1" />
          {stats.total} {t('classes.stats.classes', 'صنف')}
        </Badge>
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Users className="h-3 w-3 me-1" />
          {stats.totalStudents} {t('classes.stats.students', 'شاگرد')}
        </Badge>
      </div>
    </div>
  );
}

export default ClassStatsCard;
