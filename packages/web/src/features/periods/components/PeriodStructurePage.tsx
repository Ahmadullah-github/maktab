/**
 * PeriodStructurePage Component
 *
 * Main page component for period structure configuration
 * Composes all sub-components in organized sections
 * Integrates React Hook Form with Zod schema
 * Handles loading, error, and success states
 * Uses collapsible sections for advanced options
 *
 * Requirements: 2.1, 11.1, 11.3, 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  UnsavedChangesAlert,
  UnsavedChangesIndicator,
} from '@/components/shared/UnsavedChangesAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AFGHAN_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import { useSchoolSettings } from '@/features/school-settings/hooks/useSchoolSettings';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DURATION_LIMITS, PERIOD_LIMITS } from '../constants/defaults';
import { usePeriodStructure, useUpdatePeriodStructure } from '../hooks/usePeriodStructure';
import {
  periodStructureSchema,
  type PeriodStructureFormValues,
} from '../schemas/periodStructure.schema';
import { BreakConfiguration } from './BreakConfiguration';
import { CategoryPeriodsMatrix } from './CategoryPeriodsMatrix';
import { DefaultPeriodsInput } from './DefaultPeriodsInput';
import { DynamicPeriodsConfig } from './DynamicPeriodsConfig';
import { PeriodDurationInput } from './PeriodDurationInput';
import { PrayerBreaksConfig } from './PrayerBreaksConfig';

/**
 * Loading skeleton for the page
 */
function PeriodStructurePageSkeleton() {
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
function PeriodStructurePageError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-destructive">{t('periodStructure.errors.fetchFailed')}</p>
      <Button onClick={onRetry} variant="outline">
        {t('common.retry')}
      </Button>
    </div>
  );
}

