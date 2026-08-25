/**
 * SizeSelector component for cell and font size settings
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CellSize, FontSize } from '../../types';

interface SizeSelectorProps {
  cellSize: CellSize;
  fontSize: FontSize;
  onCellSizeChange: (value: CellSize) => void;
  onFontSizeChange: (value: FontSize) => void;
}

const CELL_SIZE_OPTIONS = [
  { value: 'compact' as const, label: 'فشرده' },
  { value: 'normal' as const, label: 'معمولی' },
  { value: 'large' as const, label: 'بزرگ' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'sm' as const, label: 'کوچک' },
  { value: 'md' as const, label: 'متوسط' },
  { value: 'lg' as const, label: 'بزرگ' },
];

export function SizeSelector({
  cellSize,
  fontSize,
  onCellSizeChange,
  onFontSizeChange,
}: SizeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cell-size" className="text-sm font-medium">
          اندازه سلول
        </Label>
        <Select value={cellSize} onValueChange={onCellSizeChange}>
          <SelectTrigger id="cell-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CELL_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="font-size" className="text-sm font-medium">
          اندازه فونت
        </Label>
        <Select value={fontSize} onValueChange={onFontSizeChange}>
          <SelectTrigger id="font-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
