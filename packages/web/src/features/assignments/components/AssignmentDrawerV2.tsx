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
import { ArrowRight, BookOpen, GraduationCap, Loader2, Trash2, User, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplyAssignmentBatch } from '../hooks/useAssignmentMutations';
import {
  getProjectionRequirementStatus,
  useAssignmentMatrixView,
  useClassAssignmentView,
  type ProjectionAssignmentSummary,
  type ProjectionRequirementView,
} from '../projections';
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
      assignment.assignedPeriodsPerWeek + (assignment.teacherId === teacherId ? periodsToAdd : 0),
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
  currentAssignments: ProjectionAssignmentSummary[];
  assignmentStatus: 'assigned' | 'unassigned' | 'partial' | 'conflict';
  onUnassign: (teacherId: number) => void;
  isUnassigning: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();

  if (mode !== 'assign' || !targetClass || !targetSubject) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-1">
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-1 shadow-sm">
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-blue-100 px-2 py-1/2">
            <BookOpen className="h-2.5 w-3.5 text-[#003366]" />
            <span className="truncate font-small text-[#003366]">{targetSubject.name}</span>
          </div>
          <ArrowRight className="h-2.5 w-3.5 shrink-0 text-slate-400 rtl:rotate-180" />
          <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1/2">
            <GraduationCap className="h-2.5 w-3.5 text-slate-600" />
            <span className="truncate font-small text-slate-700">
              {targetClass.displayName || targetClass.name}
            </span>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            <AssignmentStatusBadge status={assignmentStatus} size="sm" showTooltip={false} />
            <Badge
              variant="secondary"
              className="h-6 border border-blue-200 bg-blue-50 px-2 text-[11px] text-[#003366]"
            >
              {requiredPeriodsPerWeek} {t('common.periodsPerWeek', 'ساعت/هفته')}
            </Badge>
          </div>
        </div>

        {currentAssignments.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
            <span className="text-[11px] font-medium text-slate-500">
              {t('assignments.drawer.currentAssignments', 'فعلی')}:
            </span>
            {currentAssignments.map((assignment) => (
              <div
                key={assignment.assignmentId}
                className="flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pe-1 ps-2"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-[9px] font-semibold text-blue-800">
                  {getInitials(assignment.teacherName)}
                </span>
                <span className="max-w-40 truncate text-xs font-medium text-blue-900">
                  {assignment.teacherName}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-blue-700">
                  {assignment.assignedPeriodsPerWeek}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 rounded-full text-red-600 hover:bg-red-100 hover:text-red-700"
                    onClick={() => onUnassign(assignment.teacherId)}
                    disabled={isUnassigning}
                    aria-label={`${t('assignments.drawer.remove', 'حذف')} ${assignment.teacherName}`}
                  >
                    {isUnassigning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
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
    <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="me-1 text-sm font-medium text-slate-800">
          {t('assignments.drawer.selectedItems', 'موارد انتخاب شده')}
        </span>
        <Badge variant="secondary" className="h-6 bg-blue-100 text-[11px] text-[#003366]">
          {selectedCells.length} {t('common.items', 'مورد')}
        </Badge>
        <Badge variant="secondary" className="h-6 bg-slate-100 text-[11px] text-slate-600">
          {classCount} {t('assignments.drawer.classes', 'صنف')}
        </Badge>
        <Badge variant="secondary" className="h-6 bg-slate-100 text-[11px] text-slate-600">
          {bySubject.length} {t('assignments.drawer.subjects', 'مضمون')}
        </Badge>
        <Badge variant="secondary" className="h-6 bg-emerald-50 text-[11px] text-emerald-700">
          {totalPeriods} {t('common.periodsPerWeek', 'ساعت/هفته')}
        </Badge>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
          {bySubject.slice(0, 5).map(([subject, count]) => (
            <Badge
              key={subject}
              variant="outline"
              className="h-6 max-w-32 truncate border-blue-200 bg-blue-50 text-[10px] text-[#003366]"
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
    targetClass?.grade !== null &&
    targetClass?.grade !== undefined &&
    targetClass.grade >= 1 &&
    targetClass.grade <= 3;
  const { data: classAssignmentView } = useClassAssignmentView(mode === 'assign' ? classId : null);
  const { data: assignmentMatrix } = useAssignmentMatrixView();
  const currentRequirement = useMemo(
    () =>
      subjectId
        ? (classAssignmentView?.requirements.find(
            (requirement) => requirement.subjectId === subjectId
          ) ?? null)
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
      return selectedCells.reduce(
        (sum, cell) =>
          sum +
          (requirementByCell.get(`${cell.classId}:${cell.subjectId}`)?.remainingPeriodsPerWeek ??
            0),
        0
      );
    }
    return 0;
  }, [mode, currentRequirement, requirementByCell, selectedCells, targetSubject]);

  // Get the subject ID for teacher selection
  const targetSubjectId = subjectId || selectedCells[0]?.subjectId || 0;
  const authorizationSubjectIds = useMemo(
    () =>
      mode === 'bulk-assign'
        ? [...new Set(selectedCells.map((cell) => cell.subjectId))]
        : subjectId
          ? [subjectId]
          : [],
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

          await applyBatch.mutateAsync({
            changes: [
              {
                requirementId: currentRequirement.requirementId,
                expectedVersion: currentRequirement.assignmentVersion,
                allocations,
              },
            ],
            primaryCapabilityGrants: [{ teacherId, subjectId }],
          });

          // Don't close drawer (per user preference)
        } else if (mode === 'bulk-assign' && selectedCells.length > 0) {
          const changes = selectedCells.flatMap((cell) => {
            const requirement = requirementByCell.get(`${cell.classId}:${cell.subjectId}`);
            if (!requirement || requirement.remainingPeriodsPerWeek <= 0) return [];
            const allocations = requirement.allowSplitAssignment
              ? addAllocation(requirement, teacherId, requirement.remainingPeriodsPerWeek)
              : [{ teacherId, periodsPerWeek: requirement.requiredPeriodsPerWeek }];
            return [
              {
                requirementId: requirement.requirementId,
                expectedVersion: requirement.assignmentVersion,
                allocations,
              },
            ];
          });
          if (changes.length > 0) {
            const changedSubjectIds = [
              ...new Set(
                selectedCells.flatMap((cell) => {
                  const requirement = requirementByCell.get(`${cell.classId}:${cell.subjectId}`);
                  return requirement && requirement.remainingPeriodsPerWeek > 0
                    ? [cell.subjectId]
                    : [];
                })
              ),
            ];
            const primaryCapabilityGrants = changedSubjectIds.map((changedSubjectId) => ({
              teacherId,
              subjectId: changedSubjectId,
            }));
            await applyBatch.mutateAsync({ changes, primaryCapabilityGrants });
          }

          // Don't close drawer (per user preference)
        }
      } finally {
        // Clear loading state
        setAssigningTeacherId(null);
      }
    },
    [
      mode,
      classId,
      subjectId,
      selectedCells,
      currentRequirement,
      allocationPeriods,
      requirementByCell,
      applyBatch,
      assigningTeacherId,
    ]
  );

  const handleUnassign = useCallback(
    async (teacherId: number) => {
      if (!classId || !subjectId) return;

      if (!currentRequirement) return;
      await applyBatch.mutateAsync({
        changes: [
          {
            requirementId: currentRequirement.requirementId,
            expectedVersion: currentRequirement.assignmentVersion,
            allocations: currentRequirement.assignments
              .filter((assignment) => assignment.teacherId !== teacherId)
              .map((assignment) => ({
                teacherId: assignment.teacherId,
                periodsPerWeek: assignment.assignedPeriodsPerWeek,
              })),
          },
        ],
      });

      // Don't close drawer
    },
    [classId, subjectId, currentRequirement, applyBatch]
  );

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
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-1 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-9 items-center justify-center rounded-lg bg-blue-100 shadow-sm">
            {mode === 'bulk-assign' ? (
              <Users className="h-2.5 w-4.5 text-[#003366]" />
            ) : (
              <User className="h-2.5 w-4.5 text-[#003366]" />
            )}
          </div>
          <h2 className="font-bold text-slate-800">{title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-8"
          onClick={onClose}
          aria-label={t('common.close', 'بستن')}
        >
          <X className="w-4 h-4 text-red-500" />
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
        currentAssignments={currentAssignments}
        assignmentStatus={assignmentStatus}
        onUnassign={handleUnassign}
        isUnassigning={applyBatch.isPending}
        canEdit={!isAlphaPrimary}
      />

      {mode === 'assign' &&
        currentRequirement?.allowSplitAssignment &&
        currentRequirement.remainingPeriodsPerWeek > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
            <label
              htmlFor="assignment-allocation-periods"
              className="text-xs font-medium text-slate-600"
            >
              {t('assignments.drawer.allocationPeriods', 'ساعات برای معلم انتخابی')}
            </label>
            <Input
              id="assignment-allocation-periods"
              type="number"
              min={1}
              max={currentRequirement.remainingPeriodsPerWeek}
              value={allocationPeriods}
              onChange={(event) =>
                setAllocationPeriods(
                  Math.max(
                    1,
                    Math.min(
                      currentRequirement.remainingPeriodsPerWeek,
                      Number(event.target.value) || 1
                    )
                  )
                )
              }
              className="h-8 w-20 text-center"
            />
          </div>
        )}

      {/* Bulk Summary (Bulk mode) */}
      {mode === 'bulk-assign' && (
        <BulkAssignmentSummary selectedCells={selectedCells} totalPeriods={periodsToAdd} />
      )}

      {/* Teacher Selection List */}
      <div className="min-h-0 flex-1 p-2">
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
            authorizationSubjectIds={authorizationSubjectIds}
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
    </div>
  );
}

export default AssignmentDrawerV2;
