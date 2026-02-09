/**
 * TeacherAssignmentMatrix Component
 *
 * Displays a matrix of teacher-subject-class assignments.
 * Allows adding/removing assignments with validation and conflict detection.
 *
 * Uses the unified assignment API for proper bidirectional updates to:
 * - Teacher.classAssignments
 * - Class.subjectRequirements
 * - TeacherClassSubjectAssignment table
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAssignTeacher,
  useUnassignTeacher,
} from '../../assignments/hooks/useAssignmentMutations';
import {
  canTeacherTeachSubject,
  getTeacherSubjectCompatibility,
} from '../../assignments/services/assignmentValidation';
import type { ClassGroup } from '../../classes/types';
import type { ClassAssignment, Teacher, TeacherFormValues } from '../types';
import { ensureArray } from '../utils/serialization';

/**
 * Minimal subject interface for assignment matrix
 */
interface MinimalSubject {
  id: number;
  name: string;
  periodsPerWeek?: number | null;
}

export interface TeacherAssignmentMatrixProps {
  teacher: Teacher;
  /** @deprecated No longer used - assignments go through unified API */
  onUpdate?: (id: number, data: Partial<TeacherFormValues>) => Promise<void>;
  isUpdating?: boolean;
  subjects: MinimalSubject[];
  className?: string;
}

/**
 * Hook to fetch classes from the API
 */
function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = (await api.classes.list()) as ClassGroup[];
      return response
        .filter((c) => !c.isDeleted)
        .map((c) => ({
          ...c,
          // Parse subjectRequirements if it's a JSON string
          subjectRequirements:
            typeof c.subjectRequirements === 'string'
              ? JSON.parse(c.subjectRequirements || '[]')
              : c.subjectRequirements || [],
        }));
    },
  });
}

/**
 * TeacherAssignmentMatrix displays and manages teacher assignments
 */
