/**
 * AssignmentDrawerV2 Component
 *
 * Refactored assignment drawer with improved UX:
 * - Compact context bar instead of stacked cards
 * - Grouped teacher list with inline workload preview
 * - One-click assignment on teacher rows
 * - Keyboard navigation (Arrow keys + Enter)
 * - No redundant tabs
 *
 * Phase 2 of AssignmentDrawer refactor
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ClassGroup } from '@/features/classes/types';
import type { Subject } from '@/features/subjects/types';
import { useTeacherAssignments } from '@/features/teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '@/features/teacher-assignments/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen, GraduationCap, Loader2, Trash2, User, Users, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignmentMutations } from '../hooks/useAssignmentMutations';
import type { AssignmentCellSelection, AssignmentDrawerMode } from '../types';
import { TeacherSelectionList } from './TeacherSelectionList';

// ============================================================================
// Types
// ============================================================================

export interface AssignmentDrawerV2Props {
  /** Current drawer mode */
  mode: AssignmentDrawerMode;
  /** Target class ID (for single assignment) */
  classId: number | null;
  /** Target subject ID (for single assignment) */
  subjectId: number | null;
  /** Selected cells (for bulk assignment) */
  selectedCells: AssignmentCellSelection[];
  /** Close drawer handler */
  onClose: () => void;
  /** All teachers */
  teachers: Teacher[];
  /** All subjects */
  subjects: Subject[];
  /** All classes */
  classes: ClassGroup[];
  /** Get teacher by ID */
  getTeacherById: (id: number) => Teacher | undefined;
  /** Get subject by ID */
  getSubjectById: (id: number) => Subject | undefined;
  /** Get class by ID */
  getClassById: (id: number) => ClassGroup | undefined;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from a full name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0);
  }
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Compact context bar showing assignment target
 */
