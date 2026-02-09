/**
 * SubjectCoverageView Component
 *
 * Displays coverage analysis for a subject showing which classes
 * require it and their assignment status. Includes teacher compatibility
 * information and quick-assign functionality.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClassCoverageDetail,
  CoverageStatus,
  TeacherCompatibility,
} from '../../assignments/types';
import type { Subject } from '../types';

export interface SubjectCoverageViewProps {
  subject: Subject;
  classesRequiring: ClassCoverageDetail[];
  compatibleTeachers: TeacherCompatibility[];
  coveragePercentage: number;
  status: CoverageStatus;
  assignedCount: number;
  unassignedCount: number;
  totalClasses: number;
  isLoading?: boolean;
  onQuickAssign?: (classId: number, teacherId: number) => void;
  isAssigning?: boolean;
  className?: string;
}

/**
 * Get status color classes based on coverage status
 */
function getStatusColors(status: CoverageStatus): {
  bg: string;
  text: string;
  border: string;
  progress: string;
} {
  switch (status) {
    case 'complete':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        progress: 'bg-emerald-500',
      };
    case 'partial':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        progress: 'bg-amber-500',
      };
    case 'uncovered':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        progress: 'bg-red-500',
      };
  }
}

/**
 * Get status icon based on coverage status
 */
function StatusIcon({ status }: { status: CoverageStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case 'partial':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    case 'uncovered':
      return <XCircle className="h-4 w-4 text-red-600" />;
  }
}

/**
 * Class coverage item component
 */
