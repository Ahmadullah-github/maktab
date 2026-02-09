/**
 * GenerateButton Component
 * Button with dialog for strategy selection and generation trigger.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useGenerateSchedule } from '../../hooks';
import { STRATEGY_OPTIONS, type SolverStrategy } from '../../types';
import { GenerationProgress } from './GenerationProgress';

export interface GenerateButtonProps {
  /** Callback when generation completes successfully */
  onGenerateComplete?: () => void;
  /** Whether the button should be disabled */
  disabled?: boolean;
}

/**
 * GenerateButton component
 *
 * Displays a button that opens a dialog for strategy selection.
 * Shows GenerationProgress during generation and handles success/error states.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */
export function GenerateButton({ onGenerateComplete, disabled = false }: GenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<SolverStrategy>('balanced');

  const { generate, isGenerating, elapsedTime, error, reset, isLoadingInputData } =
    useGenerateSchedule();

  /**
   * Handle dialog close - reset state when closing
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && !isGenerating) {
        // Reset state when closing dialog (only if not generating)
        reset();
        setSelectedStrategy('balanced');
      }
      setOpen(newOpen);
    },
    [isGenerating, reset]
  );

  /**
   * Handle confirm button click - start generation
   * Requirements: 3.4, 3.5
   */
  const handleConfirm = useCallback(() => {
    generate(selectedStrategy);
  }, [generate, selectedStrategy]);

  /**
   * Handle retry button click in GenerationProgress
   */
  const handleRetry = useCallback(() => {
    reset();
    generate(selectedStrategy);
  }, [generate, reset, selectedStrategy]);

  /**
   * Handle cancel button click in GenerationProgress
   */
  const handleCancel = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  /**
   * Close dialog on successful generation
   * Requirements: 3.7
   */
  useEffect(() => {
    // When generation completes successfully (not generating, no error, and was generating before)
    if (!isGenerating && !error && elapsedTime > 0) {
      // Small delay to allow toast to show
      const timer = setTimeout(() => {
        setOpen(false);
        reset();
        onGenerateComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, error, elapsedTime, onGenerateComplete, reset]);

  // Determine if we should show the progress view
  const showProgress = isGenerating || error;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={disabled || isGenerating || isLoadingInputData}>
          <Play className="me-2 h-4 w-4" />
          تولید جدول زمانی
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تولید جدول زمانی جدید</DialogTitle>
          <DialogDescription>
            استراتژی مورد نظر برای تولید جدول زمانی را انتخاب کنید
          </DialogDescription>
        </DialogHeader>

        {showProgress ? (
          <GenerationProgress
            isGenerating={isGenerating}
            elapsedTime={elapsedTime}
            strategy={selectedStrategy}
            error={error}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <div className="py-4">
              <Label htmlFor="strategy-select" className="mb-2 block">
                استراتژی تولید
              </Label>
              <Select
                value={selectedStrategy}
                onValueChange={(value: string) => setSelectedStrategy(value as SolverStrategy)}
              >
                <SelectTrigger id="strategy-select" className="w-full">
                  <SelectValue placeholder="انتخاب استراتژی" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.labelFa}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.estimatedTimeFa}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Strategy description */}
              <div className="mt-4 rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  {selectedStrategy === 'fast' &&
                    'تولید سریع با کیفیت صنف - مناسب برای پیش‌نمایش سریع'}
                  {selectedStrategy === 'balanced' &&
                    'تعادل بین سرعت و کیفیت - مناسب برای اکثر مدارس'}
                  {selectedStrategy === 'thorough' &&
                    'بهترین کیفیت با زمان بیشتر - مناسب برای مدارس بزرگ'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                انصراف
              </Button>
              <Button onClick={handleConfirm} disabled={isLoadingInputData}>
                {isLoadingInputData ? 'در حال بارگذاری...' : 'شروع تولید'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
