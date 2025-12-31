/**
 * ClassDataGrid Component
 *
 * DataGrid wrapper for displaying and managing classes
 * Supports row selection, filtering, and delete actions
 *
 * Requirements: 1.1, 1.4, 4.1, 4.2, 4.3, 4.4
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
import type { ClassGroup } from '../types';
import { GradeBadge } from './ui/GradeBadge';
import { SingleTeacherBadge } from './ui/SingleTeacherBadge';

export interface ClassDataGridProps {
  /** Array of classes to display */
  classes: ClassGroup[];
  /** Currently selected class ID */
  selectedClassId?: number | null;
  /** Callback when a class row is selected */
  onSelectClass?: (classGroup: ClassGroup) => void;
  /** Callback when delete is confirmed */
  onDeleteClass?: (classGroup: ClassGroup) => void;
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
  /** Map of teacher IDs to names for display */
  teacherMap?: Map<number, string>;
  /** Map of room IDs to names for display */
  roomMap?: Map<number, string>;
}

/**
 * ClassDataGrid displays classes in a table format with selection and actions
 */
export function ClassDataGrid({
  classes,
  selectedClassId,
  onSelectClass,
  onDeleteClass,
  isDeleting = false,
  teacherMap = new Map(),
  roomMap = new Map(),
}: ClassDataGridProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<ClassGroup | null>(null);

  const handleRowClick = (classGroup: ClassGroup) => {
    onSelectClass?.(classGroup);
  };

  const handleDeleteClick = (e: React.MouseEvent, classGroup: ClassGroup) => {
    e.stopPropagation();
    setDeleteTarget(classGroup);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget && onDeleteClass) {
      onDeleteClass(deleteTarget);
    }
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const getTeacherName = (teacherId: number | null): string => {
    if (!teacherId) return '—';
    return teacherMap.get(teacherId) || `#${teacherId}`;
  };

  const getRoomName = (roomId: number | null): string => {
    if (!roomId) return '—';
    return roomMap.get(roomId) || `#${roomId}`;
  };

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>{t('classes.noClasses')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full border rounded-md overflow-hidden bg-background">
        {/* Header */}
        <div className="flex border-b bg-muted/40 font-medium text-xs text-muted-foreground">
          <div className="w-10 border-e flex items-center justify-center shrink-0">#</div>
          <div className="flex-1 min-w-[120px] px-3 py-2 border-e">{t('classes.form.name')}</div>
          <div className="w-20 px-3 py-2 border-e text-center">{t('classes.form.grade')}</div>
          <div className="w-16 px-3 py-2 border-e text-center">
            {t('classes.form.sectionIndex')}
          </div>
          <div className="w-24 px-3 py-2 border-e text-center">
            {t('classes.form.studentCount')}
          </div>
          <div className="flex-1 min-w-[100px] px-3 py-2 border-e">
            {t('classes.form.classTeacher')}
          </div>
          <div className="flex-1 min-w-[100px] px-3 py-2 border-e">
            {t('classes.form.fixedRoom')}
          </div>
          <div className="w-16 px-3 py-2 text-center">{t('common.actions')}</div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {classes.map((classGroup, index) => (
            <div
              key={classGroup.id}
              className={cn(
                'flex border-b last:border-b-0 cursor-pointer transition-colors',
                selectedClassId === classGroup.id
                  ? 'bg-primary/10 hover:bg-primary/15'
                  : 'hover:bg-muted/50'
              )}
              onClick={() => handleRowClick(classGroup)}
              role="row"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(classGroup);
                }
              }}
            >
              {/* Row number */}
              <div className="w-10 border-e flex items-center justify-center shrink-0 text-xs text-muted-foreground bg-muted/10">
                {index + 1}
              </div>

              {/* Name with single-teacher badge */}
              <div className="flex-1 min-w-[120px] px-3 py-2 border-e flex items-center gap-2">
                <span className="truncate font-medium">
                  {classGroup.displayName || classGroup.name}
                </span>
                {classGroup.singleTeacherMode && <SingleTeacherBadge />}
              </div>

              {/* Grade */}
              <div className="w-20 px-3 py-2 border-e flex items-center justify-center">
                <GradeBadge grade={classGroup.grade} />
              </div>

              {/* Section Index */}
              <div className="w-16 px-3 py-2 border-e text-center text-sm">
                {classGroup.sectionIndex || '—'}
              </div>

              {/* Student Count */}
              <div className="w-24 px-3 py-2 border-e text-center text-sm">
                {classGroup.studentCount}
              </div>

              {/* Class Teacher */}
              <div className="flex-1 min-w-[100px] px-3 py-2 border-e text-sm truncate">
                {getTeacherName(classGroup.classTeacherId)}
              </div>

              {/* Fixed Room */}
              <div className="flex-1 min-w-[100px] px-3 py-2 border-e text-sm truncate">
                {getRoomName(classGroup.fixedRoomId)}
              </div>

              {/* Actions */}
              <div className="w-16 px-2 py-1 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteClick(e, classGroup)}
                  disabled={isDeleting}
                  aria-label={t('classes.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20 flex justify-between">
          <span>{t('classes.recordCount', { count: classes.length })}</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('classes.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('classes.deleteConfirm.message', {
                name: deleteTarget?.displayName || deleteTarget?.name,
              })}
            </AlertDialogDescription>
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

export default ClassDataGrid;
