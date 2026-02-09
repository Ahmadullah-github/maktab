/**
 * ClassDataGrid Component
 *
 * DataGrid for displaying classes with:
 * - Checkbox selection for bulk operations
 * - Row click to open edit drawer
 * - Grade badges with color coding
 * - Single-teacher mode indicator
 * - Compact mode when drawer is open
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Building, GraduationCap, User, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRooms } from '../../rooms/hooks/useRooms';
import type { ClassGroup } from '../types';
import { getGradeCategory } from '../utils/gradeCategory';

// Types for display
interface Room {
  id: number;
  name: string;
  isDeleted?: boolean;
}

export interface ClassDataGridProps {
  classes: ClassGroup[];
  selectedId: number | null;
  selectedIds: Set<number>;
  onSelect: (classGroup: ClassGroup) => void;
  onToggleSelect: (classId: number) => void;
  onToggleSelectAll: () => void;
  onDeleteClass?: (classGroup: ClassGroup) => void;
  isDeleting?: boolean;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
}

// Grade category badge colors
const GRADE_CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  alphaPrimary: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  betaPrimary: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  middle: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  high: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  unknown: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

function GradeCategoryBadge({ grade, t }: { grade: number | null; t: (key: string) => string }) {
  const category = getGradeCategory(grade);
  const style = GRADE_CATEGORY_STYLES[category] || GRADE_CATEGORY_STYLES.unknown;

  const labelMap: Record<string, string> = {
    alphaPrimary: t('classes.filters.alphaPrimary'),
    betaPrimary: t('classes.filters.betaPrimary'),
    middle: t('classes.filters.middle'),
    high: t('classes.filters.high'),
    unknown: '—',
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-[10px] px-1.5 py-0 h-5 border font-medium',
        style.bg,
        style.text,
        style.border
      )}
    >
      {labelMap[category] || '—'}
    </Badge>
  );
}

function SingleTeacherBadge({ enabled, t }: { enabled: boolean; t: (key: string) => string }) {
  if (!enabled) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 cursor-help">
            <User className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{t('classes.singleTeacherModeHint')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ClassDataGrid({
  classes,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteClass,
  isDeleting = false,
  isLoading = false,
  compact = false,
  className,
}: ClassDataGridProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<ClassGroup | null>(null);

  // Fetch rooms for name lookups - using shared hooks for real-time updates
  const { data: allRooms = [] } = useRooms();

  // Filter out deleted items
  const rooms = useMemo(() => (allRooms as Room[]).filter((r) => !r.isDeleted), [allRooms]);

  // Create lookup maps
  const roomMap = useMemo(() => {
    const map = new Map<number, Room>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  const handleRowClick = useCallback(
    (classGroup: ClassGroup, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-checkbox]')) {
        return;
      }
      onSelect(classGroup);
    },
    [onSelect]
  );

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, classGroup: ClassGroup) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(classGroup);
      }
    },
    [onSelect]
  );

  const handleConfirmDelete = () => {
    if (deleteTarget && onDeleteClass) {
      onDeleteClass(deleteTarget);
    }
    setDeleteTarget(null);
  };

  const getRoomName = (roomId: number | null): string => {
    if (!roomId) return '—';
    return roomMap.get(roomId)?.name || `#${roomId}`;
  };

  const allSelected = classes.length > 0 && selectedIds.size === classes.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < classes.length;

  // Empty state
  if (!isLoading && classes.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground bg-white rounded-lg',
          className
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <GraduationCap className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-semibold text-gray-700">{t('classes.noClasses')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('classes.noClassesHint', 'برای شروع یک صنف اضافه کنید')}
        </p>
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
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                    {t('classes.form.name')}
                  </div>
                </th>
                <th className="w-24 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('classes.form.grade')}
                </th>
                <th className="w-28 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('classes.columns.category', 'مقطع')}
                </th>
                {!compact && (
                  <th className="w-20 p-3 border-e bg-gray-50 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-emerald-600" />
                      {t('classes.form.studentCount')}
                    </div>
                  </th>
                )}
                {!compact && (
                  <th className="p-3 border-e bg-gray-50 text-start font-semibold min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-amber-600" />
                      {t('classes.form.fixedRoom')}
                    </div>
                  </th>
                )}
                <th className="w-16 p-3 bg-gray-50 text-center font-semibold">
                  {t('classes.columns.mode', 'حالت')}
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {classes.map((classGroup, index) => {
                const isSelected = selectedId === classGroup.id;
                const isChecked = selectedIds.has(classGroup.id);

                return (
                  <tr
                    key={classGroup.id}
                    className={cn(
                      'border-b last:border-b-0 cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50',
                      isChecked && !isSelected && 'bg-primary/5'
                    )}
                    onClick={(e) => handleRowClick(classGroup, e)}
                    onKeyDown={(e) => handleKeyDown(e, classGroup)}
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
                        onCheckedChange={() => onToggleSelect(classGroup.id)}
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
                      <span className="font-medium text-gray-900">
                        {classGroup.displayName || classGroup.name}
                      </span>
                      {compact && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {classGroup.studentCount} {t('classes.stats.students', 'شاگرد')}
                          </span>
                          {classGroup.fixedRoomId && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              <Building className="h-2.5 w-2.5 me-0.5" />
                              {getRoomName(classGroup.fixedRoomId)}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="w-24 p-3 border-e text-center">
                      {classGroup.grade ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
                          {classGroup.grade}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="w-28 p-3 border-e text-center">
                      <GradeCategoryBadge grade={classGroup.grade} t={t} />
                    </td>

                    {/* Student Count */}
                    {!compact && (
                      <td className="w-20 p-3 border-e text-center">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700 cursor-help">
                                {classGroup.studentCount}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {classGroup.studentCount} {t('classes.stats.students', 'شاگرد')}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    )}

                    {/* Fixed Room */}
                    {!compact && (
                      <td className="p-3 border-e">
                        {classGroup.fixedRoomId ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border border-amber-200"
                          >
                            <Building className="h-3 w-3 me-1" />
                            {getRoomName(classGroup.fixedRoomId)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}

                    {/* Single Teacher Mode */}
                    <td className="w-16 p-3 text-center">
                      <SingleTeacherBadge enabled={classGroup.singleTeacherMode} t={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-gray-50 flex justify-between items-center shrink-0">
          <span>{t('classes.recordCount', { count: classes.length })}</span>
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
