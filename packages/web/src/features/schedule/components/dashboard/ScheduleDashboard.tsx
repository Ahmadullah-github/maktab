/**
 * ScheduleDashboard Component
 * Main container component for the schedule dashboard page.
 *
 * Features:
 * - Use PageHeader with Calendar icon
 * - Render GenerationHub as hero section
 * - Render HistorySection below
 * - Conditionally render OnboardingEmptyState
 * - Implement staggered load animations
 *
 * Requirements: 1.1, 6.1, 8.1, 9.1
 */

import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  useDeleteSchedule,
  useEmptyStateLogic,
  useEnhancedGenerateSchedule,
  useReadinessData,
  useReadinessValidation,
  useSchedules,
} from '../../hooks';
import type { SolverStrategy, TimetableApiResponse } from '../../types';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { EncouragementEmptyState } from './EncouragementEmptyState';
import { GenerationHub } from './GenerationHub';
import { HistorySection } from './HistorySection';
import { OnboardingEmptyState } from './OnboardingEmptyState';

/**
 * Animation variants for staggered entrance
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

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
};

/**
 * ScheduleDashboard component
 *
 * Main dashboard page that orchestrates:
 * - Header with title and icon
 * - GenerationHub as hero section
 * - HistorySection with saved schedules
 * - Conditional empty states (onboarding or encouragement)
 * - Delete confirmation dialog
 *
 * Requirements: 1.1, 6.1, 8.1, 9.1
 */
export function ScheduleDashboard() {
  const navigate = useNavigate();

  // Data hooks
  const { data: schedules, isLoading: isLoadingSchedules, error, refetch } = useSchedules();
  const { data: readinessData, isLoading: isReadinessLoading } = useReadinessData();
  const { warnings: validationWarnings } = useReadinessValidation();

  // Generation hook
  const {
    generate,
    cancel,
    isGenerating,
    elapsedTime,
    error: generationError,
    solverResponse,
    qualityScore,
    warnings: generationWarnings,
    reset: resetGeneration,
    canGenerate,
    blockedReason,
    solverStatus,
  } = useEnhancedGenerateSchedule();

  // Delete mutation
  const deleteScheduleMutation = useDeleteSchedule();

  // Local state
  const [selectedStrategy, setSelectedStrategy] = useState<SolverStrategy>('balanced');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<TimetableApiResponse | null>(null);

  // Determine empty state type
  const hasSchedules = (schedules?.length ?? 0) > 0;
  const { showOnboarding, showEncouragement } = useEmptyStateLogic(readinessData, hasSchedules);

  /**
   * Handle generate action
   */
  const handleGenerate = useCallback(() => {
    generate(selectedStrategy);
  }, [generate, selectedStrategy]);

  /**
   * Handle generation close/reset
   */
  const handleGenerationClose = useCallback(() => {
    resetGeneration();
    refetch();
  }, [resetGeneration, refetch]);

  /**
   * Handle load action - navigate to classes-schedule with schedule ID
   * Requirements: 7.6
   */
  const handleLoad = useCallback(
    (schedule: TimetableApiResponse) => {
      navigate({ to: '/classes-schedule', search: { scheduleId: schedule.id } });
    },
    [navigate]
  );

  /**
   * Handle delete action - open confirmation dialog
   * Requirements: 7.7
   */
  const handleDelete = useCallback((schedule: TimetableApiResponse) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handle delete confirmation - call delete mutation
   * Requirements: 7.7, 7.8
   */
  const handleConfirmDelete = useCallback(() => {
    if (!scheduleToDelete) return;

    deleteScheduleMutation.mutate(scheduleToDelete.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
      },
      onError: () => {
        setDeleteDialogOpen(false);
        setScheduleToDelete(null);
      },
    });
  }, [scheduleToDelete, deleteScheduleMutation]);

  /**
   * Handle retry on error
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state - show skeleton (Requirement: 10.1, 10.2)
  if (isLoadingSchedules && !schedules && isReadinessLoading) {
    return <DashboardSkeleton />;
  }

  // Error state - show error message with retry button (Requirement: 10.3, 10.5)
  if (error) {
    return <DashboardErrorState error={error} onRetry={handleRetry} />;
  }

  // Onboarding empty state - show when no data and no schedules
  if (showOnboarding) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">داشبورد جدول زمانی</h1>
        </div>

        {/* Onboarding empty state */}
        <OnboardingEmptyState readinessData={readinessData} />
      </div>
    );
  }

  // Get errors from generation error
  const errors = generationError?.errors ?? [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6 p-6"
    >
      {/* Header with icon (Requirement: 1.1) */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">داشبورد جدول زمانی</h1>
      </motion.div>

      {/* GenerationHub as hero section (Requirement: 1.1) */}
      <motion.div variants={itemVariants}>
        <GenerationHub
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
          readinessData={readinessData}
          isReadinessLoading={isReadinessLoading}
          validationWarnings={validationWarnings}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          elapsedTime={elapsedTime}
          errors={errors}
          warnings={generationWarnings}
          qualityScore={qualityScore}
          solverResponse={solverResponse}
          solverStatus={solverStatus}
          onRetry={handleGenerate}
          onCancel={cancel}
          onClose={handleGenerationClose}
          canGenerate={canGenerate}
          blockedReason={blockedReason}
        />
      </motion.div>

      {/* Encouragement empty state or History section */}
      <motion.div variants={itemVariants}>
        {showEncouragement ? (
          <EncouragementEmptyState onGenerateClick={handleGenerate} />
        ) : (
          <HistorySection
            schedules={schedules ?? []}
            isLoading={isLoadingSchedules}
            onLoad={handleLoad}
            onDelete={handleDelete}
            deletingId={deleteScheduleMutation.isPending ? scheduleToDelete?.id : null}
          />
        )}
      </motion.div>

      {/* Delete confirmation dialog (Requirements: 7.7, 7.8) */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        scheduleName={scheduleToDelete?.name ?? ''}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteScheduleMutation.isPending}
      />
    </motion.div>
  );
}
