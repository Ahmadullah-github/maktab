/**
 * SchoolSettingsPage Component
 *
 * Complete school configuration with Afghanistan-specific features:
 * - School Identity
 * - Academic Structure (Grade Levels)
 * - Days & Time Configuration
 * - Shift Configuration
 * - Ramadan Mode
 * - Ministry Validation
 * - Low-Resource Mode
 *
 * Note: Period configuration (periods per day, duration, breaks) is managed
 * exclusively in the Period Structure page (/settings/periods)
 *
 * Requirements: 1.1-1.6, 2.1-2.5, 3.1-3.5, 4.1-4.5, 5.1-5.6
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { SectionCard } from '@/components/ui/section-card';
import { usePeriodStructure } from '@/features/periods/hooks/usePeriodStructure';
import { cn } from '@/lib/utils';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock3,
  Globe2,
  Hash,
  Loader2,
  Save,
  School,
  Sparkles,
  SunMoon,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AFGHAN_WEEK_DAYS,
  DEFAULT_SHIFT_CONFIG,
  DEFAULT_START_TIME,
  DEFAULT_TIMEZONE,
} from '../constants/defaults';
import { useSchoolSettings, useUpdateSchoolSettings } from '../hooks/useSchoolSettings';
import {
  schoolSettingsSchema,
  type SchoolSettingsFormValues,
} from '../schemas/schoolSettings.schema';
import { AcademicStructureCard } from './AcademicStructureCard';
import { DaysOfWeekSelector } from './DaysOfWeekSelector';
import { LowResourceModeCard } from './LowResourceModeCard';
import { MinistryValidationCard } from './MinistryValidationCard';
import { RamadanModeCard } from './RamadanModeCard';
import { SchoolIdentityCard } from './SchoolIdentityCard';
import { ShiftConfiguration } from './ShiftConfiguration';
import { StartTimeInput } from './StartTimeInput';
import { TimezoneSelector } from './TimezoneSelector';

/**
 * Calculate stats for display in sidebar
 * Period data comes from PeriodStructure (read-only), not from this form
 */
function calculateStats(
  values: SchoolSettingsFormValues,
  periodData: { periodsPerDay: number; periodDuration: number }
) {
  const activeDays = values.daysOfWeek.length;
  const periodsPerDay = periodData.periodsPerDay;
  const periodDuration = values.ramadanModeEnabled
    ? values.ramadanPeriodDuration || 35
    : periodData.periodDuration;

  const [startHour, startMin] = values.startTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const teachingMinutes = periodsPerDay * periodDuration;
  const endMinutes = startMinutes + teachingMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  const teachingHours = (teachingMinutes / 60).toFixed(1);

  return {
    activeDays,
    periodsPerDay,
    periodDuration,
    teachingHours,
    endTime,
    hoursPerWeek: (parseFloat(teachingHours) * activeDays).toFixed(1),
    isMultiShift: values.shiftMode === 'multi',
    isRamadanMode: values.ramadanModeEnabled,
  };
}

function validateSettings(values: SchoolSettingsFormValues): {
  severity: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
} {
  if (values.daysOfWeek.length === 0) {
    return {
      severity: 'error',
      message: 'حداقل یک روز انتخاب کنید',
      details: 'مکتب باید حداقل یک روز در هفته فعال باشد',
    };
  }
  if (!values.enablePrimary && !values.enableMiddle && !values.enableHigh) {
    return {
      severity: 'error',
      message: 'حداقل یک مقطع تحصیلی انتخاب کنید',
      details: 'مکتب باید حداقل یک مقطع تحصیلی فعال داشته باشد',
    };
  }
  if (values.daysOfWeek.length < 5) {
    return {
      severity: 'warning',
      message: 'تعداد روزهای کاری کم است',
      details: `${values.daysOfWeek.length} روز در هفته انتخاب شده است`,
    };
  }
  return { severity: 'success', message: 'تنظیمات معتبر است' };
}

function PageSkeleton() {
  return (
    <div className="flex-1 h-full p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-80 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PageError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium">{t('common.loadError')}</p>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          {t('common.retry')}
        </Button>
      </div>
    </div>
  );
}