export function TeacherAssignmentMatrix({
  teacher,
  // onUpdate is deprecated - we use the unified assignment API now
  isUpdating = false,
  subjects,
  className,
}: TeacherAssignmentMatrixProps) {
  const { t } = useTranslation();
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [pendingClassIds, setPendingClassIds] = useState<number[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Use unified assignment mutations for proper bidirectional updates
  const assignTeacherMutation = useAssignTeacher();
  const unassignTeacherMutation = useUnassignTeacher();

  const isMutating = assignTeacherMutation.isPending || unassignTeacherMutation.isPending;

  // Normalize classAssignments to ensure it's always an array with proper classIds
  const normalizedAssignments = useMemo(() => {
    const assignments = ensureArray(teacher.classAssignments as ClassAssignment[] | string);
    return assignments.map((a) => ({
      ...a,
      classIds: ensureArray(a.classIds as number[] | string),
    }));
  }, [teacher.classAssignments]);

  // Get subjects the teacher can teach
  const teachableSubjects = useMemo(() => {
    return subjects.filter((subject) => canTeacherTeachSubject(teacher, subject.id));
  }, [subjects, teacher]);

  // Get subjects not yet assigned
  const availableSubjects = useMemo(() => {
    const assignedSubjectIds = new Set(normalizedAssignments.map((a) => a.subjectId));
    return teachableSubjects.filter((s) => !assignedSubjectIds.has(s.id));
  }, [teachableSubjects, normalizedAssignments]);

  // Get classes that require the selected subject
  const classesForSubject = useMemo(() => {
    if (!selectedSubjectId) return [];
    return classes.filter((c) => {
      const requirements = ensureArray(c.subjectRequirements as any);
      return requirements.some((r: any) => r.subjectId === selectedSubjectId);
    });
  }, [classes, selectedSubjectId]);

  // Get subject name by ID
  const getSubjectName = useCallback(
    (subjectId: number): string => {
      const subject = subjects.find((s) => s.id === subjectId);
      return subject?.name || `Subject ${subjectId}`;
    },
    [subjects]
  );

  // Get class name by ID
  const getClassName = useCallback(
    (classId: number): string => {
      const classGroup = classes.find((c) => c.id === classId);
      return classGroup?.displayName || classGroup?.name || `Class ${classId}`;
    },
    [classes]
  );

  // Get periods per week for a subject in a class
  const getPeriodsPerWeek = useCallback(
    (subjectId: number, classId: number): number => {
      const classGroup = classes.find((c) => c.id === classId);
      const requirements = ensureArray(classGroup?.subjectRequirements as any) as Array<{
        subjectId: number;
        periodsPerWeek?: number;
      }>;
      const requirement = requirements.find((r) => r.subjectId === subjectId);
      if (requirement?.periodsPerWeek) return requirement.periodsPerWeek;
      const subject = subjects.find((s) => s.id === subjectId);
      return subject?.periodsPerWeek || 1;
    },
    [classes, subjects]
  );

  // Calculate total periods for an assignment
  const calculateTotalPeriods = useCallback(
    (assignment: ClassAssignment): number => {
      const classIds = ensureArray(assignment.classIds as number[] | string);
      return classIds.reduce((total, classId) => {
        return total + getPeriodsPerWeek(assignment.subjectId, classId);
      }, 0);
    },
    [getPeriodsPerWeek]
  );

  // Handle adding a new assignment - USE ASSIGNMENT API for proper dual-write
  const handleAddAssignment = useCallback(async () => {
    if (!selectedSubjectId || pendingClassIds.length === 0) return;

    setIsAdding(true);
    try {
      // Get periods per week from class requirements or subject default
      const subject = subjects.find((s) => s.id === selectedSubjectId);
      let periodsPerWeek = subject?.periodsPerWeek || 3;

      // Try to get from first class's requirements
      for (const classId of pendingClassIds) {
        const cls = classes.find((c) => c.id === classId);
        if (cls) {
          const requirements = ensureArray(cls.subjectRequirements as any) as Array<{
            subjectId: number;
            periodsPerWeek?: number;
          }>;
          const requirement = requirements.find((r) => r.subjectId === selectedSubjectId);
          if (requirement?.periodsPerWeek) {
            periodsPerWeek = requirement.periodsPerWeek;
            break;
          }
        }
      }

      // Use the assignment API which handles dual-write to both old and new systems
      const result = await assignTeacherMutation.mutateAsync({
        teacherId: teacher.id,
        subjectId: selectedSubjectId,
        classIds: pendingClassIds,
        periodsPerWeek,
      });

      if (result.success) {
        setSelectedSubjectId(null);
        setPendingClassIds([]);
      }
      // Toast is handled by the mutation hook
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error('[TeacherAssignmentMatrix] Assignment failed', error);
    } finally {
      setIsAdding(false);
    }
  }, [selectedSubjectId, pendingClassIds, subjects, classes, teacher.id, assignTeacherMutation]);

  // Handle removing an assignment - USE ASSIGNMENT API for proper dual-write
  const handleRemoveAssignment = useCallback(
    async (subjectId: number) => {
      try {
        // Get all class IDs for this subject assignment
        const assignment = normalizedAssignments.find((a) => a.subjectId === subjectId);
        if (!assignment || assignment.classIds.length === 0) return;

        // Use the unassign API which handles dual-write to both old and new systems
        await unassignTeacherMutation.mutateAsync({
          teacherId: teacher.id,
          subjectId,
          classIds: assignment.classIds,
        });
        // Toast is handled by the mutation hook
      } catch (error) {
        // Error toast is handled by the mutation hook
        console.error('[TeacherAssignmentMatrix] Unassignment failed', error);
      }
    },
    [normalizedAssignments, teacher.id, unassignTeacherMutation]
  );

  // Handle removing a class from an assignment - USE ASSIGNMENT API for proper dual-write
  const handleRemoveClassFromAssignment = useCallback(
    async (subjectId: number, classId: number) => {
      try {
        // Use the unassign API which handles dual-write to both old and new systems
        await unassignTeacherMutation.mutateAsync({
          teacherId: teacher.id,
          subjectId,
          classIds: [classId],
        });
        // Toast is handled by the mutation hook
      } catch (error) {
        // Error toast is handled by the mutation hook
        console.error('[TeacherAssignmentMatrix] Unassignment failed', error);
      }
    },
    [teacher.id, unassignTeacherMutation]
  );

  // Handle adding a class to an existing assignment - USE ASSIGNMENT API for proper dual-write
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddClassToAssignment = useCallback(
    async (subjectId: number, classId: number) => {
      try {
        // Get periods per week from class requirements or subject default
        const subject = subjects.find((s) => s.id === subjectId);
        let periodsPerWeek = subject?.periodsPerWeek || 3;

        const cls = classes.find((c) => c.id === classId);
        if (cls) {
          const requirements = ensureArray(cls.subjectRequirements as any) as Array<{
            subjectId: number;
            periodsPerWeek?: number;
          }>;
          const requirement = requirements.find((r) => r.subjectId === subjectId);
          if (requirement?.periodsPerWeek) {
            periodsPerWeek = requirement.periodsPerWeek;
          }
        }

        // Use the assignment API which handles dual-write to both old and new systems
        await assignTeacherMutation.mutateAsync({
          teacherId: teacher.id,
          subjectId,
          classIds: [classId],
          periodsPerWeek,
        });
        // Toast is handled by the mutation hook
      } catch (error) {
        // Error toast is handled by the mutation hook
        console.error('[TeacherAssignmentMatrix] Assignment failed', error);
      }
    },
    [subjects, classes, teacher.id, assignTeacherMutation]
  );

  // Toggle class selection for new assignment
  const toggleClassSelection = useCallback((classId: number) => {
    setPendingClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }, []);

  // Check if subject has compatibility issues
  const getSubjectCompatibility = useCallback(
    (subjectId: number) => {
      return getTeacherSubjectCompatibility(teacher, subjectId);
    },
    [teacher]
  );

  if (isLoadingClasses) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current Assignments */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-3">
          {t('teachers.assignments.assignedClasses', 'صنف‌های تخصیص یافته')}
        </h4>

        {normalizedAssignments.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            {t('teachers.assignments.noAssignments', 'هیچ تخصیصی وجود ندارد')}
          </p>
        ) : (
          <div className="space-y-3">
            {normalizedAssignments.map((assignment) => {
              const compatibility = getSubjectCompatibility(assignment.subjectId);
              const hasConflict = compatibility === 'incompatible';
              const totalPeriods = calculateTotalPeriods(assignment);

              return (
                <div
                  key={assignment.subjectId}
                  className={cn(
                    'p-3 rounded-lg border',
                    hasConflict ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">
                        {getSubjectName(assignment.subjectId)}
                      </span>
                      {hasConflict && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('teachers.assignments.conflictWarning', 'تعارض شناسایی شد')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        {totalPeriods} {t('common.period', 'ساعت')}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleRemoveAssignment(assignment.subjectId)}
                      disabled={isUpdating || isMutating}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {assignment.classIds.map((classId) => (
                      <Badge
                        key={classId}
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-white border border-slate-200 gap-1"
                      >
                        {getClassName(classId)}
                        <span className="text-slate-400">
                          ({getPeriodsPerWeek(assignment.subjectId, classId)}h)
                        </span>
                        <button
                          type="button"
                          className="ms-1 hover:text-red-500"
                          onClick={() =>
                            handleRemoveClassFromAssignment(assignment.subjectId, classId)
                          }
                          disabled={isUpdating || isMutating}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Assignment */}
      {availableSubjects.length > 0 && (
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            {t('teachers.assignments.addAssignment', 'افزودن تخصیص')}
          </h4>

          <div className="space-y-3">
            {/* Subject Selector */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                {t('teachers.assignments.selectSubject', 'انتخاب مضمون')}
              </label>
              <Select
                value={selectedSubjectId?.toString() || ''}
                onValueChange={(val: string) => {
                  setSelectedSubjectId(val ? parseInt(val, 10) : null);
                  setPendingClassIds([]);
                }}
                disabled={isUpdating || isMutating || isAdding}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('teachers.assignments.selectSubject', 'انتخاب مضمون')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class Selection */}
            {selectedSubjectId && (
              <div>
                <label className="text-xs text-slate-500 mb-2 block">
                  {t('teachers.assignments.selectClasses', 'انتخاب صنف‌ها')}
                </label>
                {classesForSubject.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    {t('classes.noClasses', 'هیچ صنفی این مضمون را ندارد')}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {classesForSubject.map((classGroup) => {
                      const isSelected = pendingClassIds.includes(classGroup.id);
                      const periods = getPeriodsPerWeek(selectedSubjectId, classGroup.id);

                      return (
                        <label
                          key={classGroup.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors',
                            isSelected
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleClassSelection(classGroup.id)}
                            disabled={isUpdating || isMutating || isAdding}
                          />
                          <span className="text-sm text-slate-700 flex-1">
                            {classGroup.displayName || classGroup.name}
                          </span>
                          <span className="text-xs text-slate-400">{periods}h</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Add Button */}
            {selectedSubjectId && pendingClassIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleAddAssignment}
                disabled={isUpdating || isMutating || isAdding}
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t('teachers.assignments.addAssignment', 'افزودن تخصیص')} ({pendingClassIds.length}{' '}
                {t('classes.title', 'صنف')})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* No Available Subjects Message */}
      {availableSubjects.length === 0 && teachableSubjects.length > 0 && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
          <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {t('teachers.assignments.allSubjectsAssigned', 'همه مضامین قابل تدریس تخصیص یافته‌اند')}
          </p>
        </div>
      )}

      {/* No Teachable Subjects Message */}
      {teachableSubjects.length === 0 && (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-amber-700">
            {t('teachers.assignments.noTeachableSubjects', 'هیچ مضمونی برای تدریس تعریف نشده است')}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            {t('teachers.assignments.addSubjectsFirst', 'ابتدا مضامین را در تب مضامین اضافه کنید')}
          </p>
        </div>
      )}
    </div>
  );
}

export default TeacherAssignmentMatrix;
