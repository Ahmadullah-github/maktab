/**
 * ShiftConfiguration Component
 *
 * Renders single/multi-shift toggle
 * Shows morning/afternoon time inputs when multi-shift enabled
 *
 * Requirements: 1.6
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
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
 * ShiftConfiguration - Toggle and time inputs for shift settings
 *
 * Single shift: Only toggle shown
 * Multi shift: Shows morning and afternoon time inputs
 *
 * Requirements: 1.6
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
    <div className={cn('space-y-4', className)}>
      {/* Shift Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="shift-mode-toggle">{t('schoolSettings.labels.shiftMode')}</Label>
          <p className="text-sm text-muted-foreground">
            {isMultiShift
              ? t('schoolSettings.labels.multiShift')
              : t('schoolSettings.labels.singleShift')}
          </p>
        </div>
        <Switch
          id="shift-mode-toggle"
          checked={isMultiShift}
          onCheckedChange={handleModeToggle}
          disabled={disabled}
          aria-label="Toggle multi-shift mode"
        />
      </div>

      {/* Multi-Shift Time Inputs */}
      {isMultiShift && (
        <div className="space-y-4 rounded-lg border p-4">
          {/* Morning Shift */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('schoolSettings.labels.morningShift')}</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="morning-start" className="text-sm text-muted-foreground">
                  {t('schoolSettings.labels.shiftStart')}
                </Label>
                <Input
                  id="morning-start"
                  type="time"
                  value={currentShifts.morning.start}
                  onChange={(e) => handleShiftTimeChange('morning', 'start', e.target.value)}
                  disabled={disabled}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="morning-end" className="text-sm text-muted-foreground">
                  {t('schoolSettings.labels.shiftEnd')}
                </Label>
                <Input
                  id="morning-end"
                  type="time"
                  value={currentShifts.morning.end}
                  onChange={(e) => handleShiftTimeChange('morning', 'end', e.target.value)}
                  disabled={disabled}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          {/* Afternoon Shift */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('schoolSettings.labels.afternoonShift')}
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="afternoon-start" className="text-sm text-muted-foreground">
                  {t('schoolSettings.labels.shiftStart')}
                </Label>
                <Input
                  id="afternoon-start"
                  type="time"
                  value={currentShifts.afternoon.start}
                  onChange={(e) => handleShiftTimeChange('afternoon', 'start', e.target.value)}
                  disabled={disabled}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="afternoon-end" className="text-sm text-muted-foreground">
                  {t('schoolSettings.labels.shiftEnd')}
                </Label>
                <Input
                  id="afternoon-end"
                  type="time"
                  value={currentShifts.afternoon.end}
                  onChange={(e) => handleShiftTimeChange('afternoon', 'end', e.target.value)}
                  disabled={disabled}
                  className="w-28"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
