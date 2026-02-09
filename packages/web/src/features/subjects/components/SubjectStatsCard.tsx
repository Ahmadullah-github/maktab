/**
 * SubjectStatsCard Component
 *
 * Stats sidebar showing subject statistics summary
 * Matches TeacherStatsCard pattern
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Hash,
  Layers,
  School,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Subject } from '../types';

export interface SubjectStatsCardProps {
  subjects: Subject[];
  selectedCount: number;
  className?: string;
}

interface SubjectStats {
  total: number;
  primary: number;
  middle: number;
  high: number;
  difficult: number;
  withRoomRequirement: number;
}

function calculateStats(subjects: Subject[]): SubjectStats {
  let primary = 0;
  let middle = 0;
  let high = 0;
  let difficult = 0;
  let withRoomRequirement = 0;

  subjects.forEach((subject) => {
    // Case-insensitive section matching
    const normalizedSection = subject.section?.toUpperCase() || '';
    if (normalizedSection === 'PRIMARY') primary++;
    else if (normalizedSection === 'MIDDLE') middle++;
    else if (normalizedSection === 'HIGH') high++;

    if (subject.isDifficult) difficult++;
    if (
      subject.requiredRoomType &&
      subject.requiredRoomType !== 'normal' &&
      subject.requiredRoomType !== ''
    ) {
      withRoomRequirement++;
    }
  });

  return {
    total: subjects.length,
    primary,
    middle,
    high,
    difficult,
    withRoomRequirement,
  };
}

export function SubjectStatsCard({ subjects, selectedCount, className }: SubjectStatsCardProps) {
  const { t } = useTranslation();
  const stats = useMemo(() => calculateStats(subjects), [subjects]);

  return (
    <div className={cn('h-full overflow-auto p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">{t('subjects.stats.title', 'خلاصه آمار')}</span>
        </div>
        {selectedCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            {selectedCount} {t('common.selected', 'انتخاب شده')}
          </Badge>
        )}
      </div>

      {/* Total Subjects */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <BookOpen className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('subjects.stats.total', 'مجموع مضامین')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Difficult Subjects */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('subjects.stats.difficult', 'مضامین دشوار')}</p>
            <p className="text-2xl font-bold text-amber-700">{stats.difficult}</p>
          </div>
        </div>
      </div>

      {/* Special Room Requirements */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <School className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('subjects.stats.specialRoom', 'نیاز به اتاق خاص')}
            </p>
            <p className="text-2xl font-bold text-emerald-700">{stats.withRoomRequirement}</p>
          </div>
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="p-3 bg-slate-700 rounded-lg text-white">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-slate-300" />
          <p className="text-xs text-slate-300">{t('subjects.stats.bySection', 'بر اساس مقطع')}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center bg-white/10 rounded px-2 py-1.5">
            <span className="text-[10px] text-amber-300">
              {t('subjects.section.primary', 'ابتدایی')}
            </span>
            <span className="font-bold">{stats.primary}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded px-2 py-1.5">
            <span className="text-[10px] text-blue-300">
              {t('subjects.section.middle', 'متوسطه')}
            </span>
            <span className="font-bold">{stats.middle}</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 rounded px-2 py-1.5">
            <span className="text-[10px] text-purple-300">
              {t('subjects.section.high', 'لیسه')}
            </span>
            <span className="font-bold">{stats.high}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Hash className="h-3 w-3 me-1" />
          {stats.total} {t('subjects.stats.subjectCount', 'مضمون')}
        </Badge>
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <GraduationCap className="h-3 w-3 me-1" />
          {stats.primary + stats.middle + stats.high} {t('subjects.stats.sections', 'مقطع')}
        </Badge>
      </div>
    </div>
  );
}

export default SubjectStatsCard;
