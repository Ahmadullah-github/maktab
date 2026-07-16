/**
 * BreakConfiguration Component
 *
 * Shared-default and per-day break editor with inheritance support.
 * Primary editing happens through slot durations; advanced editing exposes
 * sparse break rows plus presets and auto-distribution.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { cn } from '@/lib/utils';
import { ChevronDown, Coffee, CopyPlus, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BREAK_DURATION_LIMITS,
  BREAK_PRESETS,
  type BreakPresetKey,
  DEFAULT_BREAK_CONFIG,
  type GradeCategoryKey,
} from '../constants/defaults';
import type {
  BreakPeriodConfig,
  BreaksByDayMap,
  CategoryPeriodsMap,
  PeriodsPerDayMap,
} from '../types';
import {
  buildBreakSlotDurations,
  buildBreaksFromSlots,
  clampBreaksToMaxPeriods,
  getEffectivePeriodsForDay,
  getMaxEffectivePeriods,
  getResolvedBreaksForDay,
} from '../utils';

type BreakEditorTarget = 'shared' | WeekDay;

interface BreakConfigurationProps {
  breaks: BreakPeriodConfig[];
  breaksByDay: BreaksByDayMap;
  onBreaksChange: (breaks: BreakPeriodConfig[]) => void;
  onBreaksByDayChange: (breaksByDay: BreaksByDayMap) => void;
  activeDays: WeekDay[];
  defaultPeriods: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: PeriodsPerDayMap;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: CategoryPeriodsMap;
  enabledCategories: readonly GradeCategoryKey[];
  disabled?: boolean;
  className?: string;
}

function BreakTimeline({
  breaks,
  maxPeriods,
}: {
  breaks: BreakPeriodConfig[];
  maxPeriods: number;
}) {
  const { t } = useTranslation();
  const sortedBreaks = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);
  const breakMap = new Map(sortedBreaks.map((b) => [b.afterPeriod, b]));

  const items: Array<{ type: 'period' | 'break'; number?: number; duration?: number }> = [];

  for (let i = 1; i <= maxPeriods; i++) {
    items.push({ type: 'period', number: i });
    const breakAfter = breakMap.get(i);
    if (breakAfter) {
      items.push({ type: 'break', duration: breakAfter.duration });
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        {t('periodStructure.labels.timeline', { defaultValue: 'Day preview' })}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item, index) =>
          item.type === 'period' ? (
            <div
              key={`period-${index}`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-200 bg-violet-100 text-xs font-medium text-violet-700"
            >
              {item.number}
            </div>
          ) : (
            <div
              key={`break-${index}`}
              className="flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 text-xs text-amber-700"
            >
              <Coffee className="h-3 w-3" />
              <span>
                {item.duration}{' '}
                {t('periodStructure.labels.minutesShort', { defaultValue: 'min' })}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function getNextAvailableBreakPeriod(
  breaks: BreakPeriodConfig[],
  maxPeriods: number
): number | null {
  const usedPeriods = new Set(breaks.map((breakConfig) => breakConfig.afterPeriod));
  const preferredOrder = [
    DEFAULT_BREAK_CONFIG.afterPeriod,
    ...Array.from({ length: Math.max(maxPeriods - 1, 0) }, (_, index) => index + 1),
  ];
  for (const period of preferredOrder) {
    if (period < maxPeriods && !usedPeriods.has(period)) return period;
  }
  return null;
}

export function buildEvenlyDistributedBreaks(
  count: number,
  maxPeriods: number
): BreakPeriodConfig[] {
  if (count <= 0 || maxPeriods <= 1) return [];
  const boundedCount = Math.min(count, maxPeriods - 1);
  const periods = new Set<number>();
  for (let index = 1; index <= boundedCount; index += 1) {
    periods.add(
      Math.min(
        Math.max(Math.floor((index * maxPeriods) / (boundedCount + 1)), 1),
        maxPeriods - 1
      )
    );
  }
  return Array.from(periods)
    .sort((left, right) => left - right)
    .map((afterPeriod) => ({
      afterPeriod,
      duration: BREAK_DURATION_LIMITS.DEFAULT,
    }));
}

export function BreakConfiguration({
  breaks,
  breaksByDay,
  onBreaksChange,
  onBreaksByDayChange,
  activeDays,
  defaultPeriods,
  dynamicPeriodsEnabled,
  periodsPerDayMap,
  categoryPeriodsEnabled,
  categoryPeriodsMap,
  enabledCategories,
  disabled = false,
  className,
}: BreakConfigurationProps) {
  const { t } = useTranslation();
  const [selectedTarget, setSelectedTarget] = useState<BreakEditorTarget>('shared');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (selectedTarget !== 'shared' && !activeDays.includes(selectedTarget)) {
      setSelectedTarget('shared');
    }
  }, [activeDays, selectedTarget]);

  const effectivePeriodOptions = useMemo(
    () => ({
      defaultPeriods,
      dynamicPeriodsEnabled,
      periodsPerDayMap,
      categoryPeriodsEnabled,
      categoryPeriodsMap,
      enabledCategories,
    }),
    [
      categoryPeriodsEnabled,
      categoryPeriodsMap,
      enabledCategories,
      defaultPeriods,
      dynamicPeriodsEnabled,
      periodsPerDayMap,
    ]
  );

  const sharedMaxPeriods = useMemo(
    () => getMaxEffectivePeriods(activeDays, effectivePeriodOptions),
    [activeDays, effectivePeriodOptions]
  );

  const maxPeriodsByDay = useMemo(
    () =>
      Object.fromEntries(
        activeDays.map((day) => [day, getEffectivePeriodsForDay(day, effectivePeriodOptions)])
      ) as Record<WeekDay, number>,
    [activeDays, effectivePeriodOptions]
  );

  const isSharedTarget = selectedTarget === 'shared';
  const hasCustomOverride =
    !isSharedTarget && Object.prototype.hasOwnProperty.call(breaksByDay, selectedTarget);
  const targetMaxPeriods = isSharedTarget
    ? sharedMaxPeriods
    : (maxPeriodsByDay[selectedTarget] ?? 1);
  const resolvedBreaks = isSharedTarget
    ? clampBreaksToMaxPeriods(breaks, targetMaxPeriods)
    : getResolvedBreaksForDay(selectedTarget, breaks, breaksByDay, targetMaxPeriods);
  const slotDurations = useMemo(
    () => buildBreakSlotDurations(targetMaxPeriods, resolvedBreaks),
    [resolvedBreaks, targetMaxPeriods]
  );
  const isInheritedDay = !isSharedTarget && !hasCustomOverride;
  const canEditTarget = !disabled && (isSharedTarget || hasCustomOverride);
  const targetLabel = isSharedTarget
    ? t('periodStructure.labels.sharedDefault', { defaultValue: 'Shared Default' })
    : t(`days.${selectedTarget.toLowerCase()}`);

  const updateDayOverride = (day: WeekDay, nextBreaks: BreakPeriodConfig[]) => {
    onBreaksByDayChange({
      ...breaksByDay,
      [day]: clampBreaksToMaxPeriods(nextBreaks, maxPeriodsByDay[day] ?? 1),
    });
  };

  const clearDayOverride = (day: WeekDay) => {
    const nextBreaksByDay = { ...breaksByDay };
    delete nextBreaksByDay[day];
    onBreaksByDayChange(nextBreaksByDay);
  };

  const updateCurrentBreaks = (nextBreaks: BreakPeriodConfig[]) => {
    const clampedBreaks = clampBreaksToMaxPeriods(nextBreaks, targetMaxPeriods);

    if (isSharedTarget) {
      onBreaksChange(clampedBreaks);
      return;
    }

    updateDayOverride(selectedTarget, clampedBreaks);
  };

  const handleSlotDurationChange = (afterPeriod: number, rawValue: string) => {
    if (!canEditTarget) {
      return;
    }

    const parsedDuration = Number.parseInt(rawValue, 10);
    const nextDuration = Number.isNaN(parsedDuration)
      ? 0
      : Math.max(0, Math.min(BREAK_DURATION_LIMITS.MAX, parsedDuration));

    updateCurrentBreaks(
      buildBreaksFromSlots(
        slotDurations.map((slot) =>
          slot.afterPeriod === afterPeriod ? { ...slot, duration: nextDuration } : slot
        )
      )
    );
  };

  const handleAddBreak = () => {
    if (!canEditTarget || targetMaxPeriods <= 1) {
      return;
    }

    const afterPeriod = getNextAvailableBreakPeriod(resolvedBreaks, targetMaxPeriods);
    if (afterPeriod === null) return;
    const newBreak: BreakPeriodConfig = {
      afterPeriod,
      duration: DEFAULT_BREAK_CONFIG.duration,
    };

    updateCurrentBreaks([...resolvedBreaks, newBreak]);
  };

  const handleRemoveBreak = (index: number) => {
    if (!canEditTarget) {
      return;
    }

    updateCurrentBreaks(resolvedBreaks.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleBreakChange = (index: number, field: keyof BreakPeriodConfig, rawValue: string) => {
    if (!canEditTarget) {
      return;
    }

    const parsedValue = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsedValue)) {
      return;
    }

    updateCurrentBreaks(
      resolvedBreaks.map((breakConfig, currentIndex) =>
        currentIndex === index ? { ...breakConfig, [field]: parsedValue } : breakConfig
      )
    );
  };

  const handleApplyPreset = (presetKey: BreakPresetKey) => {
    if (!canEditTarget) {
      return;
    }

    updateCurrentBreaks(BREAK_PRESETS[presetKey].breaks.map((breakConfig) => ({ ...breakConfig })));
  };

  const handleAutoDistribute = (count: number) => {
    if (!canEditTarget || count <= 0 || targetMaxPeriods <= 1) {
      return;
    }

    updateCurrentBreaks(buildEvenlyDistributedBreaks(count, targetMaxPeriods));
  };

  const handleCustomizeDay = () => {
    if (disabled || isSharedTarget) {
      return;
    }

    updateDayOverride(
      selectedTarget,
      getResolvedBreaksForDay(selectedTarget, breaks, breaksByDay, targetMaxPeriods)
    );
  };

  const handleResetDay = () => {
    if (disabled || isSharedTarget) {
      return;
    }

    clearDayOverride(selectedTarget);
  };

  const customDayCount = Object.keys(breaksByDay).length;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('periodStructure.help.breakPeriods')}</p>
        {categoryPeriodsEnabled && (
          <p className="text-xs text-muted-foreground">
            {t('periodStructure.help.breaksShorterCategories', {
              defaultValue:
                'Breaks are configured per day for the whole school. Shorter categories stop earlier and ignore later break slots.',
            })}
          </p>
        )}
      </div>

      <Tabs
        value={selectedTarget}
        onValueChange={(value: string) => setSelectedTarget(value as BreakEditorTarget)}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="shared" className="gap-2">
            <span>
              {t('periodStructure.labels.sharedDefault', { defaultValue: 'Shared Default' })}
            </span>
            {customDayCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                {customDayCount}
              </Badge>
            )}
          </TabsTrigger>
          {activeDays.map((day) => {
            const isCustom = Object.prototype.hasOwnProperty.call(breaksByDay, day);
            return (
              <TabsTrigger key={day} value={day} className="gap-2">
                <span>{t(`days.${day.toLowerCase()}`)}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'rounded-full px-2 py-0 text-[10px]',
                    isCustom ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {isCustom
                    ? t('periodStructure.labels.custom', { defaultValue: 'Custom' })
                    : t('periodStructure.labels.inherited', { defaultValue: 'Inherited' })}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-slate-900">{targetLabel}</h4>
              <Badge variant="outline" className="border-violet-200 text-violet-700">
                {targetMaxPeriods}{' '}
                {t('periodStructure.labels.periods', { defaultValue: 'periods' })}
              </Badge>
              {!isSharedTarget && (
                <Badge
                  variant="secondary"
                  className={cn(
                    hasCustomOverride
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {hasCustomOverride
                    ? t('periodStructure.labels.custom', { defaultValue: 'Custom' })
                    : t('periodStructure.labels.inherited', { defaultValue: 'Inherited' })}
                </Badge>
              )}
            </div>
            {!isSharedTarget && isInheritedDay && (
              <p className="text-sm text-muted-foreground">
                {t('periodStructure.help.inheritedBreaks', {
                  defaultValue:
                    'This day currently inherits the shared default break layout. Customize it only if this day needs a different pattern.',
                })}
              </p>
            )}
          </div>

          {!isSharedTarget && (
            <div className="flex flex-wrap items-center gap-2">
              {hasCustomOverride ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDay}
                  disabled={disabled}
                  className="gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('periodStructure.actions.resetDay', { defaultValue: 'Reset day' })}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCustomizeDay}
                  disabled={disabled}
                  className="gap-1"
                >
                  <CopyPlus className="h-4 w-4" />
                  {t('periodStructure.actions.customizeDay', {
                    defaultValue: 'Customize day',
                  })}
                </Button>
              )}
            </div>
          )}
        </div>

        {targetMaxPeriods <= 1 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            {t('periodStructure.help.noBreakSlots', {
              defaultValue:
                'This target only has one teaching period, so there are no break slots.',
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {slotDurations.map((slot) => (
              <div
                key={slot.afterPeriod}
                className="grid gap-3 rounded-xl border bg-slate-50/70 p-3 md:grid-cols-[180px_1fr]"
              >
                <div>
                  <Label className="text-sm font-medium">
                    {t('periodStructure.labels.afterPeriodWithValue', {
                      period: slot.afterPeriod,
                      defaultValue: `After period ${slot.afterPeriod}`,
                    })}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('periodStructure.help.zeroDisablesBreak', {
                      defaultValue: 'Set to 0 to leave no break at this point.',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={BREAK_DURATION_LIMITS.MAX}
                    step={5}
                    value={slot.duration}
                    onChange={(event) =>
                      handleSlotDurationChange(slot.afterPeriod, event.target.value)
                    }
                    disabled={!canEditTarget}
                    className="max-w-[180px]"
                  />
                  <span className="text-sm text-muted-foreground">
                    {slot.duration > 0
                      ? t('periodStructure.labels.minutesShort', { defaultValue: 'min' })
                      : t('periodStructure.labels.noBreak', { defaultValue: 'No break' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <BreakTimeline breaks={resolvedBreaks} maxPeriods={targetMaxPeriods} />
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1">
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')}
                />
                {t('periodStructure.actions.advancedEditor', {
                  defaultValue: 'Advanced editor',
                })}
              </Button>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEditTarget}
                  className="gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('periodStructure.actions.applyPreset')}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(BREAK_PRESETS) as BreakPresetKey[]).map((key) => (
                  <DropdownMenuItem key={key} onClick={() => handleApplyPreset(key)}>
                    {t(`periodStructure.${BREAK_PRESETS[key].labelKey}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEditTarget || targetMaxPeriods <= 1}
                  className="gap-1"
                >
                  {t('periodStructure.actions.autoDistribute')}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Array.from(
                  { length: Math.max(targetMaxPeriods - 1, 0) },
                  (_, index) => index + 1
                ).map((count) => (
                  <DropdownMenuItem key={count} onClick={() => handleAutoDistribute(count)}>
                    {t('periodStructure.actions.distributeCount', { count })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBreak}
              disabled={
                !canEditTarget ||
                targetMaxPeriods <= 1 ||
                getNextAvailableBreakPeriod(resolvedBreaks, targetMaxPeriods) === null
              }
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              {t('periodStructure.actions.addBreak')}
            </Button>
          </div>

          <CollapsibleContent className="space-y-3">
            {resolvedBreaks.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                {t('periodStructure.help.noAdvancedBreaks', {
                  defaultValue:
                    'No sparse break rows yet. Use the slot editor above or add one here.',
                })}
              </div>
            ) : (
              resolvedBreaks.map((breakConfig, index) => (
                <div
                  key={`${breakConfig.afterPeriod}-${index}`}
                  className="grid gap-4 rounded-xl border bg-slate-50/70 p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`break-${selectedTarget}-${index}-after`} className="text-xs">
                      {t('periodStructure.labels.afterPeriod')}
                    </Label>
                    <Input
                      id={`break-${selectedTarget}-${index}-after`}
                      type="number"
                      min={1}
                      max={Math.max(targetMaxPeriods - 1, 1)}
                      value={breakConfig.afterPeriod}
                      onChange={(event) =>
                        handleBreakChange(index, 'afterPeriod', event.target.value)
                      }
                      disabled={!canEditTarget}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`break-${selectedTarget}-${index}-duration`}
                      className="text-xs"
                    >
                      {t('periodStructure.labels.breakDuration')}
                    </Label>
                    <Input
                      id={`break-${selectedTarget}-${index}-duration`}
                      type="number"
                      min={BREAK_DURATION_LIMITS.MIN}
                      max={BREAK_DURATION_LIMITS.MAX}
                      value={breakConfig.duration}
                      onChange={(event) => handleBreakChange(index, 'duration', event.target.value)}
                      disabled={!canEditTarget}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveBreak(index)}
                      disabled={!canEditTarget}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('periodStructure.actions.removeBreak')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
