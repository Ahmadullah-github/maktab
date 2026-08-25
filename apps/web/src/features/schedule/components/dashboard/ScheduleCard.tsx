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
import type { TimetableApiResponse } from '@/features/schedule/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, GraduationCap, Loader2, Play, Trash2 } from 'lucide-react';

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
  /** Whether delete operation is in progress */
  isDeleting?: boolean;
}

/**
 * Format date to Persian locale
 */
function formatPersianDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
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
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Card
          className={cn(
            'relative w-[220px] min-h-[168px] p-4 transition-shadow duration-200',
            'hover:shadow-lg',
            isDeleting && 'opacity-50 pointer-events-none'
          )}
        >
          {/* Main content */}
          <div className="flex flex-col h-full">
            <h3 className="font-semibold text-sm mb-2 line-clamp-2" title={schedule.name}>
              {truncateText(schedule.name)}
            </h3>
            {schedule.isStale && (
              <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-700" title={schedule.staleReason ?? undefined}>
                <AlertTriangle className="h-3 w-3" />
                نیاز به تولید دوباره
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatPersianDate(schedule.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{classCount} صنف</span>
            </div>
            <div className="flex-1" />
          </div>

          {!isDeleting ? (
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoad();
                  }}
                  className="gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  بارگذاری
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف
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
