/**
 * ClassAssignmentManager Component
 *
 * Phase 3.3: Class Assignment Manager for Class-Centric View
 *
 * Manages multi-teacher assignments for all subjects in a class.
 * Shows assignment progress and allows assigning/unassigning teachers
 * for each subject requirement.
 *
 * Features:
 * - Assignment progress header (X% complete)
 * - List of subject requirements with assignments
 * - Each subject shows assigned teachers + add button
 * - Workload impact preview when selecting teacher
 */

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BookOpen, Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AssignmentStatusBadge } from '../../assignments/components/shared';
import {
  useAssignTeacher,
  useUnassignTeacher,
} from '../../assignments/hooks/useAssignmentMutations';
import type { TeacherCompatibilityLevel } from '../../assignments/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import { useUpdateClassSubjectPeriods } from '../hooks/useClasses';
import type { ClassGroup, SubjectRequirement } from '../types';
import { ClassSubjectPeriodEditor } from './ClassSubjectPeriodEditor';
import { SubjectAssignmentSection, type TeacherAssignmentInfo } from './SubjectAssignmentSection';

// ============================================================================
// Types
// ============================================================================

export interface ClassAssignmentManagerProps {
  /** The class being edited */
  classData: ClassGroup;
  /** Callback when assignment changes (for optimistic updates) */
  onAssign?: (subjectId: number, teacherId: number, periodsPerWeek: number) => Promise<void>;
  /** Callback when unassignment happens */
  onUnassign?: (assignmentId: number) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface SubjectWithAssignments {
  subjectId: number;
  subjectName: string;
  requiredPeriods: number;
  gradeDefaultPeriods: number | null;
  periodMode?: 'inherited' | 'class_override';
  assignments: TeacherAssignmentInfo[];
  assignedPeriods: number;
  remainingPeriods: number;
  isFullyAssigned: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON array from string or return as-is
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get teacher compatibility level for a subject
 */
function getTeacherCompatibility(teacher: Teacher, subjectId: number): TeacherCompatibilityLevel {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);

  if (primaryIds.includes(subjectId)) {
    return 'primary';
  }
  if (!teacher.restrictToPrimarySubjects && allowedIds.includes(subjectId)) {
    return 'allowed';
  }
  return 'incompatible';
}

// ============================================================================
// Sub-Components
// ============================================================================

export function ClassAssignmentManager({
  classData,
  onAssign,
  onUnassign,
  isUpdating = false,
  className,
}: ClassAssignmentManagerProps) {
  const { t } = useTranslation();

  // Fetch data
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { data: allAssignments = [], isLoading: isLoadingAssignments } = useTeacherAssignments();

  // Mutations
  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();
  const updatePeriods = useUpdateClassSubjectPeriods();

  // Parse subject requirements
  const subjectRequirements = useMemo((): SubjectRequirement[] => {
    return parseJsonArray<SubjectRequirement>(classData.subjectRequirements);
  }, [classData.subjectRequirements]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [subject.id, subject]));
  }, [subjects]);

  // Build subjects with assignments data
  const subjectsWithAssignments = useMemo((): SubjectWithAssignments[] => {
    return subjectRequirements.flatMap((req) => {
      const subject = subjectMap.get(req.subjectId);
      if (!subject) {
        return [];
      }

      const subjectName = subject.name;
      const requiredPeriods = req.periodsPerWeek;

      // Get assignments for this class-subject pair
      const classSubjectAssignments = allAssignments.filter(
        (a: TeacherClassSubjectAssignment) =>
          a.classId === classData.id && a.subjectId === req.subjectId
      );

      // Map to TeacherAssignmentInfo
      const assignments: TeacherAssignmentInfo[] = classSubjectAssignments.map((a) => {
        const teacher = teachers.find((t) => t.id === a.teacherId);
        return {
          assignmentId: a.id,
          teacherId: a.teacherId,
          teacherName: teacher?.fullName || `Teacher ${a.teacherId}`,
          periodsPerWeek: a.periodsPerWeek,
          compatibility: teacher ? getTeacherCompatibility(teacher, req.subjectId) : 'incompatible',
        };
      });

      const assignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
      const remainingPeriods = Math.max(0, requiredPeriods - assignedPeriods);
      const isFullyAssigned = remainingPeriods <= 0;

      return [
        {
          subjectId: req.subjectId,
          subjectName,
          requiredPeriods,
          gradeDefaultPeriods: subject.periodsPerWeek,
          periodMode: req.periodMode,
          assignments,
          assignedPeriods,
          remainingPeriods,
          isFullyAssigned,
        },
      ];
    });
  }, [subjectRequirements, subjectMap, teachers, allAssignments, classData.id]);

  // Handle assign teacher
  const handleAssign = useCallback(
    async (subjectId: number, teacherId: number, periodsPerWeek: number) => {
      if (onAssign) {
        await onAssign(subjectId, teacherId, periodsPerWeek);
      } else {
        await assignTeacher.mutateAsync({
          teacherId,
          subjectId,
          classIds: [classData.id],
          periodsPerWeek,
          addToPrimarySubjects: true,
        });
      }
    },
    [classData.id, onAssign, assignTeacher]
  );

  // Handle unassign teacher
  const handleUnassign = useCallback(
    async (assignmentId: number) => {
      if (onUnassign) {
        await onUnassign(assignmentId);
      } else {
        // Find the assignment to get teacherId and subjectId
        const assignment = allAssignments.find((a) => a.id === assignmentId);
        if (assignment) {
          await unassignTeacher.mutateAsync({
            teacherId: assignment.teacherId,
            subjectId: assignment.subjectId,
            classIds: [classData.id],
          });
        }
      }
    },
    [allAssignments, classData.id, onUnassign, unassignTeacher]
  );

  const isLoading = isLoadingSubjects || isLoadingTeachers || isLoadingAssignments;
  const isMutating =
    assignTeacher.isPending ||
    unassignTeacher.isPending ||
    updatePeriods.isPending ||
    isUpdating;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Subject List */}
      <ScrollArea className="flex-1 px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : subjectsWithAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 py-12 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">
              {t('classes.noSubjectRequirements', 'هیچ مضمونی تعریف نشده است')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {subjectsWithAssignments.map((subjectData) => (
              <div
                key={subjectData.subjectId}
                className={cn(
                  'rounded-2xl border p-3 shadow-sm transition-colors',
                  subjectData.isFullyAssigned
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : subjectData.assignments.length > 0
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-white'
                )}
              >
                {/* Subject Header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      className={cn(
                        'w-4 h-4',
                        subjectData.isFullyAssigned ? 'text-emerald-600' : 'text-slate-500'
                      )}
                    />
                    <span className="font-medium text-sm text-slate-800">
                      {subjectData.subjectName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AssignmentStatusBadge
                      status={
                        subjectData.isFullyAssigned
                          ? 'assigned'
                          : subjectData.assignments.length > 0
                            ? 'partial'
                            : 'unassigned'
                      }
                      size="sm"
                      showTooltip
                    />
                    <ClassSubjectPeriodEditor
                      value={subjectData.requiredPeriods}
                      assignedPeriods={subjectData.assignedPeriods}
                      gradeDefaultPeriods={subjectData.gradeDefaultPeriods}
                      periodMode={subjectData.periodMode}
                      onSave={(periodsPerWeek) =>
                        updatePeriods.mutateAsync({
                          classId: classData.id,
                          subjectId: subjectData.subjectId,
                          periodsPerWeek,
                        })
                      }
                      disabled={isMutating}
                      compact
                    />
                    {!subjectData.isFullyAssigned && (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-[10px] tabular-nums text-slate-600"
                      >
                        {subjectData.assignedPeriods}/{subjectData.requiredPeriods}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Assignment Section */}
                <SubjectAssignmentSection
                  classId={classData.id}
                  subjectId={subjectData.subjectId}
                  requiredPeriods={subjectData.requiredPeriods}
                  assignments={subjectData.assignments}
                  onAssign={(teacherId, periods) =>
                    handleAssign(subjectData.subjectId, teacherId, periods)
                  }
                  onUnassign={handleUnassign}
                  disabled={isMutating}
                  isLoading={isMutating}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ClassAssignmentManager;
