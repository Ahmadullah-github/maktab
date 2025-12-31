/**
 * SchoolSettingsPage Component
 *
 * Main page component for school settings configuration
 * Composes all sub-components in card-based layout
 * Integrates React Hook Form with Zod schema
 * Handles loading, error, and success states
 *
 * Requirements: 1.1, 11.1, 11.3, 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  UnsavedChangesAlert,
  UnsavedChangesIndicator,
} from '@/components/shared/UnsavedChangesAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AFGHAN_WEEK_DAYS, DEFAULT_START_TIME, DEFAULT_TIMEZONE } from '../constants/defaults';
import { useSchoolSettings, useUpdateSchoolSettings } from '../hooks/useSchoolSettings';
import {
  schoolSettingsSchema,
  type SchoolSettingsFormValues,
} from '../schemas/schoolSettings.schema';
import { DaysOfWeekSelector } from './DaysOfWeekSelector';
import { ShiftConfiguration } from './ShiftConfiguration';
import { StartTimeInput } from './StartTimeInput';
import { TimezoneSelector } from './TimezoneSelector';

/**
 * Loading skeleton for the page
 */
function SchoolSettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function SchoolSettingsPageError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-destructive">{t('schoolSettings.errors.fetchFailed')}</p>
      <Button onClick={onRetry} variant="outline">
        {t('common.reset')}
      </Button>
    </div>
  );
}

/**
 * SchoolSettingsPage - Main page for school operational settings
 *
 * Requirements: 1.1, 11.1, 11.3, 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function SchoolSettingsPage() {
  const { t } = useTranslation();

  // Fetch school settings
  const { data: settings, isLoading, isError, refetch } = useSchoolSettings();

  // Update mutation
  const updateMutation = useUpdateSchoolSettings();

  // Form setup with Zod validation
  const form = useForm<SchoolSettingsFormValues>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: {
      daysOfWeek: [...AFGHAN_WEEK_DAYS],
      startTime: DEFAULT_START_TIME,
      timezone: DEFAULT_TIMEZONE,
      shiftMode: 'single',
      shifts: undefined,
    },
  });

  // Populate form when data is loaded
  // Requirements: 11.4
  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  // Reset form dirty state after successful save
  // Requirements: 6.5
  useEffect(() => {
    if (updateMutation.isSuccess) {
      form.reset(form.getValues());
    }
  }, [updateMutation.isSuccess, form]);

  // Handle form submission
  const onSubmit = (values: SchoolSettingsFormValues) => {
    updateMutation.mutate(values);
  };

  // Loading state
  // Requirements: 11.1
  if (isLoading) {
    return <SchoolSettingsPageSkeleton />;
  }

  // Error state
  // Requirements: 11.3
  if (isError) {
    return <SchoolSettingsPageError onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      {/* Navigation guard for unsaved changes */}
      {/* Requirements: 6.2, 6.3, 6.4 */}
      <UnsavedChangesAlert isDirty={form.formState.isDirty} translationNamespace="schoolSettings" />

      {/* Page Header with unsaved changes indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('schoolSettings.pageTitle')}</h1>
          <p className="text-muted-foreground">{t('schoolSettings.pageSubtitle')}</p>
        </div>
        {/* Requirements: 6.1 */}
        <UnsavedChangesIndicator isDirty={form.formState.isDirty} />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Days of Week Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('schoolSettings.sections.daysOfWeek')}</CardTitle>
              <CardDescription>{t('schoolSettings.sections.daysOfWeekDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="daysOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DaysOfWeekSelector
                        value={field.value}
                        onChange={field.onChange}
                        disabled={updateMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Start Time Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('schoolSettings.sections.startTime')}</CardTitle>
              <CardDescription>{t('schoolSettings.sections.startTimeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('schoolSettings.labels.startTime')}</FormLabel>
                    <FormControl>
                      <StartTimeInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={updateMutation.isPending}
                        placeholder={t('schoolSettings.placeholders.startTime')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Timezone Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('schoolSettings.sections.timezone')}</CardTitle>
              <CardDescription>{t('schoolSettings.sections.timezoneDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('schoolSettings.labels.timezone')}</FormLabel>
                    <FormControl>
                      <TimezoneSelector
                        value={field.value}
                        onChange={field.onChange}
                        disabled={updateMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Shift Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('schoolSettings.sections.shiftConfig')}</CardTitle>
              <CardDescription>{t('schoolSettings.sections.shiftConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="shiftMode"
                render={({ field: shiftModeField }) => (
                  <FormField
                    control={form.control}
                    name="shifts"
                    render={({ field: shiftsField }) => (
                      <FormItem>
                        <FormControl>
                          <ShiftConfiguration
                            shiftMode={shiftModeField.value}
                            shifts={shiftsField.value}
                            onShiftModeChange={shiftModeField.onChange}
                            onShiftsChange={shiftsField.onChange}
                            disabled={updateMutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          {shiftModeField.value === 'multi'
                            ? t('schoolSettings.labels.multiShift')
                            : t('schoolSettings.labels.singleShift')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
              {updateMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
