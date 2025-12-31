/**
 * PrayerBreaksConfig Component
 *
 * Renders enable toggle for prayer breaks
 * Shows time slot configuration when enabled
 *
 * Requirements: 2.6
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BREAK_DURATION_LIMITS, DEFAULT_PRAYER_BREAK } from '../constants/defaults';
import type { PrayerBreakConfig } from '../types';

interface PrayerBreaksConfigProps {
  /** Whether prayer breaks are enabled */
  enabled: boolean;
  /** Callback when enabled state changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Array of prayer break configurations */
  prayerBreaks: PrayerBreakConfig[];
  /** Callback when prayer breaks array changes */
  onPrayerBreaksChange: (breaks: PrayerBreakConfig[]) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Validation errors for specific prayer breaks */
  errors?: Array<{ name?: string; time?: string; duration?: string }>;
}

/**
 * PrayerBreaksConfig - Prayer break time slot configuration
 *
 * Allows enabling/disabling prayer breaks and configuring time slots
 * for religious observance during school hours
 *
 * Requirements: 2.6
 */
export function PrayerBreaksConfig({
  enabled,
  onEnabledChange,
  prayerBreaks,
  onPrayerBreaksChange,
  disabled = false,
  className,
  errors,
}: PrayerBreaksConfigProps) {
  const { t } = useTranslation();

  const handleAddPrayerBreak = () => {
    const newBreak: PrayerBreakConfig = {
      name: DEFAULT_PRAYER_BREAK.name,
      time: DEFAULT_PRAYER_BREAK.time,
      duration: DEFAULT_PRAYER_BREAK.duration,
    };
    onPrayerBreaksChange([...prayerBreaks, newBreak]);
  };

  const handleRemovePrayerBreak = (index: number) => {
    const newBreaks = prayerBreaks.filter((_, i) => i !== index);
    onPrayerBreaksChange(newBreaks);
  };

  const handlePrayerBreakChange = (
    index: number,
    field: keyof PrayerBreakConfig,
    value: string | number
  ) => {
    const newBreaks = prayerBreaks.map((breakConfig, i) => {
      if (i === index) {
        if (field === 'duration') {
          const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
          if (!isNaN(numValue)) {
            return { ...breakConfig, [field]: numValue };
          }
          return breakConfig;
        }
        return { ...breakConfig, [field]: value };
      }
      return breakConfig;
    });
    onPrayerBreaksChange(newBreaks);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toggle with tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="prayer-breaks-toggle" className="text-sm font-medium">
            {t('periodStructure.labels.prayerBreaksEnabled')}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>{t('periodStructure.helpText.prayerBreaks')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="prayer-breaks-toggle"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-describedby="prayer-breaks-description"
        />
      </div>

      {/* Configuration when enabled */}
      {enabled && (
        <>
          {/* Add button */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPrayerBreak}
              disabled={disabled}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              {t('periodStructure.labels.addPrayerBreak')}
            </Button>
          </div>

          {/* Empty state */}
          {prayerBreaks.length === 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p>{t('periodStructure.helpText.prayerBreaks')}</p>
            </div>
          )}

          {/* Prayer breaks list */}
          {prayerBreaks.length > 0 && (
            <div className="space-y-3">
              {prayerBreaks.map((prayerBreak, index) => {
                const breakErrors = errors?.[index];
                return (
                  <div key={index} className="flex items-start gap-4 rounded-md border p-3">
                    {/* Name input */}
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`prayer-${index}-name`} className="text-xs">
                        {t('periodStructure.labels.prayerName')}
                      </Label>
                      <Input
                        id={`prayer-${index}-name`}
                        type="text"
                        value={prayerBreak.name}
                        onChange={(e) => handlePrayerBreakChange(index, 'name', e.target.value)}
                        disabled={disabled}
                        className={cn('w-full', breakErrors?.name && 'border-destructive')}
                        aria-invalid={!!breakErrors?.name}
                      />
                      {breakErrors?.name && (
                        <span className="text-xs text-destructive">{breakErrors.name}</span>
                      )}
                    </div>

                    {/* Time input */}
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`prayer-${index}-time`} className="text-xs">
                        {t('periodStructure.labels.prayerTime')}
                      </Label>
                      <Input
                        id={`prayer-${index}-time`}
                        type="time"
                        value={prayerBreak.time}
                        onChange={(e) => handlePrayerBreakChange(index, 'time', e.target.value)}
                        disabled={disabled}
                        className={cn('w-full', breakErrors?.time && 'border-destructive')}
                        aria-invalid={!!breakErrors?.time}
                      />
                      {breakErrors?.time && (
                        <span className="text-xs text-destructive">{breakErrors.time}</span>
                      )}
                    </div>

                    {/* Duration input */}
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`prayer-${index}-duration`} className="text-xs">
                        {t('periodStructure.labels.prayerDuration')}
                      </Label>
                      <Input
                        id={`prayer-${index}-duration`}
                        type="number"
                        value={prayerBreak.duration}
                        onChange={(e) => handlePrayerBreakChange(index, 'duration', e.target.value)}
                        min={BREAK_DURATION_LIMITS.MIN}
                        max={BREAK_DURATION_LIMITS.MAX}
                        disabled={disabled}
                        className={cn('w-full', breakErrors?.duration && 'border-destructive')}
                        aria-invalid={!!breakErrors?.duration}
                      />
                      {breakErrors?.duration && (
                        <span className="text-xs text-destructive">{breakErrors.duration}</span>
                      )}
                    </div>

                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePrayerBreak(index)}
                      disabled={disabled}
                      className="mt-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      aria-label={t('periodStructure.labels.removePrayerBreak')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
