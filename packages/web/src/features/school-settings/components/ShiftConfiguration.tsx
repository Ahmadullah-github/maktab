/**
 * ShiftConfiguration Component
 *
 * Enhanced shift configuration with realistic visual timeline
 * Shows morning/afternoon time inputs when multi-shift enabled
 * Timeline dynamically reflects actual shift times
 *
 * Requirements: 1.6
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SHIFT_CONFIG, type ShiftMode } from '../constants/defaults';
import type { ShiftsConfig } from '../types';

interface ShiftConfigurationProps {
  /** Current shift mode */
  shiftMode: ShiftMode;
  /** Shift times configuration (for multi-shift mode) */
  shifts?: ShiftsConfig;
  /** Callback when shift mode changes */
  onShiftModeChange: (mode: ShiftMode) => void;
  /** Callback when shift times change */
  onShiftsChange: (shifts: ShiftsConfig) => void;
  /** Whether the configuration is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Convert time string (HH:MM) to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate duration between two times
 */
function calculateDuration(start: string, end: string): string {
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  const diff = endMins - startMins;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (mins === 0) return `${hours} ساعت`;
  return `${hours} ساعت و ${mins} دقیقه`;
}

/**
 * ShiftConfiguration - Visual shift configuration with dynamic timeline
 */
