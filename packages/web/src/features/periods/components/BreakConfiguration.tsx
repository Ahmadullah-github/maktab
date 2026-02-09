/**
 * BreakConfiguration Component
 *
 * Allows adding/removing break periods with presets and auto-distribute
 * Configure afterPeriod and duration for each break
 * Shows timeline preview and guidance
 *
 * Requirements: 2.5, 10.4
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ChevronDown, Coffee, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BREAK_DURATION_LIMITS,
  BREAK_PRESETS,
  type BreakPresetKey,
  DEFAULT_BREAK_CONFIG,
  PERIOD_LIMITS,
} from '../constants/defaults';
import type { BreakPeriodConfig } from '../types';

interface BreakConfigurationProps {
  breaks: BreakPeriodConfig[];
  onBreaksChange: (breaks: BreakPeriodConfig[]) => void;
  maxPeriods?: number;
  disabled?: boolean;
  className?: string;
  errors?: Array<{ afterPeriod?: string; duration?: string }>;
}

/**
 * Timeline preview showing periods and breaks visually
 */
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

  if (items.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground mb-2">{t('periodStructure.labels.timeline')}</p>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item, idx) =>
          item.type === 'period' ? (
            <div
              key={`p-${idx}`}
              className="h-8 w-8 rounded bg-violet-100 border border-violet-200 flex items-center justify-center text-xs font-medium text-violet-700"
            >
              {item.number}
            </div>
          ) : (
            <div
              key={`b-${idx}`}
              className="h-8 px-2 rounded bg-amber-100 border border-amber-200 flex items-center gap-1 text-xs text-amber-700"
            >
              <Coffee className="h-3 w-3" />
              <span>{item.duration}m</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/**
 * BreakConfiguration - Break periods setup with presets and auto-distribute
 */
export function BreakConfiguration({
  breaks,
  onBreaksChange,
  maxPeriods = PERIOD_LIMITS.DEFAULT,
  disabled = false,
  className,
  errors,
}: BreakConfigurationProps) {
  const { t } = useTranslation();

  const handleAddBreak = () => {
    // Find next available period slot
    const usedPeriods = new Set(breaks.map((b) => b.afterPeriod));
    let nextPeriod: number = DEFAULT_BREAK_CONFIG.afterPeriod;
    while (usedPeriods.has(nextPeriod) && nextPeriod < maxPeriods) {
      nextPeriod++;
    }
    if (nextPeriod >= maxPeriods) nextPeriod = 1;

    const newBreak: BreakPeriodConfig = {
      afterPeriod: nextPeriod,
      duration: DEFAULT_BREAK_CONFIG.duration,
    };
    onBreaksChange([...breaks, newBreak]);
  };

  const handleRemoveBreak = (index: number) => {
    onBreaksChange(breaks.filter((_, i) => i !== index));
  };

  const handleBreakChange = (index: number, field: keyof BreakPeriodConfig, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onBreaksChange(
        breaks.map((breakConfig, i) =>
          i === index ? { ...breakConfig, [field]: numValue } : breakConfig
        )
      );
    }
  };

  const handleApplyPreset = (presetKey: BreakPresetKey) => {
    const preset = BREAK_PRESETS[presetKey];
    // Filter breaks that fit within maxPeriods
    const validBreaks = preset.breaks.filter((b) => b.afterPeriod < maxPeriods);
    onBreaksChange(validBreaks.map((b) => ({ ...b })));
  };

  const handleAutoDistribute = (count: number) => {
    if (count <= 0 || maxPeriods <= 1) return;

    const newBreaks: BreakPeriodConfig[] = [];
    const interval = Math.floor(maxPeriods / (count + 1));

    for (let i = 1; i <= count; i++) {
      const afterPeriod = Math.min(interval * i, maxPeriods - 1);
      if (afterPeriod > 0 && !newBreaks.some((b) => b.afterPeriod === afterPeriod)) {
        newBreaks.push({ afterPeriod, duration: BREAK_DURATION_LIMITS.DEFAULT });
      }
    }

    onBreaksChange(newBreaks);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Presets dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-1">
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

        {/* Auto-distribute dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-1">
              {t('periodStructure.actions.autoDistribute')}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[1, 2, 3, 4].map((count) => (
              <DropdownMenuItem key={count} onClick={() => handleAutoDistribute(count)}>
                {t('periodStructure.actions.distributeCount', { count })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Add single break */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddBreak}
          disabled={disabled}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          {t('periodStructure.actions.addBreak')}
        </Button>
      </div>

      {/* Guidance text */}
      <p className="text-sm text-muted-foreground">{t('periodStructure.help.breakPeriods')}</p>

      {/* Break list */}
      {breaks.length > 0 && (
        <div className="space-y-3">
          {breaks.map((breakConfig, index) => {
            const breakErrors = errors?.[index];
            return (
              <div key={index} className="flex items-start gap-4 rounded-md border p-3">
                {/* After period input */}
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`break-${index}-after`} className="text-xs">
                    {t('periodStructure.labels.afterPeriod')}
                  </Label>
                  <Input
                    id={`break-${index}-after`}
                    type="number"
                    value={breakConfig.afterPeriod}
                    onChange={(e) => handleBreakChange(index, 'afterPeriod', e.target.value)}
                    min={1}
                    max={maxPeriods - 1}
                    disabled={disabled}
                    className={cn('w-full', breakErrors?.afterPeriod && 'border-destructive')}
                    aria-invalid={!!breakErrors?.afterPeriod}
                  />
                  {breakErrors?.afterPeriod && (
                    <span className="text-xs text-destructive">{breakErrors.afterPeriod}</span>
                  )}
                </div>

                {/* Duration input */}
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`break-${index}-duration`} className="text-xs">
                    {t('periodStructure.labels.breakDuration')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`break-${index}-duration`}
                      type="number"
                      value={breakConfig.duration}
                      onChange={(e) => handleBreakChange(index, 'duration', e.target.value)}
                      min={BREAK_DURATION_LIMITS.MIN}
                      max={BREAK_DURATION_LIMITS.MAX}
                      disabled={disabled}
                      className={cn('w-full', breakErrors?.duration && 'border-destructive')}
                      aria-invalid={!!breakErrors?.duration}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {t('periodStructure.labels.minutes')}
                    </span>
                  </div>
                  {breakErrors?.duration && (
                    <span className="text-xs text-destructive">{breakErrors.duration}</span>
                  )}
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBreak(index)}
                  disabled={disabled}
                  className="mt-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={t('periodStructure.actions.removeBreak')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline preview */}
      {breaks.length > 0 && <BreakTimeline breaks={breaks} maxPeriods={maxPeriods} />}
    </div>
  );
}
