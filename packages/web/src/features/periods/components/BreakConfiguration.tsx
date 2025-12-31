/**
 * BreakConfiguration Component
 *
 * Allows adding/removing break periods
 * Configure afterPeriod and duration for each break
 * Shows example values and guidance
 *
 * Requirements: 2.5, 10.4
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BREAK_DURATION_LIMITS, DEFAULT_BREAK_CONFIG, PERIOD_LIMITS } from '../constants/defaults';
import type { BreakPeriodConfig } from '../types';

interface BreakConfigurationProps {
  /** Array of break period configurations */
  breaks: BreakPeriodConfig[];
  /** Callback when breaks array changes */
  onBreaksChange: (breaks: BreakPeriodConfig[]) => void;
  /** Maximum periods per day (for afterPeriod validation) */
  maxPeriods?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Validation errors for specific breaks */
  errors?: Array<{ afterPeriod?: string; duration?: string }>;
}

/**
 * BreakConfiguration - Break periods setup with add/remove functionality
 *
 * Allows configuring breaks after specific periods with duration
 * Shows example values and guidance text
 *
 * Requirements: 2.5, 10.4
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
    const newBreak: BreakPeriodConfig = {
      afterPeriod: DEFAULT_BREAK_CONFIG.afterPeriod,
      duration: DEFAULT_BREAK_CONFIG.duration,
    };
    onBreaksChange([...breaks, newBreak]);
  };

  const handleRemoveBreak = (index: number) => {
    const newBreaks = breaks.filter((_, i) => i !== index);
    onBreaksChange(newBreaks);
  };

  const handleBreakChange = (index: number, field: keyof BreakPeriodConfig, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const newBreaks = breaks.map((breakConfig, i) => {
        if (i === index) {
          return { ...breakConfig, [field]: numValue };
        }
        return breakConfig;
      });
      onBreaksChange(newBreaks);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t('periodStructure.labels.breakPeriods')}</Label>
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

      {/* Example values */}
      {breaks.length === 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="font-medium mb-1">{t('periodStructure.labels.example')}:</p>
          <p>
            {t('periodStructure.examples.breakAfterPeriod', {
              period: DEFAULT_BREAK_CONFIG.afterPeriod,
              duration: DEFAULT_BREAK_CONFIG.duration,
            })}
          </p>
        </div>
      )}

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
    </div>
  );
}
