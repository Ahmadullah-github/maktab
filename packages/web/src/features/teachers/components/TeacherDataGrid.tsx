/**
 * TeacherDataGrid Component
 *
 * DataGrid wrapper for displaying and managing teachers
 * Supports row selection, filtering, and delete actions
 *
 * Requirements: 1.1, 1.4, 1.5, 1.6
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Teacher } from '../types';
import { HoursIndicator } from './ui/HoursIndicator';
import { StatusBadge } from './ui/StatusBadge';

export interface TeacherDataGridProps {
  /** Array of teachers to display */
  teachers: Teacher[];
  /** Currently selected teacher ID */
  selectedTeacherId?: number | null;
  /** Callback when a teacher row is selected */
  onSelectTeacher?: (teacher: Teacher) => void;
  /** Callback when delete is confirmed */
  onDeleteTeacher?: (teacher: Teacher) => void;
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
  /** Maximum periods per week from SchoolConfig (for hours indicator) */
  maxPeriodsPerWeek?: number;
}

/**
 * TeacherDataGrid displays teachers in a table format with selection and actions
 */
export function TeacherDataGrid({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
  onDeleteTeacher,
  isDeleting = false,
  maxPeriodsPerWeek = 42,
}: TeacherDataGridProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  const handleRowClick = (teacher: Teacher) => {
    onSelectTeacher?.(teacher);
  };

  const handleDeleteClick = (e: React.MouseEvent, teacher: Teacher) => {
    e.stopPropagation();
    setDeleteTarget(teacher);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget && onDeleteTeacher) {
      onDeleteTeacher(deleteTarget);
    }
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  /**
   * Calculate total subject count (primary + allowed)
   */
  const getSubjectCount = (teacher: Teacher): number => {
    const primaryCount = teacher.primarySubjectIds?.length || 0;
    const allowedCount = teacher.restrictToPrimarySubjects
      ? 0
      : teacher.allowedSubjectIds?.length || 0;
    return primaryCount + allowedCount;
  };

  /**
   * Determine if teacher is active (not deleted)
   */
  const isTeacherActive = (teacher: Teacher): boolean => {
    return !teacher.isDeleted;
  };

  // Empty state
  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>{t('teachers.noTeachers')}</p>
        <p className="text-sm mt-2">{t('teachers.addOne')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full border rounded-md overflow-hidden bg-background">
        {/* Header */}
        <div className="flex border-b bg-muted/40 font-medium text-xs text-muted-foreground">
          <div className="w-10 border-e flex items-center justify-center shrink-0">#</div>
          <div className="flex-1 min-w-[150px] px-3 py-2 border-e">{t('common.fullName')}</div>
          <div className="w-24 px-3 py-2 border-e text-center">
            {t('teachers.status.filledHours')}
          </div>
          <div className="w-20 px-3 py-2 border-e text-center">{t('teachers.subjects')}</div>
          <div className="w-28 px-3 py-2 border-e text-center">{t('common.hoursPerWeek')}</div>
          <div className="w-16 px-3 py-2 text-center">{t('common.actions')}</div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {teachers.map((teacher, index) => (
            <div
              key={teacher.id}
              className={cn(
                'flex border-b last:border-b-0 cursor-pointer transition-colors',
                selectedTeacherId === teacher.id
                  ? 'bg-primary/10 hover:bg-primary/15'
                  : 'hover:bg-muted/50'
              )}
              onClick={() => handleRowClick(teacher)}
              role="row"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(teacher);
                }
              }}
            >
              {/* Row number */}
              <div className="w-10 border-e flex items-center justify-center shrink-0 text-xs text-muted-foreground bg-muted/10">
                {index + 1}
              </div>

              {/* Full Name */}
              <div className="flex-1 min-w-[150px] px-3 py-2 border-e flex items-center gap-2">
                <span className="truncate font-medium">{teacher.fullName}</span>
              </div>

              {/* Status Badge */}
              <div className="w-24 px-3 py-2 border-e flex items-center justify-center">
                <StatusBadge isActive={isTeacherActive(teacher)} size="sm" />
              </div>

              {/* Subject Count */}
              <div className="w-20 px-3 py-2 border-e text-center text-sm">
                {getSubjectCount(teacher)}
              </div>

              {/* Hours per Week */}
              <div className="w-28 px-2 py-2 border-e flex items-center justify-center">
                <HoursIndicator
                  filledHours={teacher.maxPeriodsPerWeek}
                  maxHours={maxPeriodsPerWeek}
                  size="sm"
                  showProgressBar={false}
                />
              </div>

              {/* Actions */}
              <div className="w-16 px-2 py-1 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteClick(e, teacher)}
                  disabled={isDeleting}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20 flex justify-between">
          <span>{t('teachers.activeCount', { count: teachers.length })}</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && handleCancelDelete()}
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
