/**
 * PeriodsConfiguration Component
 *
 * Configure periods per day, duration, and breaks
 * Inspired by PeriodsStep wizard component
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Coffee, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

interface PeriodsConfigurationProps {
  periodsPerDay: number;
  periodDuration: number;
  breakPeriods: BreakPeriodConfig[];
  onPeriodsChange: (periods: number) => void;
  onDurationChange: (duration: number) => void;
  onBreaksChange: (breaks: BreakPeriodConfig[]) => void;
  disabled?: boolean;
}

const DURATION_OPTIONS = [30, 35, 40, 45, 50, 55, 60];
const BREAK_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];

export function PeriodsConfiguration({
  periodsPerDay,
  periodDuration,
  breakPeriods,
  onPeriodsChange,
  onDurationChange,
  onBreaksChange,
  disabled = false,
}: PeriodsConfigurationProps) {
  const { t } = useTranslation();

  const updateBreakDuration = (afterPeriod: number, duration: number) => {
    const existing = breakPeriods.find((b) => b.afterPeriod === afterPeriod);
    let updated: BreakPeriodConfig[];

    if (existing) {
      if (duration === 0) {
        updated = breakPeriods.filter((b) => b.afterPeriod !== afterPeriod);
      } else {
        updated = breakPeriods.map((b) => (b.afterPeriod === afterPeriod ? { ...b, duration } : b));
      }
    } else if (duration > 0) {
      updated = [...breakPeriods, { afterPeriod, duration }].sort(
        (a, b) => a.afterPeriod - b.afterPeriod
      );
    } else {
      updated = breakPeriods;
    }

    onBreaksChange(updated);
  };

  const getBreakDuration = (afterPeriod: number): number => {
    return breakPeriods.find((b) => b.afterPeriod === afterPeriod)?.duration || 0;
  };

  return (
    <div className="space-y-6">
      {/* Basic Settings Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Periods per Day */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('schoolSettings.labels.periodsPerDay')}</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPeriodsChange(Math.max(1, periodsPerDay - 1))}
              disabled={disabled || periodsPerDay <= 1}
              className="h-10 w-10"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={periodsPerDay}
              onChange={(e) =>
                onPeriodsChange(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))
              }
              disabled={disabled}
              className="h-10 text-center text-lg font-semibold w-20"
              min={1}
              max={12}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPeriodsChange(Math.min(12, periodsPerDay + 1))}
              disabled={disabled || periodsPerDay >= 12}
              className="h-10 w-10"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('schoolSettings.labels.periodsRange')}</p>
        </div>

        {/* Period Duration */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('schoolSettings.labels.periodDuration')}</Label>
          <Select
            value={String(periodDuration)}
            onValueChange={(v) => onDurationChange(parseInt(v))}
            disabled={disabled}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} {t('schoolSettings.labels.minutes')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('schoolSettings.labels.durationDesc')}</p>
        </div>
      </div>

      {/* Break Periods */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Coffee className="h-4 w-4 text-amber-600" />
          {t('schoolSettings.labels.breakPeriods')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t('schoolSettings.labels.breakPeriodsDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: periodsPerDay - 1 }, (_, i) => i + 1).map((p) => {
            const breakDuration = getBreakDuration(p);
            const hasBreak = breakDuration > 0;

            return (
              <div
                key={p}
                className={cn(
                  'p-3 rounded-lg border-2 transition-all',
                  hasBreak
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {hasBreak && <Coffee className="h-4 w-4 text-amber-600" />}
                    <span className="text-sm font-medium">
                      {t('schoolSettings.labels.afterPeriod')} {p}
                    </span>
                  </div>
                  <Select
                    value={String(breakDuration)}
                    onValueChange={(v) => updateBreakDuration(p, parseInt(v))}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BREAK_DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={String(d)} className="text-xs">
                          {d === 0
                            ? t('schoolSettings.labels.noBreak')
                            : `${d} ${t('schoolSettings.labels.min')}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
