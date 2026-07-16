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
import { ArrowLeft, ArrowRight, Check, Loader2, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  calculateMaxPeriodsPerWeek,
  getEffectivePeriodsPerDayMap,
  getMaxPeriodsPerDay,
} from '@/features/school-settings/hooks/useSchoolSettings';
import type { SchoolConfig } from '@/features/school-settings/types';
import type { UnavailableSlot } from '../types';
import { logger } from '../utils/logger';
import { AvailabilityMatrix } from './AvailabilityMatrix';
import { SubjectManager, type Subject } from './SubjectManager';
import { useRooms } from '@/features/rooms/hooks/useRooms';
import { useTeachers } from '../hooks/useTeachers';

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
 * Get default form values based on SchoolConfig
 */
function getDefaultValues(config: SchoolConfig): TeacherFormValues {
  const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
  return {
    fullName: '',
    staffCode: '',
    employmentType: 'full_time',
    primarySubjectIds: [],
    allowedSubjectIds: [],
    restrictToPrimarySubjects: true,
    unavailable: [],
    maxPeriodsPerWeek,
    maxPeriodsPerDay: getMaxPeriodsPerDay(config),
    maxConsecutivePeriods: 2,
    timePreference: 'any',
    preferredRoomIds: [],
    preferredColleagues: [],
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
      // Step 1: Validate stable identity and display name.
      if (!values.fullName || values.fullName.trim().length === 0) {
        errors.push('teachers.validation.nameRequired');
      } else if (values.fullName.length > 255) {
        errors.push('teachers.validation.nameTooLong');
      }
      if (!values.staffCode || values.staffCode.trim().length === 0) {
        errors.push('teachers.validation.staffCodeRequired');
      }
      break;

    case 2:
      // Step 2: Subjects - no required validation, subjects are optional
      break;

    case 3:
      // Step 3: Availability - no required validation, availability is optional
      break;

    case 4: {
      // Step 4: Validate constraints
      const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
      const maxPeriodsPerDay = getMaxPeriodsPerDay(config);

      if (values.maxPeriodsPerWeek < 0 || values.maxPeriodsPerWeek > maxPeriodsPerWeek) {
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
    <div className="flex items-center justify-center gap-2 py-4 px-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = (i + 1) as WizardStep;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl text-sm font-semibold transition-all duration-200',
                isActive && 'bg-linear-to-br from-[#003366] to-[#004488] text-white shadow-md',
                isCompleted && 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200',
                !isActive && !isCompleted && 'bg-slate-100 text-slate-400 border-2 border-slate-200'
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
            </div>
            {stepNum < totalSteps && (
              <div
                className={cn(
                  'w-8 h-1 mx-1.5 rounded-full transition-colors',
                  stepNum < currentStep ? 'bg-emerald-300' : 'bg-slate-200'
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
  const { data: rooms = [] } = useRooms();
  const { data: teachers = [] } = useTeachers();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  // Calculate constraint limits for display
  const maxPeriodsPerWeekLimit = useMemo(
    () => calculateMaxPeriodsPerWeek(schoolConfig),
    [schoolConfig]
  );
  const maxPeriodsPerDayLimit = getMaxPeriodsPerDay(schoolConfig);
  const effectivePeriodsPerDayMap = useMemo(
    () => getEffectivePeriodsPerDayMap(schoolConfig),
    [schoolConfig]
  );

  // Get default values based on SchoolConfig
  const defaultValues = useMemo(() => getDefaultValues(schoolConfig), [schoolConfig]);

  // Initialize form with react-hook-form and base Zod validation
  // Dynamic validation is handled in validateWizardStep
  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
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
        side="right"
        className={cn(
          'w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0',
          'bg-linear-to-br from-slate-50 to-white',
          className
        )}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b-2 border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#003366] to-[#004488] flex items-center justify-center shadow-md">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-slate-800">
                {t('teachers.wizard.title')}
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-500">
                {t('teachers.wizard.subtitle')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Progress Indicator */}
        <div className="px-6 pt-4">
          <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

          {/* Step Title */}
          <div className="text-center mt-4 mb-3">
            <h3 className="font-semibold text-base text-slate-800">{getStepTitle(currentStep)}</h3>
          </div>

          {/* Step Errors */}
          {stepErrors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
              {stepErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600 font-medium">
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
                  <div className="space-y-5">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                      <h4 className="font-semibold text-sm text-slate-800 mb-1">
                        {t('teachers.basicInfo')}
                      </h4>
                      <p className="text-xs text-slate-500">{t('teachers.basicInfoDesc')}</p>
                    </div>
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field, fieldState }) => (
                        <FormItem className="p-4 bg-white rounded-xl border-2 border-slate-100">
                          <FormLabel className="text-sm font-medium text-slate-700">
                            {t('teachers.fullName')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('teachers.firstNamePlaceholder')}
                              {...field}
                              className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
                            />
                          </FormControl>
                          <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="staffCode"
                      render={({ field, fieldState }) => (
                        <FormItem className="p-4 bg-white rounded-xl border-2 border-slate-100">
                          <FormLabel>{t('teachers.staffCode', 'Staff code')}</FormLabel>
                          <FormControl>
                            <Input placeholder="T-00001" {...field} />
                          </FormControl>
                          <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="employmentType"
                      render={({ field }) => (
                        <FormItem className="p-4 bg-white rounded-xl border-2 border-slate-100">
                          <FormLabel>{t('teachers.employmentType', 'Employment type')}</FormLabel>
                          <FormControl>
                            <select {...field} className="h-10 w-full rounded-md border-2 px-3">
                              <option value="full_time">{t('teachers.filterFullTime')}</option>
                              <option value="part_time">{t('teachers.filterPartTime')}</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Subjects */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                      <h4 className="font-semibold text-sm text-slate-800 mb-1">
                        {t('teachers.subjects')}
                      </h4>
                      <p className="text-xs text-slate-500">{t('teachers.subjectsDesc')}</p>
                    </div>
                    {isLoadingSubjects ? (
                      <div className="flex items-center justify-center py-8 bg-white rounded-xl border-2 border-slate-100">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
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
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Availability */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                      <h4 className="font-semibold text-sm text-slate-800 mb-1">
                        {t('teachers.availability')}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {t('teachers.availabilityWizardDesc')}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                      <AvailabilityMatrix
                        value={watchedUnavailable}
                        onChange={handleAvailabilityChange}
                        disabled={isCreating}
                        daysOfWeek={schoolConfig.daysOfWeek}
                        periodsPerDayMap={effectivePeriodsPerDayMap}
                        defaultPeriodsPerDay={schoolConfig.defaultPeriodsPerDay}
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Constraints */}
                {currentStep === 4 && (
                  <div className="space-y-5">
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                      <h4 className="font-semibold text-sm text-slate-800 mb-1">
                        {t('teachers.constraints')}
                      </h4>
                      <p className="text-xs text-slate-500">{t('teachers.constraintsDesc')}</p>
                    </div>

                    {/* Max Periods Per Week */}
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                    <FormField
                      control={form.control}
                      name="timePreference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('teachers.timePreference', 'Time preference')}</FormLabel>
                          <FormControl>
                            <select {...field} className="h-10 w-full rounded-md border-2 px-3">
                              <option value="any">{t('teachers.timeAny', 'Any time')}</option>
                              <option value="morning">{t('teachers.timeMorning', 'Morning')}</option>
                              <option value="afternoon">{t('teachers.timeAfternoon', 'Afternoon')}</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preferredRoomIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('teachers.preferredRooms', 'Preferred rooms')}</FormLabel>
                          <FormControl>
                            <select
                              multiple
                              value={field.value.map(String)}
                              onChange={(event) =>
                                field.onChange(
                                  Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value))
                                )
                              }
                              className="min-h-24 w-full rounded-md border-2 px-3 py-2"
                            >
                              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preferredColleagues"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('teachers.preferredColleagues', 'Preferred colleagues')}</FormLabel>
                          <FormControl>
                            <select
                              multiple
                              value={field.value.map(String)}
                              onChange={(event) =>
                                field.onChange(
                                  Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value))
                                )
                              }
                              className="min-h-24 w-full rounded-md border-2 px-3 py-2"
                            >
                              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} ({teacher.staffCode})</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxPeriodsPerWeek"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('teachers.maxPeriodsPerWeek')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={maxPeriodsPerWeekLimit}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                                className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              {t('common.period')} 1-{maxPeriodsPerWeekLimit}
                            </FormDescription>
                            <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Max Periods Per Day */}
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                      <FormField
                        control={form.control}
                        name="maxPeriodsPerDay"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('teachers.maxPeriodsPerDay')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={maxPeriodsPerDayLimit}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                                className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              {t('common.period')} 1-{maxPeriodsPerDayLimit}
                            </FormDescription>
                            <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Max Consecutive Periods */}
                    <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                      <FormField
                        control={form.control}
                        name="maxConsecutivePeriods"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('teachers.maxConsecutive')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={2}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                                className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-slate-500">
                              {t('common.period')} 1-2
                            </FormDescription>
                            <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Form>
          </div>
        </ScrollArea>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t-2 border-slate-100 bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isCreating}
            className="gap-2 border-2 border-slate-200 hover:bg-slate-50"
          >
            <ArrowRight className="h-4 w-4" />
            {t('common.back')}
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isCreating}
              className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-md"
            >
              {t('common.next')}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isCreating}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('teachers.wizard.finalSave')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TeacherFormDrawer;
