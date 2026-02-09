/**
 * useBulkOperation Hook
 * Manages state and execution of bulk assignment operations
 *
 * Requirements: 8.6
 */

import { useCallback, useRef, useState } from 'react';
import type { BulkOperationResult, BulkOperationStatus } from '../components/BulkOperationProgress';

// ============================================================================
// Types
// ============================================================================

export interface BulkOperationState {
  status: BulkOperationStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  results: BulkOperationResult[];
  isOpen: boolean;
}

export interface BulkOperationOptions<T, R> {
  /** Function to process a single item */
  processItem: (item: T) => Promise<R>;
  /** Function to get item ID for tracking */
  getItemId: (item: T) => number | string;
  /** Callback when operation completes */
  onComplete?: (results: BulkOperationResult[]) => void;
  /** Callback when operation is cancelled */
  onCancel?: () => void;
  /** Delay between items in ms (for rate limiting) */
  delayBetweenItems?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
}

export interface UseBulkOperationReturn<T> {
  /** Current operation state */
  state: BulkOperationState;
  /** Start the bulk operation */
  start: (items: T[]) => Promise<void>;
  /** Cancel the operation */
  cancel: () => void;
  /** Reset the state */
  reset: () => void;
  /** Close the progress dialog */
  close: () => void;
  /** Open the progress dialog */
  open: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: BulkOperationState = {
  status: 'idle',
  totalItems: 0,
  completedItems: 0,
  failedItems: 0,
  results: [],
  isOpen: false,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useBulkOperation manages bulk assignment operations with progress tracking
 *
 * @example
 * ```tsx
 * const { state, start, cancel, reset } = useBulkOperation({
 *   processItem: async (item) => {
 *     await api.assignments.create(item);
 *     return { success: true };
 *   },
 *   getItemId: (item) => item.id,
 *   onComplete: (results) => {
 *     console.log('Completed:', results);
 *   },
 * });
 *
 * // Start operation
 * await start(items);
 * ```
 */
export function useBulkOperation<T, R = unknown>(
  options: BulkOperationOptions<T, R>
): UseBulkOperationReturn<T> {
  const {
    processItem,
    getItemId,
    onComplete,
    onCancel,
    delayBetweenItems = 0,
    continueOnError = true,
  } = options;

  const [state, setState] = useState<BulkOperationState>(initialState);
  const cancelledRef = useRef(false);
  const processingRef = useRef(false);

  /**
   * Start the bulk operation
   */
  const start = useCallback(
    async (items: T[]): Promise<void> => {
      if (processingRef.current) {
        console.warn('Bulk operation already in progress');
        return;
      }

      processingRef.current = true;
      cancelledRef.current = false;

      setState({
        status: 'running',
        totalItems: items.length,
        completedItems: 0,
        failedItems: 0,
        results: [],
        isOpen: true,
      });

      const results: BulkOperationResult[] = [];
      let failedCount = 0;

      for (let i = 0; i < items.length; i++) {
        // Check for cancellation
        if (cancelledRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'cancelled',
          }));
          break;
        }

        const item = items[i];
        const itemId = getItemId(item);

        try {
          await processItem(item);
          results.push({ success: true, itemId });
        } catch (error) {
          failedCount++;
          results.push({
            success: false,
            itemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!continueOnError) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              completedItems: i + 1,
              failedItems: failedCount,
              results,
            }));
            break;
          }
        }

        // Update progress
        setState((prev) => ({
          ...prev,
          completedItems: i + 1,
          failedItems: failedCount,
          results,
        }));

        // Add delay between items if specified
        if (delayBetweenItems > 0 && i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenItems));
        }
      }

      // Final state update
      if (!cancelledRef.current) {
        setState((prev) => ({
          ...prev,
          status: failedCount > 0 && failedCount === items.length ? 'error' : 'completed',
          results,
        }));
      }

      processingRef.current = false;
      onComplete?.(results);
    },
    [processItem, getItemId, onComplete, delayBetweenItems, continueOnError]
  );

  /**
   * Cancel the operation
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel?.();
  }, [onCancel]);

  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    cancelledRef.current = false;
    processingRef.current = false;
    setState(initialState);
  }, []);

  /**
   * Close the progress dialog
   */
  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  /**
   * Open the progress dialog
   */
  const open = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
    }));
  }, []);

  return {
    state,
    start,
    cancel,
    reset,
    close,
    open,
  };
}

export default useBulkOperation;