function ClassCoverageItem({
  classDetail,
  compatibleTeachers,
  onQuickAssign,
  isAssigning,
}: {
  classDetail: ClassCoverageDetail;
  compatibleTeachers: TeacherCompatibility[];
  onQuickAssign?: (classId: number, teacherId: number) => void;
  isAssigning?: boolean;
}) {
  const { t } = useTranslation();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const isAssigned = classDetail.assignmentStatus === 'assigned';

  const handleAssign = () => {
    if (selectedTeacherId && onQuickAssign) {
      onQuickAssign(classDetail.classId, parseInt(selectedTeacherId, 10));
      setSelectedTeacherId('');
    }
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors',
        isAssigned
          ? 'bg-emerald-50/50 border-emerald-200'
          : 'bg-slate-50 border-slate-200 hover:border-violet-300'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('p-1.5 rounded-md', isAssigned ? 'bg-emerald-100' : 'bg-slate-200')}>
            <GraduationCap
              className={cn('h-3.5 w-3.5', isAssigned ? 'text-emerald-600' : 'text-slate-500')}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{classDetail.className}</p>
            <p className="text-xs text-slate-500">
              {classDetail.periodsPerWeek} {t('subjects.coverage.periodsPerWeek', 'ساعت در هفته')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAssigned ? (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"
            >
              <UserCheck className="h-3 w-3 me-1" />
              {classDetail.assignedTeacherName}
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={selectedTeacherId}
                onValueChange={setSelectedTeacherId}
                disabled={isAssigning}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs border-slate-200">
                  <SelectValue placeholder={t('subjects.coverage.selectTeacher', 'انتخاب معلم')} />
                </SelectTrigger>
                <SelectContent>
                  {compatibleTeachers
                    .filter((t) => t.canAcceptAssignment)
                    .map((teacher) => (
                      <SelectItem
                        key={teacher.teacherId}
                        value={teacher.teacherId.toString()}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span>{teacher.teacherName}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1 py-0',
                              teacher.compatibility === 'primary'
                                ? 'border-violet-300 text-violet-600'
                                : 'border-slate-300 text-slate-500'
                            )}
                          >
                            {teacher.compatibility === 'primary'
                              ? t('subjects.coverage.primary', 'اصلی')
                              : t('subjects.coverage.allowed', 'مجاز')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  {compatibleTeachers.filter((t) => t.canAcceptAssignment).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      {t('subjects.coverage.noAvailableTeachers', 'معلم در دسترس نیست')}
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAssign}
                disabled={!selectedTeacherId || isAssigning}
                className="h-8 px-2 text-xs border-violet-300 text-violet-600 hover:bg-violet-50"
              >
                {isAssigning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <UserPlus className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Teacher compatibility list component
 */
function TeacherCompatibilityList({
  teachers,
  isExpanded,
  onToggle,
}: {
  teachers: TeacherCompatibility[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  if (teachers.length === 0) {
    return (
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-700">
          {t('subjects.coverage.noCompatibleTeachers', 'هیچ معلم مناسبی برای این مضمون یافت نشد')}
        </p>
      </div>
    );
  }

  const displayTeachers = isExpanded ? teachers : teachers.slice(0, 3);

  return (
    <div className="space-y-2">
      {displayTeachers.map((teacher) => (
        <div
          key={teacher.teacherId}
          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded-md',
                teacher.compatibility === 'primary' ? 'bg-violet-100' : 'bg-slate-100'
              )}
            >
              <Users
                className={cn(
                  'h-3.5 w-3.5',
                  teacher.compatibility === 'primary' ? 'text-violet-600' : 'text-slate-500'
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{teacher.teacherName}</p>
              <p className="text-xs text-slate-500">
                {teacher.currentWorkload}/{teacher.maxWorkload}{' '}
                {t('subjects.coverage.periods', 'ساعت')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                teacher.compatibility === 'primary'
                  ? 'border-violet-300 text-violet-600'
                  : 'border-slate-300 text-slate-500'
              )}
            >
              {teacher.compatibility === 'primary'
                ? t('subjects.coverage.primary', 'اصلی')
                : t('subjects.coverage.allowed', 'مجاز')}
            </Badge>
            {teacher.canAcceptAssignment ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                {t('subjects.coverage.available', 'در دسترس')}
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                {t('subjects.coverage.full', 'پر')}
              </Badge>
            )}
          </div>
        </div>
      ))}

      {teachers.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full text-xs text-slate-500 hover:text-slate-700"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 me-1" />
              {t('subjects.coverage.showLess', 'نمایش کمتر')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 me-1" />
              {t('subjects.coverage.showMore', 'نمایش بیشتر')} ({teachers.length - 3})
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export function SubjectCoverageView({
  subject,
  classesRequiring,
  compatibleTeachers,
  coveragePercentage,
  status,
  assignedCount,
  unassignedCount,
  totalClasses,
  isLoading = false,
  onQuickAssign,
  isAssigning = false,
  className,
}: SubjectCoverageViewProps) {
  const { t } = useTranslation();
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const statusColors = getStatusColors(status);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Coverage Summary */}
      <div className={cn('p-4 rounded-lg border', statusColors.bg, statusColors.border)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <h4 className={cn('font-medium text-sm', statusColors.text)}>
              {status === 'complete' && t('subjects.coverage.complete', 'پوشش کامل')}
              {status === 'partial' && t('subjects.coverage.partial', 'پوشش ناقص')}
              {status === 'uncovered' && t('subjects.coverage.uncovered', 'بدون پوشش')}
            </h4>
          </div>
          <Badge
            variant="outline"
            className={cn('text-xs', statusColors.text, statusColors.border)}
          >
            {coveragePercentage}%
          </Badge>
        </div>

        <Progress value={coveragePercentage} className="h-2 mb-3" />

        <div className="flex items-center justify-between text-xs">
          <span className={statusColors.text}>
            {assignedCount} {t('subjects.coverage.assigned', 'تخصیص یافته')} / {totalClasses}{' '}
            {t('subjects.coverage.total', 'کل')}
          </span>
          {unassignedCount > 0 && (
            <span className="text-amber-600">
              {unassignedCount} {t('subjects.coverage.needsAssignment', 'نیاز به تخصیص')}
            </span>
          )}
        </div>
      </div>

      {/* Classes Requiring This Subject */}
      {totalClasses > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-violet-600" />
            {t('subjects.coverage.classesRequiring', 'صنف‌های نیازمند این مضمون')}
            <Badge variant="secondary" className="text-xs">
              {totalClasses}
            </Badge>
          </h4>

          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2 pe-2">
              {classesRequiring.map((classDetail) => (
                <ClassCoverageItem
                  key={classDetail.classId}
                  classDetail={classDetail}
                  compatibleTeachers={compatibleTeachers}
                  onQuickAssign={onQuickAssign}
                  isAssigning={isAssigning}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
          <GraduationCap className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {t('subjects.coverage.noClassesRequire', 'هیچ صنفی این مضمون را در برنامه ندارد')}
          </p>
        </div>
      )}

      {/* Compatible Teachers */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" />
          {t('subjects.coverage.compatibleTeachers', 'معلمان مناسب')}
          <Badge variant="secondary" className="text-xs">
            {compatibleTeachers.length}
          </Badge>
        </h4>

        <TeacherCompatibilityList
          teachers={compatibleTeachers}
          isExpanded={showAllTeachers}
          onToggle={() => setShowAllTeachers(!showAllTeachers)}
        />
      </div>
    </div>
  );
}

export default SubjectCoverageView;
