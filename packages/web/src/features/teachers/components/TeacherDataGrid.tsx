/**
 * TeacherDataGrid Component
 *
 * DataGrid for displaying teachers with:
 * - Checkbox selection for bulk operations
 * - Row click to open edit drawer
 * - Status badges
 * - Expert subjects display
 * - Class assignments with periods
 * - Compact mode when drawer is open
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BookOpen, GraduationCap, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClasses } from '../../classes/hooks/useClasses';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Teacher } from '../types';
import { ensureArray } from '../utils/serialization';
import { AssignmentBadgesCell } from './AssignmentBadgesCell';
import { useTeacherWorkloadViews } from '@/features/assignments/projections';

// Types for display (compatible with AssignmentBadgesCell)
interface Subject {
  id: number;
  name: string;
  periodsPerWeek?: number;
  isDeleted?: boolean;
}

interface Class {
  id: number;
  name: string;
  grade?: number;
  isDeleted?: boolean;
}

export interface TeacherDataGridProps {
  teachers: Teacher[];
  selectedId: number | null;
  selectedIds: Set<number>;
  onSelect: (teacher: Teacher) => void;
  onToggleSelect: (teacherId: number) => void;
  onToggleSelectAll: () => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
  isDeleting?: boolean;
  maxPeriodsPerWeek?: number;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
  /** Callback when assignment add button is clicked - opens drawer to assignments tab */
  onAssignmentClick?: (teacher: Teacher) => void;
}

function StatusBadge({ isFullTime }: { isFullTime: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        isFullTime
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
      )}
    >
      {isFullTime
        ? t('teachers.filterFullTime', 'تمام وقت')
        : t('teachers.filterPartTime', 'نیمه وقت')}
    </span>
  );
}

