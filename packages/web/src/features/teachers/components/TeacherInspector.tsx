/**
 * TeacherInspector Component
 *
 * A side panel for viewing and editing teacher details.
 * Opens on the left side (RTL layout) with a tabbed interface.
 *
 * Features:
 * - Tabbed interface: Basic Info, Subjects, Availability, Constraints
 * - Close button and deselect handling
 * - Integrates with update mutation for saving changes
 * - Preserves form state across tab switches
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { teacherFormSchema, type TeacherFormValues } from '@/schemas/teacher.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, Info, Loader2, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { calculateMaxPeriodsPerWeek, type SchoolConfig } from '../hooks/useSchoolConfig';
import type {
  Teacher,
  TeacherFormValues as TeacherFormValuesType,
  UnavailableSlot,
} from '../types';
import { logger } from '../utils/logger';
import { AvailabilityMatrix } from './AvailabilityMatrix';
import { SubjectManager, type Subject } from './SubjectManager';

/**
 * Props for the TeacherInspector component
 */
export interface TeacherInspectorProps {
  /** The teacher to display/edit */
  teacher: Teacher;
  /** Callback when the inspector should close */
  onClose: () => void;
  /** Callback when the teacher is updated */
  onUpdate: (id: number, data: Partial<TeacherFormValuesType>) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** SchoolConfig for dynamic constraints */
  schoolConfig: SchoolConfig;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Tab values for the inspector
 */
export type InspectorTab = 'basicInfo' | 'subjects' | 'availability' | 'constraints';

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
 * Get default form values from teacher data
 */
function getDefaultValues(teacher: Teacher): TeacherFormValues {
  return {
    fullName: teacher.fullName,
    primarySubjectIds: teacher.primarySubjectIds || [],
    allowedSubjectIds: teacher.allowedSubjectIds || [],
    restrictToPrimarySubjects: teacher.restrictToPrimarySubjects,
    unavailable: teacher.unavailable || [],
    maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
    maxPeriodsPerDay: teacher.maxPeriodsPerDay,
    maxConsecutivePeriods: teacher.maxConsecutivePeriods,
    timePreference: teacher.timePreference || 'any',
  };
}

/**
 * TeacherInspector provides a side panel for viewing and editing teacher details
 *
 * @example
 * ```tsx
 * <TeacherInspector
 *   teacher={selectedTeacher}
 *   onClose={() => setSelectedTeacher(null)}
 *   onUpdate={handleUpdate}
 *   isUpdating={isPending}
 *   schoolConfig={schoolConfig}
 * />
 * ```
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function TeacherInspector({
  teacher,
  onClose,
  onUpdate,
  isUpdating = false,
  schoolConfig,
  className,
}: TeacherInspectorProps) {
  const { t } = useTranslation();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const [activeTab, setActiveTab] = useState<InspectorTab>('basicInfo');

  // Calculate constraint limits for display
  const maxPeriodsPerWeekLimit = useMemo(
    () => calculateMaxPeriodsPerWeek(schoolConfig),
    [schoolConfig]
  );
  const maxPeriodsPerDayLimit = schoolConfig.defaultPeriodsPerDay;

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<TeacherFormValues>({
    // @ts-ignore - Type inference issue with zod resolver
    resolver: zodResolver(teacherFormSchema),
    defaultValues: getDefaultValues(teacher),
  });

  // Debug logging on mount
  useEffect(() => {
    logger.debug('TeacherInspector mounted', {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
    });
    return () => logger.debug('TeacherInspector unmounted');
  }, [teacher.id, teacher.fullName]);

  // Reset form when teacher changes
  useEffect(() => {
    form.reset(getDefaultValues(teacher));
    logger.debug('TeacherInspector: form reset with teacher data', { teacherId: teacher.id });
  }, [teacher, form]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (values: TeacherFormValues) => {
      logger.debug('TeacherInspector: submitting form', {
        teacherId: teacher.id,
        fullName: values.fullName,
      });
      await onUpdate(teacher.id, values as TeacherFormValuesType);
    },
    [teacher.id, onUpdate]
  );

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

  return (
    <div
      className={cn(
        'flex flex-col h-full border-e bg-background',
        'w-full sm:w-[350px] md:w-[400px] lg:w-[450px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-lg">{teacher.fullName}</h2>
            <p className="text-sm text-muted-foreground">{t('teachers.editDetails')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
          aria-label={t('common.cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as InspectorTab)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-4 mt-4 grid grid-cols-4">
          <TabsTrigger value="basicInfo" className="gap-1.5">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">{t('teachers.tabs.basicInfo')}</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t('sidebar.subjects')}</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t('teachers.tabs.schedule')}</span>
          </TabsTrigger>
          <TabsTrigger value="constraints" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t('teachers.tabs.constraints')}</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <Form {...form}>
            {/* @ts-ignore - Type inference issue with form.handleSubmit */}
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
              {/* Basic Info Tab */}
              <TabsContent value="basicInfo" className="p-4 mt-0">
                <div className="space-y-6">
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
                </div>
              </TabsContent>

              {/* Subjects Tab */}
              <TabsContent value="subjects" className="p-4 mt-0">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">{t('teachers.subjects')}</h3>
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
                      disabled={isUpdating}
                    />
                  )}
                </div>
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="p-4 mt-0">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-1">{t('teachers.availability')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('teachers.availabilityDesc')}
                    </p>
                  </div>
                  <AvailabilityMatrix
                    value={watchedUnavailable}
                    onChange={handleAvailabilityChange}
                    disabled={isUpdating}
                    daysOfWeek={schoolConfig.daysOfWeek}
                    periodsPerDayMap={schoolConfig.periodsPerDayMap}
                    defaultPeriodsPerDay={schoolConfig.defaultPeriodsPerDay}
                  />
                </div>
              </TabsContent>

              {/* Constraints Tab */}
              <TabsContent value="constraints" className="p-4 mt-0">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-1">{t('teachers.constraints')}</h3>
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
              </TabsContent>

              {/* Save Button - Fixed at bottom */}
              <div className="sticky bottom-0 bg-background border-t p-4 mt-auto">
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={onClose} disabled={isUpdating}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default TeacherInspector;
