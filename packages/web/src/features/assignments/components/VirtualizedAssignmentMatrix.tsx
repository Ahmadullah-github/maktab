/**
 * VirtualizedAssignmentMatrix Component
 *
 * Provides efficient rendering for large assignment matrices using virtualization.
 * Handles both row and column virtualization for optimal performance.
 *
 * Requirements: 11.4
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Loader2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { ClassAssignment, Teacher } from '../../teachers/types';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentCell {
  subjectId: number;
  classId: number;
  isAssigned: boolean;
  periodsPerWeek: number;
}

export interface VirtualizedAssignmentMatrixProps {
  /** Teacher being edited */
  teacher: Teacher;
  /** Available subjects */
  subjects: Subject[];
  /** Available classes */
  classes: ClassGroup[];
  /** Callback when assignments change */
  onAssignmentChange: (assignments: ClassAssignment[]) => void;
  /** Whether updates are in progress */
  isUpdating?: boolean;
  /** Maximum height of the matrix */
  maxHeight?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;
const SUBJECT_COLUMN_WIDTH = 150;
const CLASS_COLUMN_WIDTH = 100;
const MAX_VISIBLE_ROWS = 10;
const MAX_VISIBLE_COLUMNS = 8;

// ============================================================================
// Component
// ============================================================================

