/**
 * ProgressView Component
 * Displays generation progress with elapsed time and status
 *
 * Features:
 * - Display selected strategy icon and name
 * - Show elapsed time counter (updating every second)
 * - Show animated spinner/pulse indicator
 * - Display phase text "در حال تولید جدول زمانی..."
 * - Show Cancel button
 * - Implement fade transition on mount
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.3
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STRATEGY_CONFIG } from '@/types/strategy';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, X } from 'lucide-react';

/**
 * Props for ProgressView component
 */
export interface ProgressViewProps {
  /** Currently selected strategy */
  strategy: string | null;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Localized phase text from server */
  phaseText?: string;
  /** Determinate progress percentage when available */
  percentComplete?: number;
  /** Estimated seconds remaining when available */
  estimatedSecondsRemaining?: number;
  /** Whether cancel is still allowed */
  canCancel?: boolean;
  /** Callback to cancel generation */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format elapsed time as Persian string
 * Shows minutes and seconds when over 60 seconds
 */
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ثانیه`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} دقیقه و ${remainingSeconds} ثانیه`;
}

function formatRemainingTime(seconds?: number): string | null {
  if (seconds === undefined || Number.isNaN(seconds)) {
    return null;
  }

  if (seconds < 60) {
    return `${seconds} ثانیه باقی مانده`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} دقیقه و ${remainingSeconds} ثانیه باقی مانده`;
}

/**
 * ProgressView component for displaying generation progress
 *
 * Shows the selected strategy, elapsed time, and a cancel button
 * during schedule generation. Uses Framer Motion for smooth
 * fade-in animation on mount.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.3
 */
export function ProgressView({
  strategy,
  elapsedTime,
  isGenerating,
  phaseText,
  percentComplete,
  estimatedSecondsRemaining,
  canCancel = true,
  onCancel,
  className,
}: ProgressViewProps) {
  const config =
    strategy && strategy in STRATEGY_CONFIG
      ? STRATEGY_CONFIG[strategy as keyof typeof STRATEGY_CONFIG]
      : null;
  const Icon = config?.icon || Sparkles;
  const progressValue =
    typeof percentComplete === 'number' && Number.isFinite(percentComplete)
      ? Math.max(0, Math.min(100, percentComplete))
      : undefined;
  const remainingText = formatRemainingTime(estimatedSecondsRemaining);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('w-full', className)}
    >
      <Card className="p-8 bg-linear-to-br from-primary/5 via-background to-primary/10">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Strategy icon with pulse animation */}
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative"
          >
            {/* Outer pulse ring */}
            <motion.div
              animate={{
                scale: [1, 1.5],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full bg-primary/20"
            />
            {/* Icon container */}
            <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-10 h-10 text-primary" />
            </div>
          </motion.div>

          {/* Strategy name (Requirement: 5.2) */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              استراتژی {config?.labelFa || 'در حال اجرا'}
            </h3>
            <p className="text-sm text-muted-foreground">
              زمان تخمینی: {config?.estimatedTimeFa || 'در حال محاسبه...'}
            </p>
          </div>

          {/* Phase text with spinner (Requirements: 5.4, 5.5) */}
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-base font-medium">
              {phaseText || 'در حال تولید جدول زمانی...'}
            </span>
          </div>

          {/* Elapsed time counter (Requirement: 5.3) */}
          <div className="bg-muted/50 rounded-lg px-6 py-3 space-y-1">
            <p className="text-sm text-muted-foreground mb-1">زمان سپری شده</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatElapsedTime(elapsedTime)}
            </p>
            {remainingText && <p className="text-sm text-muted-foreground">{remainingText}</p>}
          </div>

          {/* Progress bar animation */}
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              {progressValue === undefined ? (
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ width: '30%' }}
                />
              ) : (
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressValue}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              )}
            </div>
            {progressValue !== undefined && (
              <p className="mt-2 text-sm text-muted-foreground text-center">
                {progressValue}% تکمیل شده
              </p>
            )}
          </div>

          {/* Cancel button (Requirement: 5.6) */}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={!isGenerating || !canCancel}
            className="mt-4"
          >
            <X className="w-4 h-4 me-2" />
            {canCancel ? 'لغو' : 'در حال نهایی‌سازی'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
