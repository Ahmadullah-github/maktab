/**
 * Hook for executing validated swap operations
 *
 * Handles the transition from validation to execution,
 * managing execution state and calling the store action.
 * Supports both simple swaps and cascading swaps.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * Phase 5: Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useScheduleStore } from '../stores/scheduleStore';
import type { SwapValidationResult } from '../types';
import { canExecuteSwap } from '../utils/swapValidation';

/**
 * Return type for useSwapExecution hook
 */
export interface UseSwapExecutionReturn {
  /** Execute a validated swap */
  executeSwap: (validatedSwap: SwapValidationResult) => void;
  /** Whether a swap is currently being executed */
  isExecuting: boolean;
}

/**
 * Hook for executing validated swaps
 *
 * Provides a function to execute swaps that have been validated,
 * along with execution state tracking. Supports cascading swaps
 * when multiple lessons are affected.
 *
 * @returns Object containing executeSwap function and isExecuting state
 *
 * Requirements:
 * - 7.1: Return executeSwap function accepting SwapValidationResult
 * - 7.2: Return isExecuting boolean state
 * - 7.3: Handle execution state transitions
 * - 7.4: Call store action with swap operation
 * - Phase 5: Support cascading swaps with multiple lesson moves
 */
export function useSwapExecution(): UseSwapExecutionReturn {
  const { t } = useTranslation();
  const [isExecuting, setIsExecuting] = useState(false);
  const storeCascadingSwap = useScheduleStore((state) => state.executeCascadingSwap);

  const executeSwap = useCallback(
    (validatedSwap: SwapValidationResult) => {
      // Only execute if the swap is valid or can proceed with warning
      if (!canExecuteSwap(validatedSwap)) {
        return;
      }

      // Set executing state (Requirement: 7.3)
      setIsExecuting(true);

      try {
        // Check if this is a cascading swap (multiple lessons affected)
        const affectedLessons = validatedSwap.affectedLessons;

        if (!affectedLessons || affectedLessons.length === 0) {
          throw new Error('The server returned an empty swap plan. Please validate again.');
        }

        const lessonMoves = affectedLessons.map((lesson) => ({
          class_id: lesson.classId,
          subject_id: lesson.subjectId,
          teacher_ids: lesson.teacherIds,
          room_id: lesson.roomId,
          from_day: lesson.fromDay,
          from_period: lesson.fromPeriod,
          to_day: lesson.toDay,
          to_period: lesson.toPeriod,
          is_fixed: lesson.isFixed,
        }));

        storeCascadingSwap(lessonMoves);

        toast.success(t('swap.success.swapExecuted', 'تبادل با موفقیت انجام شد'), {
          description: t('swap.success.description', '{{count}} درس جابجا شد', {
            count: validatedSwap.totalMoves ?? affectedLessons.length,
          }),
        });
      } catch (error) {
        // Show error toast
        toast.error(t('swap.errors.executionFailed', 'خطا در اجرای تبادل'), {
          description: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        // Reset executing state (Requirement: 7.3)
        setIsExecuting(false);
      }
    },
    [storeCascadingSwap, t]
  );

  return {
    executeSwap,
    isExecuting,
  };
}
