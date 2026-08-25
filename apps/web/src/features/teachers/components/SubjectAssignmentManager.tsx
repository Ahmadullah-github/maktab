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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  useApplyAssignmentBatch,
  useValidateAssignmentBatch,
  type AssignmentBatchChange,
  type AssignmentBatchResult,
} from '@/features/assignments/hooks/useAssignmentMutations';
import {
  useAssignmentMatrixView,
  useTeacherWorkloadView,
} from '@/features/assignments/projections';
import { determineWorkloadStatus } from '@/features/assignments/services/workloadCalculation';
import { ClassSubjectPeriodEditor } from '@/features/classes/components/ClassSubjectPeriodEditor';
import { useUpdateClassSubjectPeriods } from '@/features/classes/hooks/useClasses';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';
import type { Subject } from '@/features/subjects/types';
import { api } from '@/lib/api';
import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Square,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Teacher, TeacherFormValues } from '../types';
import { ensureArray } from '../utils/serialization';
import {
  buildTeacherAssignmentBatchChanges,
  buildTeacherSubjectOpportunities,
  matchesTeacherSubjectOpportunity,
  sortTeacherSubjectOpportunities,
  type TeacherClassOpportunity,
  type TeacherSubjectOpportunity,
} from '../utils/teacherAssignmentOpportunities';
import { SubjectAssignmentRow, type ClassInfo, type SubjectInfo } from './SubjectAssignmentRow';
import { WorkloadProgressHeader } from './WorkloadProgressHeader';

export interface SubjectAssignmentManagerProps {
  teacher: Teacher;
  onUpdate: (data: Partial<TeacherFormValues>) => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

interface PendingOverride {
  changes: AssignmentBatchChange[];
  overrideClasses: TeacherClassOpportunity[];
  warnings: AssignmentBatchResult['warnings'];
}

function getAssignedClasses(
  opportunity: TeacherSubjectOpportunity,
  teacherId: number
): ClassInfo[] {
  return opportunity.requirements.flatMap((requirement) => {
    const periods = requirement.assignments
      .filter((assignment) => assignment.teacherId === teacherId)
      .reduce((sum, assignment) => sum + assignment.assignedPeriodsPerWeek, 0);
    return periods > 0
      ? [
          {
            id: requirement.classId,
            name: requirement.className,
            displayName: requirement.className,
            periodsPerWeek: periods,
            requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
          },
        ]
      : [];
  });
}

function getManageableClasses(
  opportunity: TeacherSubjectOpportunity,
  showAllSubjects: boolean
): TeacherClassOpportunity[] {
  return opportunity.requirements.filter(
    (requirement) => requirement.status !== 'fully_assigned_other' || showAllSubjects
  );
}

export function SubjectAssignmentManager({
  teacher,
  onUpdate,
  isUpdating = false,
  className,
}: SubjectAssignmentManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);

  const { data: allSubjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: assignmentMatrix, isLoading: isLoadingAssignments } = useAssignmentMatrixView();
  const { data: workloadView } = useTeacherWorkloadView(teacher.id);
  const validateBatch = useValidateAssignmentBatch();
  const applyBatch = useApplyAssignmentBatch();
  const updatePeriods = useUpdateClassSubjectPeriods();

  const updateCapabilityMutation = useMutation({
    mutationFn: (input: {
      subjectId: number;
      capabilityLevel: 'primary' | 'allowed' | null;
      removeAssignments?: boolean;
    }) =>
      api.assignmentCommands.updateTeacherCapability({
        teacherId: teacher.id,
        subjectId: input.subjectId,
        capabilityLevel: input.capabilityLevel,
        removeAssignments: input.removeAssignments ?? false,
      }),
    onSuccess: () => invalidateAssignmentCaches(queryClient),
  });

  const subjects = useMemo(
    () => allSubjects.filter((subject) => !subject.isDeleted),
    [allSubjects]
  );
  const requirements = useMemo(
    () => assignmentMatrix?.classes.flatMap((classGroup) => classGroup.requirements) ?? [],
    [assignmentMatrix]
  );
  const opportunities = useMemo(
    () => buildTeacherSubjectOpportunities(subjects, requirements, teacher.id),
    [requirements, subjects, teacher.id]
  );