export function VirtualizedAssignmentMatrix({
  teacher,
  subjects,
  classes,
  onAssignmentChange,
  isUpdating = false,
  maxHeight = 400,
  className,
}: VirtualizedAssignmentMatrixProps) {
  const { t } = useTranslation();
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  // Filter to teachable subjects
  const teachableSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      const isPrimary = teacher.primarySubjectIds.includes(subject.id);
      const isAllowed = teacher.allowedSubjectIds.includes(subject.id);
      if (teacher.restrictToPrimarySubjects) {
        return isPrimary;
      }
      return isPrimary || isAllowed;
    });
  }, [subjects, teacher]);

  // Filter to classes that require any teachable subject
  const relevantClasses = useMemo(() => {
    const teachableSubjectIds = new Set(teachableSubjects.map((s) => s.id));
    return classes.filter((c) =>
      c.subjectRequirements.some((r) => teachableSubjectIds.has(r.subjectId))
    );
  }, [classes, teachableSubjects]);

  // Build assignment lookup
  const assignmentLookup = useMemo(() => {
    const lookup = new Map<string, boolean>();
    for (const assignment of teacher.classAssignments) {
      for (const classId of assignment.classIds) {
        lookup.set(`${assignment.subjectId}:${classId}`, true);
      }
    }
    return lookup;
  }, [teacher.classAssignments]);

  // Get periods for a subject in a class
  const getPeriodsPerWeek = useCallback(
    (subjectId: number, classId: number): number => {
      const classGroup = relevantClasses.find((c) => c.id === classId);
      const requirement = classGroup?.subjectRequirements.find((r) => r.subjectId === subjectId);
      if (requirement?.periodsPerWeek) return requirement.periodsPerWeek;
      const subject = teachableSubjects.find((s) => s.id === subjectId);
      return subject?.periodsPerWeek || 1;
    },
    [relevantClasses, teachableSubjects]
  );

  // Check if a cell is assigned
  const isAssigned = useCallback(
    (subjectId: number, classId: number): boolean => {
      const key = `${subjectId}:${classId}`;
      // Check pending changes first
      if (pendingChanges.has(key)) {
        return pendingChanges.get(key)!;
      }
      return assignmentLookup.has(key);
    },
    [assignmentLookup, pendingChanges]
  );

  // Toggle assignment
  const toggleAssignment = useCallback(
    (subjectId: number, classId: number) => {
      const key = `${subjectId}:${classId}`;
      const currentlyAssigned = isAssigned(subjectId, classId);

      // Update pending changes
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(key, !currentlyAssigned);
        return next;
      });
    },
    [isAssigned]
  );

  // Apply pending changes
  const applyChanges = useCallback(() => {
    if (pendingChanges.size === 0) return;

    // Build new assignments from current + pending
    const newAssignmentMap = new Map<number, Set<number>>();

    // Start with current assignments
    for (const assignment of teacher.classAssignments) {
      newAssignmentMap.set(assignment.subjectId, new Set(assignment.classIds));
    }

    // Apply pending changes
    for (const [key, shouldAssign] of pendingChanges) {
      const [subjectIdStr, classIdStr] = key.split(':');
      const subjectId = parseInt(subjectIdStr, 10);
      const classId = parseInt(classIdStr, 10);

      if (!newAssignmentMap.has(subjectId)) {
        newAssignmentMap.set(subjectId, new Set());
      }

      if (shouldAssign) {
        newAssignmentMap.get(subjectId)!.add(classId);
      } else {
        newAssignmentMap.get(subjectId)!.delete(classId);
      }
    }

    // Convert to assignments array
    const newAssignments: ClassAssignment[] = [];
    for (const [subjectId, classIds] of newAssignmentMap) {
      if (classIds.size > 0) {
        newAssignments.push({
          subjectId,
          classIds: Array.from(classIds),
        });
      }
    }

    onAssignmentChange(newAssignments);
    setPendingChanges(new Map());
  }, [pendingChanges, teacher.classAssignments, onAssignmentChange]);

  // Cancel pending changes
  const cancelChanges = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  // Calculate dimensions
  const containerHeight = Math.min(
    maxHeight,
    HEADER_HEIGHT + Math.min(teachableSubjects.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT + 60
  );

  const containerWidth =
    SUBJECT_COLUMN_WIDTH +
    Math.min(relevantClasses.length, MAX_VISIBLE_COLUMNS) * CLASS_COLUMN_WIDTH;

  // Loading state
  if (teachableSubjects.length === 0) {
    return (
      <div
        className={cn('p-4 bg-slate-50 rounded-lg border border-slate-200 text-center', className)}
      >
        <p className="text-sm text-slate-600">
          {t('teachers.assignments.noTeachableSubjects', 'هیچ مضمونی برای تدریس تعریف نشده است')}
        </p>
      </div>
    );
  }

  if (relevantClasses.length === 0) {
    return (
      <div
        className={cn('p-4 bg-slate-50 rounded-lg border border-slate-200 text-center', className)}
      >
        <p className="text-sm text-slate-600">
          {t('teachers.assignments.noClassesForSubjects', 'هیچ صنفی این مضامین را ندارد')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Matrix */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <ScrollArea style={{ height: containerHeight, width: '100%' }}>
          <div style={{ minWidth: containerWidth }}>
            {/* Header Row */}
            <div className="flex sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
              <div
                className="shrink-0 p-2 font-medium text-xs text-slate-600 border-e border-slate-200"
                style={{ width: SUBJECT_COLUMN_WIDTH }}
              >
                {t('subjects.title', 'مضمون')}
              </div>
              {relevantClasses.map((classGroup) => (
                <div
                  key={classGroup.id}
                  className="shrink-0 p-2 text-center font-medium text-xs text-slate-600 border-e border-slate-200 last:border-e-0"
                  style={{ width: CLASS_COLUMN_WIDTH }}
                >
                  {classGroup.displayName || classGroup.name}
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {teachableSubjects.map((subject) => (
              <div
                key={subject.id}
                className="flex border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Subject Name */}
                <div
                  className="shrink-0 p-2 flex items-center text-sm text-slate-700 border-e border-slate-200 truncate"
                  style={{ width: SUBJECT_COLUMN_WIDTH }}
                >
                  {subject.name}
                </div>

                {/* Class Cells */}
                {relevantClasses.map((classGroup) => {
                  const hasRequirement = classGroup.subjectRequirements.some(
                    (r) => r.subjectId === subject.id
                  );

                  if (!hasRequirement) {
                    return (
                      <div
                        key={classGroup.id}
                        className="shrink-0 p-2 flex items-center justify-center bg-slate-50 border-e border-slate-100 last:border-e-0"
                        style={{ width: CLASS_COLUMN_WIDTH }}
                      >
                        <span className="text-slate-300">—</span>
                      </div>
                    );
                  }

                  const assigned = isAssigned(subject.id, classGroup.id);
                  const periods = getPeriodsPerWeek(subject.id, classGroup.id);
                  const key = `${subject.id}:${classGroup.id}`;
                  const hasPendingChange = pendingChanges.has(key);

                  return (
                    <div
                      key={classGroup.id}
                      className={cn(
                        'shrink-0 p-2 flex items-center justify-center border-e border-slate-100 last:border-e-0',
                        hasPendingChange && 'bg-amber-50'
                      )}
                      style={{ width: CLASS_COLUMN_WIDTH }}
                    >
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={assigned}
                          onCheckedChange={() => toggleAssignment(subject.id, classGroup.id)}
                          disabled={isUpdating}
                          className={cn(assigned && 'bg-violet-600 border-violet-600')}
                        />
                        <span className="text-xs text-slate-500">{periods}h</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Pending Changes Actions */}
      {pendingChanges.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              {pendingChanges.size} {t('common.changes', 'تغییر')}
            </Badge>
            <span className="text-sm text-amber-700">
              {t('teachers.assignments.pendingChanges', 'تغییرات در انتظار ذخیره')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelChanges}
              disabled={isUpdating}
              className="text-slate-600 hover:text-slate-800"
            >
              <X className="h-4 w-4 me-1" />
              {t('common.cancel', 'لغو')}
            </Button>
            <Button
              size="sm"
              onClick={applyChanges}
              disabled={isUpdating}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 me-1" />
              )}
              {t('common.save', 'ذخیره')}
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {teachableSubjects.length} {t('subjects.title', 'مضمون')} × {relevantClasses.length}{' '}
          {t('classes.title', 'صنف')}
        </span>
        <span>
          {teacher.classAssignments.reduce((sum, a) => sum + a.classIds.length, 0)}{' '}
          {t('teachers.assignments.totalAssignments', 'تخصیص')}
        </span>
      </div>
    </div>
  );
}

export default VirtualizedAssignmentMatrix;
