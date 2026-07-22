/**
 * ScheduleCardList Component
 * Horizontal scrollable row of ScheduleCards with staggered animations
 *
 * Features:
 * - Horizontal scrollable row of ScheduleCards
 * - Sort by creation date (newest first)
 * - Staggered entrance animation
 *
 * Requirements: 6.3, 6.6, 9.4
 */

import type { TimetableApiResponse } from '@/features/schedule/types';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useMemo } from 'react';
import { ScheduleCard } from './ScheduleCard';

/**
 * Props for ScheduleCardList component
 */
export interface ScheduleCardListProps {
  /** Array of schedules to display */
  schedules: TimetableApiResponse[];
  /** Callback when a schedule's Load action is clicked */
  onLoad: (schedule: TimetableApiResponse) => void;
  /** Callback when a schedule's Delete action is clicked */
  onDelete: (schedule: TimetableApiResponse) => void;
  onImprove?: (schedule: TimetableApiResponse) => void;
  improvingSourceId?: number | null;
  /** ID of schedule currently being deleted */
  deletingId?: number | null;
  /** Maximum number of schedules to display (optional) */
  maxItems?: number;
}

/**
 * Animation variants for staggered entrance
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
} satisfies Variants;

/**
 * ScheduleCardList component for displaying schedules in a horizontal row
 *
 * Sorts schedules by creation date (newest first) and renders them
 * with staggered entrance animations.
 *
 * Requirements: 6.3, 6.6, 9.4
 */
export function ScheduleCardList({
  schedules,
  onLoad,
  onDelete,
  onImprove,
  improvingSourceId = null,
  deletingId = null,
  maxItems,
}: ScheduleCardListProps) {
  // Sort schedules by creation date (newest first)
  const sortedSchedules = useMemo(() => {
    const sorted = [...schedules].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
    // Apply maxItems limit if specified
    return maxItems ? sorted.slice(0, maxItems) : sorted;
  }, [schedules, maxItems]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <AnimatePresence mode="popLayout">
        {sortedSchedules.map((schedule) => (
          <motion.div key={schedule.id} variants={itemVariants} layout className="min-w-0">
            <ScheduleCard
              schedule={schedule}
              onLoad={() => onLoad(schedule)}
              onDelete={() => onDelete(schedule)}
              onImprove={onImprove ? () => onImprove(schedule) : undefined}
              isImproving={improvingSourceId === schedule.id}
              isDeleting={deletingId === schedule.id}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
