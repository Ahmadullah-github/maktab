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
import { motion, type Variants } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useDeleteSchedule,
  useEmptyStateLogic,
  useGenerateSchedule,
  useLatestAvailableCandidate,
  useReadinessData,
  useReadinessValidation,
  useSchedules,
} from '../../hooks';
import type { TimetableApiResponse } from '../../types';
import { CandidateComparisonCard } from './CandidateComparisonCard';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { EncouragementEmptyState } from './EncouragementEmptyState';
import { GenerationHub } from './GenerationHub';
import { HistorySection } from './HistorySection';
import { OnboardingEmptyState } from './OnboardingEmptyState';
import type { AffectedEntity } from '@/types/solver';
import type { IssueAction } from '@/features/schedule/errors/issuePresentation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const {
    data: readinessData,
    isLoading: isReadinessLoading,
    error: readinessError,
    refetch: refetchReadiness,
  } = useReadinessData();
  const { warnings: validationWarnings, error: validationError } = useReadinessValidation();

  // Generation hook
  const {
    generate,
    improve,
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
    generationJob,
    resultTimetableId,
    resultCandidateId,
  } = useGenerateSchedule();
  const latestCandidateQuery = useLatestAvailableCandidate();

  // Delete mutation
  const deleteScheduleMutation = useDeleteSchedule();

  // Local state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<TimetableApiResponse | null>(null);
  const [staleScheduleToLoad, setStaleScheduleToLoad] = useState<TimetableApiResponse | null>(null);

  // Determine empty state type
  const hasSchedules = (schedules?.length ?? 0) > 0;
  const { showOnboarding, showEncouragement } = useEmptyStateLogic(readinessData, hasSchedules);

  /**
   * Handle generate action
   */
  const handleGenerate = useCallback(() => {
    generate();
  }, [generate]);

  /**
   * Handle generation close/reset
   */
  const handleGenerationClose = useCallback(() => {
    const savedId = resultTimetableId;
    resetGeneration();
    refetch();
    if (savedId) {
      navigate({ to: '/classes-schedule', search: { scheduleId: savedId } });
    }
  }, [resultTimetableId, resetGeneration, refetch, navigate]);

  const handleImprove = useCallback(
    (schedule: TimetableApiResponse) => improve(schedule.id),
    [improve]
  );

  const handleCandidateAccepted = useCallback(
    (timetableId: number) => {
      resetGeneration();
      void refetch();
      navigate({ to: '/classes-schedule', search: { scheduleId: timetableId } });
    },
    [navigate, refetch, resetGeneration]
  );

  /**
   * Handle load action - navigate to classes-schedule with schedule ID
   * Requirements: 7.6
   */
  const handleLoad = useCallback(
    (schedule: TimetableApiResponse) => {
      if (schedule.isStale) {
        setStaleScheduleToLoad(schedule);
        return;
      }
      navigate({ to: '/classes-schedule', search: { scheduleId: schedule.id } });
    },
    [navigate]
  );

  const handleEntityClick = useCallback(
    (entity: AffectedEntity) => {
      const selected = Number(entity.id);
      if (entity.type === 'teacher') {
        navigate({ to: '/teachers', search: { selected } });
      } else if (entity.type === 'class') {
        navigate({ to: '/classes', search: { selected } });
      } else if (entity.type === 'subject') {
        navigate({ to: '/subjects', search: { selected } });
      } else {
        navigate({ to: '/rooms', search: { selected } });
      }
    },
    [navigate]
  );

  const handleQuickAction = useCallback(
    (action: IssueAction) => {
      if (action.entity) {
        handleEntityClick(action.entity);
        return;
      }
      if (action.type === 'edit_assignments') navigate({ to: '/assignments' });
      else if (action.type.includes('teacher')) navigate({ to: '/teachers', search: {} });
      else if (action.type.includes('class')) navigate({ to: '/classes', search: {} });
      else if (action.type.includes('subject')) navigate({ to: '/subjects', search: {} });
      else if (action.type.includes('room')) navigate({ to: '/rooms', search: {} });
      else navigate({ to: '/school-settings' });
    },
    [handleEntityClick, navigate]
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
    refetchReadiness();
  }, [refetch, refetchReadiness]);

  // Loading state - show skeleton (Requirement: 10.1, 10.2)
  if ((isLoadingSchedules && !schedules) || isReadinessLoading) {
    return <DashboardSkeleton />;
  }

  // Error state - show error message with retry button (Requirement: 10.3, 10.5)
  if (error || readinessError || validationError) {
    return <DashboardErrorState error={error || readinessError || validationError} onRetry={handleRetry} />;
  }

  // Onboarding empty state - show when no data and no schedules
  if (showOnboarding) {
    return (
      <div className="flex min-h-full flex-col bg-linear-to-br from-slate-50/90 via-background to-primary/5">
        <PageHeader
          icon={Calendar}
          title="داشبورد جدول زمانی"
          subtitle="ساخت، بررسی و مدیریت جدول‌های درسی مکتب"
        />
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <OnboardingEmptyState readinessData={readinessData} />
        </main>
      </div>
    );
  }

  // Get errors from generation error
  const errors = generationError?.errors ?? [];

  return (
    <div className="flex min-h-full flex-col bg-linear-to-br from-slate-50/90 via-background to-primary/5">
      <PageHeader
        icon={Calendar}
        title="داشبورد جدول زمانی"
        subtitle="ساخت، بررسی و مدیریت جدول‌های درسی مکتب"
      />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 sm:p-6 lg:p-8"
      >
        {/* GenerationHub as hero section (Requirement: 1.1) */}
        <motion.div variants={itemVariants}>
          <GenerationHub
            readinessData={readinessData}
            isReadinessLoading={isReadinessLoading}
            validationWarnings={validationWarnings}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            elapsedTime={elapsedTime}
            errors={errors}
            warnings={generationWarnings}
            diagnosticId={generationError?.diagnosticId ?? solverResponse?.diagnosticId}
            qualityScore={qualityScore}
            solverResponse={solverResponse}
            solverStatus={solverStatus}
            generationJob={generationJob}
            onRetry={handleGenerate}
            onCancel={cancel}
            onClose={handleGenerationClose}
            onEntityClick={handleEntityClick}
            onQuickAction={handleQuickAction}
            canGenerate={canGenerate}
            blockedReason={blockedReason}
          />
        </motion.div>

        {resultCandidateId ?? latestCandidateQuery.data?.id ? (
          <motion.div variants={itemVariants}>
            <CandidateComparisonCard
              candidateId={(resultCandidateId ?? latestCandidateQuery.data?.id)!}
              onAccepted={handleCandidateAccepted}
              onDiscarded={resetGeneration}
            />
          </motion.div>
        ) : null}

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
              onImprove={handleImprove}
              improvingSourceId={
                isGenerating && generationJob?.mode === 'improve'
                  ? generationJob.sourceTimetableId
                  : null
              }
              deletingId={deleteScheduleMutation.isPending ? scheduleToDelete?.id : null}
            />
          )}
        </motion.div>
      </motion.main>

      {/* Delete confirmation dialog (Requirements: 7.7, 7.8) */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        scheduleName={scheduleToDelete?.name ?? ''}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteScheduleMutation.isPending}
      />
      <AlertDialog
        open={staleScheduleToLoad !== null}
        onOpenChange={(open) => !open && setStaleScheduleToLoad(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>این جدول نیاز به تولید دوباره دارد</AlertDialogTitle>
            <AlertDialogDescription>
              {staleScheduleToLoad?.staleReason || 'داده‌های مؤثر بر جدول تغییر کرده‌اند.'} بارگذاری ادامه یابد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (staleScheduleToLoad) {
                  navigate({ to: '/classes-schedule', search: { scheduleId: staleScheduleToLoad.id } });
                }
                setStaleScheduleToLoad(null);
              }}
            >
              بارگذاری جدول
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