  const visibleGroups = useMemo(() => {
    const matching = opportunities.filter((opportunity) =>
      matchesTeacherSubjectOpportunity(opportunity, searchQuery)
    );
    return {
      needs: sortTeacherSubjectOpportunities(
        matching.filter((opportunity) => opportunity.group === 'needs')
      ),
      current: sortTeacherSubjectOpportunities(
        matching.filter((opportunity) => opportunity.group === 'current')
      ),
      other: showAllSubjects
        ? sortTeacherSubjectOpportunities(
            matching.filter(
              (opportunity) => opportunity.group === 'hidden' || opportunity.group === 'no_demand'
            )
          )
        : [],
    };
  }, [opportunities, searchQuery, showAllSubjects]);

  const hiddenSubjectCount = useMemo(
    () =>
      opportunities.filter(
        (opportunity) => opportunity.group === 'hidden' || opportunity.group === 'no_demand'
      ).length,
    [opportunities]
  );

  const primarySubjectIds = useMemo(
    () => ensureArray<number>(teacher.primarySubjectIds),
    [teacher.primarySubjectIds]
  );
  const allowedSubjectIds = useMemo(
    () => ensureArray<number>(teacher.allowedSubjectIds),
    [teacher.allowedSubjectIds]
  );
  const restrictToPrimary = teacher.restrictToPrimarySubjects;

  const workload = useMemo(() => {
    const effectiveMax = workloadView?.effectiveCapacityPerWeek ?? teacher.maxPeriodsPerWeek;
    const assigned = workloadView?.assignedPeriodsPerWeek ?? 0;
    return {
      totalPeriods: assigned,
      maxPeriods: effectiveMax,
      contractedMaxPeriods: workloadView?.contractedMaxPeriodsPerWeek ?? teacher.maxPeriodsPerWeek,
      availableSlots: effectiveMax,
      status: determineWorkloadStatus(assigned, effectiveMax),
      remainingCapacity: workloadView?.remainingCapacityPerWeek ?? effectiveMax - assigned,
    };
  }, [teacher.maxPeriodsPerWeek, workloadView]);

