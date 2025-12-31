/**
 * TeacherForm Component
 *
 * A reusable form component for creating and editing teacher profiles.
 * Uses react-hook-form with Zod validation and supports localized error messages.
 *
 * Features:
 * - Dynamic constraint validation based on SchoolConfig
 * - Default constraint values derived from SchoolConfig
 * - Farsi validation messages via i18n
 *
 * Requirements: 2.1, 5.1, 5.2, 5.3, 5.4, 5.5, 9.3
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
import { teacherFormSchema, type TeacherFormValues } from '@/schemas/teacher.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { calculateMaxPeriodsPerWeek, type SchoolConfig } from '../hooks/useSchoolConfig';
import { logger } from '../utils/logger';

/**
 * Props for the TeacherForm component
 */
export interface TeacherFormProps {
  /** Initial values for editing an existing teacher */
  initialValues?: Partial<TeacherFormValues>;
  /** Callback when form is submitted successfully */
  onSubmit: (values: TeacherFormValues) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Whether this is an edit form (vs create) */
  isEditing?: boolean;
  /** SchoolConfig for dynamic constraint validation */
  schoolConfig: SchoolConfig;
  /** Whether to show only basic info fields (for wizard step 1) */
  basicInfoOnly?: boolean;
  /** Whether to show only constraint fields (for wizard step 4) */
  constraintsOnly?: boolean;
}

/**
 * Creates a dynamic Zod schema with SchoolConfig-based constraint validation
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function createTeacherFormSchemaWithConfig(config: SchoolConfig) {
  const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
  const maxPeriodsPerDay = config.defaultPeriodsPerDay;

  return teacherFormSchema.extend({
    maxPeriodsPerWeek: z.coerce
      .number()
      .int()
      .min(1, 'teachers.validation.invalidConstraint')
      .max(maxPeriodsPerWeek, 'teachers.validation.invalidConstraint'),
    maxPeriodsPerDay: z.coerce
      .number()
      .int()
      .min(1, 'teachers.validation.invalidConstraint')
      .max(maxPeriodsPerDay, 'teachers.validation.invalidConstraint'),
    maxConsecutivePeriods: z.coerce
      .number()
      .int()
      .min(1, 'teachers.validation.invalidConstraint')
      .max(2, 'teachers.validation.invalidConstraint'),
  });
}

/**
 * Calculates default constraint values from SchoolConfig
 *
 * Requirements: 5.5
 */
export function getDefaultConstraints(config: SchoolConfig): {
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
} {
  const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
  return {
    maxPeriodsPerWeek,
    maxPeriodsPerDay: config.defaultPeriodsPerDay,
    maxConsecutivePeriods: 2,
  };
}

/**
 * Default form values for a new teacher
 */
const getDefaultValues = (config: SchoolConfig): TeacherFormValues => {
  const defaults = getDefaultConstraints(config);
  return {
    fullName: '',
    primarySubjectIds: [],
    allowedSubjectIds: [],
    restrictToPrimarySubjects: true,
    unavailable: [],
    maxPeriodsPerWeek: defaults.maxPeriodsPerWeek,
    maxPeriodsPerDay: defaults.maxPeriodsPerDay,
    maxConsecutivePeriods: defaults.maxConsecutivePeriods,
    timePreference: 'any',
  };
};

/**
 * TeacherForm provides a form for creating and editing teacher profiles
 *
 * @example
 * ```tsx
 * <TeacherForm
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   isSubmitting={isPending}
 *   schoolConfig={schoolConfig}
 * />
 * ```
 *
 * Requirements: 2.1, 5.1, 5.2, 5.3, 5.4, 5.5, 9.3
 */
export function TeacherForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
  schoolConfig,
  basicInfoOnly = false,
  constraintsOnly = false,
}: TeacherFormProps) {
  const { t } = useTranslation();

  // Create dynamic schema with SchoolConfig-based validation
  const dynamicSchema = useMemo(
    () => createTeacherFormSchemaWithConfig(schoolConfig),
    [schoolConfig]
  );

  // Calculate constraint limits for display
  const maxPeriodsPerWeekLimit = useMemo(
    () => calculateMaxPeriodsPerWeek(schoolConfig),
    [schoolConfig]
  );
  const maxPeriodsPerDayLimit = schoolConfig.defaultPeriodsPerDay;

  // Get default values based on SchoolConfig
  const defaultValues = useMemo(() => getDefaultValues(schoolConfig), [schoolConfig]);

  // Initialize form with react-hook-form and dynamic Zod validation
  const form = useForm<TeacherFormValues>({
    // @ts-ignore - Type inference issue with zod resolver
    resolver: zodResolver(dynamicSchema),
    defaultValues: {
      ...defaultValues,
      ...initialValues,
    },
  });

  // Debug logging on mount
  useEffect(() => {
    logger.debug('TeacherForm mounted', {
      isEditing,
      hasInitialValues: !!initialValues,
      maxPeriodsPerWeekLimit,
      maxPeriodsPerDayLimit,
    });
  }, [isEditing, initialValues, maxPeriodsPerWeekLimit, maxPeriodsPerDayLimit]);

  // Reset form when initialValues change (for edit mode)
  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...defaultValues,
        ...initialValues,
      });
    }
  }, [initialValues, form, defaultValues]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = (values: any) => {
    logger.debug('TeacherForm submitted', { fullName: values.fullName });
    onSubmit(values as TeacherFormValues);
  };

  // Translate validation error messages
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    // If the message is a translation key, translate it
    if (message.startsWith('teachers.')) {
      return t(message);
    }
    return message;
  };

  return (
    <Form {...form}>
      {/* @ts-ignore - Type inference issue with form.handleSubmit */}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Info Fields */}
        {!constraintsOnly && (
          <>
            {/* Full Name */}
            {/* @ts-ignore - Type inference issue with form.control */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('teachers.fullName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('teachers.firstNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                </FormItem>
              )}
            />
          </>
        )}

        {/* Constraint Fields */}
        {!basicInfoOnly && (
          <>
            {/* Max Periods Per Week */}
            {/* @ts-ignore - Type inference issue with form.control */}
            <FormField
              control={form.control}
              name="maxPeriodsPerWeek"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('teachers.maxPeriodsPerWeek')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={maxPeriodsPerWeekLimit}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('common.period')} 1-{maxPeriodsPerWeekLimit}
                  </FormDescription>
                  <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                </FormItem>
              )}
            />

            {/* Max Periods Per Day */}
            {/* @ts-ignore - Type inference issue with form.control */}
            <FormField
              control={form.control}
              name="maxPeriodsPerDay"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('teachers.maxPeriodsPerDay')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={maxPeriodsPerDayLimit}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('common.period')} 1-{maxPeriodsPerDayLimit}
                  </FormDescription>
                  <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                </FormItem>
              )}
            />

            {/* Max Consecutive Periods */}
            {/* @ts-ignore - Type inference issue with form.control */}
            <FormField
              control={form.control}
              name="maxConsecutivePeriods"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('teachers.maxConsecutive')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={2}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                    />
                  </FormControl>
                  <FormDescription>{t('common.period')} 1-2</FormDescription>
                  <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                </FormItem>
              )}
            />
          </>
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

export default TeacherForm;
