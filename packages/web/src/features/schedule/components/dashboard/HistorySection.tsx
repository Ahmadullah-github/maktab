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
  onImprove?: (schedule: TimetableApiResponse) => void;
  improvingSourceId?: number | null;
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
  onImprove,
  improvingSourceId = null,
  deletingId = null,
}: HistorySectionProps) {
  const hasSchedules = schedules.length > 0;
  const [showAll, setShowAll] = useState(false);
  const canToggle = schedules.length > MAX_VISIBLE_SCHEDULES;

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="space-y-5 rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[210px] animate-pulse rounded-2xl bg-muted"
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
      className="space-y-5 rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-sm backdrop-blur-sm sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">جدول‌های ذخیره‌شده</h2>
              {hasSchedules ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {schedules.length}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              جدول را باز کنید یا نسخهٔ بهتری از آن بسازید
            </p>
          </div>
        </div>

        {/* View All button */}
        {canToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((value) => !value)}
            className="gap-1 rounded-lg text-primary"
          >
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
          onImprove={onImprove}
          improvingSourceId={improvingSourceId}
          deletingId={deletingId}
          maxItems={showAll ? undefined : MAX_VISIBLE_SCHEDULES}
        />
      ) : (
        <EmptyHistoryState />
      )}
    </motion.section>
  );
}
