/**
 * ClassForm Component
 *
 * A reusable form component for creating and editing class groups.
 * Uses react-hook-form with Zod validation and supports localized error messages.
 *
 * Features:
 * - Auto-enables single-teacher mode for grades 1-3
 * - Integrates with RoomSelector for fixed room assignment
 * - Supports class teacher selection in single-teacher mode
 *
 * Requirements: 2.2, 2.4, 2.5
 */

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { classFormSchema, type ClassFormValues } from '@/schemas/class.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { shouldEnableSingleTeacherMode } from '../utils/gradeCategory';
import { componentLogger, logger } from '../utils/logger';
import { RoomSelector } from './ui/RoomSelector';

/**
 * Teacher type for the class teacher selector
 */
interface Teacher {
  id: number;
  fullName: string;
  isDeleted?: boolean;
}

/**
 * Props for the ClassForm component
 */
export interface ClassFormProps {
  /** Initial values for editing an existing class */
  initialValues?: Partial<ClassFormValues>;
  /** Callback when form is submitted successfully */
  onSubmit: (values: ClassFormValues) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Whether this is an edit form (vs create) */
  isEditing?: boolean;
  /** IDs of rooms already assigned to other classes */
  assignedRoomIds?: number[];
  /** Current class ID (for edit mode, to exclude from room warnings) */
  currentClassId?: number | null;
}

/**
 * Hook to fetch teachers for the class teacher selector
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
 * Grade options for the grade selector (1-12)
 */
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Default form values for a new class
 */
const DEFAULT_VALUES: ClassFormValues = {
  name: '',
  displayName: '',
  grade: null,
  sectionIndex: '',
  studentCount: 0,
  fixedRoomId: null,
  homeRoomId: null,
  singleTeacherMode: false,
  classTeacherId: null,
  subjectRequirements: [],
};

/**
 * ClassForm provides a form for creating and editing class groups
 *
 * @example
 * ```tsx
 * <ClassForm
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   isSubmitting={isPending}
 * />
 * ```
 */
export function ClassForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
  assignedRoomIds = [],
  currentClassId,
}: ClassFormProps) {
  const { t } = useTranslation();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      ...initialValues,
    },
  });

  // Watch grade field to auto-enable single-teacher mode
  const watchedGrade = form.watch('grade');
  const watchedSingleTeacherMode = form.watch('singleTeacherMode');

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('ClassForm', { isEditing, hasInitialValues: !!initialValues });
    return () => componentLogger.unmount('ClassForm');
  }, [isEditing, initialValues]);

  // Auto-enable single-teacher mode for grades 1-3
  useEffect(() => {
    if (watchedGrade !== null && shouldEnableSingleTeacherMode(watchedGrade)) {
      const currentValue = form.getValues('singleTeacherMode');
      if (!currentValue) {
        logger.debug('Auto-enabling single-teacher mode for grade', { grade: watchedGrade });
        form.setValue('singleTeacherMode', true);
      }
    }
  }, [watchedGrade, form]);

  // Clear classTeacherId when single-teacher mode is disabled
  useEffect(() => {
    if (!watchedSingleTeacherMode) {
      const currentTeacherId = form.getValues('classTeacherId');
      if (currentTeacherId !== null) {
        logger.debug('Clearing classTeacherId as single-teacher mode is disabled');
        form.setValue('classTeacherId', null);
      }
    }
  }, [watchedSingleTeacherMode, form]);

  // Reset form when initialValues change (for edit mode)
  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, form]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = (values: any) => {
    logger.debug('ClassForm submitted', { name: values.name, grade: values.grade });
    onSubmit(values as ClassFormValues);
  };

  // Translate validation error messages
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    // If the message is a translation key, translate it
    if (message.startsWith('classes.')) {
      return t(message);
    }
    return message;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Class Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('classes.form.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('classes.form.namePlaceholder')} {...field} />
              </FormControl>
              <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
            </FormItem>
          )}
        />

        {/* Preferred home room (soft constraint) */}
        <FormField
          control={form.control}
          name="homeRoomId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('classes.form.homeRoom')}</FormLabel>
              <FormDescription>{t('classes.form.homeRoomDesc')}</FormDescription>
              <FormControl>
                <RoomSelector
                  value={field.value ?? null}
                  onChange={field.onChange}
                  currentClassId={currentClassId}
                  placeholder={t('classes.form.homeRoomPlaceholder')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Grade and Section Index - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Grade Selector */}
          <FormField
            control={form.control}
            name="grade"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('classes.form.grade')}</FormLabel>
                <Select
                  value={field.value?.toString() || ''}
                  onValueChange={(value: string) => {
                    const numValue = value ? parseInt(value, 10) : null;
                    field.onChange(numValue);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('classes.form.gradePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GRADE_OPTIONS.map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
              </FormItem>
            )}
          />

          {/* Section Index */}
          <FormField
            control={form.control}
            name="sectionIndex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('classes.form.sectionIndex')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('classes.form.sectionIndexPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Student Count */}
        <FormField
          control={form.control}
          name="studentCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('classes.form.studentCount')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fixed Room Selector */}
        <FormField
          control={form.control}
          name="fixedRoomId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('classes.form.fixedRoom')}</FormLabel>
              <FormControl>
                <RoomSelector
                  value={field.value ?? null}
                  onChange={field.onChange}
                  assignedRoomIds={assignedRoomIds}
                  currentClassId={currentClassId}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Single-Teacher Mode Toggle */}
        <FormField
          control={form.control}
          name="singleTeacherMode"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('classes.form.singleTeacherMode')}</FormLabel>
                <FormDescription>{t('classes.form.singleTeacherModeDesc')}</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Class Teacher Selector - Only shown when single-teacher mode is enabled */}
        {watchedSingleTeacherMode && (
          <FormField
            control={form.control}
            name="classTeacherId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('classes.form.classTeacher')}</FormLabel>
                <Select
                  value={field.value?.toString() || ''}
                  onValueChange={(value: string) => {
                    const numValue = value ? parseInt(value, 10) : null;
                    field.onChange(numValue);
                  }}
                  disabled={isLoadingTeachers}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('classes.form.classTeacherPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? t('common.saveChanges') : t('common.create')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default ClassForm;
