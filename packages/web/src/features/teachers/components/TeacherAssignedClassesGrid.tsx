/**
 * TeacherAssignedClassesGrid Component
 *
 * Visual grid of assigned classes with remove capability.
 * Shows class cards grouped by subject with period info.
 *
 * Phase 2.1 of Teacher Assignment System
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BookOpen, GraduationCap, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClasses } from '../../classes/hooks/useClasses';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { ClassAssignment, Teacher } from '../types';
import { ensureArray } from '../utils/serialization';

/**
 * Subject info for display
 */
interface SubjectInfo {
  id: number;
  name: string;
  periodsPerWeek?: number | null;
}

/**
 * Class info for display
 */
interface ClassInfo {
  id: number;
  name: string;
  grade?: number | null;
}

/**
 * Grouped assignment for display
 */
interface GroupedAssignment {
  subjectId: number;
  subjectName: string;
  classes: {
    classId: number;
    className: string;
    grade: number | null;
    periods: number;
  }[];
  totalPeriods: number;
}

export interface TeacherAssignedClassesGridProps {
  /** The teacher whose assignments to display */
  teacher: Teacher;
  /** Callback when an assignment is removed */
  onRemove: (subjectId: number, classId: number) => void;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TeacherAssignedClassesGrid displays assigned classes in a visual grid
 */
export function TeacherAssignedClassesGrid({
  teacher,
  onRemove,
  isUpdating = false,
  className,
}: TeacherAssignedClassesGridProps) {
  const { t } = useTranslation();
  // Fetch data using shared hooks for real-time updates
  const { data: allSubjects = [] } = useSubjects();
  const { data: allClasses = [] } = useClasses();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Filter out deleted items
  const subjects = useMemo(
    () => allSubjects.filter((s) => !(s as { isDeleted?: boolean }).isDeleted),
    [allSubjects]
  );
  const classes = useMemo(
    () => allClasses.filter((c) => !(c as { isDeleted?: boolean }).isDeleted),
    [allClasses]
  );

  // Create lookup maps
  const subjectMap = useMemo(() => {
    const map = new Map<number, SubjectInfo>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map = new Map<number, ClassInfo>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Group assignments by subject
  const groupedAssignments = useMemo((): GroupedAssignment[] => {
    const classAssignments = ensureArray<ClassAssignment>(teacher.classAssignments);
    const groups: GroupedAssignment[] = [];

    classAssignments.forEach((assignment) => {
      const subject = subjectMap.get(assignment.subjectId);
      if (!subject) return;

      const classIds = ensureArray<number>(assignment.classIds);
      const classItems = classIds
        .map((classId) => {
          const cls = classMap.get(classId);
          if (!cls) return null;
          return {
            classId,
            className: cls.name,
            grade: cls.grade ?? null,
            periods: subject.periodsPerWeek ?? 0,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (classItems.length > 0) {
        groups.push({
          subjectId: assignment.subjectId,
          subjectName: subject.name,
          classes: classItems,
          totalPeriods: classItems.reduce((sum, c) => sum + c.periods, 0),
        });
      }
    });

    return groups;
  }, [teacher.classAssignments, subjectMap, classMap]);

  // Calculate total periods
  const totalPeriods = useMemo(() => {
    return groupedAssignments.reduce((sum, g) => sum + g.totalPeriods, 0);
  }, [groupedAssignments]);

  // Handle remove click
  const handleRemove = async (subjectId: number, classId: number) => {
    const key = `${subjectId}-${classId}`;
    setRemovingId(key);
    try {
      await onRemove(subjectId, classId);
    } finally {
      setRemovingId(null);
    }
  };

  // Empty state
  if (groupedAssignments.length === 0) {
    return (
      <div
        className={cn('p-4 bg-white rounded-lg border-2 border-dashed border-slate-200', className)}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <GraduationCap className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {t('teachers.assignments.noAssignments', 'هیچ تخصیصی وجود ندارد')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'teachers.assignments.addAssignmentHint',
              'از فرم زیر برای افزودن تخصیص استفاده کنید'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-600" />
          <h3 className="font-medium text-sm text-slate-800">
            {t('teachers.assignments.assignedClasses', 'صنف‌های تخصیص یافته')}
          </h3>
        </div>
        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          {totalPeriods} {t('common.periodsShort', 'ساعت')}
        </Badge>
      </div>

      {/* Grouped assignments */}
      <div className="space-y-4">
        {groupedAssignments.map((group) => (
          <div
            key={group.subjectId}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden"
          >
            {/* Subject header */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-sm font-medium text-slate-700">{group.subjectName}</span>
              </div>
              <span className="text-xs text-slate-500">
                {group.classes.length} {t('teachers.assignments.classes', 'صنف')} •{' '}
                {group.totalPeriods} {t('common.periodsShort', 'ساعت')}
              </span>
            </div>

            {/* Class cards */}
            <div className="p-2 flex flex-wrap gap-2">
              {group.classes.map((cls) => {
                const key = `${group.subjectId}-${cls.classId}`;
                const isRemoving = removingId === key;

                return (
                  <div
                    key={cls.classId}
                    className={cn(
                      'group relative flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                      'bg-blue-50/50 border-blue-200 hover:bg-blue-100/50',
                      isRemoving && 'opacity-50'
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{cls.className}</span>
                      <span className="text-[10px] text-slate-500">
                        {cls.periods} {t('common.periodsShort', 'ساعت')}
                      </span>
                    </div>

                    {/* Remove button */}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(group.subjectId, cls.classId)}
                            disabled={isUpdating || isRemoving}
                            className={cn(
                              'h-5 w-5 p-0 rounded-full',
                              'opacity-0 group-hover:opacity-100 transition-opacity',
                              'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            )}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="text-xs">
                            {t('teachers.assignments.removeAssignment', 'حذف تخصیص')}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeacherAssignedClassesGrid;
