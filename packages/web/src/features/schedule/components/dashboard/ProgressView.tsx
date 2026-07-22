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
      className={cn(
        'w-full rounded-2xl border border-slate-200/90 bg-white/75 p-5 shadow-sm backdrop-blur-sm sm:p-6',
        className
      )}
    >
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:gap-10">
        <div className="flex items-center gap-5 text-start">
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
            className="relative shrink-0"
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
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </motion.div>

          <div className="min-w-0 space-y-2">
            <h3 className="text-xl font-bold text-slate-950">
              استراتژی {config?.labelFa || 'در حال اجرا'}
            </h3>
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="font-medium">
              {phaseText || 'در حال تولید جدول زمانی...'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              زمان تخمینی: {config?.estimatedTimeFa || 'در حال محاسبه...'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">زمان سپری‌شده</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">
                {formatElapsedTime(elapsedTime)}
              </p>
            </div>
            {remainingText ? <p className="text-xs text-muted-foreground">{remainingText}</p> : null}
          </div>

          {/* Progress bar animation */}
          <div className="w-full">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
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
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {progressValue}% تکمیل شده
              </p>
            )}
          </div>

          {/* Cancel button (Requirement: 5.6) */}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={!isGenerating || !canCancel}
            size="sm"
            className="mt-4 rounded-lg border-slate-200 bg-white"
          >
            <X className="h-4 w-4" />
            {canCancel ? 'لغو' : 'در حال نهایی‌سازی'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
