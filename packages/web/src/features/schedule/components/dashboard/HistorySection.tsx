/**
 * HistorySection Component
 * Section displaying saved schedules with header and actions
 *
 * Features:
 * - Header with "جدول‌های قبلی" title and count
 * - "مشاهده همه" button when > 4 schedules
 * - Empty state when no schedules
 *
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { Button } from '@/components/ui/button';
import type { TimetableApiResponse } from '@/features/schedule/types';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { useState } from 'react';
import { EmptyHistoryState } from './EmptyHistoryState';
import { ScheduleCardList } from './ScheduleCardList';

/**
 * Props for HistorySection component
 */
export interface HistorySectionProps {
  /** Array of schedules to display */
  schedules: TimetableApiResponse[];
  /** Whether schedules are loading */
  isLoading?: boolean;
  /** Callback when a schedule's Load action is clicked */
  onLoad: (schedule: TimetableApiResponse) => void;
  /** Callback when a schedule's Delete action is clicked */
  onDelete: (schedule: TimetableApiResponse) => void;
  /** ID of schedule currently being deleted */
  deletingId?: number | null;
}

/** Maximum schedules to show before showing "View All" button */
const MAX_VISIBLE_SCHEDULES = 4;

/**
 * HistorySection component for displaying saved schedules
 *
 * Shows a header with title and count, schedule cards in a horizontal row,
 * and a "View All" button when there are more than 4 schedules.
 *
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */
export function HistorySection({
  schedules,
  isLoading = false,
  onLoad,
  onDelete,
  deletingId = null,
}: HistorySectionProps) {
  const hasSchedules = schedules.length > 0;
  const [showAll, setShowAll] = useState(false);
  const canToggle = schedules.length > MAX_VISIBLE_SCHEDULES;

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[220px] h-[140px] bg-muted animate-pulse rounded-lg shrink-0"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">جدول‌های قبلی</h2>
          {hasSchedules && (
            <span className="text-sm text-muted-foreground">({schedules.length})</span>
          )}
        </div>

        {/* View All button */}
        {canToggle && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)} className="gap-1">
            {showAll ? 'نمایش کمتر' : 'مشاهده همه'}
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {/* Content */}
      {hasSchedules ? (
        <ScheduleCardList
          schedules={schedules}
          onLoad={onLoad}
          onDelete={onDelete}
          deletingId={deletingId}
          maxItems={showAll ? undefined : MAX_VISIBLE_SCHEDULES}
        />
      ) : (
        <EmptyHistoryState />
      )}
    </motion.section>
  );
}
