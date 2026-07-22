/**
 * SuccessState Component
 * Displays success animation and quality score after generation
 *
 * Features:
 * - Display checkmark animation
 * - Show quality score with color coding
 * - Auto-transition after 2 seconds
 *
 * Requirements: 5.7, 5.9, 13.1, 13.2
 */

import { cn } from '@/lib/utils';
import type { QualityScore } from '@/types/solver';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Get background class based on quality score
 */
function getQualityBgClass(score: number): string {
  if (score >= 80) return 'bg-green-50';
  if (score >= 60) return 'bg-blue-50';
  if (score >= 40) return 'bg-yellow-50';
  return 'bg-red-50';
}

/**
 * Get text color class based on quality score
 */
function getQualityColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Props for SuccessState component
 */
export interface SuccessStateProps {
  /** Quality score from solver */
  qualityScore: QualityScore | null;
  /** Callback when auto-transition should occur */
  onTransition?: () => void;
  /** Auto-transition delay in milliseconds (default: 2000) */
  transitionDelay?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get quality label in Persian based on score
 */
function getQualityLabel(score: number): string {
  if (score >= 80) return 'عالی';
  if (score >= 60) return 'خوب';
  if (score >= 40) return 'متوسط';
  return 'نیاز به بهبود';
}

/**
 * SuccessState component for displaying generation success
 *
 * Shows an animated checkmark and the quality score with
 * appropriate color coding. Auto-transitions after a delay.
 *
 * Requirements: 5.7, 5.9, 13.1, 13.2
 */
export function SuccessState({
  qualityScore,
  onTransition,
  transitionDelay = 2000,
  className,
}: SuccessStateProps) {
  const score = qualityScore?.overall ?? 0;

  // Auto-transition after delay (Requirement: 5.9)
  useEffect(() => {
    if (onTransition) {
      const timer = setTimeout(() => {
        onTransition();
      }, transitionDelay);
      return () => clearTimeout(timer);
    }
  }, [onTransition, transitionDelay]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'w-full rounded-2xl border border-emerald-200/80 bg-linear-to-l from-emerald-50 via-white to-white p-5 shadow-sm sm:p-6',
        className
      )}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between sm:text-start">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Animated checkmark (Requirement: 5.7) */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className="relative"
          >
            {/* Success ring animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
              }}
              className="absolute inset-0 rounded-full bg-green-500/30"
            />
            {/* Checkmark container */}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Check className="h-8 w-8 text-green-600" strokeWidth={3} />
              </motion.div>
            </div>
          </motion.div>

          {/* Success message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-1 text-center sm:text-start"
          >
            <h3 className="text-xl font-bold text-green-700">جدول زمانی با موفقیت تولید شد</h3>
            <p className="text-sm text-muted-foreground">جدول زمانی جدید ذخیره شد</p>
            <p className="text-xs text-muted-foreground">در حال انتقال به صفحهٔ جدول...</p>
          </motion.div>
        </div>

          {/* Quality score display (Requirements: 13.1, 13.2) */}
          {qualityScore && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn('min-w-40 rounded-2xl px-6 py-3 text-center', getQualityBgClass(score))}
            >
              <p className="text-sm text-muted-foreground mb-1">کیفیت جدول</p>
              <div className="flex items-baseline gap-2 justify-center">
                <span
                  className={cn('text-3xl font-bold tabular-nums', getQualityColorClass(score))}
                >
                  {score}
                </span>
                <span className="text-lg text-muted-foreground">/ ۱۰۰</span>
              </div>
              <p className={cn('text-sm font-medium mt-1', getQualityColorClass(score))}>
                {getQualityLabel(score)}
              </p>
            </motion.div>
          )}

      </div>
    </motion.div>
  );
}
