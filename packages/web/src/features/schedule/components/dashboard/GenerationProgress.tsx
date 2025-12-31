/**
 * GenerationProgress Component
 * Progress indicator during schedule generation.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { STRATEGY_OPTIONS, type GenerationError, type SolverStrategy } from '../../types';

export interface GenerationProgressProps {
  isGenerating: boolean;
  elapsedTime: number;
  strategy: SolverStrategy;
  error?: GenerationError | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function GenerationProgress({
  isGenerating,
  elapsedTime,
  strategy,
  error,
  onRetry,
  onCancel,
}: GenerationProgressProps) {
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStrategyName = (strategyValue: SolverStrategy): string => {
    const option = STRATEGY_OPTIONS.find((opt) => opt.value === strategyValue);
    return option?.labelFa ?? strategyValue;
  };

  if (error) {
    const showRetry = error.type !== 'SOLVER_BUSY';

    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">{error.messageFa}</p>
        </div>
        <div className="flex gap-2">
          {showRetry && onRetry && <Button onClick={onRetry}>تلاش مجدد</Button>}
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              بستن
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!isGenerating) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-lg font-medium">در حال تولید جدول زمانی...</p>
        <p className="text-sm text-muted-foreground">استراتژی: {getStrategyName(strategy)}</p>
        <p className="mt-2 text-2xl font-mono">{formatElapsedTime(elapsedTime)}</p>
      </div>
      {onCancel && (
        <Button variant="outline" onClick={onCancel}>
          انصراف
        </Button>
      )}
    </div>
  );
}
