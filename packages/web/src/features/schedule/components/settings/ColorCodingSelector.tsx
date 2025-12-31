/**
 * ColorCodingSelector component for color coding options
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ColorCodingMode } from '../../types';

interface ColorCodingSelectorProps {
  colorBy: ColorCodingMode;
  onColorByChange: (value: ColorCodingMode) => void;
}

const COLOR_CODING_OPTIONS = [
  { value: 'none' as const, label: 'بدون رنگ' },
  { value: 'subject' as const, label: 'بر اساس درس' },
  { value: 'teacher' as const, label: 'بر اساس استاد' },
];

export function ColorCodingSelector({ colorBy, onColorByChange }: ColorCodingSelectorProps) {
  return (
    <div className="space-y-3">
      <RadioGroup
        value={colorBy}
        onValueChange={onColorByChange}
        className="flex flex-col space-y-2"
      >
        {COLOR_CODING_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
            <RadioGroupItem value={option.value} id={`color-${option.value}`} />
            <Label htmlFor={`color-${option.value}`} className="text-sm font-medium cursor-pointer">
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
