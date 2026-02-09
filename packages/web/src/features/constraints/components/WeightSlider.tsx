/**
 * WeightSlider Component
 * A slider for adjusting optimization weights (0-2 range)
 * with visual feedback and tooltip
 */

import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface WeightSliderProps {
  label: string;
  description: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Get color class based on weight value
 */
function getWeightColor(value: number): string {
  if (value === 0) return 'bg-muted';
  if (value < 0.5) return 'bg-blue-300';
  if (value < 1) return 'bg-blue-400';
  if (value < 1.5) return 'bg-blue-500';
  return 'bg-blue-600';
}

/**
 * Get label for weight value
 */
function getWeightLabel(value: number, t: (key: string) => string): string {
  if (value === 0) return t('constraints.weightLabels.disabled');
  if (value < 0.5) return t('constraints.weightLabels.veryLow');
  if (value < 1) return t('constraints.weightLabels.low');
  if (value < 1.5) return t('constraints.weightLabels.medium');
  if (value < 2) return t('constraints.weightLabels.high');
  return t('constraints.weightLabels.veryHigh');
}

export function WeightSlider({
  label,
  description,
  tooltip,
  value,
  onChange,
  disabled = false,
}: WeightSliderProps) {
  const id = useId();
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('constraints.tooltipLabel')}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-sm">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-sm text-muted-foreground">{getWeightLabel(value, t)}</span>
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-muted',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary',
            '[&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        <div
          className={cn(
            'w-12 h-6 rounded flex items-center justify-center text-xs font-medium',
            getWeightColor(value),
            value > 0 ? 'text-white' : 'text-muted-foreground'
          )}
        >
          {value.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
