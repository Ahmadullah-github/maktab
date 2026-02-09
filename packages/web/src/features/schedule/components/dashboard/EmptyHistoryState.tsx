/**
 * EmptyHistoryState Component
 * Empty state display when no schedules exist
 *
 * Features:
 * - Message encouraging first generation
 * - Subtle styling
 *
 * Requirements: 6.5
 */

import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

/**
 * Props for EmptyHistoryState component
 */
export interface EmptyHistoryStateProps {
  /** Optional custom message */
  message?: string;
}

/**
 * EmptyHistoryState component for displaying when no schedules exist
 *
 * Shows a subtle message encouraging the user to generate their first schedule.
 *
 * Requirements: 6.5
 */
export function EmptyHistoryState({
  message = 'هنوز جدول زمانی ذخیره نشده است. اولین جدول زمانی خود را تولید کنید!',
}: EmptyHistoryStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <CalendarDays className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </motion.div>
  );
}
