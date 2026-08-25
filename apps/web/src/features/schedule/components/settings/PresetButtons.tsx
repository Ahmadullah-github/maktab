/**
 * PresetButtons component for quick preset configurations
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Button } from '@/components/ui/button';
import { DISPLAY_PRESETS } from '../../constants';
import type { DisplayPreset } from '../../types';

interface PresetButtonsProps {
  onApplyPreset: (preset: DisplayPreset) => void;
}

export function PresetButtons({ onApplyPreset }: PresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISPLAY_PRESETS.map((preset) => (
        <Button
          key={preset.key}
          variant="outline"
          size="sm"
          onClick={() => onApplyPreset(preset)}
          className="text-sm"
        >
          {preset.labelFa}
        </Button>
      ))}
    </div>
  );
}