function StatsSidebar({
  stats,
  validation,
}: {
  stats: ReturnType<typeof calculateStats>;
  validation: ReturnType<typeof validateSettings>;
}) {
  const { t } = useTranslation();

  return (
    <Card className="sticky top-6 border-2 border-border/50 shadow-lg">
      <CardHeader className="pb-3 bg-linear-to-r from-slate-50 to-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('schoolSettings.stats.summary')}
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
              : validation.severity === 'warning'
                ? t('common.warning')
                : t('common.error')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between p-3.5 bg-blue-50 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <CalendarDays className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('schoolSettings.stats.activeDays')}</p>
              <p className="text-2xl font-bold text-[#003366]">{stats.activeDays}</p>
            </div>
          </div>
          <div className="w-16 bg-blue-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(stats.activeDays / 7) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-violet-50 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-100 rounded-xl">
              <Hash className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('schoolSettings.stats.periodsPerDay')}</p>
              <p className="text-2xl font-bold text-violet-700">{stats.periodsPerDay}</p>
            </div>
          </div>
          {stats.isRamadanMode && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {stats.periodDuration} دقیقه
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <Clock3 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('schoolSettings.stats.teachingHours')}</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.teachingHours}h</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-amber-50 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <CheckCircle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('schoolSettings.stats.endTime')}</p>
              <p className="text-2xl font-bold text-amber-700">{stats.endTime}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-linear-to-br from-[#003366] to-[#004488] rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200">{t('schoolSettings.stats.weeklyHours')}</p>
              <p className="text-3xl font-bold">{stats.hoursPerWeek}h</p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-300 opacity-50" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {stats.isMultiShift && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              <SunMoon className="h-3.5 w-3.5 me-1" />
              {t('schoolSettings.labels.multiShift')}
            </Badge>
          )}
          {stats.isRamadanMode && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
              <Sparkles className="h-3.5 w-3.5 me-1" />
              {t('schoolSettings.labels.ramadanMode')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SchoolSettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = useSchoolSettings();
  const { data: periodStructure } = usePeriodStructure();
  const updateMutation = useUpdateSchoolSettings();

  // Get period data from PeriodStructure (read-only display)
  const periodData = useMemo(
    () => ({
      periodsPerDay: periodStructure?.defaultPeriodsPerDay ?? 7,
      periodDuration: periodStructure?.periodDuration ?? 45,
    }),
    [periodStructure]
  );

  const form = useForm<SchoolSettingsFormValues>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: {
      schoolName: '',
      enablePrimary: true,
      enableMiddle: true,
      enableHigh: true,
      daysOfWeek: [...AFGHAN_WEEK_DAYS],
      startTime: DEFAULT_START_TIME,
      timezone: DEFAULT_TIMEZONE,
      shiftMode: 'single',
      shifts: undefined,
      ramadanModeEnabled: false,
      ramadanPeriodDuration: 35,
      enableMinistryValidation: false,
      ministryValidationMode: 'warn',
      customCurriculumMode: false,
      lowResourceMode: false,
    },
  });

  const watchedValues = form.watch();
  const stats = useMemo(
    () => calculateStats(watchedValues, periodData),
    [watchedValues, periodData]
  );
  const validation = useMemo(() => validateSettings(watchedValues), [watchedValues]);

  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  useEffect(() => {
    if (updateMutation.isSuccess) form.reset(form.getValues());
  }, [updateMutation.isSuccess, form]);

  const onSubmit = (values: SchoolSettingsFormValues) => {
    if (validation.severity === 'error') return;
    updateMutation.mutate(values);
  };

  // Sync dirty state with navigation guard store
  const setDirty = useNavigationGuardStore((s) => s.setDirty);
  useEffect(() => {
    setDirty(form.formState.isDirty);
    return () => setDirty(false);
  }, [form.formState.isDirty, setDirty]);

  const applyPreset = useCallback(
    (preset: 'afghan' | 'fullWeek' | 'multiShift') => {
      switch (preset) {
        case 'afghan':
          form.setValue('daysOfWeek', [...AFGHAN_WEEK_DAYS], { shouldDirty: true });
          form.setValue('shiftMode', 'single', { shouldDirty: true });
          break;
        case 'fullWeek':
          form.setValue(
            'daysOfWeek',
            ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            { shouldDirty: true }
          );
          break;
        case 'multiShift':
          form.setValue('shiftMode', 'multi', { shouldDirty: true });
          form.setValue('shifts', DEFAULT_SHIFT_CONFIG, { shouldDirty: true });
          break;
      }
    },
    [form]
  );

  if (isLoading) return <PageSkeleton />;
  if (isError) return <PageError onRetry={refetch} />;

  return (
    <div className="flex-1 h-full flex flex-col">
      {/* Sticky Header */}
      <PageHeader
        icon={School}
        title={t('schoolSettings.title')}
        subtitle={t('schoolSettings.description')}
        actions={
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={
              updateMutation.isPending || !form.formState.isDirty || validation.severity === 'error'
            }
            className="gap-2 bg-[#003366] hover:bg-[#004488]"
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-white rounded-xl border shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-white border-blue-200 text-blue-700 px-3 py-1">
              <CalendarDays className="h-3.5 w-3.5 me-1.5" />
              {stats.activeDays} {t('schoolSettings.stats.days')}
            </Badge>
            <Badge
              variant="outline"
              className="bg-white border-violet-200 text-violet-700 px-3 py-1"
            >
              <Hash className="h-3.5 w-3.5 me-1.5" />
              {stats.periodsPerDay} {t('schoolSettings.stats.periods')}
            </Badge>
            {stats.isMultiShift && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 px-3 py-1">
                <SunMoon className="h-3.5 w-3.5 me-1.5" />
                {t('schoolSettings.labels.multiShift')}
              </Badge>
            )}
            {stats.isRamadanMode && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5 me-1.5" />
                {t('schoolSettings.labels.ramadanMode')}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => applyPreset('afghan')}
              className="h-9 text-xs gap-1.5 bg-white hover:bg-gray-50 shadow-sm"
            >
              <School className="h-3.5 w-3.5" />
              {t('schoolSettings.presets.afghan')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => applyPreset('fullWeek')}
              className="h-9 text-xs bg-white hover:bg-gray-50 shadow-sm"
            >
              {t('schoolSettings.presets.fullWeek')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => applyPreset('multiShift')}
              className="h-9 text-xs bg-white hover:bg-gray-50 shadow-sm"
            >
              {t('schoolSettings.presets.multiShift')}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-[1fr_320px] gap-6">
              {/* Main Content - Configuration */}
              <div className="space-y-6">
                {/* School Identity */}
                <FormField
                  control={form.control}
                  name="schoolName"
                  render={({ field }) => (
                    <SchoolIdentityCard
                      schoolName={field.value || ''}
                      onChange={field.onChange}
                      disabled={updateMutation.isPending}
                    />
                  )}
                />

                {/* Academic Structure */}
                <AcademicStructureCard
                  enablePrimary={watchedValues.enablePrimary}
                  enableMiddle={watchedValues.enableMiddle}
                  enableHigh={watchedValues.enableHigh}
                  onToggle={(key) => {
                    const currentValue = form.getValues(key);
                    form.setValue(key, !currentValue, { shouldDirty: true });
                  }}
                  disabled={updateMutation.isPending}
                  error={form.formState.errors.enablePrimary?.message}
                />

                {/* Days of Week */}
                <SectionCard
                  icon={CalendarDays}
                  iconColor="bg-linear-to-br from-blue-500 to-indigo-600"
                  title={t('schoolSettings.sections.daysOfWeek')}
                  description={t('schoolSettings.sections.daysOfWeekDesc')}
                >
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
                </SectionCard>

                {/* Time Settings Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard
                    icon={Clock3}
                    iconColor="bg-linear-to-br from-cyan-500 to-teal-600"
                    title={t('schoolSettings.sections.startTime')}
                    description={t('schoolSettings.sections.startTimeDesc')}
                  >
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <StartTimeInput
                              value={field.value}
                              onChange={field.onChange}
                              disabled={updateMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SectionCard>

                  <SectionCard
                    icon={Globe2}
                    iconColor="bg-linear-to-br from-purple-500 to-pink-600"
                    title={t('schoolSettings.sections.timezone')}
                    description={t('schoolSettings.sections.timezoneDesc')}
                  >
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
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
                  </SectionCard>
                </div>

                {/* Shift Configuration */}
                <SectionCard
                  icon={SunMoon}
                  iconColor="bg-linear-to-br from-amber-500 to-orange-600"
                  title={t('schoolSettings.sections.shifts')}
                  description={t('schoolSettings.sections.shiftsDesc')}
                >
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  />
                </SectionCard>

                {/* Ramadan Mode */}
                <FormField
                  control={form.control}
                  name="ramadanModeEnabled"
                  render={({ field: enabledField }) => (
                    <FormField
                      control={form.control}
                      name="ramadanPeriodDuration"
                      render={({ field: durationField }) => (
                        <RamadanModeCard
                          enabled={enabledField.value}
                          periodDuration={durationField.value}
                          onEnabledChange={enabledField.onChange}
                          onDurationChange={durationField.onChange}
                          disabled={updateMutation.isPending}
                        />
                      )}
                    />
                  )}
                />

                {/* Ministry Validation */}
                <FormField
                  control={form.control}
                  name="enableMinistryValidation"
                  render={({ field: enabledField }) => (
                    <FormField
                      control={form.control}
                      name="ministryValidationMode"
                      render={({ field: modeField }) => (
                        <FormField
                          control={form.control}
                          name="customCurriculumMode"
                          render={({ field: customField }) => (
                            <MinistryValidationCard
                              enabled={enabledField.value}
                              mode={modeField.value}
                              customCurriculumMode={customField.value}
                              onEnabledChange={enabledField.onChange}
                              onModeChange={modeField.onChange}
                              onCustomCurriculumChange={customField.onChange}
                              disabled={updateMutation.isPending}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />

                {/* Low Resource Mode */}
                <FormField
                  control={form.control}
                  name="lowResourceMode"
                  render={({ field }) => (
                    <LowResourceModeCard
                      enabled={field.value}
                      onEnabledChange={field.onChange}
                      disabled={updateMutation.isPending}
                    />
                  )}
                />

                {/* Validation Alert */}
                {validation.severity !== 'success' && (
                  <Alert
                    variant={validation.severity === 'error' ? 'destructive' : 'default'}
                    className="border-2"
                  >
                    {validation.severity === 'error' ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <AlertTitle>{validation.message}</AlertTitle>
                    {validation.details && (
                      <AlertDescription>{validation.details}</AlertDescription>
                    )}
                  </Alert>
                )}
              </div>

              {/* Stats Sidebar */}
              <div>
                <div className="sticky top-6">
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
