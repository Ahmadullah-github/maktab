/**
 * ScheduleDashboard Component
 * Main container component for the schedule dashboard page.
 * Displays statistics, saved schedules list, and generation controls.
 *
 * Requirements: 1.1, 1.2, 2.5, 2.6, 5.4, 5.5, 5.6, 8.2, 8.3, 8.4
 */

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useDeleteSchedule, useSchedules, useScheduleStats } from '../../hooks';
import type { TimetableApiResponse } from '../../types';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { GenerateButton } from './GenerateButton';
import { ScheduleList } from './ScheduleList';
import { StatsCards } from './StatsCards';

/**
 * ScheduleDashboard component
 *
 * Main dashboard page that orchestrates:
 * - Header with title and generate button
 * - Statistics cards showing aggregate data
 * - List of saved schedules with actions
 * - Delete confirmation dialog
 *
 * Requirements: 1.1, 1.2, 2.5, 2.6, 5.4, 5.5, 5.6, 8.2, 8.3, 8.4
 */
export function ScheduleDashboard() {
  const navigate = useNavigate();
  const { data: schedules, isLoading: isLoadingSchedules, error, refetch } = useSchedules();
  const stats = useScheduleStats();
  const deleteScheduleMutation = useDeleteSchedule();

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<TimetableApiResponse | null>(null);

  /**
   * Handle load action - navigate to classes-schedule with schedule ID
   * Requirements: 2.5
   */
  const handleLoad = useCallback(
    (schedule: TimetableApiResponse) => {
      navigate({ to: '/classes-schedule', search: { scheduleId: schedule.id } });
    },
    [navigate]
  );

  /**
   * Handle delete action - open confirmation dialog
   * Requirements: 5.4
   */
  const handleDelete = useCallback((schedule: TimetableApiResponse) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handle delete confirmation - call delete mutation
   * Requirements: 5.4, 5.5, 5.6
   */
  const handleConfirmDelete = useCallback(() => {
    if (!scheduleToDelete) return;

    deleteScheduleMutation.mutate(scheduleToDelete.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
      },
      onError: () => {
        // Error toast is handled by the mutation hook
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
      },
    });
  }, [scheduleToDelete, deleteScheduleMutation]);

  /**
   * Handle rename action
   * Note: Rename functionality requires API support - currently a placeholder
   */
  const handleRename = useCallback((_id: number, _newName: string) => {
    // TODO: Implement rename API call when backend supports it
    toast.info('تغییر نام در حال حاضر پشتیبانی نمی‌شود');
  }, []);

  /**
   * Handle retry on error
   * Requirements: 8.4
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state - show skeleton
  // Requirements: 8.2
  if (isLoadingSchedules && !schedules) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state - show error message with retry button
  // Requirements: 8.3, 8.4
  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">داشبورد جدول زمانی</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-8">
          <p className="text-lg text-destructive">خطا در دریافت لیست جدول‌های زمانی</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تلاش مجدد
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header with title and generate button */}
      {/* Requirements: 1.1, 1.2 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">داشبورد جدول زمانی</h1>
        <GenerateButton onGenerateComplete={refetch} />
      </div>

      {/* Statistics cards */}
      <StatsCards
        totalSchedules={stats.totalSchedules}
        totalClasses={stats.totalClasses}
        totalTeachers={stats.totalTeachers}
        lastGeneratedAt={stats.lastGeneratedAt}
        isLoading={stats.isLoading}
      />

      {/* Schedule list */}
      {/* Requirements: 2.5, 2.6 */}
      <ScheduleList
        schedules={schedules ?? []}
        isLoading={isLoadingSchedules}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onRename={handleRename}
      />

      {/* Delete confirmation dialog */}
      {/* Requirements: 5.4 */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        scheduleName={scheduleToDelete?.name ?? ''}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteScheduleMutation.isPending}
      />
    </div>
  );
}
