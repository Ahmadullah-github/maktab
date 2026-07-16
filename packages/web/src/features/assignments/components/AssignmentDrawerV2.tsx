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
import { Input } from '@/components/ui/input';
import type { ClassGroup } from '@/features/classes/types';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import { cn } from '@/lib/utils';
import {
  getProjectionRequirementStatus,
  useClassAssignmentView,
  useAssignmentMatrixView,
  type ProjectionRequirementView,
  type ProjectionAssignmentSummary,
} from '../projections';
import { ArrowRight, BookOpen, GraduationCap, Loader2, Trash2, User, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplyAssignmentBatch } from '../hooks/useAssignmentMutations';
import type { AssignmentCellSelection, AssignmentDrawerMode } from '../types';
import { AssignmentStatusBadge } from './shared';
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

export function addAllocation(
  requirement: ProjectionRequirementView,
  teacherId: number,
  periodsToAdd: number
) {
  const allocations = requirement.assignments.map((assignment) => ({
    teacherId: assignment.teacherId,
    periodsPerWeek:
      assignment.assignedPeriodsPerWeek +
      (assignment.teacherId === teacherId ? periodsToAdd : 0),
  }));
  if (!allocations.some((allocation) => allocation.teacherId === teacherId)) {
    allocations.push({ teacherId, periodsPerWeek: periodsToAdd });
  }
  return allocations;
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
  requiredPeriodsPerWeek,
  assignedPeriodsPerWeek,
  remainingPeriodsPerWeek,
  currentAssignments,
  assignmentStatus,
  onUnassign,
  isUnassigning,
  canEdit,
}: {
  mode: AssignmentDrawerMode;
  targetClass: ClassGroup | null;
  targetSubject: Subject | null;
  requiredPeriodsPerWeek: number;
  assignedPeriodsPerWeek: number;
  remainingPeriodsPerWeek: number;
  currentAssignments: ProjectionAssignmentSummary[];
  assignmentStatus: 'assigned' | 'unassigned' | 'partial' | 'conflict';
  onUnassign: (teacherId: number) => void;
  isUnassigning: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();

  if (mode !== 'assign' || !targetClass || !targetSubject) return null;

  return (
    <div className="border-b border-slate-200 bg-linear-to-b from-white to-slate-50/80 p-3">
      <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 rounded-xl bg-blue-100 px-2.5 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-[#003366]" />
            <span className="font-medium text-[#003366]">{targetSubject.name}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-slate-600" />
            <span className="font-medium text-slate-700">
              {targetClass.displayName || targetClass.name}
            </span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <AssignmentStatusBadge status={assignmentStatus} size="sm" showTooltip={false} />
            <Badge
              variant="secondary"
              className="border border-blue-200 bg-blue-100 text-xs text-[#003366]"
            >
              {requiredPeriodsPerWeek} {t('common.periodsPerWeek', 'ساعت/هفته')}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('assignments.drawer.requiredPeriods', 'نیاز کل')}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{requiredPeriodsPerWeek}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('assignments.drawer.assignedPeriods', 'تخصیص شده')}
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-700">{assignedPeriodsPerWeek}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('assignments.drawer.remainingPeriods', 'باقیمانده')}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-700">
              {remainingPeriodsPerWeek}
            </p>
          </div>
        </div>

        {currentAssignments.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {t('assignments.drawer.currentAssignments', 'تخصیص‌های فعلی')}
              </p>
              <Badge variant="outline" className="rounded-full text-[11px]">
                {currentAssignments.length} {t('common.items', 'مورد')}
              </Badge>
            </div>
            {currentAssignments.map((assignment) => (
              <div
                key={assignment.assignmentId}
                className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-medium text-amber-800">
                    {getInitials(assignment.teacherName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amber-900">
                      {assignment.teacherName}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      {assignment.assignedPeriodsPerWeek}{' '}
                      {t('common.periodsPerWeek', 'ساعت/هفته')}
                    </p>
                  </div>
                </div>
                {canEdit && <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onUnassign(assignment.teacherId)}
                  disabled={isUnassigning}
                >
                  {isUnassigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span className="ms-1 text-xs">{t('assignments.drawer.remove', 'حذف')}</span>
                </Button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            {t(
              'assignments.drawer.noCurrentAssignment',
              'برای این نیازمندی هنوز معلمی تخصیص داده نشده است.'
            )}
          </div>
        )}
      </div>
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

  // Group by subject for display
  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of selectedCells) {
      const key = cell.subjectName || `Subject ${cell.subjectId}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [selectedCells]);

  const classCount = useMemo(
    () => new Set(selectedCells.map((cell) => cell.classId)).size,
    [selectedCells]
  );

  if (selectedCells.length === 0) return null;

  return (
    <div className="border-b border-slate-200 bg-linear-to-b from-white to-slate-50/80 p-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {t('assignments.drawer.selectedItems', 'موارد انتخاب شده')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                'assignments.drawer.bulkHint',
                'معلم انتخاب‌شده روی همه نیازمندی‌های این مجموعه اعمال می‌شود.'
              )}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="border border-blue-200 bg-blue-100 text-[#003366]"
          >
            {selectedCells.length} {t('common.items', 'مورد')}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('assignments.drawer.classes', 'صنف‌ها')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{classCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('assignments.drawer.subjects', 'مضامین')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{bySubject.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              {t('assignments.drawer.totalPeriods', 'مجموع ساعات')}
            </p>
            <p className="mt-1 text-lg font-semibold text-[#003366]">{totalPeriods}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {bySubject.slice(0, 5).map(([subject, count]) => (
            <Badge
              key={subject}
              variant="outline"
              className="border-blue-200 bg-blue-50 text-xs text-[#003366]"
            >
              {subject} ({count})
            </Badge>
          ))}
          {bySubject.length > 5 && (
            <Badge variant="outline" className="text-xs text-slate-400">
              +{bySubject.length - 5}
            </Badge>
          )}
        </div>
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
  getSubjectById,
  getClassById,
  className,
}: AssignmentDrawerV2Props) {
  const { t } = useTranslation();
  const applyBatch = useApplyAssignmentBatch();

  // Track which teacher is currently being assigned (prevents rapid clicks)
  const [assigningTeacherId, setAssigningTeacherId] = useState<number | null>(null);

  // Get target data for single assignment
  const targetClass = classId ? (getClassById(classId) ?? null) : null;
  const targetSubject = subjectId ? (getSubjectById(subjectId) ?? null) : null;
  const isAlphaPrimary =
    targetClass?.grade !== null && targetClass?.grade !== undefined &&
    targetClass.grade >= 1 && targetClass.grade <= 3;
  const { data: classAssignmentView } = useClassAssignmentView(mode === 'assign' ? classId : null);
  const { data: assignmentMatrix } = useAssignmentMatrixView();
  const currentRequirement = useMemo(
    () =>
      subjectId
        ? (classAssignmentView?.requirements.find((requirement) => requirement.subjectId === subjectId) ?? null)
        : null,
    [classAssignmentView, subjectId]
  );

  const currentAssignments = useMemo(
    () => currentRequirement?.assignments ?? [],
    [currentRequirement]
  );
  const currentTeacherIds = useMemo(
    () => currentAssignments.map((assignment) => assignment.teacherId),
    [currentAssignments]
  );
  const assignmentStatus = currentRequirement
    ? getProjectionRequirementStatus(currentRequirement)
    : 'unassigned';

  const [allocationPeriods, setAllocationPeriods] = useState(1);
  useEffect(() => {
    const remaining = currentRequirement?.remainingPeriodsPerWeek ?? 1;
    setAllocationPeriods(Math.max(1, remaining));
  }, [currentRequirement?.requirementId, currentRequirement?.remainingPeriodsPerWeek]);

  const requirementByCell = useMemo(() => {
    const map = new Map<string, ProjectionRequirementView>();
    for (const classView of assignmentMatrix?.classes ?? []) {
      for (const requirement of classView.requirements) {
        map.set(`${requirement.classId}:${requirement.subjectId}`, requirement);
      }
    }
    return map;
  }, [assignmentMatrix]);

  // Calculate periods to add
  const periodsToAdd = useMemo(() => {
    if (mode === 'assign') {
      if (currentRequirement) {
        return currentRequirement.remainingPeriodsPerWeek;
      }
      return targetSubject?.periodsPerWeek || 0;
    }
    if (mode === 'bulk-assign') {
      return selectedCells.reduce((sum, cell) =>
        sum + (requirementByCell.get(`${cell.classId}:${cell.subjectId}`)?.remainingPeriodsPerWeek ?? 0),
      0);
    }
    return 0;
  }, [mode, currentRequirement, requirementByCell, selectedCells, targetSubject]);

  // Get the subject ID for teacher selection
  const targetSubjectId = subjectId || selectedCells[0]?.subjectId || 0;
  const eligibleSubjectIds = useMemo(
    () => [...new Set(
      mode === 'assign' && subjectId ? [subjectId] : selectedCells.map((cell) => cell.subjectId)
    )],
    [mode, selectedCells, subjectId]
  );

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
          if (!currentRequirement) return;
          const allocations = currentRequirement.allowSplitAssignment
            ? addAllocation(currentRequirement, teacherId, allocationPeriods)
            : [{ teacherId, periodsPerWeek: currentRequirement.requiredPeriodsPerWeek }];

          await applyBatch.mutateAsync([{
            requirementId: currentRequirement.requirementId,
            expectedVersion: currentRequirement.assignmentVersion,
            allocations,
          }]);

          // Don't close drawer (per user preference)
        } else if (mode === 'bulk-assign' && selectedCells.length > 0) {
          const changes = selectedCells.flatMap((cell) => {
            const requirement = requirementByCell.get(`${cell.classId}:${cell.subjectId}`);
            if (!requirement || requirement.remainingPeriodsPerWeek <= 0) return [];
            const allocations = requirement.allowSplitAssignment
              ? addAllocation(requirement, teacherId, requirement.remainingPeriodsPerWeek)
              : [{ teacherId, periodsPerWeek: requirement.requiredPeriodsPerWeek }];
            return [{
              requirementId: requirement.requirementId,
              expectedVersion: requirement.assignmentVersion,
              allocations,
            }];
          });
          if (changes.length > 0) await applyBatch.mutateAsync(changes);

          // Don't close drawer (per user preference)
        }
      } finally {
        // Clear loading state
        setAssigningTeacherId(null);
      }
    },
    [mode, classId, subjectId, selectedCells, currentRequirement, allocationPeriods,
      requirementByCell, applyBatch, assigningTeacherId]
  );

  const handleUnassign = useCallback(async (teacherId: number) => {
    if (!classId || !subjectId) return;

    if (!currentRequirement) return;
    await applyBatch.mutateAsync([{
      requirementId: currentRequirement.requirementId,
      expectedVersion: currentRequirement.assignmentVersion,
      allocations: currentRequirement.assignments
        .filter((assignment) => assignment.teacherId !== teacherId)
        .map((assignment) => ({
          teacherId: assignment.teacherId,
          periodsPerWeek: assignment.assignedPeriodsPerWeek,
        })),
    }]);

    // Don't close drawer
  }, [classId, subjectId, currentRequirement, applyBatch]);

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
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden bg-linear-to-br from-slate-50 to-white',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 shadow-sm">
            {mode === 'bulk-assign' ? (
              <Users className="h-4.5 w-4.5 text-[#003366]" />
            ) : (
              <User className="h-4.5 w-4.5 text-[#003366]" />
            )}
          </div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label={t('common.close', 'بستن')}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Context Bar (Single mode) */}
      <AssignmentContextBar
        mode={mode}
        targetClass={targetClass}
        targetSubject={targetSubject}
        requiredPeriodsPerWeek={
          currentRequirement?.requiredPeriodsPerWeek ?? targetSubject?.periodsPerWeek ?? 0
        }
        assignedPeriodsPerWeek={currentRequirement?.assignedPeriodsPerWeek ?? 0}
        remainingPeriodsPerWeek={currentRequirement?.remainingPeriodsPerWeek ?? periodsToAdd}
        currentAssignments={currentAssignments}
        assignmentStatus={assignmentStatus}
        onUnassign={handleUnassign}
        isUnassigning={applyBatch.isPending}
        canEdit={!isAlphaPrimary}
      />

      {mode === 'assign' && currentRequirement?.allowSplitAssignment &&
        currentRequirement.remainingPeriodsPerWeek > 0 && (
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <label htmlFor="assignment-allocation-periods" className="mb-1 block text-sm font-medium text-slate-700">
              {t('assignments.drawer.allocationPeriods', 'ساعات تخصیص به این معلم')}
            </label>
            <Input
              id="assignment-allocation-periods"
              type="number"
              min={1}
              max={currentRequirement.remainingPeriodsPerWeek}
              value={allocationPeriods}
              onChange={(event) => setAllocationPeriods(Math.max(
                1,
                Math.min(currentRequirement.remainingPeriodsPerWeek, Number(event.target.value) || 1)
              ))}
            />
          </div>
        )}

      {/* Bulk Summary (Bulk mode) */}
      {mode === 'bulk-assign' && (
        <BulkAssignmentSummary selectedCells={selectedCells} totalPeriods={periodsToAdd} />
      )}

      {/* Teacher Selection List */}
      <div className="flex-1 min-h-0 p-3">
        {mode === 'assign' && isAlphaPrimary ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center text-sm text-blue-800">
            {t(
              'assignments.drawer.alphaManagedByClassTeacher',
              'تخصیص صنف‌های پایه ۱ تا ۳ از معلم نگران صنف به‌صورت خودکار ساخته می‌شود.'
            )}
          </div>
        ) : targetSubjectId > 0 ? (
          <TeacherSelectionList
            subjectId={targetSubjectId}
            eligibleSubjectIds={eligibleSubjectIds}
            periodsToAdd={periodsToAdd}
            onAssign={handleAssign}
            assigningTeacherId={assigningTeacherId}
            currentTeacherIds={currentTeacherIds}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-sm">{t('assignments.drawer.selectSubject', 'مضمون انتخاب نشده')}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white/70 px-4 py-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {t('common.close', 'بستن')}
        </Button>
      </div>
    </div>
  );
}

export default AssignmentDrawerV2;
