/**
 * SubjectAssignmentManager Component
 *
 * Unified component for managing teacher subject capabilities AND class assignments.
 * Replaces both SubjectManager (Subjects tab) and Assignments tab content.
 *
 * Features:
 * - Workload progress header with live updates
 * - Search/filter subjects
 * - Collapsible subject rows with inline class assignments
 * - Add class popover per subject
 * - Restrict to primary toggle
 *
 * Phase 2.1 of SubjectManager Refactoring
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  CheckSquare,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAssignTeacher,
  useUnassignTeacher,
} from '../../assignments/hooks/useAssignmentMutations';
import {
  calculateWorkloadFromAssignments,
  determineWorkloadStatus,
} from '../../assignments/services/workloadCalculation';
import { useClasses } from '../../classes/hooks/useClasses';
import type { SubjectRequirement } from '../../classes/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeacherAssignments } from '../../teacher-assignments';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments';
import {
  calculateMaxPeriodsPerWeek,
  useSchoolConfig,
} from '@/features/school-settings/hooks/useSchoolSettings';
import type { ClassAssignment, Teacher, TeacherFormValues } from '../types';
import { ensureArray } from '../utils/serialization';
import { type AvailableClass } from './AddClassPopover';
import { SubjectAssignmentRow, type ClassInfo, type SubjectInfo } from './SubjectAssignmentRow';
import { WorkloadProgressHeader } from './WorkloadProgressHeader';

export interface SubjectAssignmentManagerProps {
  /** The teacher being edited */
  teacher: Teacher;
  /** Callback to update teacher data */
  onUpdate: (data: Partial<TeacherFormValues>) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Parse subject requirements from class
 */
function parseSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  if (Array.isArray(requirements)) return requirements;
  if (typeof requirements === 'string') {
    try {
      const parsed = JSON.parse(requirements);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface SelectedClassPeriodOverride {
  classId: number;
  periodsPerWeek: number;
}

/**
 * SubjectAssignmentManager - Unified subject capability and assignment management
 */
export function SubjectAssignmentManager({
  teacher,
  onUpdate,
  isUpdating = false,
  className,
}: SubjectAssignmentManagerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePopoverSubjectId, setActivePopoverSubjectId] = useState<number | null>(null);

  // Fetch data - using shared hooks for real-time updates
  const { data: allSubjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: allClasses = [], isLoading: isLoadingClasses } = useClasses();
  const { data: schoolConfig } = useSchoolConfig();
  // Fetch all teacher assignments for multi-teacher period tracking AND real-time updates
  const { data: allTeacherAssignments = [], isLoading: isLoadingAssignments } =
    useTeacherAssignments();

  // Assignment mutations - use the assignment API for proper dual-write
  const assignTeacherMutation = useAssignTeacher();
  const unassignTeacherMutation = useUnassignTeacher();

  // Filter out deleted items
  const subjects = useMemo(() => allSubjects.filter((s) => !s.isDeleted), [allSubjects]);
  const classes = useMemo(() => allClasses.filter((c) => !c.isDeleted), [allClasses]);

  // Calculate school total periods per week
  const schoolTotalPeriods = useMemo(() => {
    if (!schoolConfig) return undefined;
    return calculateMaxPeriodsPerWeek(schoolConfig);
  }, [schoolConfig]);

  // Parse teacher data - use teacher prop for subject capabilities
  const primarySubjectIds = useMemo(
    () => ensureArray<number>(teacher.primarySubjectIds),
    [teacher.primarySubjectIds]
  );
  const allowedSubjectIds = useMemo(
    () => ensureArray<number>(teacher.allowedSubjectIds),
    [teacher.allowedSubjectIds]
  );
  const restrictToPrimary = teacher.restrictToPrimarySubjects;

  const teacherAssignmentRecords = useMemo(
    () =>
      allTeacherAssignments.filter(
        (assignment) => assignment.teacherId === teacher.id && !assignment.isDeleted
      ),
    [allTeacherAssignments, teacher.id]
  );

  const teacherAssignmentsBySubject = useMemo(() => {
    const assignmentMap = new Map<number, TeacherClassSubjectAssignment[]>();

    for (const assignment of teacherAssignmentRecords) {
      const existing = assignmentMap.get(assignment.subjectId) || [];
      existing.push(assignment);
      assignmentMap.set(assignment.subjectId, existing);
    }

    return assignmentMap;
  }, [teacherAssignmentRecords]);

  const classMap = useMemo(() => {
    const map = new Map(classes.map((cls) => [cls.id, cls]));
    return map;
  }, [classes]);

  // REAL-TIME FIX: Derive classAssignments from useTeacherAssignments() instead of teacher prop
  // This ensures real-time updates when assignments change from other features
  const classAssignments = useMemo(() => {
    const assignmentMap = new Map<number, number[]>();

    for (const assignment of teacherAssignmentRecords) {
      const existing = assignmentMap.get(assignment.subjectId) || [];
      existing.push(assignment.classId);
      assignmentMap.set(assignment.subjectId, existing);
    }

    // Convert to ClassAssignment array
    const result: ClassAssignment[] = [];
    for (const [subjectId, classIds] of assignmentMap) {
      result.push({ subjectId, classIds });
    }

    return result;
  }, [teacherAssignmentRecords]);

  // Calculate workload with school total periods for available slots calculation
  // REAL-TIME FIX: Use calculateWorkloadFromAssignments with allTeacherAssignments
  // instead of calculateTeacherWorkload which uses stale teacher.classAssignments
  const workload = useMemo(() => {
    if (subjects.length === 0 || classes.length === 0) {
      return {
        teacherId: teacher.id,
        totalPeriods: 0,
        maxPeriods: teacher.maxPeriodsPerWeek,
        contractedMaxPeriods: teacher.maxPeriodsPerWeek,
        availableSlots: undefined,
        utilizationPercentage: 0,
        breakdown: [],
        status: determineWorkloadStatus(0, teacher.maxPeriodsPerWeek),
        remainingCapacity: teacher.maxPeriodsPerWeek,
      };
    }

    // Filter assignments for this teacher (exclude deleted)
    const teacherAssignmentRecords = allTeacherAssignments
      .filter((a) => a.teacherId === teacher.id && !a.isDeleted)
      .map((a) => ({
        teacherId: a.teacherId,
        classId: a.classId,
        subjectId: a.subjectId,
        periodsPerWeek: a.periodsPerWeek,
      }));

    // Calculate available slots (total school periods minus unavailable slots)
    const unavailableCount = ensureArray<unknown>(teacher.unavailable).length;
    const availableSlots = schoolTotalPeriods
      ? Math.max(0, schoolTotalPeriods - unavailableCount)
      : undefined;

    // Effective max is the minimum of contracted max and available slots
    const contractedMax = teacher.maxPeriodsPerWeek;
    const effectiveMax =
      availableSlots !== undefined ? Math.min(contractedMax, availableSlots) : contractedMax;

    // Use the real-time assignment data for workload calculation
    const baseWorkload = calculateWorkloadFromAssignments(
      teacher.id,
      teacherAssignmentRecords,
      effectiveMax,
      subjects
    );

    return {
      ...baseWorkload,
      contractedMaxPeriods: contractedMax,
      availableSlots,
    };
  }, [teacher, subjects, classes, schoolTotalPeriods, allTeacherAssignments]);

  // Filter subjects by search
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))
    );
  }, [subjects, searchQuery]);

  // Sort subjects: enabled first, then by name
  const sortedSubjects = useMemo(() => {
    return [...filteredSubjects].sort((a, b) => {
      const aEnabled = primarySubjectIds.includes(a.id) || allowedSubjectIds.includes(a.id);
      const bEnabled = primarySubjectIds.includes(b.id) || allowedSubjectIds.includes(b.id);

      // Enabled subjects first
      if (aEnabled && !bEnabled) return -1;
      if (!aEnabled && bEnabled) return 1;

      // Then by assignment count (subjects with assignments first)
      const aAssignments = classAssignments.find((ca) => ca.subjectId === a.id);
      const bAssignments = classAssignments.find((ca) => ca.subjectId === b.id);
      const aHasAssignments = aAssignments && aAssignments.classIds.length > 0;
      const bHasAssignments = bAssignments && bAssignments.classIds.length > 0;

      if (aHasAssignments && !bHasAssignments) return -1;
      if (!aHasAssignments && bHasAssignments) return 1;

      // Finally by name
      return a.name.localeCompare(b.name, 'fa');
    });
  }, [filteredSubjects, primarySubjectIds, allowedSubjectIds, classAssignments]);

  // Get assigned classes for a subject
  const getAssignedClasses = useCallback(
    (subjectId: number): ClassInfo[] => {
      const assignments = teacherAssignmentsBySubject.get(subjectId) || [];

      return assignments
        .map((assignment) => {
          const cls = classMap.get(assignment.classId);
          if (!cls) return null;

          return {
            id: cls.id,
            name: cls.name,
            displayName: cls.displayName || cls.name,
            grade: cls.grade,
            periodsPerWeek: assignment.periodsPerWeek,
          } as ClassInfo;
        })
        .filter((classInfo): classInfo is ClassInfo => classInfo !== null);
    },
    [classMap, teacherAssignmentsBySubject]
  );

  // Get available classes for a subject (not already assigned by THIS teacher, but may have partial assignments)
  const getAvailableClasses = useCallback(
    (subjectId: number): AvailableClass[] => {
      const assignment = classAssignments.find((ca) => ca.subjectId === subjectId);
      const assignedClassIds = new Set(ensureArray<number>(assignment?.classIds));
      const subject = subjects.find((s) => s.id === subjectId);

      return classes
        .filter((cls) => {
          // Check if this class requires this subject
          const requirements = parseSubjectRequirements(cls.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === subjectId);
          if (!requirement) return false; // Class doesn't need this subject

          // If already fully assigned by this teacher, exclude
          if (assignedClassIds.has(cls.id)) return false;

          // Calculate remaining periods from all teacher assignments (exclude deleted)
          const classSubjectAssignments = allTeacherAssignments.filter(
            (a) => a.classId === cls.id && a.subjectId === subjectId && !a.isDeleted
          );
          const totalAssigned = classSubjectAssignments.reduce(
            (sum, a) => sum + a.periodsPerWeek,
            0
          );
          const totalRequired = requirement.periodsPerWeek || subject?.periodsPerWeek || 1;
          const remaining = totalRequired - totalAssigned;

          // Include if there are remaining periods to assign
          return remaining > 0;
        })
        .map((cls) => {
          const requirements = parseSubjectRequirements(cls.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === subjectId);
          const totalRequired = requirement?.periodsPerWeek || subject?.periodsPerWeek || 1;

          // Calculate assigned periods from all teachers (exclude deleted)
          const classSubjectAssignments = allTeacherAssignments.filter(
            (a) => a.classId === cls.id && a.subjectId === subjectId && !a.isDeleted
          );
          const assignedPeriods = classSubjectAssignments.reduce(
            (sum, a) => sum + a.periodsPerWeek,
            0
          );
          const remainingPeriods = Math.max(0, totalRequired - assignedPeriods);

          return {
            id: cls.id,
            name: cls.name,
            displayName: cls.displayName,
            grade: cls.grade,
            periodsPerWeek: totalRequired,
            assignedPeriods,
            remainingPeriods,
          };
        });
    },
    [classAssignments, classes, subjects, allTeacherAssignments]
  );

  // Calculate total periods for a subject
  const getTotalPeriods = useCallback(
    (subjectId: number): number => {
      const assignments = teacherAssignmentsBySubject.get(subjectId) || [];
      return assignments.reduce((sum, assignment) => sum + assignment.periodsPerWeek, 0);
    },
    [teacherAssignmentsBySubject]
  );

  // === Handlers ===

  // Toggle subject enabled (add to primary or remove entirely)
  const handleToggleSubjectEnabled = useCallback(
    async (subjectId: number, enabled: boolean) => {
      if (enabled) {
        // Add to primary subjects
        await onUpdate({
          primarySubjectIds: [...primarySubjectIds, subjectId],
        });
      } else {
        const subjectAssignmentRecords = teacherAssignmentsBySubject.get(subjectId) || [];
        const classIdsToUnassign = Array.from(
          new Set(subjectAssignmentRecords.map((assignment) => assignment.classId))
        );

        if (classIdsToUnassign.length > 0) {
          await unassignTeacherMutation.mutateAsync({
            teacherId: teacher.id,
            subjectId,
            classIds: classIdsToUnassign,
          });
        }

        // Remove from both primary and allowed after canonical unassign succeeds
        const newPrimary = primarySubjectIds.filter((id) => id !== subjectId);
        const newAllowed = allowedSubjectIds.filter((id) => id !== subjectId);

        await onUpdate({
          primarySubjectIds: newPrimary,
          allowedSubjectIds: newAllowed,
        });
      }
    },
    [
      allowedSubjectIds,
      onUpdate,
      primarySubjectIds,
      teacher.id,
      teacherAssignmentsBySubject,
      unassignTeacherMutation,
    ]
  );

  // Toggle between primary and allowed
  const handleTogglePrimary = useCallback(
    async (subjectId: number, isPrimary: boolean) => {
      if (isPrimary) {
        // Move from allowed to primary
        await onUpdate({
          primarySubjectIds: [...primarySubjectIds, subjectId],
          allowedSubjectIds: allowedSubjectIds.filter((id) => id !== subjectId),
        });
      } else {
        // Move from primary to allowed
        await onUpdate({
          primarySubjectIds: primarySubjectIds.filter((id) => id !== subjectId),
          allowedSubjectIds: [...allowedSubjectIds, subjectId],
        });
      }
    },
    [primarySubjectIds, allowedSubjectIds, onUpdate]
  );

  // Add classes to a subject - USE ASSIGNMENT API for proper dual-write
  const handleAddClasses = useCallback(
    async (subjectId: number, classConfigs: SelectedClassPeriodOverride[]) => {
      console.log('[SubjectAssignmentManager] handleAddClasses called', {
        teacherId: teacher.id,
        subjectId,
        classIds: classConfigs.map((config) => config.classId),
        classPeriodOverrides: classConfigs,
      });

      try {
        // Use the assignment API which handles dual-write to both old and new systems
        const result = await assignTeacherMutation.mutateAsync({
          teacherId: teacher.id,
          subjectId,
          classIds: classConfigs.map((config) => config.classId),
          classPeriodOverrides: classConfigs,
          persistRequirementOverrides: true,
        });

        console.log('[SubjectAssignmentManager] Assignment result', result);

        // Only close the popover if the assignment was successful
        if (result.success) {
          setActivePopoverSubjectId(null);
        }
        // If result.success is false, keep the popover open so user can see the error
        // and potentially retry with different selections
      } catch (error) {
        console.error('[SubjectAssignmentManager] Assignment failed', error);
        // Don't close the popover on error so user can retry
      }
    },
    [teacher.id, assignTeacherMutation]
  );

  // Remove a class from a subject - USE ASSIGNMENT API for proper dual-write
  const handleRemoveClass = useCallback(
    async (subjectId: number, classId: number) => {
      // Use the unassign API which handles dual-write to both old and new systems
      await unassignTeacherMutation.mutateAsync({
        teacherId: teacher.id,
        subjectId,
        classIds: [classId],
      });
    },
    [teacher.id, unassignTeacherMutation]
  );

  // Toggle restrict to primary
  const handleRestrictChange = useCallback(
    async (restricted: boolean) => {
      if (restricted) {
        // Move all allowed subjects to primary
        await onUpdate({
          restrictToPrimarySubjects: true,
          primarySubjectIds: [...new Set([...primarySubjectIds, ...allowedSubjectIds])],
          allowedSubjectIds: [],
        });
      } else {
        await onUpdate({
          restrictToPrimarySubjects: false,
        });
      }
    },
    [primarySubjectIds, allowedSubjectIds, onUpdate]
  );

  const isLoading = isLoadingSubjects || isLoadingClasses || isLoadingAssignments;
  const isMutating =
    isUpdating || assignTeacherMutation.isPending || unassignTeacherMutation.isPending;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Workload Progress Header */}
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

      {/* Search */}
      <div className="px-1 pb-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('teachers.searchSubjects', 'جستجوی مضمون...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 ps-9 text-sm border-2 border-slate-200 focus:border-blue-400"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Subject List */}
      <ScrollArea className="flex-1 px-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : sortedSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {searchQuery
                ? t('teachers.noSubjectsFound', 'مضمونی یافت نشد')
                : t('teachers.noSubjectsAvailable', 'مضمونی موجود نیست')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {sortedSubjects.map((subject) => {
              const isEnabled =
                primarySubjectIds.includes(subject.id) || allowedSubjectIds.includes(subject.id);
              const isPrimary = primarySubjectIds.includes(subject.id);
              const assignedClasses = getAssignedClasses(subject.id);
              const totalPeriods = getTotalPeriods(subject.id);

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
                  totalPeriods={totalPeriods}
                  onToggleEnabled={(enabled) => handleToggleSubjectEnabled(subject.id, enabled)}
                  onTogglePrimary={(primary) => handleTogglePrimary(subject.id, primary)}
                  onAddClassClick={() => setActivePopoverSubjectId(subject.id)}
                  onRemoveClass={(classId) => handleRemoveClass(subject.id, classId)}
                  disabled={isMutating}
                  restrictToPrimary={restrictToPrimary}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Restrict Toggle */}
      <div className="px-1 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border-2 border-slate-100">
          <Switch
            id="restrict-toggle"
            checked={restrictToPrimary}
            onCheckedChange={handleRestrictChange}
            disabled={isMutating}
            className="shrink-0"
          />
          <div className="flex flex-col gap-0.5 flex-1">
            <Label
              htmlFor="restrict-toggle"
              className="text-sm font-medium text-slate-700 cursor-pointer"
            >
              {t('teachers.restrictToPrimary', 'محدود به مضامین اصلی')}
            </Label>
            <span className="text-xs text-slate-500">
              {t('teachers.restrictToPrimaryDesc', 'فقط مضامین اصلی قابل تدریس باشند')}
            </span>
          </div>
        </div>
      </div>

      {/* Add Class Popover - Rendered outside the list for proper positioning */}
      {activePopoverSubjectId !== null && (
        <AddClassPopoverWrapper
          subjectId={activePopoverSubjectId}
          subjects={subjects}
          availableClasses={getAvailableClasses(activePopoverSubjectId)}
          onAdd={(classConfigs) => handleAddClasses(activePopoverSubjectId, classConfigs)}
          onClose={() => setActivePopoverSubjectId(null)}
          isAdding={isMutating}
        />
      )}
    </div>
  );
}

