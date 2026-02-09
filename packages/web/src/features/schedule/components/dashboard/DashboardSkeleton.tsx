/**
 * DashboardSkeleton Component
 * Skeleton placeholder for the Schedule Dashboard during loading
 *
 * Features:
 * - Skeleton for GenerationHub (strategy cards, checklist, button)
 * - Skeleton for HistorySection (card placeholders)
 * - Match actual component layouts
 *
 * Requirements: 10.1, 10.2
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Props for DashboardSkeleton component
 */
export interface DashboardSkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton for a single strategy card
 * Matches StrategyCard layout: icon, name, time, description
 */
function StrategyCardSkeleton() {
  return (
    <Card className="relative min-w-[160px] h-full">
      <div className="p-4 pt-6 flex flex-col h-full">
        {/* Icon placeholder */}
        <Skeleton className="w-12 h-12 rounded-xl mb-3" />
        {/* Name placeholder */}
        <Skeleton className="w-16 h-5 mb-1" />
        {/* Time placeholder */}
        <Skeleton className="w-20 h-4 mb-2" />
        {/* Description placeholder */}
        <Skeleton className="w-full h-3 mt-auto" />
      </div>
    </Card>
  );
}

/**
 * Skeleton for strategy selector section
 * Shows 3 strategy cards in a row
 */
function StrategySelectorSkeleton() {
  return (
    <div className="flex items-stretch justify-center gap-4">
      {[1, 2, 3].map((i) => (
        <StrategyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a single readiness item
 * Matches ReadinessItem layout: icon, label, count
 */
function ReadinessItemSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 p-3 min-w-[100px]">
      <Skeleton className="w-10 h-10 rounded-full" />
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-8 h-5" />
    </div>
  );
}

/**
 * Skeleton for readiness checklist section
 * Shows 4 readiness items in a row
 */
function ReadinessChecklistSkeleton() {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {[1, 2, 3, 4].map((i) => (
        <ReadinessItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for GenerationHub component
 * Matches GenerationHub layout: header, strategy cards, checklist, button
 */
function GenerationHubSkeleton() {
  return (
    <Card className="relative overflow-hidden bg-linear-to-br from-primary/5 via-background to-primary/10">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="w-32 h-6" />
          </div>
          <Skeleton className="w-64 h-4 mx-auto" />
        </div>

        {/* Strategy selector */}
        <StrategySelectorSkeleton />

        {/* Readiness checklist */}
        <ReadinessChecklistSkeleton />

        {/* Generate button */}
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="w-40 h-11 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Skeleton for a single schedule card
 * Matches ScheduleCard layout: name, date, class count
 */
function ScheduleCardSkeleton() {
  return (
    <Card className="w-[220px] h-[140px] p-4 shrink-0">
      <div className="flex flex-col h-full">
        {/* Name placeholder */}
        <Skeleton className="w-full h-5 mb-2" />
        <Skeleton className="w-3/4 h-5 mb-3" />
        {/* Date placeholder */}
        <div className="flex items-center gap-1.5 mb-1">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="w-20 h-3" />
        </div>
        {/* Class count placeholder */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="w-12 h-3" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Skeleton for HistorySection component
 * Matches HistorySection layout: header with title, horizontal card list
 */
function HistorySectionSkeleton() {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="w-24 h-6" />
          <Skeleton className="w-8 h-4" />
        </div>
      </div>

      {/* Schedule cards */}
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <ScheduleCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

/**
 * DashboardSkeleton component
 *
 * Full skeleton placeholder for the Schedule Dashboard.
 * Matches the actual layout of ScheduleDashboard with:
 * - Header with icon and title
 * - GenerationHub skeleton
 * - HistorySection skeleton
 *
 * Requirements: 10.1, 10.2
 */
export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-6 p-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-48 h-8" />
      </div>

      {/* GenerationHub skeleton */}
      <GenerationHubSkeleton />

      {/* HistorySection skeleton */}
      <HistorySectionSkeleton />
    </div>
  );
}

// Export sub-components for potential reuse
export {
  GenerationHubSkeleton,
  HistorySectionSkeleton,
  ReadinessChecklistSkeleton,
  ScheduleCardSkeleton,
  StrategyCardSkeleton,
  StrategySelectorSkeleton,
};