  const activeOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.subject.id === activeSubjectId) ?? null,
    [activeSubjectId, opportunities]
  );

  const handleToggleSubjectEnabled = useCallback(
    async (subjectId: number, enabled: boolean) => {
      await updateCapabilityMutation.mutateAsync({
        subjectId,
        capabilityLevel: enabled ? 'primary' : null,
        removeAssignments: !enabled,
      });
    },
    [updateCapabilityMutation]
  );

  const handleTogglePrimary = useCallback(
    async (subjectId: number, isPrimary: boolean) => {
      await updateCapabilityMutation.mutateAsync({
        subjectId,
        capabilityLevel: isPrimary ? 'primary' : 'allowed',
      });
    },
    [updateCapabilityMutation]
  );

  const handleRestrictChange = useCallback(
    async (restricted: boolean) => {
      if (restricted) {
        await onUpdate({
          restrictToPrimarySubjects: true,
          primarySubjectIds: [...new Set([...primarySubjectIds, ...allowedSubjectIds])],
          allowedSubjectIds: [],
        });
      } else {
        await onUpdate({ restrictToPrimarySubjects: false });
      }
    },
    [allowedSubjectIds, onUpdate, primarySubjectIds]
  );

  const handleRemoveClass = useCallback(
    async (subjectId: number, classId: number) => {
      const opportunity = opportunities.find((item) => item.subject.id === subjectId);
      const requirement = opportunity?.requirements.find((item) => item.classId === classId);
      if (!requirement) return;

      const allocations = requirement.assignments
        .filter((assignment) => assignment.teacherId !== teacher.id)
        .map((assignment) => ({
          teacherId: assignment.teacherId,
          periodsPerWeek: assignment.assignedPeriodsPerWeek,
        }));
      await applyBatch.mutateAsync({
        changes: [
          {
            requirementId: requirement.requirementId,
            expectedVersion: requirement.assignmentVersion,
            allocations,
          },
        ],
      });
    },
    [applyBatch, opportunities, teacher.id]
  );

  const handleAddClasses = useCallback(
    async (selectedClasses: TeacherClassOpportunity[], periodOverrides: Record<number, number>) => {
      let changes: AssignmentBatchChange[];
      try {
        changes = buildTeacherAssignmentBatchChanges(selectedClasses, teacher.id, periodOverrides);
      } catch (error) {
        toast.error(t('teachers.invalidPeriods', 'ساعات انتخاب‌شده معتبر نیست'), {
          description: error instanceof Error ? error.message : undefined,
        });
        return;
      }

      try {
        const validation = await validateBatch.mutateAsync({ changes });
        if (!validation.isValid) {
          toast.error(t('teachers.assignmentBlocked', 'تخصیص امکان‌پذیر نیست'), {
            description: validation.conflicts
              .map((conflict) => conflict.messageFa || conflict.message)
              .join('\n'),
          });
          return;
        }

        const overrideClasses = selectedClasses.filter((item) => item.requiresOverride);
        if (overrideClasses.length > 0) {
          setPendingOverride({ changes, overrideClasses, warnings: validation.warnings });
          return;
        }

        await applyBatch.mutateAsync({ changes });
        setActiveSubjectId(null);
      } catch (error) {
        toast.error(t('teachers.assignmentBlocked', 'تخصیص امکان‌پذیر نیست'), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [applyBatch, t, teacher.id, validateBatch]
  );

  const handleConfirmOverride = useCallback(async () => {
    if (!pendingOverride) return;
    try {
      await applyBatch.mutateAsync({ changes: pendingOverride.changes });
      setPendingOverride(null);
      setActiveSubjectId(null);
    } catch {
      // The batch mutation surfaces the authoritative conflict and keeps both dialogs open.
    }
  }, [applyBatch, pendingOverride]);

  const isLoading = isLoadingSubjects || isLoadingAssignments;
  const isMutating =
    isUpdating ||
    updateCapabilityMutation.isPending ||
    updatePeriods.isPending ||
    validateBatch.isPending ||
    applyBatch.isPending;
  const hasVisibleSubjects =
    visibleGroups.needs.length + visibleGroups.current.length + visibleGroups.other.length > 0;

  const renderSubject = (opportunity: TeacherSubjectOpportunity) => {
    const subject = opportunity.subject;
    const isEnabled =
      primarySubjectIds.includes(subject.id) || allowedSubjectIds.includes(subject.id);
    const isPrimary = primarySubjectIds.includes(subject.id);
    const assignedClasses = getAssignedClasses(opportunity, teacher.id);
    const subjectInfo: SubjectInfo = {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      periodsPerWeek: subject.periodsPerWeek,
      grade: subject.grade,
    };

    return (
      <SubjectAssignmentRow
        key={subject.id}
        subject={subjectInfo}
        isEnabled={isEnabled}
        isPrimary={isPrimary}
        assignedClasses={assignedClasses}
        totalPeriods={assignedClasses.reduce((sum, item) => sum + item.periodsPerWeek, 0)}
        opportunitySummary={{
          unassigned: opportunity.unassignedCount,
          partial: opportunity.partialCount,
          assignedToOthers: opportunity.fullyAssignedOtherCount,
          noDemand: opportunity.group === 'no_demand',
        }}
        onToggleEnabled={(enabled) => handleToggleSubjectEnabled(subject.id, enabled)}
        onTogglePrimary={(primary) => handleTogglePrimary(subject.id, primary)}
        onAddClassClick={() => setActiveSubjectId(subject.id)}
        canAddClass={getManageableClasses(opportunity, showAllSubjects).length > 0}
        onRemoveClass={(classId) => handleRemoveClass(subject.id, classId)}
        disabled={isMutating}
        restrictToPrimary={restrictToPrimary}
      />
    );
  };

  const renderSection = (
    title: string,
    description: string,
    items: TeacherSubjectOpportunity[],
    tone: 'blue' | 'emerald' | 'slate'
  ) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2" aria-label={title}>
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
            <p className="truncate text-[11px] text-slate-400">{description}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'h-5 min-w-6 justify-center px-1.5 text-[10px]',
              tone === 'blue' && 'border-blue-200 bg-blue-50 text-blue-700',
              tone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              tone === 'slate' && 'border-slate-200 bg-slate-50 text-slate-600'
            )}
          >
            {items.length}
          </Badge>
        </div>
        <div className="space-y-2">{items.map(renderSubject)}</div>
      </section>
    );
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="px-1 pb-3">
        <WorkloadProgressHeader
          currentPeriods={workload.totalPeriods}
          maxPeriods={workload.maxPeriods}
          status={workload.status}
          remainingCapacity={workload.remainingCapacity}
          contractedMaxPeriods={workload.contractedMaxPeriods}
          availableSlots={workload.availableSlots}
        />
      </div>

      <div className="space-y-2 px-1 pb-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('teachers.searchSubjectsOrClasses', 'جستجوی مضمون یا صنف...')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 border-2 border-slate-200 ps-9 text-sm focus:border-blue-400"
            disabled={isLoading}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAllSubjects((current) => !current)}
          className={cn(
            'h-8 w-full justify-between rounded-lg border-slate-200 px-3 text-xs',
            showAllSubjects && 'border-amber-200 bg-amber-50 text-amber-800'
          )}
        >
          <span className="flex items-center gap-2">
            {showAllSubjects ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAllSubjects
              ? t('teachers.hideCompletedSubjects', 'پنهان‌کردن مضامین تکمیل‌شده')
              : t('teachers.showAllSubjects', 'نمایش همه مضامین')}
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {hiddenSubjectCount}
          </Badge>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : !hasVisibleSubjects ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">
              {searchQuery
                ? t('teachers.noSubjectsFound', 'مضمونی یافت نشد')
                : t('teachers.noAssignmentOpportunities', 'نیازمندی بازی برای تخصیص وجود ندارد')}
            </p>
            {!showAllSubjects && hiddenSubjectCount > 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAllSubjects(true)}
                className="mt-2 text-xs text-blue-600"
              >
                {t('teachers.showAllSubjects', 'نمایش همه مضامین')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {renderSection(
              t('teachers.needsAssignment', 'نیازمند تخصیص'),
              t('teachers.needsAssignmentDesc', 'مضامین تخصیص‌نشده و نیمه‌تخصیص'),
              visibleGroups.needs,
              'blue'
            )}
            {renderSection(
              t('teachers.currentAssignments', 'تخصیص‌های فعلی'),
              t('teachers.currentAssignmentsDesc', 'تخصیص‌های تکمیل‌شده این معلم'),
              visibleGroups.current,
              'emerald'
            )}
            {renderSection(
              t('teachers.otherSubjects', 'سایر مضامین'),
              t('teachers.otherSubjectsDesc', 'تکمیل‌شده توسط دیگران یا بدون نیاز صنف'),
              visibleGroups.other,
              'slate'
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-slate-200 px-1 pt-3">
        <div className="flex items-center gap-3 rounded-xl border-2 border-slate-100 bg-slate-50 p-3">
          <Switch
            id="restrict-toggle"
            checked={restrictToPrimary}
            onCheckedChange={handleRestrictChange}
            disabled={isMutating}
            className="shrink-0"
          />
          <div className="flex flex-1 flex-col gap-0.5">
            <Label
              htmlFor="restrict-toggle"
              className="cursor-pointer text-sm font-medium text-slate-700"
            >
              {t('teachers.restrictToPrimary', 'محدود به مضامین اصلی')}
            </Label>
            <span className="text-xs text-slate-500">
              {t('teachers.restrictToPrimaryDesc', 'فقط مضامین اصلی قابل تدریس باشند')}
            </span>
          </div>
        </div>
      </div>

      {activeOpportunity && (
        <AddClassDialog
          subject={activeOpportunity.subject}
          classes={getManageableClasses(activeOpportunity, showAllSubjects)}
          hasRequiredClasses={activeOpportunity.requirements.length > 0}
          onAdd={handleAddClasses}
          onUpdateRequiredPeriods={(classId, periodsPerWeek) =>
            updatePeriods.mutateAsync({
              classId,
              subjectId: activeOpportunity.subject.id,
              periodsPerWeek,
            })
          }
          onClose={() => setActiveSubjectId(null)}
          isAdding={isMutating}
        />
      )}

      <OverrideConfirmationDialog
        pending={pendingOverride}
        teacherName={teacher.fullName}
        isApplying={applyBatch.isPending}
        onCancel={() => setPendingOverride(null)}
        onConfirm={handleConfirmOverride}
      />
    </div>
  );
}

function AddClassDialog({
  subject,
  classes,
  hasRequiredClasses,
  onAdd,
  onUpdateRequiredPeriods,
  onClose,
  isAdding,
}: {
  subject: Subject;
  classes: TeacherClassOpportunity[];
  hasRequiredClasses: boolean;
  onAdd: (
    selectedClasses: TeacherClassOpportunity[],
    periodOverrides: Record<number, number>
  ) => Promise<void>;
  onUpdateRequiredPeriods: (classId: number, periodsPerWeek: number) => Promise<unknown>;
  onClose: () => void;
  isAdding: boolean;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [periodOverrides] = useState<Record<number, number>>({});

  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return classes;
    return classes.filter((item) => item.className.toLocaleLowerCase().includes(query));
  }, [classes, searchQuery]);
  const filteredSelectableClasses = useMemo(
    () => filteredClasses.filter((item) => item.status !== 'current'),
    [filteredClasses]
  );

  const getConfiguredPeriods = useCallback(
    (classItem: TeacherClassOpportunity) =>
      classItem.status === 'current'
        ? classItem.selectedTeacherPeriods
        : classItem.requiresOverride
          ? classItem.requiredPeriodsPerWeek
          : (periodOverrides[classItem.classId] ?? classItem.remainingPeriodsPerWeek),
    [periodOverrides]
  );

  const selectedClasses = useMemo(
    () => classes.filter((classItem) => selectedIds.has(classItem.classId)),
    [classes, selectedIds]
  );
  const selectedPeriods = useMemo(
    () => selectedClasses.reduce((sum, item) => sum + getConfiguredPeriods(item), 0),
    [getConfiguredPeriods, selectedClasses]
  );
  const overrideCount = selectedClasses.filter((item) => item.requiresOverride).length;

  const toggleClass = useCallback(
    (classId: number) => {
      const classItem = classes.find((item) => item.classId === classId);
      if (!classItem || classItem.status === 'current') return;
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(classId)) next.delete(classId);
        else next.add(classId);
        return next;
      });
    },
    [classes]
  );

  const allVisibleSelected =
    filteredSelectableClasses.length > 0 &&
    filteredSelectableClasses.every((classItem) => selectedIds.has(classItem.classId));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(88vh,46rem)] w-[min(94vw,38rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <GraduationCap className="h-4 w-4" />
            </span>
            {t('teachers.assignClassesFor', 'تخصیص صنف‌ها برای')} {subject.name}
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs text-slate-500">
            {t(
              'teachers.assignmentOpportunityHint',
              'نیازمندی‌های باز در اولویت هستند. موارد تکمیل‌شده با نشان بازنویسی مشخص شده‌اند.'
            )}
          </DialogDescription>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('teachers.searchClasses', 'جستجوی صنف...')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-xl border-slate-200 bg-slate-50 ps-10 text-sm"
            />
          </div>
        </div>

        {filteredClasses.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
            <span className="text-xs text-slate-500">
              {filteredClasses.length} {t('teachers.classesAvailable', 'صنف موجود')}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={filteredSelectableClasses.length === 0 || allVisibleSelected}
                onClick={() =>
                  setSelectedIds(
                    (current) =>
                      new Set([
                        ...current,
                        ...filteredSelectableClasses.map((item) => item.classId),
                      ])
                  )
                }
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {t('common.selectAll', 'انتخاب همه')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                <Square className="h-3.5 w-3.5" />
                {t('common.deselectAll', 'لغو انتخاب')}
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 bg-white">
          {filteredClasses.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <GraduationCap className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {!hasRequiredClasses
                  ? t('teachers.noClassesRequireSubject', 'هیچ صنفی به این مضمون نیاز ندارد')
                  : classes.length === 0
                    ? t('teachers.noClassesAvailable', 'همه صنف‌ها به این معلم تخصیص یافته‌اند')
                    : t('teachers.noClassesFound', 'صنفی یافت نشد')}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredClasses.map((classItem) => {
                const selected = selectedIds.has(classItem.classId);
                const isPartial = classItem.status === 'partial';
                const isCurrent = classItem.status === 'current';
                return (
                  <div
                    key={classItem.requirementId}
                    onClick={() => !isCurrent && toggleClass(classItem.classId)}
                    className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                      isCurrent ? 'cursor-default' : 'cursor-pointer',
                      classItem.requiresOverride
                        ? selected
                          ? 'border-red-300 bg-red-50'
                          : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                        : selected
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleClass(classItem.classId)}
                      disabled={isCurrent || isAdding}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('teachers.selectClass', 'انتخاب صنف')}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">
                          {classItem.className}
                        </span>
                        {classItem.status === 'unassigned' && (
                          <Badge className="bg-blue-100 text-[10px] text-blue-700 hover:bg-blue-100">
                            {t('teachers.unassigned', 'تخصیص‌نشده')}
                          </Badge>
                        )}
                        {isPartial && (
                          <Badge className="bg-amber-100 text-[10px] text-amber-700 hover:bg-amber-100">
                            {t('teachers.partiallyAssigned', 'نیمه‌تخصیص')}
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge className="bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100">
                            {t('teachers.assignedToThisTeacher', 'تخصیص‌یافته به این معلم')}
                          </Badge>
                        )}
                        {classItem.requiresOverride && (
                          <Badge className="gap-1 bg-red-100 text-[10px] text-red-700 hover:bg-red-100">
                            <AlertTriangle className="h-3 w-3" />
                            {t('teachers.overrideRequired', 'نیازمند بازنویسی')}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {classItem.assignedPeriodsPerWeek}/{classItem.requiredPeriodsPerWeek}{' '}
                        {t('common.period', 'ساعت')} ·{' '}
                        {classItem.requiresOverride
                          ? classItem.assignments
                              .map(
                                (assignment) =>
                                  `${assignment.teacherName} (${assignment.assignedPeriodsPerWeek})`
                              )
                              .join('، ')
                          : t('teachers.remainingPeriods', '{{count}} ساعت باقی‌مانده', {
                              count: classItem.remainingPeriodsPerWeek,
                            })}
                      </p>
                    </div>
                    <div
                      className="mt-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <ClassSubjectPeriodEditor
                        value={classItem.requiredPeriodsPerWeek}
                        assignedPeriods={classItem.assignedPeriodsPerWeek}
                        gradeDefaultPeriods={subject.periodsPerWeek}
                        periodMode={classItem.periodMode}
                        onSave={(periodsPerWeek) =>
                          onUpdateRequiredPeriods(classItem.classId, periodsPerWeek)
                        }
                        disabled={isAdding}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-xs text-slate-500">
            {selectedIds.size > 0 && (
              <>
                <span className="font-semibold text-blue-700">{selectedIds.size}</span>{' '}
                {t('teachers.classesSelected', 'صنف انتخاب شده')} ·{' '}
                <span className="font-semibold text-emerald-700">+{selectedPeriods}</span>{' '}
                {t('common.period', 'ساعت')}
              </>
            )}
            {overrideCount > 0 && (
              <div className="mt-1 font-medium text-red-600">
                {t('teachers.overrideCount', '{{count}} مورد نیازمند تأیید بازنویسی', {
                  count: overrideCount,
                })}
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => void onAdd(selectedClasses, periodOverrides)}
            disabled={selectedIds.size === 0 || isAdding}
            className={cn(
              'h-10 gap-2 rounded-xl px-4',
              overrideCount > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {overrideCount > 0
              ? t('teachers.reviewOverride', 'بررسی بازنویسی')
              : t('common.add', 'افزودن')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverrideConfirmationDialog({
  pending,
  teacherName,
  isApplying,
  onCancel,
  onConfirm,
}: {
  pending: PendingOverride | null;
  teacherName: string;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {t('teachers.confirmAssignmentOverride', 'تأیید بازنویسی تخصیص')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-start">
              <p>
                {t(
                  'teachers.overrideExplanation',
                  'تمام تخصیص‌های فعلی موارد زیر حذف شده و ساعات کامل به {{teacher}} انتقال می‌یابد.',
                  { teacher: teacherName }
                )}
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-red-100 bg-red-50/60 p-3">
                {pending?.overrideClasses.map((classItem) => (
                  <div key={classItem.requirementId} className="rounded-lg bg-white p-2.5 text-xs">
                    <div className="font-semibold text-slate-800">{classItem.className}</div>
                    <div className="mt-1 text-slate-500">
                      {classItem.assignments
                        .map(
                          (assignment) =>
                            `${assignment.teacherName}: ${assignment.assignedPeriodsPerWeek}`
                        )
                        .join('، ')}
                    </div>
                    <div className="mt-1 font-medium text-red-700">
                      → {teacherName}: {classItem.requiredPeriodsPerWeek}{' '}
                      {t('common.period', 'ساعت')}
                    </div>
                  </div>
                ))}
              </div>
              {(pending?.warnings.length ?? 0) > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {pending?.warnings.map((warning) => (
                    <div key={`${warning.type}-${warning.message}`}>
                      {warning.messageFa || warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApplying} onClick={onCancel}>
            {t('common.cancel', 'لغو')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isApplying}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            {isApplying && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('teachers.confirmOverride', 'بازنویسی و تخصیص کامل')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SubjectAssignmentManager;
