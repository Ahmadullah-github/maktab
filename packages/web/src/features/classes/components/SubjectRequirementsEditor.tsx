/**
 * SubjectRequirementsEditor Component
 *
 * A component for managing subject requirements for a class.
 * Allows adding, removing, and editing subject-period configurations.
 *
 * Features:
 * - Display list of subject requirements with period count inputs
 * - Add/remove subject functionality
 * - Validate period counts within allowed range (1-20)
 * - Support for optional teacher assignment per subject
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectRequirement } from '../types';
import { componentLogger, logger } from '../utils/logger';

/**
 * Subject type from the API
 */
interface Subject {
  id: number;
  name: string;
  code?: string;
  grade?: number | null;
  periodsPerWeek?: number | null;
  isDeleted?: boolean;
}

/**
 * Teacher type for optional teacher assignment
 */
interface Teacher {
  id: number;
  fullName: string;
  isDeleted?: boolean;
}

/**
 * Props for the SubjectRequirementsEditor component
 */
export interface SubjectRequirementsEditorProps {
  /** Current subject requirements */
  value: SubjectRequirement[];
  /** Callback when requirements change */
  onChange: (requirements: SubjectRequirement[]) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether to show teacher assignment column */
  showTeacherColumn?: boolean;
  /** Optional class grade to filter subjects */
  classGrade?: number | null;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Minimum and maximum periods per week
 */
const MIN_PERIODS = 1;
const MAX_PERIODS = 20;

/**
 * Hook to fetch subjects from the API
 */
function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = (await api.subjects.list()) as Subject[];
      return response.filter((subject) => !subject.isDeleted);
    },
  });
}

/**
 * Hook to fetch teachers from the API
 */
function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const response = (await api.teachers.list()) as Teacher[];
      return response.filter((teacher) => !teacher.isDeleted);
    },
  });
}

/**
 * SubjectRequirementsEditor provides an interface for managing subject requirements
 *
 * @example
 * ```tsx
 * <SubjectRequirementsEditor
 *   value={subjectRequirements}
 *   onChange={setSubjectRequirements}
 *   showTeacherColumn={!singleTeacherMode}
 * />
 * ```
 */
export function SubjectRequirementsEditor({
  value,
  onChange,
  disabled = false,
  showTeacherColumn = false,
  classGrade,
  className,
}: SubjectRequirementsEditorProps) {
  const { t } = useTranslation();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectRequirementsEditor', {
      requirementsCount: value.length,
      showTeacherColumn,
    });
    return () => componentLogger.unmount('SubjectRequirementsEditor');
  }, [value.length, showTeacherColumn]);

  // Filter subjects that are not already added
  const availableSubjects = useMemo(() => {
    const addedSubjectIds = new Set(value.map((req) => req.subjectId));
    return subjects.filter((subject) => {
      // Exclude already added subjects
      if (addedSubjectIds.has(subject.id)) return false;
      // Optionally filter by grade if classGrade is provided
      if (classGrade !== null && classGrade !== undefined && subject.grade !== null) {
        // Allow subjects that match the class grade or have no grade restriction
        return subject.grade === classGrade || subject.grade === null;
      }
      return true;
    });
  }, [subjects, value, classGrade]);

  // Get subject name by ID
  const getSubjectName = (subjectId: number): string => {
    const subject = subjects.find((s) => s.id === subjectId);
    return subject?.name || `Subject ${subjectId}`;
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId: number | null | undefined): string => {
    if (!teacherId) return '';
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.fullName || '';
  };

  // Handle adding a new subject requirement
  const handleAddSubject = (subjectId: number) => {
    const subject = subjects.find((s) => s.id === subjectId);
    const defaultPeriods = subject?.periodsPerWeek || 3;

    logger.debug('Adding subject requirement', { subjectId, defaultPeriods });

    const newRequirement: SubjectRequirement = {
      subjectId,
      periodsPerWeek: Math.min(Math.max(defaultPeriods, MIN_PERIODS), MAX_PERIODS),
      teacherId: null,
    };

    onChange([...value, newRequirement]);
  };

  // Handle removing a subject requirement
  const handleRemoveSubject = (subjectId: number) => {
    logger.debug('Removing subject requirement', { subjectId });
    onChange(value.filter((req) => req.subjectId !== subjectId));
  };

  // Handle updating periods for a subject
  const handlePeriodsChange = (subjectId: number, periods: number) => {
    // Clamp periods to valid range
    const clampedPeriods = Math.min(Math.max(periods, MIN_PERIODS), MAX_PERIODS);

    logger.debug('Updating periods for subject', { subjectId, periods: clampedPeriods });

    onChange(
      value.map((req) =>
        req.subjectId === subjectId ? { ...req, periodsPerWeek: clampedPeriods } : req
      )
    );
  };

  // Handle updating teacher for a subject
  const handleTeacherChange = (subjectId: number, teacherId: number | null) => {
    logger.debug('Updating teacher for subject', { subjectId, teacherId });

    onChange(value.map((req) => (req.subjectId === subjectId ? { ...req, teacherId } : req)));
  };

  const isLoading = isLoadingSubjects || isLoadingTeachers;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{t('classes.subjectRequirements.title')}</Label>
      </div>

      {/* Subject Requirements List */}
      <div className="space-y-2">
        {value.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <BookOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('classes.noClasses')}</p>
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {/* Table Header */}
            <div
              className={cn(
                'grid gap-4 px-4 py-2 bg-muted/50 text-sm font-medium',
                showTeacherColumn ? 'grid-cols-[1fr,100px,1fr,40px]' : 'grid-cols-[1fr,100px,40px]'
              )}
            >
              <span>{t('classes.subjectRequirements.subject')}</span>
              <span>{t('classes.subjectRequirements.periodsPerWeek')}</span>
              {showTeacherColumn && <span>{t('classes.subjectRequirements.teacher')}</span>}
              <span className="sr-only">{t('common.actions')}</span>
            </div>

            {/* Subject Rows */}
            {value.map((requirement) => (
              <div
                key={requirement.subjectId}
                className={cn(
                  'grid gap-4 px-4 py-3 items-center',
                  showTeacherColumn
                    ? 'grid-cols-[1fr,100px,1fr,40px]'
                    : 'grid-cols-[1fr,100px,40px]'
                )}
              >
                {/* Subject Name */}
                <span className="font-medium truncate">
                  {getSubjectName(requirement.subjectId)}
                </span>

                {/* Periods Input */}
                <Input
                  type="number"
                  min={MIN_PERIODS}
                  max={MAX_PERIODS}
                  value={requirement.periodsPerWeek}
                  onChange={(e) =>
                    handlePeriodsChange(requirement.subjectId, parseInt(e.target.value, 10) || 1)
                  }
                  disabled={disabled}
                  className="w-full"
                />

                {/* Teacher Selector (optional) */}
                {showTeacherColumn && (
                  <Select
                    value={requirement.teacherId?.toString() || '__none__'}
                    onValueChange={(val: string) =>
                      handleTeacherChange(
                        requirement.subjectId,
                        val === '__none__' ? null : parseInt(val, 10)
                      )
                    }
                    disabled={disabled || isLoadingTeachers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('classes.form.classTeacherPlaceholder')}>
                        {getTeacherName(requirement.teacherId)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id.toString()}>
                          {teacher.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSubject(requirement.subjectId)}
                  disabled={disabled}
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t('classes.subjectRequirements.remove')}</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Subject Selector */}
      <div className="flex gap-2">
        <Select
          value=""
          onValueChange={(val: string) => {
            if (val) handleAddSubject(parseInt(val, 10));
          }}
          disabled={disabled || isLoading || availableSubjects.length === 0}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('classes.subjectRequirements.addSubject')} />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id.toString()}>
                {subject.name}
                {subject.periodsPerWeek && (
                  <span className="text-muted-foreground ml-2">
                    ({subject.periodsPerWeek} {t('common.hoursPerWeek')})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || isLoading || availableSubjects.length === 0}
          onClick={() => {
            if (availableSubjects.length > 0) {
              handleAddSubject(availableSubjects[0].id);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">{t('classes.subjectRequirements.addSubject')}</span>
        </Button>
      </div>
    </div>
  );
}

export default SubjectRequirementsEditor;
