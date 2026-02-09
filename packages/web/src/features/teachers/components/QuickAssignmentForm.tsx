/**
 * QuickAssignmentForm Component
 *
 * Simple form to add new assignments with workload preview.
 * Shows subject dropdown, available classes checkboxes, and capacity preview.
 *
 * Phase 2.2 of Teacher Assignment System
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type SubjectRequirement } from '@/lib/apiParsers';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Loader2, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canTeacherTeachSubject } from '../../assignments/services/assignmentValidation';
import { useClasses } from '../../classes/hooks/useClasses';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { ClassAssignment, Teacher } from '../types';
import { ensureArray } from '../utils/serialization';

/**
 * Subject info for display
 */
interface SubjectInfo {
  id: number;
  name: string;
  periodsPerWeek?: number | null;
  isDeleted?: boolean;
}

/**
 * Raw class from API
 */
interface ClassInfoRaw {
  id: number;
  name: string;
  grade?: number | null;
  subjectRequirements?: string | SubjectRequirement[];
  isDeleted?: boolean;
}

/**
 * Parsed class info for display
 */
interface ClassInfo {
  id: number;
  name: string;
  grade?: number | null;
  subjectRequirements: SubjectRequirement[];
}

/**
 * Parse subject requirements from raw class data
 */
function parseSubjectRequirements(
  requirements: string | SubjectRequirement[] | null | undefined
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

export interface QuickAssignmentFormProps {
  /** The teacher to add assignments for */
  teacher: Teacher;
  /** Callback when assignments are added */
  onAdd: (subjectId: number, classIds: number[]) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * QuickAssignmentForm provides a simple interface to add assignments
 */
export function QuickAssignmentForm({
  teacher,
  onAdd,
  isUpdating = false,
  className,
}: QuickAssignmentFormProps) {
  const { t } = useTranslation();
  // Fetch data using shared hooks for real-time updates
  const { data: allSubjects = [] } = useSubjects();
  const { data: allClasses = [] } = useClasses();

  // Filter out deleted items and parse class data
  const subjects = useMemo(
    () => (allSubjects as SubjectInfo[]).filter((s) => !s.isDeleted),
    [allSubjects]
  );
  const classes = useMemo(
    () =>
      (allClasses as ClassInfoRaw[])
        .filter((c) => !c.isDeleted)
        .map(
          (c): ClassInfo => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            subjectRequirements: parseSubjectRequirements(c.subjectRequirements),
          })
        ),
    [allClasses]
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Get subjects the teacher can teach
  const teachableSubjects = useMemo(() => {
    return subjects.filter((subject) => canTeacherTeachSubject(teacher, subject.id));
  }, [subjects, teacher]);

  // Get currently assigned class IDs for the selected subject
  const assignedClassIds = useMemo(() => {
    if (!selectedSubjectId) return new Set<number>();

    const classAssignments = ensureArray<ClassAssignment>(teacher.classAssignments);
    const assignment = classAssignments.find((a) => a.subjectId === selectedSubjectId);
    if (!assignment) return new Set<number>();

    return new Set(ensureArray<number>(assignment.classIds));
  }, [teacher.classAssignments, selectedSubjectId]);

  // Get available classes for the selected subject (not already assigned)
  const availableClasses = useMemo(() => {
    if (!selectedSubjectId) return [];

    return classes.filter((cls) => {
      // Check if class requires this subject
      const requiresSubject = cls.subjectRequirements.some(
        (r) => r.subjectId === selectedSubjectId
      );

      // Check if not already assigned
      const isAssigned = assignedClassIds.has(cls.id);

      return requiresSubject && !isAssigned;
    });
  }, [classes, selectedSubjectId, assignedClassIds]);

  // Get selected subject info
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) ?? null;
  }, [subjects, selectedSubjectId]);

  // Calculate current workload
  const currentWorkload = useMemo(() => {
    const classAssignments = ensureArray<ClassAssignment>(teacher.classAssignments);
    let total = 0;

    classAssignments.forEach((assignment) => {
      const subject = subjects.find((s) => s.id === assignment.subjectId);
      if (!subject) return;

      const classIds = ensureArray<number>(assignment.classIds);
      total += classIds.length * (subject.periodsPerWeek ?? 0);
    });

    return total;
  }, [teacher.classAssignments, subjects]);

  // Calculate preview workload (with selected classes)
  const previewWorkload = useMemo(() => {
    if (!selectedSubject || selectedClassIds.size === 0) return currentWorkload;

    const additionalPeriods = selectedClassIds.size * (selectedSubject.periodsPerWeek ?? 0);
    return currentWorkload + additionalPeriods;
  }, [currentWorkload, selectedSubject, selectedClassIds]);

  // Check if preview exceeds max
  const isOverCapacity = previewWorkload > teacher.maxPeriodsPerWeek;
  const utilizationPercent = Math.min((previewWorkload / teacher.maxPeriodsPerWeek) * 100, 100);

  // Handle subject change
  const handleSubjectChange = useCallback((value: string) => {
    setSelectedSubjectId(Number(value));
    setSelectedClassIds(new Set());
  }, []);

  // Handle class toggle
  const handleClassToggle = useCallback((classId: number) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedClassIds.size === availableClasses.length) {
      setSelectedClassIds(new Set());
    } else {
      setSelectedClassIds(new Set(availableClasses.map((c) => c.id)));
    }
  }, [availableClasses, selectedClassIds]);

  // Handle add
  const handleAdd = async () => {
    if (!selectedSubjectId || selectedClassIds.size === 0) return;

    setIsAdding(true);
    try {
      await onAdd(selectedSubjectId, Array.from(selectedClassIds));
      // Reset form
      setSelectedClassIds(new Set());
    } finally {
      setIsAdding(false);
    }
  };

  // Check if all teachable subjects are fully assigned
  const allSubjectsAssigned = useMemo(() => {
    return teachableSubjects.every((subject) => {
      const classAssignments = ensureArray<ClassAssignment>(teacher.classAssignments);
      const assignment = classAssignments.find((a) => a.subjectId === subject.id);
      if (!assignment) return false;

      const assignedIds = new Set(ensureArray<number>(assignment.classIds));
      const availableForSubject = classes.filter((cls) => {
        return (
          cls.subjectRequirements.some((r) => r.subjectId === subject.id) &&
          !assignedIds.has(cls.id)
        );
      });

      return availableForSubject.length === 0;
    });
  }, [teachableSubjects, teacher.classAssignments, classes]);

  // No teachable subjects
  if (teachableSubjects.length === 0) {
    return (
      <div className={cn('p-4 bg-amber-50 rounded-lg border border-amber-200', className)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {t(
                'teachers.assignments.noTeachableSubjects',
                'هیچ مضمونی برای تدریس تعریف نشده است'
              )}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {t(
                'teachers.assignments.addSubjectsFirst',
                'ابتدا مضامین را در تب مضامین اضافه کنید'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All subjects fully assigned
  if (allSubjectsAssigned) {
    return (
      <div className={cn('p-4 bg-green-50 rounded-lg border border-green-200', className)}>
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {t(
                'teachers.assignments.allSubjectsAssigned',
                'همه مضامین قابل تدریس تخصیص یافته‌اند'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 bg-white rounded-lg border-2 border-slate-200 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-blue-600" />
        <h3 className="font-medium text-sm text-slate-800">
          {t('teachers.assignments.addAssignment', 'افزودن تخصیص')}
        </h3>
      </div>

      {/* Subject Select */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">
          {t('teachers.assignments.selectSubject', 'انتخاب مضمون')}
        </label>
        <Select
          value={selectedSubjectId?.toString() ?? ''}
          onValueChange={handleSubjectChange}
          disabled={isUpdating || isAdding}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={t(
                'teachers.assignments.selectSubjectPlaceholder',
                'مضمون را انتخاب کنید...'
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {teachableSubjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id.toString()}>
                <div className="flex items-center gap-2">
                  <span>{subject.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({subject.periodsPerWeek ?? 0} {t('common.periodsShort', 'ساعت')})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Available Classes */}
      {selectedSubjectId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">
              {t('teachers.assignments.availableClasses', 'صنف‌های موجود')}
            </label>
            {availableClasses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-6 px-2 text-xs"
                disabled={isUpdating || isAdding}
              >
                {selectedClassIds.size === availableClasses.length
                  ? t('common.deselectAll', 'لغو همه')
                  : t('common.selectAll', 'انتخاب همه')}
              </Button>
            )}
          </div>

          {availableClasses.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              {t(
                'teachers.assignments.noAvailableClasses',
                'همه صنف‌ها برای این مضمون تخصیص یافته‌اند'
              )}
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
              {availableClasses.map((cls) => {
                const requirement = cls.subjectRequirements.find(
                  (r) => r.subjectId === selectedSubjectId
                );
                const periods = requirement?.periodsPerWeek ?? selectedSubject?.periodsPerWeek ?? 0;

                return (
                  <label
                    key={cls.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                      selectedClassIds.has(cls.id)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    )}
                  >
                    <Checkbox
                      checked={selectedClassIds.has(cls.id)}
                      onCheckedChange={() => handleClassToggle(cls.id)}
                      disabled={isUpdating || isAdding}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-slate-700">{cls.name}</span>
                      <span className="text-xs text-slate-500">
                        {periods} {t('common.periodsShort', 'ساعت')}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Workload Preview */}
      {selectedSubjectId && selectedClassIds.size > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">
              {t('teachers.assignments.workloadPreview', 'پیش‌نمایش بار کاری')}
            </span>
            <span className={cn('font-medium', isOverCapacity ? 'text-red-600' : 'text-slate-700')}>
              {currentWorkload} → {previewWorkload} / {teacher.maxPeriodsPerWeek}{' '}
              {t('common.periodsShort', 'ساعت')}
            </span>
          </div>
          <Progress
            value={utilizationPercent}
            className={cn('h-2', isOverCapacity && '[&>div]:bg-red-500')}
          />
          {isOverCapacity && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="h-3 w-3" />
              <span>{t('teachers.assignments.overCapacityWarning', 'بیش از حد مجاز')}</span>
            </div>
          )}
        </div>
      )}

      {/* Add Button */}
      <Button
        onClick={handleAdd}
        disabled={!selectedSubjectId || selectedClassIds.size === 0 || isUpdating || isAdding}
        className="w-full"
      >
        {isAdding ? (
          <>
            <Loader2 className="h-4 w-4 me-2 animate-spin" />
            {t('common.adding', 'در حال افزودن...')}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 me-2" />
            {t('teachers.assignments.addSelected', 'افزودن انتخاب شده‌ها')}
            {selectedClassIds.size > 0 && ` (${selectedClassIds.size})`}
          </>
        )}
      </Button>
    </div>
  );
}

export default QuickAssignmentForm;
