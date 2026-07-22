/**
 * ScheduleCard Component
 * Card displaying saved schedule with hover actions
 *
 * Features:
 * - Display schedule name (truncated), date (Persian format), class count
 * - Hover lift animation
 * - Show Load and Delete buttons on hover with fade-in
 * - Delete animation (scale-down and fade)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 9.5
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocalizedDate } from '@/components/ui/LocalizedDate';
import type { TimetableApiResponse } from '@/features/schedule/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  GraduationCap,
  Gauge,
  Loader2,
  Play,
  Trash2,
  WandSparkles,
} from 'lucide-react';

/**
 * Props for ScheduleCard component
 */
export interface ScheduleCardProps {
  /** Schedule data to display */
  schedule: TimetableApiResponse;
  /** Callback when Load action is clicked */
  onLoad: () => void;
  /** Callback when Delete action is clicked */
  onDelete: () => void;
  /** Run a separate improvement job without changing this timetable. */
  onImprove?: () => void;
  isImproving?: boolean;
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
}

/**
 * Truncate text with ellipsis if exceeds max length
 */
function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Extract class count from schedule data
 */
function getClassCount(schedule: TimetableApiResponse): number {
  if (schedule.classCount !== undefined) return schedule.classCount;
  try {
    if (!schedule.data) return 0;
    const data = typeof schedule.data === 'string' ? JSON.parse(schedule.data) : schedule.data;
    if (data.statistics?.totalClasses) {
      return data.statistics.totalClasses;
    }
    if (data.metadata?.classes?.length) {
      return data.metadata.classes.length;
    }
    if (data.lessons?.length) {
      const uniqueClasses = new Set(data.lessons.map((l: { classId: string }) => l.classId));
      return uniqueClasses.size;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * ScheduleCard component for displaying saved schedules
 *
 * Shows schedule name, creation date, and class count.
 * Reveals Load and Delete actions on hover with smooth animations.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 9.5
 */
export function ScheduleCard({
  schedule,
  onLoad,
  onDelete,
  onImprove,
  isImproving = false,
  isDeleting = false,
}: ScheduleCardProps) {
  const classCount = getClassCount(schedule);

  return (
    <motion.div
      layout
      initial={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="h-full"
      >
        <Card
          className={cn(
            'relative flex min-h-[210px] h-full flex-col overflow-hidden rounded-2xl border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 sm:p-5',
            'hover:border-primary/25 hover:shadow-[0_16px_35px_-24px_rgba(0,51,102,0.55)]',
            isDeleting && 'opacity-50 pointer-events-none'
          )}
        >
          {/* Main content */}
          <div className="flex flex-1 flex-col">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 min-w-0 font-bold leading-6 text-slate-900" title={schedule.name}>
                {truncateText(schedule.name)}
              </h3>
              {!schedule.isStale ? (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  معتبر
                </span>
              ) : null}
            </div>
            {schedule.isStale && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200" title={schedule.staleReason ?? undefined}>
                <AlertTriangle className="h-3 w-3" />
                نیاز به تولید دوباره
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <LocalizedDate
                  value={schedule.createdAt}
                  className="min-w-0"
                  options={{ year: 'numeric', month: 'short', day: 'numeric' }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                <span>{classCount} صنف</span>
              </div>
              {schedule.qualityScore !== null && schedule.qualityScore !== undefined ? (
                <div className="col-span-2 flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  <span>کیفیت جدول</span>
                  <span className="font-bold text-primary">{Math.round(schedule.qualityScore)} از ۱۰۰</span>
                </div>
              ) : null}
            </div>
          </div>

          {!isDeleting ? (
              <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-slate-100 pt-3">
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoad();
                  }}
                  className="h-9 gap-1.5 rounded-lg bg-primary shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  بارگذاری
                </Button>
                {onImprove ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      onImprove();
                    }}
                    disabled={isImproving}
                    className="h-9 gap-1.5 rounded-lg border-slate-200 px-3"
                    title="بهبود جداگانه این جدول"
                  >
                    {isImproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <WandSparkles className="h-4 w-4" />
                    )}
                    بهبود
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="h-9 w-9 rounded-lg bg-red-50 p-0 text-red-600 shadow-none hover:bg-red-100"
                  aria-label="حذف جدول"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
          ) : null}

          {/* Deleting overlay */}
          {isDeleting && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
