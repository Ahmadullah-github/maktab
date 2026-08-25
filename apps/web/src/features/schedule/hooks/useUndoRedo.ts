/**
 * Hook for undo/redo operations
 *
 * Provides functions and state for undoing and redoing swap operations.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { useCallback } from 'react';

import { getCanRedo, getCanUndo, useScheduleStore } from '../stores/scheduleStore';

/**
 * Return type for useUndoRedo hook
 */
export interface UseUndoRedoReturn {
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of actions in undo stack */
  undoCount: number;
  /** Number of actions in redo stack */
  redoCount: number;
}

/**
 * Hook for undo/redo operations
 *
 * Provides undo and redo functions along with state indicating
 * whether each operation is available and the count of actions
 * in each stack.
 *
 * @returns Object containing undo/redo functions and state
 *
 * Requirements:
 * - 8.1: Return undo function
 * - 8.2: Return redo function
 * - 8.3: Return canUndo boolean
 * - 8.4: Return canRedo boolean
 * - 8.5: Return undoCount number
 * - 8.6: Return redoCount number
 */
export function useUndoRedo(): UseUndoRedoReturn {
  // Get store actions
  const storeUndo = useScheduleStore((state) => state.undo);
  const storeRedo = useScheduleStore((state) => state.redo);

  // Get computed state using selectors
  const canUndo = useScheduleStore(getCanUndo);
  const canRedo = useScheduleStore(getCanRedo);
  const undoCount = useScheduleStore((state) => state.undoStack.length);
  const redoCount = useScheduleStore((state) => state.redoStack.length);

  // Wrap store actions in callbacks for stable references
  const undo = useCallback(() => {
    storeUndo();
  }, [storeUndo]);

  const redo = useCallback(() => {
    storeRedo();
  }, [storeRedo]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
  };
}