export function TeacherDataGrid({
  teachers,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteTeacher,
  isDeleting = false,
  maxPeriodsPerWeek = 42,
  isLoading = false,
  compact = false,
  className,
  onAssignmentClick,
}: TeacherDataGridProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  // Fetch subjects and classes for name lookups - using shared hooks for real-time updates
  const { data: allSubjects = [] } = useSubjects();
  const { data: allClasses = [] } = useClasses();
  const workloadViews = useTeacherWorkloadViews(teachers.map((teacher) => teacher.id));

  // Filter out deleted items and normalize types for AssignmentBadgesCell compatibility
  const subjects = useMemo(
    () =>
      allSubjects
        .filter((s) => !s.isDeleted)
        .map((s) => ({
          id: s.id,
          name: s.name,
          periodsPerWeek: s.periodsPerWeek ?? undefined,
          isDeleted: s.isDeleted,
        })),
    [allSubjects]
  );
  const classes = useMemo(
    () =>
      allClasses
        .filter((c) => !c.isDeleted)
        .map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade ?? undefined,
          isDeleted: c.isDeleted,
        })),
    [allClasses]
  );

  // Create lookup maps
  const subjectMap = useMemo(() => {
    const map = new Map<number, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const classMap = useMemo(() => {
    const map = new Map<number, Class>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  const handleRowClick = useCallback(
    (teacher: Teacher, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-checkbox]')) {
        return;
      }
      onSelect(teacher);
    },
    [onSelect]
  );

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, teacher: Teacher) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(teacher);
      }
    },
    [onSelect]
  );

  const handleConfirmDelete = () => {
    if (deleteTarget && onDeleteTeacher) {
      onDeleteTeacher(deleteTarget);
    }
    setDeleteTarget(null);
  };

  // Get expert subject names
  const getExpertSubjects = (teacher: Teacher): string[] => {
    const ids = ensureArray<number>(teacher.primarySubjectIds);
    return ids.map((id) => subjectMap.get(id)?.name).filter((name): name is string => !!name);
  };

  const visibleSelectedCount = teachers.reduce(
    (count, teacher) => count + (selectedIds.has(teacher.id) ? 1 : 0),
    0
  );
  const allSelected = teachers.length > 0 && visibleSelectedCount === teachers.length;
  const someSelected = visibleSelectedCount > 0 && !allSelected;

  // Empty state
  if (!isLoading && teachers.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-64 text-muted-foreground bg-white',
          className
        )}
      >
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('teachers.noTeachers')}</p>
        <p className="text-sm">{t('teachers.addOne')}</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('flex flex-col h-full overflow-hidden bg-white', className)}>
        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b text-xs text-muted-foreground">
                <th className="w-12 p-3 border-e bg-gray-50" data-checkbox>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                    aria-label={t('common.selectAll')}
                    className={cn(someSelected && 'data-[state=checked]:bg-primary/50')}
                    {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                  />
                </th>
                {!compact && (
                  <th className="w-10 p-3 border-e bg-gray-50 text-center font-semibold">#</th>
                )}
                <th className="p-3 border-e bg-gray-50 text-start font-semibold min-w-[140px]">
                  {t('common.fullName', 'نام کامل')}
                </th>
                <th className="w-24 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('teachers.status.label', 'وضعیت')}
                </th>
                {!compact && (
                  <th className="p-3 border-e bg-gray-50 text-start font-semibold min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                      {t('teachers.expertSubjects', 'تخصص')}
                    </div>
                  </th>
                )}
                {!compact && (
                  <th className="p-3 border-e bg-gray-50 text-start font-semibold min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                      {t('teachers.classAssignments', 'صنف‌های اختصاص داده شده')}
                    </div>
                  </th>
                )}
                <th className="w-24 p-3 bg-gray-50 text-center font-semibold">
                  {t('teachers.availablePeriods', 'در دسترس')}
                </th>
                {onDeleteTeacher && <th className="w-14 bg-gray-50" />}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {teachers.map((teacher, index) => {
                const isSelected = selectedId === teacher.id;
                const isChecked = selectedIds.has(teacher.id);
                const isFullTime = teacher.employmentType === 'full_time';
                const expertSubjects = getExpertSubjects(teacher);
                const unavailableCount = new Set(
                  (teacher.unavailable ?? []).map((slot) => `${slot.day}:${slot.period}`)
                ).size;
                const availablePeriods = Math.max(
                  0,
                  Math.min(teacher.maxPeriodsPerWeek, maxPeriodsPerWeek - unavailableCount)
                );

                return (
                  <tr
                    key={teacher.id}
                    className={cn(
                      'border-b last:border-b-0 cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50',
                      isChecked && !isSelected && 'bg-primary/5'
                    )}
                    onClick={(e) => handleRowClick(teacher, e)}
                    onKeyDown={(e) => handleKeyDown(e, teacher)}
                    tabIndex={0}
                    aria-selected={isSelected}
                  >
                    {/* Checkbox */}
                    <td
                      className={cn(
                        'w-12 p-3 border-e text-center',
                        isSelected && 'border-s-4 border-s-blue-500'
                      )}
                      data-checkbox
                      onClick={handleCheckboxClick}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onToggleSelect(teacher.id)}
                        aria-label={t('common.select')}
                      />
                    </td>

                    {/* Row number */}
                    {!compact && (
                      <td className="w-10 p-3 border-e text-center text-xs text-muted-foreground">
                        {index + 1}
                      </td>
                    )}

                    {/* Name */}
                    <td className="p-3 border-e">
                      <span className="font-medium text-gray-900">{teacher.fullName}</span>
                      {compact && expertSubjects.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {expertSubjects.slice(0, 2).join('، ')}
                          {expertSubjects.length > 2 && ` +${expertSubjects.length - 2}`}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="w-24 p-3 border-e text-center">
                      <StatusBadge isFullTime={isFullTime} />
                    </td>

                    {/* Expert Subjects */}
                    {!compact && (
                      <td className="p-3 border-e">
                        {expertSubjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {expertSubjects.slice(0, 2).map((name, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 bg-violet-50 text-violet-700 border border-violet-200"
                              >
                                {name}
                              </Badge>
                            ))}
                            {expertSubjects.length > 2 && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-5 cursor-help"
                                    >
                                      +{expertSubjects.length - 2}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px]">
                                    <p className="text-xs">{expertSubjects.slice(2).join('، ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}

                    {/* Class Assignments - Using AssignmentBadgesCell */}
                    {!compact && (
                      <td className="p-3 border-e">
                        <AssignmentBadgesCell
                          teacher={teacher}
                          subjectMap={subjectMap}
                          classMap={classMap}
                          maxDisplay={3}
                          onBadgeClick={(t) => onAssignmentClick?.(t)}
                          onAddClick={(t) => onAssignmentClick?.(t)}
                          compact={false}
                          workloadView={workloadViews.workloadByTeacherId.get(teacher.id)}
                          isLoading={workloadViews.isLoading}
                          error={workloadViews.error}
                        />
                      </td>
                    )}

                    {/* Available Periods */}
                    <td className="w-24 p-3 text-center">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              <span className="text-sm font-medium text-gray-700">
                                {availablePeriods}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                /{maxPeriodsPerWeek}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="text-xs space-y-1">
                              <div>
                                {t('teachers.totalSlots', 'کل ساعات')}: {maxPeriodsPerWeek}
                              </div>
                              <div>
                                {t('teachers.unavailableSlots', 'غیرفعال')}:{' '}
                                {unavailableCount}
                              </div>
                              <div className="font-medium border-t pt-1">
                                {t('teachers.availableSlots', 'در دسترس')}:{' '}
                                {availablePeriods}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    {onDeleteTeacher && (
                      <td className="w-14 p-2 text-center" data-checkbox>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label={t('common.delete')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(teacher);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-gray-50 flex justify-between items-center shrink-0">
          <span>{t('teachers.activeCount', { count: teachers.length })}</span>
          {selectedIds.size > 0 && (
            <span className="text-primary font-medium">
              {selectedIds.size} {t('common.selected', 'انتخاب شده')}
            </span>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>{t('teachers.deleteConfirmation')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TeacherDataGrid;
