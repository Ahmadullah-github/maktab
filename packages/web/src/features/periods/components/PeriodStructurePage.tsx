/**
 * PeriodStructurePage Component - Redesigned
 * Requirements: 2.1, 11.1, 11.3, 11.4, 6.1-6.5
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { SectionCard } from '@/components/ui/section-card';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { useSchoolConfig } from '@/features/school-settings/hooks/useSchoolSettings';
import { fromSchoolSettingsApiResponse } from '@/features/school-settings/schemas/schoolSettings.schema';
import { cn } from '@/lib/utils';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Coffee,
  Grid3X3,
  Hash,
  HelpCircle,
  Loader2,
  Moon,
  RotateCcw,
  Save,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DURATION_LIMITS, GRADE_CATEGORIES, PERIOD_LIMITS } from '../constants/defaults';
import { useUpdatePeriodStructure } from '../hooks/useUpdatePeriodStructure';
import {
  fromPeriodStructureApiResponse,
  periodStructureSchema,
  type PeriodStructureFormValues,
} from '../schemas/periodStructure.schema';
import type { BreakPeriodConfig } from '../types';
import {
  getEffectivePeriodsForDay,
  getMaxEffectivePeriods,
  getResolvedBreaksForDay,
  normalizeBreaks,
  stripInactiveBreakOverrides,
} from '../utils';
import { BreakConfiguration } from './BreakConfiguration';
import { CategoryPeriodsMatrix } from './CategoryPeriodsMatrix';
import { DynamicPeriodsConfig } from './DynamicPeriodsConfig';
import { PrayerBreaksConfig } from './PrayerBreaksConfig';

interface PeriodStats {
  totalPeriodsPerWeek: number;
  teachingHoursPerDay: string;
  teachingHoursPerWeek: string;
  totalBreakMinutes: number;
  enabledCategoriesCount: number;
  hasDynamicPeriods: boolean;
  hasCategoryPeriods: boolean;
  hasBreaks: boolean;
}

function calculateStats(
  values: PeriodStructureFormValues,
  activeDays: WeekDay[],
  enabledCategoriesCount: number,
  effectivePeriodDuration: number
): PeriodStats {
  const daysCount = activeDays.length || 1;
  const effectivePeriodOptions = {
    defaultPeriods: values.defaultPeriodsPerDay,
    dynamicPeriodsEnabled: values.dynamicPeriodsEnabled,
    periodsPerDayMap: values.periodsPerDayMap,
    categoryPeriodsEnabled: values.categoryPeriodsEnabled,
    categoryPeriodsMap: values.categoryPeriodsMap,
  };

  const totalPeriodsPerWeek = activeDays.reduce(
    (sum, day) => sum + getEffectivePeriodsForDay(day, effectivePeriodOptions),
    0
  );
  const totalTeachingMinutes = totalPeriodsPerWeek * effectivePeriodDuration;
  const avgPeriodsPerDay = totalPeriodsPerWeek / daysCount;
  const teachingHoursPerDay = ((avgPeriodsPerDay * effectivePeriodDuration) / 60).toFixed(1);
  const teachingHoursPerWeek = (totalTeachingMinutes / 60).toFixed(1);

  const regularBreakMinutes = activeDays.reduce(
    (maxBreakMinutes, day) => {
      const periodsForDay = getEffectivePeriodsForDay(day, effectivePeriodOptions);
      const resolvedBreaks = getResolvedBreaksForDay(
        day,
        values.breaks,
        values.breaksByDay,
        periodsForDay
      );
      const dayBreakMinutes = resolvedBreaks.reduce(
        (sum: number, breakConfig: BreakPeriodConfig) => sum + breakConfig.duration,
        0
      );
      return Math.max(maxBreakMinutes, dayBreakMinutes);
    },
    values.breaks.reduce((sum, breakConfig) => sum + breakConfig.duration, 0)
  );
  return {
    totalPeriodsPerWeek,
    teachingHoursPerDay,
    teachingHoursPerWeek,
    totalBreakMinutes: regularBreakMinutes,
    enabledCategoriesCount,
    hasDynamicPeriods: values.dynamicPeriodsEnabled,
    hasCategoryPeriods: values.categoryPeriodsEnabled,
    hasBreaks:
      values.breaks.length > 0 ||
      Object.values(values.breaksByDay).some((dayBreaks) => (dayBreaks?.length ?? 0) > 0),
  };
}

function validateSettings(values: PeriodStructureFormValues, activeDays: WeekDay[]) {
  if (values.defaultPeriodsPerDay < PERIOD_LIMITS.MIN)
    return {
      severity: 'error' as const,
      messageKey: 'periodStructure.validation.periodCountTooLow',
    };
  if (values.periodDuration < DURATION_LIMITS.MIN)
    return {
      severity: 'error' as const,
      messageKey: 'periodStructure.validation.durationTooLow',
    };
  if (activeDays.length === 0)
    return {
      severity: 'warning' as const,
      messageKey: 'periodStructure.validation.noActiveDays',
    };

  const effectivePeriodOptions = {
    defaultPeriods: values.defaultPeriodsPerDay,
    dynamicPeriodsEnabled: values.dynamicPeriodsEnabled,
    periodsPerDayMap: values.periodsPerDayMap,
    categoryPeriodsEnabled: values.categoryPeriodsEnabled,
    categoryPeriodsMap: values.categoryPeriodsMap,
  };
  const sharedMaxPeriods = getMaxEffectivePeriods(activeDays, effectivePeriodOptions);
  const seenSharedPeriods = new Set<number>();

  for (const breakConfig of normalizeBreaks(values.breaks)) {
    if (seenSharedPeriods.has(breakConfig.afterPeriod)) {
      return {
        severity: 'error' as const,
        messageKey: 'periodStructure.validation.duplicateSharedBreak',
      };
    }
    if (breakConfig.afterPeriod >= sharedMaxPeriods) {
      return {
        severity: 'error' as const,
        messageKey: 'periodStructure.validation.sharedBreakOutOfRange',
      };
    }
    seenSharedPeriods.add(breakConfig.afterPeriod);
  }

  const activeDaySet = new Set(activeDays);
  for (const [day, dayBreaks] of Object.entries(values.breaksByDay)) {
    if (!activeDaySet.has(day as WeekDay)) {
      return {
        severity: 'error' as const,
        messageKey: 'periodStructure.validation.inactiveDayBreak',
      };
    }

    const dayMaxPeriods = getEffectivePeriodsForDay(day as WeekDay, effectivePeriodOptions);
    const seenDayPeriods = new Set<number>();

    for (const breakConfig of normalizeBreaks(dayBreaks ?? [])) {
      if (seenDayPeriods.has(breakConfig.afterPeriod)) {
        return {
          severity: 'error' as const,
          messageKey: 'periodStructure.validation.duplicateDayBreak',
        };
      }
      if (breakConfig.afterPeriod >= dayMaxPeriods) {
        return {
          severity: 'error' as const,
          messageKey: 'periodStructure.validation.dayBreakOutOfRange',
        };
      }
      seenDayPeriods.add(breakConfig.afterPeriod);
    }
  }

  return { severity: 'success' as const, messageKey: 'common.valid' };
}

function PageSkeleton() {
  return (
    <div className="flex-1 h-full p-6 animate-pulse">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

function PageError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <p className="text-red-600 font-medium">{t('periodStructure.errors.fetchFailed')}</p>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RotateCcw className="w-4 h-4" />
        {t('common.retry')}
      </Button>
    </div>
  );
}

function StatsSidebar({
  stats,
  validation,
}: {
  stats: PeriodStats;
  validation: { severity: string; message: string };
}) {
  const { t } = useTranslation();
  return (
    <Card className="border-2 border-violet-200 bg-linear-to-br from-violet-50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-violet-800">
            <TrendingUp className="h-5 w-5" />
            {t('periodStructure.stats.summary')}
          </CardTitle>
          <span
            className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1',
              validation.severity === 'success' && 'bg-emerald-100 text-emerald-700',
              validation.severity === 'warning' && 'bg-amber-100 text-amber-700',
              validation.severity === 'error' && 'bg-red-100 text-red-700'
            )}
          >
            {validation.severity === 'success' ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {validation.severity === 'success'
              ? t('common.valid')
              : validation.severity === 'error'
                ? t('common.error')
                : t('common.warning')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3.5 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-100 rounded-xl">
              <Hash className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('periodStructure.stats.totalPeriods')}</p>
              <p className="text-2xl font-bold text-violet-700">{stats.totalPeriodsPerWeek}</p>
            </div>
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Clock className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('periodStructure.stats.hoursPerDay')}</p>
              <p className="text-2xl font-bold text-blue-700">{stats.teachingHoursPerDay}h</p>
            </div>
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <Coffee className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('periodStructure.stats.breakTime')}</p>
              <p className="text-2xl font-bold text-amber-700">{stats.totalBreakMinutes}m</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-linear-to-br from-violet-600 to-purple-700 rounded-xl text-white shadow-lg">
          <p className="text-xs text-violet-200">{t('periodStructure.stats.hoursPerWeek')}</p>
          <p className="text-3xl font-bold">{stats.teachingHoursPerWeek}h</p>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {stats.hasDynamicPeriods && (
            <Badge className="bg-blue-100 text-blue-800">
              <Calendar className="h-3.5 w-3.5 me-1" />
              {t('periodStructure.badges.dynamicPeriods')}
            </Badge>
          )}
          {stats.hasCategoryPeriods && (
            <Badge className="bg-purple-100 text-purple-800">
              <Grid3X3 className="h-3.5 w-3.5 me-1" />
              {t('periodStructure.badges.categoryPeriods')}
            </Badge>
          )}
          {stats.hasBreaks && (
            <Badge className="bg-amber-100 text-amber-800">
              <Coffee className="h-3.5 w-3.5 me-1" />
              {t('periodStructure.badges.breaksConfigured')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PeriodStepper({
  value,
  onChange,
  min,
  max,
  disabled,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  unit: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="h-12 w-12 rounded-xl border-2"
        aria-label={t('periodStructure.actions.decreasePeriods')}
      >
        <span className="text-xl font-bold">−</span>
      </Button>
      <div className="flex-1 h-14 rounded-xl border-2 border-violet-200 bg-violet-50 flex items-center justify-center">
        <span className="text-3xl font-bold text-violet-700">{value}</span>
        <span className="text-sm text-violet-600 ms-2">{unit}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="h-12 w-12 rounded-xl border-2"
        aria-label={t('periodStructure.actions.increasePeriods')}
      >
        <span className="text-xl font-bold">+</span>
      </Button>
    </div>
  );
}

function DurationStepper({
  value,
  onChange,
  min,
  max,
  step = 5,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={disabled || value <= min}
        className="h-12 w-12 rounded-xl border-2"
        aria-label={t('periodStructure.actions.decreaseDuration')}
      >
        <span className="text-xl font-bold">−</span>
      </Button>
      <div className="flex-1 h-14 rounded-xl border-2 border-emerald-200 bg-emerald-50 flex items-center justify-center">
        <span className="text-3xl font-bold text-emerald-700">{value}</span>
        <span className="text-sm text-emerald-600 ms-2">{t('periodStructure.labels.minutes')}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={disabled || value >= max}
        className="h-12 w-12 rounded-xl border-2"
        aria-label={t('periodStructure.actions.increaseDuration')}
      >
        <span className="text-xl font-bold">+</span>
      </Button>
    </div>
  );
}

export function PeriodStructurePage() {
  const { t } = useTranslation();
  const { data: schoolConfig, isLoading, isError, refetch } = useSchoolConfig();
  const updateMutation = useUpdatePeriodStructure();
  const periodStructure = useMemo(
    () => (schoolConfig ? fromPeriodStructureApiResponse(schoolConfig) : undefined),
    [schoolConfig]
  );
  const schoolSettings = useMemo(
    () => (schoolConfig ? fromSchoolSettingsApiResponse(schoolConfig) : undefined),
    [schoolConfig]
  );

  const activeDays = useMemo<WeekDay[]>(() => {
    if (schoolSettings?.daysOfWeek && Array.isArray(schoolSettings.daysOfWeek))
      return schoolSettings.daysOfWeek as WeekDay[];
    return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  }, [schoolSettings]);

  const enabledCategoriesCount = useMemo(() => {
    let count = 0;
    if (schoolSettings?.enablePrimary) count += 2;
    if (schoolSettings?.enableMiddle) count += 1;
    if (schoolSettings?.enableHigh) count += 1;
    return count || 4;
  }, [schoolSettings]);

  const filteredCategories = useMemo(
    () =>
      GRADE_CATEGORIES.filter((cat) => {
        if (cat.key === 'Alpha-Primary' || cat.key === 'Beta-Primary')
          return schoolSettings?.enablePrimary ?? true;
        if (cat.key === 'Middle') return schoolSettings?.enableMiddle ?? true;
        if (cat.key === 'High') return schoolSettings?.enableHigh ?? true;
        return true;
      }),
    [schoolSettings]
  );

  const form = useForm<PeriodStructureFormValues>({
    resolver: zodResolver(periodStructureSchema),
    defaultValues: {
      revision: 1,
      schoolId: null,
      defaultPeriodsPerDay: PERIOD_LIMITS.DEFAULT,
      periodDuration: DURATION_LIMITS.DEFAULT,
      dynamicPeriodsEnabled: false,
      periodsPerDayMap: {},
      categoryPeriodsEnabled: false,
      categoryPeriodsMap: {},
      breaks: [],
      breaksByDay: {},
      prayerBreaksEnabled: false,
      prayerBreaks: [],
    },
  });

  const watchedValues = form.watch();
  const effectivePeriodDuration = schoolSettings?.ramadanModeEnabled
    ? schoolSettings.ramadanPeriodDuration
    : watchedValues.periodDuration;
  const stats = useMemo(
    () =>
      calculateStats(watchedValues, activeDays, enabledCategoriesCount, effectivePeriodDuration),
    [watchedValues, activeDays, enabledCategoriesCount, effectivePeriodDuration]
  );
  const validationState = useMemo(
    () => validateSettings(watchedValues, activeDays),
    [watchedValues, activeDays]
  );
  const validation = useMemo(
    () => ({
      severity: validationState.severity,
      message: t(validationState.messageKey),
    }),
    [t, validationState]
  );

  useEffect(() => {
    if (periodStructure) form.reset(periodStructure);
  }, [periodStructure, form]);
  const onSubmit = useCallback(
    (values: PeriodStructureFormValues) => {
      if (validation.severity === 'error') return;
      updateMutation.mutate({
        ...values,
        breaks: normalizeBreaks(values.breaks),
        breaksByDay: stripInactiveBreakOverrides(values.breaksByDay, activeDays),
      });
    },
    [activeDays, updateMutation, validation.severity]
  );

  // Sync dirty state with navigation guard store
  const setDirty = useNavigationGuardStore((s) => s.setDirty);
  useEffect(() => {
    setDirty(form.formState.isDirty);
    return () => setDirty(false);
  }, [form.formState.isDirty, setDirty]);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError onRetry={() => refetch()} />;

  const defaultPeriods = watchedValues.defaultPeriodsPerDay;

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
      <PageHeader
        icon={Timer}
        title={t('periodStructure.pageTitle')}
        subtitle={t('periodStructure.pageSubtitle')}
        actions={
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={
              updateMutation.isPending || !form.formState.isDirty || validation.severity === 'error'
            }
            className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-lg"
            size="lg"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('common.saveChanges')}
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/80 backdrop-blur border-2 border-violet-100 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="bg-white border-violet-300 text-violet-700 px-3 py-1"
            >
              <Calendar className="h-3.5 w-3.5 me-1.5" />
              {activeDays.length} {t('periodStructure.labels.activeDays')}
            </Badge>
            <Badge
              variant="outline"
              className="bg-white border-violet-300 text-violet-700 px-3 py-1"
            >
              <Grid3X3 className="h-3.5 w-3.5 me-1.5" />
              {filteredCategories.length} {t('periodStructure.labels.categories')}
            </Badge>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
                  <HelpCircle className="h-4 w-4" />
                  {t('common.help')}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p>{t('periodStructure.help.overview')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-6">
                <SectionCard
                  icon={Hash}
                  iconColor="bg-linear-to-br from-violet-500 to-purple-600"
                  title={t('periodStructure.sections.defaultPeriods')}
                  description={t('periodStructure.sections.defaultPeriodsDesc')}
                >
                  <FormField
                    control={form.control}
                    name="defaultPeriodsPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PeriodStepper
                            value={field.value}
                            onChange={field.onChange}
                            min={PERIOD_LIMITS.MIN}
                            max={PERIOD_LIMITS.MAX}
                            disabled={updateMutation.isPending}
                            unit={t('periodStructure.labels.period')}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-3">
                          {t('periodStructure.help.defaultPeriods', {
                            min: PERIOD_LIMITS.MIN,
                            max: PERIOD_LIMITS.MAX,
                          })}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SectionCard>
                <SectionCard
                  icon={Clock}
                  iconColor="bg-linear-to-br from-emerald-500 to-teal-600"
                  title={t('periodStructure.sections.periodDuration')}
                  description={t('periodStructure.sections.periodDurationDesc')}
                >
                  <FormField
                    control={form.control}
                    name="periodDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <DurationStepper
                            value={field.value}
                            onChange={field.onChange}
                            min={DURATION_LIMITS.MIN}
                            max={DURATION_LIMITS.MAX}
                            step={5}
                            disabled={updateMutation.isPending}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-3">
                          {t('periodStructure.help.periodDuration', {
                            min: DURATION_LIMITS.MIN,
                            max: DURATION_LIMITS.MAX,
                          })}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SectionCard>
                <SectionCard
                  icon={Calendar}
                  iconColor="bg-linear-to-br from-blue-500 to-indigo-600"
                  title={t('periodStructure.sections.dynamicPeriods')}
                  description={t('periodStructure.sections.dynamicPeriodsDesc')}
                  badge={
                    watchedValues.dynamicPeriodsEnabled && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {t('common.active')}
                      </Badge>
                    )
                  }
                  action={
                    <FormField
                      control={form.control}
                      name="dynamicPeriodsEnabled"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={(enabled) => {
                            field.onChange(enabled);
                            if (enabled) {
                              const currentMap = form.getValues('periodsPerDayMap');
                              form.setValue(
                                'periodsPerDayMap',
                                Object.fromEntries(
                                  activeDays.map((day) => [day, currentMap[day] ?? defaultPeriods])
                                ),
                                { shouldDirty: true }
                              );
                            }
                          }}
                          disabled={updateMutation.isPending}
                        />
                      )}
                    />
                  }
                >
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
                </SectionCard>
                {filteredCategories.length > 1 && (
                  <SectionCard
                    icon={Grid3X3}
                    iconColor="bg-linear-to-br from-purple-500 to-pink-600"
                    title={t('periodStructure.sections.categoryPeriods')}
                    description={t('periodStructure.sections.categoryPeriodsDesc')}
                    badge={
                      watchedValues.categoryPeriodsEnabled && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          {t('common.active')}
                        </Badge>
                      )
                    }
                    action={
                      <FormField
                        control={form.control}
                        name="categoryPeriodsEnabled"
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={(enabled) => {
                              field.onChange(enabled);
                              if (enabled) {
                                const currentMap = form.getValues('categoryPeriodsMap');
                                form.setValue(
                                  'categoryPeriodsMap',
                                  Object.fromEntries(
                                    filteredCategories.map((category) => [
                                      category.key,
                                      Object.fromEntries(
                                        activeDays.map((day) => [
                                          day,
                                          currentMap[category.key]?.[day] ?? defaultPeriods,
                                        ])
                                      ),
                                    ])
                                  ),
                                  { shouldDirty: true }
                                );
                              }
                            }}
                            disabled={updateMutation.isPending}
                          />
                        )}
                      />
                    }
                  >
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
                                  categoryPeriodsMap={mapField.value}
                                  onCategoryPeriodsMapChange={mapField.onChange}
                                  activeDays={activeDays}
                                  defaultPeriods={defaultPeriods}
                                  filteredCategories={filteredCategories}
                                  disabled={updateMutation.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    />
                  </SectionCard>
                )}
                <SectionCard
                  icon={Coffee}
                  iconColor="bg-linear-to-br from-amber-500 to-orange-600"
                  title={t('periodStructure.sections.breaks')}
                  description={t('periodStructure.sections.breaksDesc')}
                  badge={
                    (watchedValues.breaks.length > 0 ||
                      Object.keys(watchedValues.breaksByDay).length > 0) && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        {watchedValues.breaks.length +
                          Object.values(watchedValues.breaksByDay).reduce(
                            (sum, dayBreaks) => sum + (dayBreaks?.length ?? 0),
                            0
                          )}{' '}
                        {t('periodStructure.labels.breaksCount')}
                      </Badge>
                    )
                  }
                >
                  <FormField
                    control={form.control}
                    name="breaks"
                    render={({ field: breaksField }) => (
                      <FormField
                        control={form.control}
                        name="breaksByDay"
                        render={({ field: breaksByDayField }) => (
                          <FormItem>
                            <FormControl>
                              <BreakConfiguration
                                breaks={breaksField.value}
                                breaksByDay={breaksByDayField.value}
                                onBreaksChange={breaksField.onChange}
                                onBreaksByDayChange={breaksByDayField.onChange}
                                activeDays={activeDays}
                                defaultPeriods={defaultPeriods}
                                dynamicPeriodsEnabled={watchedValues.dynamicPeriodsEnabled}
                                periodsPerDayMap={watchedValues.periodsPerDayMap}
                                categoryPeriodsEnabled={watchedValues.categoryPeriodsEnabled}
                                categoryPeriodsMap={watchedValues.categoryPeriodsMap}
                                disabled={updateMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </SectionCard>
                <SectionCard
                  icon={Moon}
                  iconColor="bg-linear-to-br from-teal-500 to-cyan-600"
                  title={t('periodStructure.sections.prayerBreaks')}
                  description={t('periodStructure.sections.prayerBreaksDesc')}
                  badge={
                    watchedValues.prayerBreaksEnabled && (
                      <Badge className="bg-teal-100 text-teal-700 text-xs">
                        {t('common.active')}
                      </Badge>
                    )
                  }
                  action={
                    <FormField
                      control={form.control}
                      name="prayerBreaksEnabled"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={updateMutation.isPending}
                        />
                      )}
                    />
                  }
                >
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
                </SectionCard>
                {validation.severity !== 'success' && (
                  <Alert
                    variant={validation.severity === 'error' ? 'destructive' : 'default'}
                    className="border-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{validation.message}</AlertTitle>
                    <AlertDescription>
                      {t('periodStructure.validation.checkSettings')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="hidden lg:block">
                <div className="sticky top-24">
                  <StatsSidebar stats={stats} validation={validation} />
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
