/**
 * BulkAssignmentPreview Component
 *
 * Shows preview of bulk assignment operation:
 * - List of selected cells grouped by subject
 * - Selected teacher info
 * - Validation results per cell
 * - Summary with partial assign option
 *
 * Requirements: Phase 5.2
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { ClassGroup } from '@/features/classes/types';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, User, XCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentCellSelection, BulkAssignmentPreviewItem } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface BulkAssignmentPreviewProps {
  /** Selected cells for bulk assignment */
  selectedCells: AssignmentCellSelection[];
  /** Selected teacher for assignment */
  selectedTeacher: Teacher | null;
  /** All classes for lookup */
  classes: ClassGroup[];
  /** All subjects for lookup */
  subjects: Subject[];
  /** Get class by ID */
  getClassById: (id: number) => ClassGroup | undefined;
  /** Get subject by ID */
  getSubjectById: (id: number) => Subject | undefined;
  /** Confirm assignment handler */
  onConfirm: (cellsToAssign: AssignmentCellSelection[]) => void;
  /** Cancel handler */
  onCancel: () => void;
  /** Whether assignment is in progress */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
}

interface GroupedCells {
  subjectId: number;
  subjectName: string;
  cells: BulkAssignmentPreviewItem[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate teacher's current workload
 */
function calculateTeacherWorkload(
  teacher: Teacher,
  classes: ClassGroup[],
  subjects: Subject[]
): number {
  if (!teacher.classAssignments || teacher.classAssignments.length === 0) {
    return 0;
  }

  let total = 0;
  for (const assignment of teacher.classAssignments) {
    const subject = subjects.find((candidate) => candidate.id === assignment.subjectId);
    for (const classId of assignment.classIds || []) {
      const classData = classes.find((c) => c.id === classId);
      if (classData) {
        const requirement = classData.subjectRequirements?.find(
          (r) => r.subjectId === assignment.subjectId
        );
        total += requirement?.periodsPerWeek ?? subject?.periodsPerWeek ?? 0;
      }
    }
  }
  return total;
}

/**
 * Check if teacher can teach a subject
 */
function canTeachSubject(teacher: Teacher, subjectId: number): boolean {
  const isPrimary = teacher.primarySubjectIds?.includes(subjectId) || false;
  const isAllowed =
    !teacher.restrictToPrimarySubjects && (teacher.allowedSubjectIds?.includes(subjectId) || false);
  return isPrimary || isAllowed;
}

// ============================================================================
// Component
// ============================================================================

export function BulkAssignmentPreview({
  selectedCells,
  selectedTeacher,
  classes,
  subjects,
  getClassById,
  getSubjectById,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: BulkAssignmentPreviewProps) {
  const { t } = useTranslation();

  // Track which cells are selected for partial assignment
  const [enabledCells, setEnabledCells] = useState<Set<string>>(
    new Set(selectedCells.map((c) => `${c.classId}:${c.subjectId}`))
  );

  // Calculate preview items with validation
  const previewData = useMemo(() => {
    if (!selectedTeacher) {
      return { groups: [], canAssignCount: 0, cannotAssignCount: 0, totalPeriods: 0 };
    }

    const currentWorkload = calculateTeacherWorkload(selectedTeacher, classes, subjects);
    const maxWorkload = selectedTeacher.maxPeriodsPerWeek || 30;
    let runningWorkload = currentWorkload;

    // Group cells by subject
    const groupMap = new Map<number, GroupedCells>();

    for (const cell of selectedCells) {
      const classData = getClassById(cell.classId);
      const subject = getSubjectById(cell.subjectId);

      if (!classData || !subject) continue;

      const requirement = classData.subjectRequirements?.find(
        (r) => r.subjectId === cell.subjectId
      );
      const periodsPerWeek =
        requirement?.periodsPerWeek ?? cell.periodsPerWeek ?? subject.periodsPerWeek ?? 0;

      // Validate assignment
      const canTeach = canTeachSubject(selectedTeacher, cell.subjectId);
      const wouldExceedWorkload = runningWorkload + periodsPerWeek > maxWorkload;

      let canAssign = true;
      let reason: string | undefined;
      let reasonFa: string | undefined;

      if (!canTeach) {
        canAssign = false;
        reason = 'Teacher cannot teach this subject';
        reasonFa = 'معلم نمی‌تواند این مضمون را تدریس کند';
      } else if (wouldExceedWorkload) {
        canAssign = false;
        reason = 'Would exceed workload limit';
        reasonFa = 'از حد بار کاری فراتر می‌رود';
      }

      // Update running workload for next iteration
      if (canAssign) {
        runningWorkload += periodsPerWeek;
      }

      const item: BulkAssignmentPreviewItem = {
        classId: cell.classId,
        className: classData.displayName || classData.name,
        subjectId: cell.subjectId,
        subjectName: subject.name,
        periodsPerWeek,
        canAssign,
        reason,
        reasonFa,
        conflicts: [],
      };

      // Add to group
      if (!groupMap.has(cell.subjectId)) {
        groupMap.set(cell.subjectId, {
          subjectId: cell.subjectId,
          subjectName: subject.name,
          cells: [],
        });
      }
      groupMap.get(cell.subjectId)!.cells.push(item);
    }

    const groups = Array.from(groupMap.values());
    const allItems = groups.flatMap((g) => g.cells);
    const canAssignCount = allItems.filter((i) => i.canAssign).length;
    const cannotAssignCount = allItems.filter((i) => !i.canAssign).length;
    const totalPeriods = allItems
      .filter((i) => i.canAssign)
      .reduce((sum, i) => sum + i.periodsPerWeek, 0);

    return { groups, canAssignCount, cannotAssignCount, totalPeriods };
  }, [selectedCells, selectedTeacher, classes, subjects, getClassById, getSubjectById]);

  // Toggle cell for partial assignment
  const toggleCell = useCallback((classId: number, subjectId: number) => {
    const key = `${classId}:${subjectId}`;
    setEnabledCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Select/deselect all
  const selectAll = useCallback(() => {
    setEnabledCells(new Set(selectedCells.map((c) => `${c.classId}:${c.subjectId}`)));
  }, [selectedCells]);

  const deselectAll = useCallback(() => {
    setEnabledCells(new Set());
  }, []);

  // Get cells to assign (enabled and can assign)
  const cellsToAssign = useMemo(() => {
    return selectedCells.filter((cell) => {
      const key = `${cell.classId}:${cell.subjectId}`;
      if (!enabledCells.has(key)) return false;

      const item = previewData.groups
        .flatMap((g) => g.cells)
        .find((i) => i.classId === cell.classId && i.subjectId === cell.subjectId);

      return item?.canAssign ?? false;
    });
  }, [selectedCells, enabledCells, previewData.groups]);

  const selectedTotalPeriods = useMemo(() => {
    return previewData.groups
      .flatMap((group) => group.cells)
      .filter((item) => enabledCells.has(`${item.classId}:${item.subjectId}`) && item.canAssign)
      .reduce((sum, item) => sum + item.periodsPerWeek, 0);
  }, [enabledCells, previewData.groups]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    onConfirm(cellsToAssign);
  }, [cellsToAssign, onConfirm]);

  if (!selectedTeacher) {
    return (
      <div className={cn('p-4 text-center text-slate-500', className)}>
        {t('assignments.bulkPreview.selectTeacher', 'ابتدا یک معلم انتخاب کنید')}
      </div>
    );
  }

  const currentWorkload = calculateTeacherWorkload(selectedTeacher, classes, subjects);
  const maxWorkload = selectedTeacher.maxPeriodsPerWeek || 30;
  const projectedWorkload = currentWorkload + selectedTotalPeriods;
  const projectedUtilization = Math.round((projectedWorkload / maxWorkload) * 100);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Teacher Summary */}
      <Card className="m-4 mb-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" />
            {t('assignments.bulkPreview.teacher', 'معلم انتخاب شده')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium">
              {selectedTeacher.fullName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-800">{selectedTeacher.fullName}</p>
              <p className="text-xs text-slate-500">
                {t('assignments.bulkPreview.workload', 'بار کاری: {{current}}/{{max}}', {
                  current: currentWorkload,
                  max: maxWorkload,
                })}
              </p>
            </div>
          </div>

          {/* Workload Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {t('assignments.bulkPreview.afterAssignment', 'پس از تخصیص')}
              </span>
              <span
                className={cn(
                  'font-medium',
                  projectedUtilization > 100 ? 'text-red-600' : 'text-slate-700'
                )}
              >
                {projectedWorkload}/{maxWorkload} (+{selectedTotalPeriods})
              </span>
            </div>
            <Progress
              value={Math.min(projectedUtilization, 100)}
              className={cn('h-2', projectedUtilization > 100 && '[&>div]:bg-red-500')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-sm">
            {t('assignments.bulkPreview.canAssign', '{{count}} قابل تخصیص', {
              count: previewData.canAssignCount,
            })}
          </span>
        </div>
        {previewData.cannotAssignCount > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-600">
              {t('assignments.bulkPreview.cannotAssign', '{{count}} غیرقابل تخصیص', {
                count: previewData.cannotAssignCount,
              })}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
          {t('assignments.bulkPreview.selectAll', 'انتخاب همه')}
        </Button>
        <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
          {t('assignments.bulkPreview.deselectAll', 'لغو همه')}
        </Button>
      </div>

      <Separator />

      {/* Grouped Cells */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {previewData.groups.map((group) => (
            <div key={group.subjectId} className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                {group.subjectName}
                <Badge variant="secondary" className="text-xs">
                  {group.cells.length}
                </Badge>
              </h4>

              <div className="space-y-1">
                {group.cells.map((item) => {
                  const key = `${item.classId}:${item.subjectId}`;
                  const isEnabled = enabledCells.has(key);

                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg transition-colors',
                        item.canAssign
                          ? isEnabled
                            ? 'bg-emerald-50'
                            : 'bg-slate-50'
                          : 'bg-red-50 opacity-60'
                      )}
                    >
                      <Checkbox
                        checked={isEnabled && item.canAssign}
                        onCheckedChange={() => toggleCell(item.classId, item.subjectId)}
                        disabled={!item.canAssign}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {item.className}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.periodsPerWeek} {t('assignments.periods', 'ساعت')}
                        </p>
                      </div>

                      {item.canAssign ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="flex items-center gap-1 text-red-600 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs">{item.reasonFa || item.reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-600">
            {t('assignments.bulkPreview.selectedCount', '{{count}} مورد انتخاب شده', {
              count: cellsToAssign.length,
            })}
          </span>
          <span className="text-sm font-medium text-slate-800">
            {t('assignments.bulkPreview.totalPeriods', 'مجموع: {{count}} ساعت', {
              count: selectedTotalPeriods,
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={cellsToAssign.length === 0 || isLoading}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isLoading
              ? t('common.saving', 'در حال ذخیره...')
              : t('assignments.bulkPreview.confirm', 'تخصیص {{count}} مورد', {
                  count: cellsToAssign.length,
                })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BulkAssignmentPreview;
