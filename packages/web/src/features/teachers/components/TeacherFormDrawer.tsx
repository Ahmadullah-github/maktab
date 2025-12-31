/**
 * TeacherFormDrawer Component (Wizard)
 *
 * A multi-step wizard drawer for creating new teachers.
 * - Step 1: Personal Information (fullName)
 * - Step 2: Subjects (SubjectManager)
 * - Step 3: Availability (AvailabilityMatrix)
 * - Step 4: Constraints
 *
 * Features:
 * - Progress indicator showing current/total steps
 * - Back/Next navigation buttons
 * - Validation on each step before advancing
 * - Final save creates teacher with all data
 * - Data preservation across navigation
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { teacherFormSchema, type TeacherFormValues } from '@/schemas/teacher.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { calculateMaxPeriodsPerWeek, type SchoolConfig } from '../hooks/useSchoolConfig';
import type { UnavailableSlot } from '../types';
import { logger } from '../utils/logger';
import { AvailabilityMatrix } from './AvailabilityMatrix';
import { SubjectManager, type Subject } from './SubjectManager';

/**
 * Wizard step type
 */
export type WizardStep = 1 | 2 | 3 | 4;

/**
 * Total number of steps in the wizard
 */
export const TOTAL_STEPS = 4;

/**
 * Props for the TeacherFormDrawer component
 */
export interface TeacherFormDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when the drawer should close */
  onOpenChange: (open: boolean) => void;
  /** Callback when a teacher is created */
  onCreate: (data: TeacherFormValues) => Promise<void>;
  /** Whether creation is in progress */
  isCreating?: boolean;
  /** SchoolConfig for dynamic constraints */
  schoolConfig: SchoolConfig;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Hook to fetch subjects for the subject manager
 */
function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = (await api.subjects.list()) as Subject[];
      return response.filter((subject) => !(subject as { isDeleted?: boolean }).isDeleted);
    },
  });
}

/**
 * Creates a dynamic Zod schema with SchoolConfig-based constraint validation
 */