function AssignmentContextBar({
  mode,
  targetClass,
  targetSubject,
  periodsPerWeek,
  currentTeacher,
  onUnassign,
  isUnassigning,
}: {
  mode: AssignmentDrawerMode;
  targetClass: ClassGroup | null;
  targetSubject: Subject | null;
  periodsPerWeek: number;
  currentTeacher: Teacher | null;
  onUnassign: () => void;
  isUnassigning: boolean;
}) {
  const { t } = useTranslation();

  if (mode !== 'assign' || !targetClass || !targetSubject) return null;

  return (
    <div className="p-3 bg-slate-50 border-b space-y-3">
      {/* Subject → Class flow */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-100 rounded-md">
          <BookOpen className="w-3.5 h-3.5 text-violet-600" />
          <span className="font-medium text-violet-700">{targetSubject.name}</span>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded-md">
          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium text-blue-700">
            {targetClass.displayName || targetClass.name}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs ms-auto">
          {periodsPerWeek} {t('common.periodsPerWeek', 'ساعت/هفته')}
        </Badge>
      </div>

      {/* Current assignment (if exists) */}
      {currentTeacher && (
        <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 text-sm font-medium">
              {getInitials(currentTeacher.fullName)}
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">{currentTeacher.fullName}</p>
              <p className="text-[10px] text-amber-600">
                {t('assignments.drawer.currentlyAssigned', 'تخصیص فعلی')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={onUnassign}
            disabled={isUnassigning}
          >
            {isUnassigning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span className="ms-1 text-xs">{t('assignments.drawer.remove', 'حذف')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk assignment summary bar
 */
function BulkAssignmentSummary({
  selectedCells,
  totalPeriods,
}: {
  selectedCells: AssignmentCellSelection[];
  totalPeriods: number;
}) {
  const { t } = useTranslation();

  if (selectedCells.length === 0) return null;

  // Group by subject for display
  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of selectedCells) {
      const key = cell.subjectName || `Subject ${cell.subjectId}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [selectedCells]);

  return (
    <div className="p-3 bg-slate-50 border-b">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          {t('assignments.drawer.selectedItems', 'موارد انتخاب شده')}
        </span>
        <Badge variant="secondary">
          {selectedCells.length} {t('common.items', 'مورد')}
        </Badge>
      </div>

      {/* Subject breakdown */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {bySubject.slice(0, 4).map(([subject, count]) => (
          <Badge key={subject} variant="outline" className="text-xs">
            {subject} ({count})
          </Badge>
        ))}
        {bySubject.length > 4 && (
          <Badge variant="outline" className="text-xs text-slate-400">
            +{bySubject.length - 4}
          </Badge>
        )}
      </div>

      {/* Total periods */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
        <span>{t('assignments.drawer.totalPeriods', 'مجموع ساعات')}</span>
        <span className="font-medium text-slate-700">{totalPeriods}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AssignmentDrawerV2({
  mode,
  classId,
  subjectId,
  selectedCells,
  onClose,
  getTeacherById,
  getSubjectById,
  getClassById,
  className,
}: AssignmentDrawerV2Props) {
  const { t } = useTranslation();
  const { assignTeacher, unassignTeacher } = useAssignmentMutations();

  // Track which teacher is currently being assigned (prevents rapid clicks)
  const [assigningTeacherId, setAssigningTeacherId] = useState<number | null>(null);

  // Fetch real-time assignment data
  const { data: allAssignments = [] } = useTeacherAssignments();

  // Get target data for single assignment
  const targetClass = classId ? (getClassById(classId) ?? null) : null;
  const targetSubject = subjectId ? (getSubjectById(subjectId) ?? null) : null;

  // Get current assignment for single mode
  const currentTeacher = useMemo(() => {
    if (!targetClass || !subjectId) return null;

    // Check assignments table for current teacher
    const assignment = allAssignments.find(
      (a: TeacherClassSubjectAssignment) =>
        a.classId === classId && a.subjectId === subjectId && !a.isDeleted
    );

    if (assignment) {
      return getTeacherById(assignment.teacherId) || null;
    }

    // Fallback to class.subjectRequirements
    const requirement = targetClass.subjectRequirements?.find((r) => r.subjectId === subjectId);
    if (requirement?.teacherId) {
      return getTeacherById(requirement.teacherId) || null;
    }

    return null;
  }, [targetClass, subjectId, classId, allAssignments, getTeacherById]);

  // Calculate periods to add
  const periodsToAdd = useMemo(() => {
    if (mode === 'assign' && targetClass && subjectId) {
      const requirement = targetClass.subjectRequirements?.find((r) => r.subjectId === subjectId);
      return requirement?.periodsPerWeek || 4;
    }
    if (mode === 'bulk-assign') {
      return selectedCells.reduce((sum, cell) => sum + (cell.periodsPerWeek || 4), 0);
    }
    return 0;
  }, [mode, targetClass, subjectId, selectedCells]);

  // Get the subject ID for teacher selection
  const targetSubjectId = subjectId || selectedCells[0]?.subjectId || 0;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAssign = useCallback(
    async (teacherId: number) => {
      // Prevent rapid clicks - if already assigning this teacher, ignore
      if (assigningTeacherId === teacherId) return;

      // Set loading state for this specific teacher
      setAssigningTeacherId(teacherId);

      try {
        if (mode === 'assign' && classId && subjectId) {
          const requirement = targetClass?.subjectRequirements?.find(
            (r) => r.subjectId === subjectId
          );

          await assignTeacher.mutateAsync({
            teacherId,
            subjectId,
            classIds: [classId],
            periodsPerWeek: requirement?.periodsPerWeek || 4,
          });

          // Don't close drawer (per user preference)
        } else if (mode === 'bulk-assign' && selectedCells.length > 0) {
          // Group by subject for bulk assignment
          const bySubject = new Map<number, { classIds: number[]; periodsPerWeek: number }>();

          for (const cell of selectedCells) {
            if (!bySubject.has(cell.subjectId)) {
              bySubject.set(cell.subjectId, {
                classIds: [],
                periodsPerWeek: cell.periodsPerWeek || 4,
              });
            }
            bySubject.get(cell.subjectId)!.classIds.push(cell.classId);
          }

          // Assign each subject group
          for (const [subjId, data] of bySubject) {
            await assignTeacher.mutateAsync({
              teacherId,
              subjectId: subjId,
              classIds: data.classIds,
              periodsPerWeek: data.periodsPerWeek,
            });
          }

          // Don't close drawer (per user preference)
        }
      } finally {
        // Clear loading state
        setAssigningTeacherId(null);
      }
    },
    [mode, classId, subjectId, targetClass, selectedCells, assignTeacher, assigningTeacherId]
  );

  const handleUnassign = useCallback(async () => {
    if (!currentTeacher || !classId || !subjectId) return;

    await unassignTeacher.mutateAsync({
      teacherId: currentTeacher.id,
      subjectId,
      classIds: [classId],
    });

    // Don't close drawer
  }, [currentTeacher, classId, subjectId, unassignTeacher]);

  // ============================================================================
  // Render
  // ============================================================================

  const title =
    mode === 'assign'
      ? t('assignments.drawer.assignTitle', 'تخصیص معلم')
      : mode === 'bulk-assign'
        ? t('assignments.drawer.bulkAssignTitle', 'تخصیص گروهی')
        : t('assignments.drawer.detailsTitle', 'جزئیات تخصیص');

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center',
              mode === 'bulk-assign' ? 'bg-blue-100' : 'bg-violet-100'
            )}
          >
            {mode === 'bulk-assign' ? (
              <Users className="w-4.5 h-4.5 text-blue-600" />
            ) : (
              <User className="w-4.5 h-4.5 text-violet-600" />
            )}
          </div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Context Bar (Single mode) */}
      <AssignmentContextBar
        mode={mode}
        targetClass={targetClass}
        targetSubject={targetSubject}
        periodsPerWeek={periodsToAdd}
        currentTeacher={currentTeacher}
        onUnassign={handleUnassign}
        isUnassigning={unassignTeacher.isPending}
      />

      {/* Bulk Summary (Bulk mode) */}
      {mode === 'bulk-assign' && (
        <BulkAssignmentSummary selectedCells={selectedCells} totalPeriods={periodsToAdd} />
      )}

      {/* Teacher Selection List */}
      <div className="flex-1 min-h-0 p-3">
        {targetSubjectId > 0 ? (
          <TeacherSelectionList
            subjectId={targetSubjectId}
            periodsToAdd={periodsToAdd}
            onAssign={handleAssign}
            assigningTeacherId={assigningTeacherId}
            currentTeacherId={currentTeacher?.id}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-sm">{t('assignments.drawer.selectSubject', 'مضمون انتخاب نشده')}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-slate-50">
        <Button variant="outline" onClick={onClose} className="w-full">
          {t('common.close', 'بستن')}
        </Button>
      </div>
    </div>
  );
}

export default AssignmentDrawerV2;