/**
 * PeriodStructurePage - Main page for period structure configuration
 *
 * Requirements: 2.1, 11.1, 11.3, 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function PeriodStructurePage() {
  const { t } = useTranslation();

  // Collapsible section states
  const [dynamicOpen, setDynamicOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [breaksOpen, setBreaksOpen] = useState(true);
  const [prayerOpen, setPrayerOpen] = useState(false);

  // Fetch period structure
  const { data: periodStructure, isLoading, isError, refetch } = usePeriodStructure();

  // Fetch school settings to get active days
  const { data: schoolSettings } = useSchoolSettings();

  // Get active days from school settings or use Afghan defaults
  const activeDays: WeekDay[] = (schoolSettings?.daysOfWeek as WeekDay[]) || [...AFGHAN_WEEK_DAYS];

  // Update mutation
  const updateMutation = useUpdatePeriodStructure();

  // Form setup with Zod validation
  const form = useForm<PeriodStructureFormValues>({
    resolver: zodResolver(periodStructureSchema),
    defaultValues: {
      defaultPeriodsPerDay: PERIOD_LIMITS.DEFAULT,
      periodDuration: DURATION_LIMITS.DEFAULT,
      dynamicPeriodsEnabled: false,
      periodsPerDayMap: {},
      categoryPeriodsEnabled: false,
      categoryPeriodsMap: {},
      breaks: [],
      prayerBreaksEnabled: false,
      prayerBreaks: [],
    },
  });

  // Populate form when data is loaded
  // Requirements: 11.4
  useEffect(() => {
    if (periodStructure) {
      form.reset(periodStructure);
      // Open sections if they have data
      if (periodStructure.dynamicPeriodsEnabled) {
        setDynamicOpen(true);
      }
      if (periodStructure.categoryPeriodsEnabled) {
        setCategoryOpen(true);
      }
      if (periodStructure.prayerBreaksEnabled) {
        setPrayerOpen(true);
      }
    }
  }, [periodStructure, form]);

  // Reset form dirty state after successful save
  // Requirements: 6.5
  useEffect(() => {
    if (updateMutation.isSuccess) {
      form.reset(form.getValues());
    }
  }, [updateMutation.isSuccess, form]);

  // Handle form submission
  const onSubmit = (values: PeriodStructureFormValues) => {
    updateMutation.mutate(values);
  };

  // Loading state
  // Requirements: 11.1
  if (isLoading) {
    return <PeriodStructurePageSkeleton />;
  }

  // Error state
  // Requirements: 11.3
  if (isError) {
    return <PeriodStructurePageError onRetry={() => refetch()} />;
  }

  const defaultPeriods = form.watch('defaultPeriodsPerDay');

  return (
    <div className="space-y-6">
      {/* Navigation guard for unsaved changes */}
      {/* Requirements: 6.2, 6.3, 6.4 */}
      <UnsavedChangesAlert
        isDirty={form.formState.isDirty}
        translationNamespace="periodStructure"
      />

      {/* Page Header with unsaved changes indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('periodStructure.pageTitle')}</h1>
          <p className="text-muted-foreground">{t('periodStructure.pageSubtitle')}</p>
        </div>
        {/* Requirements: 6.1 */}
        <UnsavedChangesIndicator isDirty={form.formState.isDirty} />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('periodStructure.sections.basicConfig')}</CardTitle>
              <CardDescription>{t('periodStructure.sections.basicConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default Periods Per Day */}
              <FormField
                control={form.control}
                name="defaultPeriodsPerDay"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t('periodStructure.labels.defaultPeriodsPerDay')}</FormLabel>
                    <FormControl>
                      <DefaultPeriodsInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={updateMutation.isPending}
                        error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Period Duration */}
              <FormField
                control={form.control}
                name="periodDuration"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t('periodStructure.labels.periodDuration')}</FormLabel>
                    <FormControl>
                      <PeriodDurationInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={updateMutation.isPending}
                        error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Dynamic Periods Card (Collapsible) */}
          <Collapsible open={dynamicOpen} onOpenChange={setDynamicOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('periodStructure.sections.dynamicPeriods')}</CardTitle>
                      <CardDescription>
                        {t('periodStructure.sections.dynamicPeriodsDesc')}
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${dynamicOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="dynamicPeriodsEnabled"
                    render={({ field: enabledField }) => (
                      <FormField
                        control={form.control}
                        name="periodsPerDayMap"
                        render={({ field: mapField }) => (
                          <FormItem>
                            <FormControl>
                              <DynamicPeriodsConfig
                                enabled={enabledField.value}
                                onEnabledChange={enabledField.onChange}
                                periodsPerDayMap={mapField.value}
                                onPeriodsPerDayMapChange={mapField.onChange}
                                activeDays={activeDays}
                                defaultPeriods={defaultPeriods}
                                disabled={updateMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Category-Based Periods Card (Collapsible) */}
          <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('periodStructure.sections.categoryPeriods')}</CardTitle>
                      <CardDescription>
                        {t('periodStructure.sections.categoryPeriodsDesc')}
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="categoryPeriodsEnabled"
                    render={({ field: enabledField }) => (
                      <FormField
                        control={form.control}
                        name="categoryPeriodsMap"
                        render={({ field: mapField }) => (
                          <FormItem>
                            <FormControl>
                              <CategoryPeriodsMatrix
                                enabled={enabledField.value}
                                onEnabledChange={enabledField.onChange}
                                categoryPeriodsMap={mapField.value}
                                onCategoryPeriodsMapChange={mapField.onChange}
                                activeDays={activeDays}
                                defaultPeriods={defaultPeriods}
                                disabled={updateMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Break Configuration Card (Collapsible) */}
          <Collapsible open={breaksOpen} onOpenChange={setBreaksOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('periodStructure.sections.breaks')}</CardTitle>
                      <CardDescription>{t('periodStructure.sections.breaksDesc')}</CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${breaksOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="breaks"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <BreakConfiguration
                            breaks={field.value}
                            onBreaksChange={field.onChange}
                            maxPeriods={defaultPeriods}
                            disabled={updateMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Prayer Breaks Card (Collapsible) */}
          <Collapsible open={prayerOpen} onOpenChange={setPrayerOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('periodStructure.sections.prayerBreaks')}</CardTitle>
                      <CardDescription>
                        {t('periodStructure.sections.prayerBreaksDesc')}
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${prayerOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="prayerBreaksEnabled"
                    render={({ field: enabledField }) => (
                      <FormField
                        control={form.control}
                        name="prayerBreaks"
                        render={({ field: breaksField }) => (
                          <FormItem>
                            <FormControl>
                              <PrayerBreaksConfig
                                enabled={enabledField.value}
                                onEnabledChange={enabledField.onChange}
                                prayerBreaks={breaksField.value}
                                onPrayerBreaksChange={breaksField.onChange}
                                disabled={updateMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

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
