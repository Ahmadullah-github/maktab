/**
 * EncouragementEmptyState Component
 * Empty state display when data exists but no schedules have been generated
 *
 * Features:
 * - Encouraging message to generate first schedule
 * - Visual indicator that system is ready
 *
 * Requirements: 8.5
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CalendarPlus, CheckCircle2, Sparkles } from 'lucide-react';

/**
 * Props for EncouragementEmptyState component
 */
export interface EncouragementEmptyStateProps {
  /** Callback when generate button is clicked */
  onGenerateClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EncouragementEmptyState component
 *
 * Displays an encouraging message when the user has entered all required data
 * but hasn't generated their first schedule yet.
 *
 * Requirements: 8.5
 */
export function EncouragementEmptyState({
  onGenerateClick,
  className,
}: EncouragementEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6',
        'bg-gradient-to-b from-green-50/50 to-white rounded-xl border border-green-200/50',
        className
      )}
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CalendarPlus className="w-8 h-8 text-green-600" />
        </div>
        <div className="absolute -top-1 -end-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      </motion.div>

      {/* Encouragement Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="text-center mb-6"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2">همه چیز آماده است!</h2>
        <p className="text-muted-foreground max-w-md">
          اطلاعات مکتب شما کامل شده است. اکنون می‌توانید اولین جدول زمانی خود را تولید کنید.
        </p>
      </motion.div>

      {/* Generate Button */}
      {onGenerateClick && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Button
            size="lg"
            onClick={onGenerateClick}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Sparkles className="w-5 h-5" />
            تولید اولین جدول زمانی
          </Button>
        </motion.div>
      )}

      {/* Hint text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="text-xs text-muted-foreground mt-4"
      >
        یا از بخش بالا استراتژی مورد نظر خود را انتخاب کنید
      </motion.p>
    </motion.div>
  );
}