function createWizardSchema(config: SchoolConfig) {
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
 * Get default form values based on SchoolConfig
 */
function getDefaultValues(config: SchoolConfig): TeacherFormValues {
  const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
  return {
    fullName: '',
    primarySubjectIds: [],
    allowedSubjectIds: [],
    restrictToPrimarySubjects: true,
    unavailable: [],
    maxPeriodsPerWeek,
    maxPeriodsPerDay: config.defaultPeriodsPerDay,
    maxConsecutivePeriods: 2,
    timePreference: 'any',
  };
}

/**
 * Validates a specific step of the wizard
 * Returns true if the step is valid, false otherwise
 */
export function validateWizardStep(
  step: WizardStep,
  values: TeacherFormValues,
  config: SchoolConfig
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (step) {
    case 1:
      // Step 1: Validate fullName
      if (!values.fullName || values.fullName.trim().length === 0) {
        errors.push('teachers.validation.nameRequired');
      } else if (values.fullName.length > 255) {
        errors.push('teachers.validation.nameTooLong');
      }
      break;

    case 2:
      // Step 2: Subjects - no required validation, subjects are optional
      break;

    case 3:
      // Step 3: Availability - no required validation, availability is optional
      break;

    case 4:
      // Step 4: Validate constraints
      const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
      const maxPeriodsPerDay = config.defaultPeriodsPerDay;

      if (values.maxPeriodsPerWeek < 1 || values.maxPeriodsPerWeek > maxPeriodsPerWeek) {
        errors.push('teachers.validation.invalidConstraint');
      }
      if (values.maxPeriodsPerDay < 1 || values.maxPeriodsPerDay > maxPeriodsPerDay) {
        errors.push('teachers.validation.invalidConstraint');
      }
      if (values.maxConsecutivePeriods < 1 || values.maxConsecutivePeriods > 2) {
        errors.push('teachers.validation.invalidConstraint');
      }
      break;
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Progress indicator component showing current step
 */
function WizardProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: WizardStep;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = (i + 1) as WizardStep;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                isActive && 'bg-primary text-primary-foreground',
                isCompleted && 'bg-primary/20 text-primary',
                !isActive && !isCompleted && 'bg-muted text-muted-foreground'
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
            </div>
            {stepNum < totalSteps && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  stepNum < currentStep ? 'bg-primary/50' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * TeacherFormDrawer provides a multi-step wizard for creating new teachers
 *
 * @example
 * ```tsx
 * <TeacherFormDrawer
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onCreate={handleCreate}
 *   isCreating={isPending}
 *   schoolConfig={schoolConfig}
 * />
 * ```
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export function TeacherFormDrawer({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
  schoolConfig,
  className,
}: TeacherFormDrawerProps) {
  const { t } = useTranslation();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  // Create dynamic schema with SchoolConfig-based validation
  const dynamicSchema = useMemo(() => createWizardSchema(schoolConfig), [schoolConfig]);

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
    defaultValues,
  });

  // Reset form and step when drawer opens/closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset form and step when closing
        form.reset(defaultValues);
        setCurrentStep(1);
        setStepErrors([]);
      }
      onOpenChange(newOpen);
    },
    [form, defaultValues, onOpenChange]
  );

  // Handle next step navigation
  const handleNext = useCallback(() => {
    const values = form.getValues();
    const validation = validateWizardStep(currentStep, values, schoolConfig);

    if (!validation.isValid) {
      setStepErrors(validation.errors);
      return;
    }

    setStepErrors([]);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
      logger.debug('Wizard: advancing to step', { step: currentStep + 1 });
    }
  }, [currentStep, form, schoolConfig]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    setStepErrors([]);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
      logger.debug('Wizard: going back to step', { step: currentStep - 1 });
    }
  }, [currentStep]);

  // Handle final save
  const handleSave = useCallback(async () => {
    const values = form.getValues();
    const validation = validateWizardStep(currentStep, values, schoolConfig);

    if (!validation.isValid) {
      setStepErrors(validation.errors);
      return;
    }

    logger.debug('Wizard: saving teacher', { fullName: values.fullName });
    await onCreate(values);
    handleOpenChange(false);
  }, [form, currentStep, schoolConfig, onCreate, handleOpenChange]);

  // Handle subject changes
  const handlePrimarySubjectsChange = useCallback(
    (ids: number[]) => {
      form.setValue('primarySubjectIds', ids, { shouldDirty: true });
    },
    [form]
  );

  const handleAllowedSubjectsChange = useCallback(
    (ids: number[]) => {
      form.setValue('allowedSubjectIds', ids, { shouldDirty: true });
    },
    [form]
  );

  const handleRestrictChange = useCallback(
    (value: boolean) => {
      form.setValue('restrictToPrimarySubjects', value, { shouldDirty: true });
    },
    [form]
  );

  // Handle availability changes
  const handleAvailabilityChange = useCallback(
    (slots: UnavailableSlot[]) => {
      form.setValue('unavailable', slots, { shouldDirty: true });
    },
    [form]
  );

  // Translate validation error messages
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    if (message.startsWith('teachers.')) {
      return t(message);
    }
    return message;
  };

  // Watch form values for controlled components
  const watchedPrimarySubjectIds = form.watch('primarySubjectIds');
  const watchedAllowedSubjectIds = form.watch('allowedSubjectIds');
  const watchedRestrictToPrimary = form.watch('restrictToPrimarySubjects');
  const watchedUnavailable = form.watch('unavailable');

  // Get step title
  const getStepTitle = (step: WizardStep): string => {
    return t(`teachers.steps.${step}`);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="left"
        className={cn('w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0', className)}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{t('teachers.wizard.title')}</SheetTitle>
          <SheetDescription>{t('teachers.wizard.subtitle')}</SheetDescription>
        </SheetHeader>

        {/* Progress Indicator */}
        <div className="px-6">
          <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {/* Step Title */}
          <div className="text-center mb-4">
            <h3 className="font-medium text-lg">{getStepTitle(currentStep)}</h3>
          </div>

          {/* Step Errors */}
          {stepErrors.length > 0 && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              {stepErrors.map((error, index) => (
                <p key={index} className="text-sm text-destructive">
                  {t(error)}
                </p>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-350px)]">
          <div className="px-6 py-4">
            <Form {...form}>
              <div className="space-y-6">
                {/* Step 1: Personal Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-1">{t('teachers.basicInfo')}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('teachers.basicInfoDesc')}
                      </p>
                    </div>
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
                  </div>
                )}

                {/* Step 2: Subjects */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-1">{t('teachers.subjects')}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('teachers.subjectsDesc')}
                      </p>
                    </div>
                    {isLoadingSubjects ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <SubjectManager
                        primarySubjectIds={watchedPrimarySubjectIds}
                        allowedSubjectIds={watchedAllowedSubjectIds}
                        restrictToPrimary={watchedRestrictToPrimary}
                        onPrimaryChange={handlePrimarySubjectsChange}
                        onAllowedChange={handleAllowedSubjectsChange}
                        onRestrictChange={handleRestrictChange}
                        availableSubjects={subjects}
                        disabled={isCreating}
                      />
                    )}
                  </div>
                )}

                {/* Step 3: Availability */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-1">{t('teachers.availability')}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('teachers.availabilityWizardDesc')}
                      </p>
                    </div>
                    <AvailabilityMatrix
                      value={watchedUnavailable}
                      onChange={handleAvailabilityChange}
                      disabled={isCreating}
                      daysOfWeek={schoolConfig.daysOfWeek}
                      periodsPerDayMap={schoolConfig.periodsPerDayMap}
                      defaultPeriodsPerDay={schoolConfig.defaultPeriodsPerDay}
                    />
                  </div>
                )}

                {/* Step 4: Constraints */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-1">{t('teachers.constraints')}</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('teachers.constraintsDesc')}
                      </p>
                    </div>

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
                  </div>
                )}
              </div>
            </Form>
          </div>
        </ScrollArea>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isCreating}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button type="button" onClick={handleNext} disabled={isCreating}>
              {t('common.next')}
              <ArrowLeft className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('teachers.wizard.finalSave')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TeacherFormDrawer;