export function ShiftConfiguration({
  shiftMode,
  shifts,
  onShiftModeChange,
  onShiftsChange,
  disabled = false,
  className,
}: ShiftConfigurationProps) {
  const { t } = useTranslation();
  const isMultiShift = shiftMode === 'multi';

  // Use default shift config if not provided
  const currentShifts = shifts || DEFAULT_SHIFT_CONFIG;

  // Calculate timeline percentages based on actual times
  const timelineData = useMemo(() => {
    const dayStart = 6 * 60; // 6:00 AM
    const dayEnd = 20 * 60; // 8:00 PM
    const totalMinutes = dayEnd - dayStart;

    const morningStart = timeToMinutes(currentShifts.morning.start);
    const morningEnd = timeToMinutes(currentShifts.morning.end);
    const afternoonStart = timeToMinutes(currentShifts.afternoon.start);
    const afternoonEnd = timeToMinutes(currentShifts.afternoon.end);

    return {
      morningLeft: ((morningStart - dayStart) / totalMinutes) * 100,
      morningWidth: ((morningEnd - morningStart) / totalMinutes) * 100,
      breakWidth: ((afternoonStart - morningEnd) / totalMinutes) * 100,
      afternoonLeft: ((afternoonStart - dayStart) / totalMinutes) * 100,
      afternoonWidth: ((afternoonEnd - afternoonStart) / totalMinutes) * 100,
      morningDuration: calculateDuration(currentShifts.morning.start, currentShifts.morning.end),
      afternoonDuration: calculateDuration(
        currentShifts.afternoon.start,
        currentShifts.afternoon.end
      ),
      breakDuration: calculateDuration(currentShifts.morning.end, currentShifts.afternoon.start),
    };
  }, [currentShifts]);

  // Real-time validation for shift times
  const validationErrors = useMemo(() => {
    if (!isMultiShift) return null;

    const errors: { field: 'morning' | 'afternoon' | 'overlap'; message: string }[] = [];
    const morningStart = timeToMinutes(currentShifts.morning.start);
    const morningEnd = timeToMinutes(currentShifts.morning.end);
    const afternoonStart = timeToMinutes(currentShifts.afternoon.start);
    const afternoonEnd = timeToMinutes(currentShifts.afternoon.end);

    if (morningEnd <= morningStart) {
      errors.push({
        field: 'morning',
        message: t('schoolSettings.validation.morningEndBeforeStart'),
      });
    }
    if (afternoonEnd <= afternoonStart) {
      errors.push({
        field: 'afternoon',
        message: t('schoolSettings.validation.afternoonEndBeforeStart'),
      });
    }
    if (afternoonStart < morningEnd) {
      errors.push({
        field: 'overlap',
        message: t('schoolSettings.validation.shiftsOverlap'),
      });
    }

    return errors.length > 0 ? errors : null;
  }, [isMultiShift, currentShifts, t]);

  const hasMorningError = validationErrors?.some((e) => e.field === 'morning');
  const hasAfternoonError = validationErrors?.some((e) => e.field === 'afternoon');
  const hasOverlapError = validationErrors?.some((e) => e.field === 'overlap');

  const handleModeToggle = (checked: boolean) => {
    const newMode: ShiftMode = checked ? 'multi' : 'single';
    onShiftModeChange(newMode);

    // Initialize shifts config when enabling multi-shift
    if (checked && !shifts) {
      onShiftsChange({ ...DEFAULT_SHIFT_CONFIG });
    }
  };

  const handleShiftTimeChange = (
    shift: 'morning' | 'afternoon',
    field: 'start' | 'end',
    value: string
  ) => {
    onShiftsChange({
      ...currentShifts,
      [shift]: {
        ...currentShifts[shift],
        [field]: value,
      },
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Shift Mode Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-0.5">
            <Label htmlFor="shift-mode-toggle" className="text-base font-semibold">
              {t('schoolSettings.labels.multiShiftMode')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('schoolSettings.labels.multiShiftDesc')}
            </p>
          </div>
        </div>
        <Switch
          id="shift-mode-toggle"
          checked={isMultiShift}
          onCheckedChange={handleModeToggle}
          disabled={disabled}
          aria-label={t('schoolSettings.labels.toggleMultiShift')}
        />
      </div>

      {/* Multi-Shift Configuration */}
      {isMultiShift && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Shift Time Inputs - Cards First */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Morning Shift Card */}
            <div
              className={cn(
                'bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border rounded-xl p-5 transition-colors',
                hasMorningError
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-amber-200 dark:border-amber-800'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                  <Sunrise className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-base font-semibold text-amber-900 dark:text-amber-100">
                    {t('schoolSettings.labels.morningShift')}
                  </Label>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {timelineData.morningDuration}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-amber-700 dark:text-amber-300 mb-1 block">
                    {t('schoolSettings.labels.startTime')}
                  </label>
                  <Input
                    type="time"
                    value={currentShifts.morning.start}
                    onChange={(e) => handleShiftTimeChange('morning', 'start', e.target.value)}
                    disabled={disabled}
                    className="text-center bg-white dark:bg-amber-950/50 border-amber-300 dark:border-amber-700"
                    aria-label={t('schoolSettings.labels.morningStart')}
                  />
                </div>
                <div className="flex items-center justify-center pt-5">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">←</span>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-amber-700 dark:text-amber-300 mb-1 block">
                    {t('schoolSettings.labels.endTime')}
                  </label>
                  <Input
                    type="time"
                    value={currentShifts.morning.end}
                    onChange={(e) => handleShiftTimeChange('morning', 'end', e.target.value)}
                    disabled={disabled}
                    className="text-center bg-white dark:bg-amber-950/50 border-amber-300 dark:border-amber-700"
                    aria-label={t('schoolSettings.labels.morningEnd')}
                  />
                </div>
              </div>
            </div>

            {/* Afternoon Shift Card */}
            <div
              className={cn(
                'bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border rounded-xl p-5 transition-colors',
                hasAfternoonError || hasOverlapError
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-blue-200 dark:border-blue-800'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <Sunset className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                    {t('schoolSettings.labels.afternoonShift')}
                  </Label>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {timelineData.afternoonDuration}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">
                    {t('schoolSettings.labels.startTime')}
                  </label>
                  <Input
                    type="time"
                    value={currentShifts.afternoon.start}
                    onChange={(e) => handleShiftTimeChange('afternoon', 'start', e.target.value)}
                    disabled={disabled}
                    className="text-center bg-white dark:bg-blue-950/50 border-blue-300 dark:border-blue-700"
                    aria-label={t('schoolSettings.labels.afternoonStart')}
                  />
                </div>
                <div className="flex items-center justify-center pt-5">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">←</span>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">
                    {t('schoolSettings.labels.endTime')}
                  </label>
                  <Input
                    type="time"
                    value={currentShifts.afternoon.end}
                    onChange={(e) => handleShiftTimeChange('afternoon', 'end', e.target.value)}
                    disabled={disabled}
                    className="text-center bg-white dark:bg-blue-950/50 border-blue-300 dark:border-blue-700"
                    aria-label={t('schoolSettings.labels.afternoonEnd')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Visual Timeline */}
          <div className="bg-muted/30 rounded-xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {t('schoolSettings.labels.dailySchedulePreview')}
              </span>
            </div>

            {/* Time markers */}
            <div className="flex justify-between mb-2 text-xs text-muted-foreground px-1">
              <span>۰۶:۰۰</span>
              <span>۰۸:۰۰</span>
              <span>۱۰:۰۰</span>
              <span>۱۲:۰۰</span>
              <span>۱۴:۰۰</span>
              <span>۱۶:۰۰</span>
              <span>۱۸:۰۰</span>
              <span>۲۰:۰۰</span>
            </div>

            {/* Timeline Track */}
            <div className="relative h-16 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
              {/* Morning Shift Block */}
              <div
                className="absolute top-2 bottom-2 bg-linear-to-l from-amber-400 to-amber-500 rounded-md flex items-center justify-center gap-2 text-white text-sm font-medium shadow-md transition-all duration-300"
                style={{
                  right: `${timelineData.morningLeft}%`,
                  width: `${timelineData.morningWidth}%`,
                }}
              >
                <Sun className="w-4 h-4" />
                <span className="hidden sm:inline">{t('schoolSettings.labels.morningShift')}</span>
              </div>

              {/* Break indicator */}
              {timelineData.breakWidth > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{
                    right: `${timelineData.morningLeft + timelineData.morningWidth}%`,
                    width: `${timelineData.breakWidth}%`,
                  }}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-300 dark:bg-slate-700 px-2 py-1 rounded">
                    {t('schoolSettings.labels.break')}
                  </span>
                </div>
              )}

              {/* Afternoon Shift Block */}
              <div
                className="absolute top-2 bottom-2 bg-linear-to-l from-blue-500 to-blue-600 rounded-md flex items-center justify-center gap-2 text-white text-sm font-medium shadow-md transition-all duration-300"
                style={{
                  right: `${timelineData.afternoonLeft}%`,
                  width: `${timelineData.afternoonWidth}%`,
                }}
              >
                <Moon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t('schoolSettings.labels.afternoonShift')}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-linear-to-l from-amber-400 to-amber-500" />
                <span className="text-muted-foreground">
                  {currentShifts.morning.start} - {currentShifts.morning.end}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-linear-to-l from-blue-500 to-blue-600" />
                <span className="text-muted-foreground">
                  {currentShifts.afternoon.start} - {currentShifts.afternoon.end}
                </span>
              </div>
            </div>
          </div>

          {/* Validation Errors Display */}
          {validationErrors && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-full shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-1">
                  {validationErrors.map((error, i) => (
                    <p key={i} className="text-sm text-red-700 dark:text-red-300">
                      {error.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
