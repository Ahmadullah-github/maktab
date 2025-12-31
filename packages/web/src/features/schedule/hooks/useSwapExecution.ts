/**
 * Hook for executing validated swap operations
 *
 * Handles the transition from validation to execution,
 * managing execution state and calling the store action.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useCallback, useState } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type { SwapValidationResult } from '../types';

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
 * along with execution state tracking.
 *
 * @returns Object containing executeSwap function and isExecuting state
 *
 * Requirements:
 * - 7.1: Return executeSwap function accepting SwapValidationResult
 * - 7.2: Return isExecuting boolean state
 * - 7.3: Handle execution state transitions
 * - 7.4: Call store action with swap operation
 */
export function useSwapExecution(): UseSwapExecutionReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const storeExecuteSwap = useScheduleStore((state) => state.executeSwap);

  const executeSwap = useCallback(
    (validatedSwap: SwapValidationResult) => {
      // Only execute if the swap is valid or can proceed with warning
      if (!validatedSwap.isValid && !validatedSwap.canProceedWithWarning) {
        return;
      }

      // Set executing state (Requirement: 7.3)
      setIsExecuting(true);

      try {
        // Call store action with the swap operation (Requirement: 7.4)
        storeExecuteSwap(validatedSwap.swap);
      } finally {
        // Reset executing state (Requirement: 7.3)
        setIsExecuting(false);
      }
    },
    [storeExecuteSwap]
  );

  return {
    executeSwap,
    isExecuting,
  };
}