/**
 * Wrapper component for AddClassPopover that handles the modal-like behavior
 */
function AddClassPopoverWrapper({
  subjectId,
  subjects,
  availableClasses: availableClassesProp,
  onAdd,
  onClose,
  isAdding,
}: {
  subjectId: number;
  subjects: Subject[];
  availableClasses: AvailableClass[];
  onAdd: (classes: SelectedClassPeriodOverride[]) => void;
  onClose: () => void;
  isAdding: boolean;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [periodOverrides, setPeriodOverrides] = useState<Record<number, number>>({});

  const subject = subjects.find((s) => s.id === subjectId);

  // Filter classes by search query
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return availableClassesProp;
    const query = searchQuery.toLowerCase();
    return availableClassesProp.filter(
      (cls) =>
        cls.name.toLowerCase().includes(query) ||
        (cls.displayName && cls.displayName.toLowerCase().includes(query))
    );
  }, [availableClassesProp, searchQuery]);

  const getConfiguredPeriods = useCallback(
    (cls: AvailableClass): number => {
      return periodOverrides[cls.id] ?? cls.periodsPerWeek;
    },
    [periodOverrides]
  );

  // Calculate total periods for selected classes using the configured overrides
  const selectedPeriods = useMemo(() => {
    return availableClassesProp
      .filter((cls) => selectedIds.has(cls.id))
      .reduce((sum, cls) => sum + getConfiguredPeriods(cls), 0);
  }, [availableClassesProp, getConfiguredPeriods, selectedIds]);

  const handleToggle = useCallback((classId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredClasses.map((cls) => cls.id)));
  }, [filteredClasses]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAdd = useCallback(() => {
    if (selectedIds.size === 0) return;
    onAdd(
      availableClassesProp
        .filter((cls) => selectedIds.has(cls.id))
        .map((cls) => ({
          classId: cls.id,
          periodsPerWeek: getConfiguredPeriods(cls),
        }))
    );
  }, [availableClassesProp, getConfiguredPeriods, onAdd, selectedIds]);

  const handlePeriodChange = useCallback((classId: number, value: string) => {
    const parsed = Number.parseInt(value, 10);
    const nextValue = Number.isNaN(parsed) ? 1 : Math.max(1, Math.min(20, parsed));
    setPeriodOverrides((prev) => ({
      ...prev,
      [classId]: nextValue,
    }));
  }, []);

  if (!subject) return null;

  const allSelected = filteredClasses.length > 0 && selectedIds.size === filteredClasses.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      {/* Modal Content */}
      <div className="relative z-10 flex max-h-[min(86vh,44rem)] w-[min(92vw,34rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="font-semibold text-base text-slate-800">
                {t('teachers.addClassesFor', 'افزودن صنف برای')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700">{subject.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  'teachers.adjustClassPeriodsHint',
                  'صنف‌ها را انتخاب کنید و ساعات هفتگی هر صنف را در همین بخش تنظیم کنید. این مقدار نیازمندی مضمون برای همان صنف را به‌روزرسانی می‌کند.'
                )}
              </p>
            </div>
            <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {availableClassesProp.length} {t('teachers.classesAvailable', 'صنف موجود')}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-slate-100 bg-white px-5 py-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('teachers.searchClasses', 'جستجوی صنف...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-slate-200 bg-slate-50 ps-10 text-sm shadow-xs focus-visible:border-blue-300 focus-visible:ring-blue-200"
            />
          </div>
        </div>

        {/* Select All / Deselect All */}
        {filteredClasses.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <span className="text-sm text-slate-600">
              {filteredClasses.length} {t('teachers.classesAvailable', 'صنف موجود')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs gap-1.5 text-slate-600 hover:bg-white"
                onClick={handleSelectAll}
                disabled={allSelected}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {t('common.selectAll', 'انتخاب همه')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs gap-1.5 text-slate-600 hover:bg-white"
                onClick={handleDeselectAll}
                disabled={!someSelected}
              >
                <Square className="h-3.5 w-3.5" />
                {t('common.deselectAll', 'لغو انتخاب')}
              </Button>
            </div>
          </div>
        )}

        {/* Class List */}
        <ScrollArea className="flex-1 bg-white">
          {filteredClasses.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <GraduationCap className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                {availableClassesProp.length === 0
                  ? t('teachers.noClassesAvailable', 'همه صنف‌ها اختصاص داده شده‌اند')
                  : t('teachers.noClassesFound', 'صنفی یافت نشد')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t(
                  'teachers.tryDifferentSearch',
                  'جستجو را تغییر دهید یا از مضمون دیگری استفاده کنید'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredClasses.map((cls) => {
                const isSelected = selectedIds.has(cls.id);
                const hasPartialAssignment =
                  cls.assignedPeriods !== undefined && cls.assignedPeriods > 0;
                const configuredPeriods = getConfiguredPeriods(cls);

                return (
                  <div
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggle(cls.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle(cls.id);
                      }
                    }}
                    className={cn(
                      'grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition-all cursor-pointer',
                      isSelected
                        ? 'border-blue-200 bg-blue-50 shadow-xs hover:bg-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className={cn(
                        'mt-0.5 shrink-0',
                        isSelected && 'border-blue-500 data-[state=checked]:bg-blue-600'
                      )}
                      tabIndex={-1}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">
                          {cls.displayName || cls.name}
                        </span>
                        {hasPartialAssignment && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            {t('teachers.partiallyAssigned', 'نیمه‌تخصیص')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {hasPartialAssignment
                          ? t(
                              'teachers.assignedOutOfRequired',
                              '{{assigned}} از {{required}} ساعت قبلاً تخصیص یافته',
                              {
                                assigned: cls.assignedPeriods,
                                required: cls.periodsPerWeek,
                              }
                            )
                          : t(
                              'teachers.classWeeklyPeriods',
                              'برای این صنف {{count}} ساعت در هفته تنظیم کنید و نیازمندی صنف را به‌روزرسانی نمایید',
                              {
                                count: configuredPeriods,
                              }
                            )}
                      </p>
                    </div>
                    <div
                      className="flex flex-col items-end gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={configuredPeriods}
                          onChange={(e) => handlePeriodChange(cls.id, e.target.value)}
                          disabled={isAdding}
                          className="h-8 w-16 border-0 bg-white px-2 text-center text-sm font-semibold tabular-nums shadow-xs focus-visible:ring-2 focus-visible:ring-blue-200"
                        />
                        <span className="text-xs font-medium text-slate-500">
                          {t('common.period', 'ساعت')}
                        </span>
                      </div>
                      {hasPartialAssignment && (
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {cls.assignedPeriods}/{cls.periodsPerWeek}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-linear-to-t from-slate-50 to-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Period Preview */}
            <div className="min-w-0 text-sm text-slate-600">
              {someSelected && (
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold text-blue-600">{selectedIds.size}</span>{' '}
                    {t('teachers.classesSelected', 'صنف انتخاب شده')}
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-emerald-600">+{selectedPeriods}</span>{' '}
                    {t('common.period', 'ساعت')}
                  </div>
                </div>
              )}
            </div>
            {/* Add Button */}
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!someSelected || isAdding}
              className="h-10 rounded-xl px-4 gap-2 bg-blue-600 text-sm font-medium shadow-sm hover:bg-blue-700"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t('common.add', 'افزودن')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubjectAssignmentManager;
