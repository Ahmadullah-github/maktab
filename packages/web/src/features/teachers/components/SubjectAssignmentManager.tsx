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
import { calculateMaxPeriodsPerWeek, useSchoolConfig } from '../hooks/useSchoolConfig';
import type { ClassAssignment, Teacher, TeacherFormValues } from '../types';
import { ensureArray } from '../utils/serialization';
import { type AvailableClass } from './AddClassPopover';
import { SubjectAssignmentRow, type ClassInfo, type SubjectInfo } from './SubjectAssignmentRow';
import { WorkloadProgressHeader } from './WorkloadProgressHeader';

export interface SubjectAssignmentManagerProps {
  /** The teacher being edited */
  teacher: Teacher;
  /** Callback to update teacher data */
  onUpdate: (
    data: Partial<TeacherFormValues & { classAssignments: ClassAssignment[] }>
  ) => Promise<void>;
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

  // REAL-TIME FIX: Derive classAssignments from useTeacherAssignments() instead of teacher prop
  // This ensures real-time updates when assignments change from other features
  const classAssignments = useMemo(() => {
    // Filter assignments for this teacher and group by subject
    const teacherAssignments = allTeacherAssignments.filter(
      (a) => a.teacherId === teacher.id && !a.isDeleted
    );

    // Group by subjectId
    const assignmentMap = new Map<number, number[]>();
    for (const assignment of teacherAssignments) {
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
  }, [allTeacherAssignments, teacher.id]);

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
      const assignment = classAssignments.find((ca) => ca.subjectId === subjectId);
      if (!assignment) return [];

      const classIds = ensureArray<number>(assignment.classIds);
      return classIds
        .map((classId) => {
          const cls = classes.find((c) => c.id === classId);
          if (!cls) return null;

          // Get periods for this subject in this class
          const requirements = parseSubjectRequirements(cls.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === subjectId);
          const subject = subjects.find((s) => s.id === subjectId);
          const periodsPerWeek = requirement?.periodsPerWeek || subject?.periodsPerWeek || 1;

          return {
            id: cls.id,
            name: cls.name,
            displayName: cls.displayName || cls.name,
            grade: cls.grade,
            periodsPerWeek,
          } as ClassInfo;
        })
        .filter((c): c is ClassInfo => c !== null);
    },
    [classAssignments, classes, subjects]
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
      const assignedClasses = getAssignedClasses(subjectId);
      return assignedClasses.reduce((sum, cls) => sum + cls.periodsPerWeek, 0);
    },
    [getAssignedClasses]
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
        // Remove from both primary and allowed, and remove class assignments
        const newPrimary = primarySubjectIds.filter((id) => id !== subjectId);
        const newAllowed = allowedSubjectIds.filter((id) => id !== subjectId);
        const newAssignments = classAssignments.filter((ca) => ca.subjectId !== subjectId);

        await onUpdate({
          primarySubjectIds: newPrimary,
          allowedSubjectIds: newAllowed,
          classAssignments: newAssignments,
        });
      }
    },
    [primarySubjectIds, allowedSubjectIds, classAssignments, onUpdate]
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
    async (subjectId: number, classIds: number[]) => {
      // Get the periods per week for this subject from the first class's requirements
      // or fall back to the subject's default
      const subject = subjects.find((s) => s.id === subjectId);
      let periodsPerWeek = subject?.periodsPerWeek || 3;

      // Try to get from class requirements
      for (const classId of classIds) {
        const cls = classes.find((c) => c.id === classId);
        if (cls) {
          const requirements = parseSubjectRequirements(cls.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === subjectId);
          if (requirement?.periodsPerWeek) {
            periodsPerWeek = requirement.periodsPerWeek;
            break;
          }
        }
      }

      console.log('[SubjectAssignmentManager] handleAddClasses called', {
        teacherId: teacher.id,
        subjectId,
        classIds,
        periodsPerWeek,
        subjectName: subject?.name,
      });

      try {
        // Use the assignment API which handles dual-write to both old and new systems
        const result = await assignTeacherMutation.mutateAsync({
          teacherId: teacher.id,
          subjectId,
          classIds,
          periodsPerWeek,
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
    [subjects, classes, teacher.id, assignTeacherMutation]
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
          onAdd={(classIds) => handleAddClasses(activePopoverSubjectId, classIds)}
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
  onAdd: (classIds: number[]) => void;
  onClose: () => void;
  isAdding: boolean;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  // Calculate total periods for selected classes (use remaining periods for partial assignments)
  const selectedPeriods = useMemo(() => {
    return filteredClasses
      .filter((cls) => selectedIds.has(cls.id))
      .reduce((sum, cls) => sum + (cls.remainingPeriods ?? cls.periodsPerWeek), 0);
  }, [filteredClasses, selectedIds]);

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
    onAdd(Array.from(selectedIds));
  }, [selectedIds, onAdd]);

  if (!subject) return null;

  const allSelected = filteredClasses.length > 0 && selectedIds.size === filteredClasses.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in-0 duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      {/* Modal Content */}
      <div className="relative z-10 w-80 rounded-lg border-2 border-slate-200 bg-white shadow-xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm text-slate-800">
                {t('teachers.addClassesFor', 'افزودن صنف برای')}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -me-1" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{subject.name}</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('teachers.searchClasses', 'جستجوی صنف...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 ps-8 text-sm border-slate-200"
            />
          </div>
        </div>

        {/* Select All / Deselect All */}
        {filteredClasses.length > 0 && (
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filteredClasses.length} {t('teachers.classesAvailable', 'صنف موجود')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={handleSelectAll}
                disabled={allSelected}
              >
                <CheckSquare className="w-3 h-3" />
                {t('common.selectAll', 'انتخاب همه')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={handleDeselectAll}
                disabled={!someSelected}
              >
                <Square className="w-3 h-3" />
                {t('common.deselectAll', 'لغو انتخاب')}
              </Button>
            </div>
          </div>
        )}

        {/* Class List */}
        <ScrollArea className="max-h-[240px]">
          {filteredClasses.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">
                {availableClassesProp.length === 0
                  ? t('teachers.noClassesAvailable', 'همه صنف‌ها اختصاص داده شده‌اند')
                  : t('teachers.noClassesFound', 'صنفی یافت نشد')}
              </p>
            </div>
          ) : (
            <div className="p-1.5">
              {filteredClasses.map((cls) => {
                const isSelected = selectedIds.has(cls.id);
                const hasPartialAssignment =
                  cls.assignedPeriods !== undefined && cls.assignedPeriods > 0;
                const remainingPeriods = cls.remainingPeriods ?? cls.periodsPerWeek;

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
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-start cursor-pointer',
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className={cn(
                        'shrink-0',
                        isSelected && 'border-blue-500 data-[state=checked]:bg-blue-600'
                      )}
                      tabIndex={-1}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-slate-800 truncate">
                          {cls.displayName || cls.name}
                        </span>
                        {hasPartialAssignment && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                            {t('teachers.partiallyAssigned', 'نیمه‌تخصیص')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasPartialAssignment ? (
                        <span className="text-xs tabular-nums">
                          <span className="text-emerald-600 font-medium">{remainingPeriods}</span>
                          <span className="text-slate-400">/{cls.periodsPerWeek}</span>
                          <span className="text-slate-500 ms-0.5">
                            {t('common.remaining', 'باقی')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 tabular-nums">
                          {cls.periodsPerWeek} {t('common.period', 'ساعت')}
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
        <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            {/* Period Preview */}
            <div className="text-xs text-slate-600">
              {someSelected && (
                <>
                  <span className="font-medium text-blue-600">{selectedIds.size}</span>{' '}
                  {t('teachers.classesSelected', 'صنف انتخاب شده')}
                  {' • '}
                  <span className="font-medium text-emerald-600">+{selectedPeriods}</span>{' '}
                  {t('common.period', 'ساعت')}
                </>
              )}
            </div>
            {/* Add Button */}
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!someSelected || isAdding}
              className="h-8 px-3 gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {isAdding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
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
