/**
 * Hook for tracking unsaved changes and handling navigation warnings
 *
 * Provides state and functions for managing unsaved changes,
 * including beforeunload handler registration.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { useCallback, useEffect, useState } from 'react';

import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../stores/scheduleStore';

/**
 * Return type for useUnsavedChanges hook
 */
export interface UseUnsavedChangesReturn {
  /** Number of unsaved changes */
  count: number;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Confirm leaving with unsaved changes - returns Promise<boolean> */
  confirmLeave: () => Promise<boolean>;
  /** Save current changes */
  save: () => Promise<void>;
  /** Whether save is in progress */
  isSaving: boolean;
}

/**
 * Options for useUnsavedChanges hook
 */
export interface UseUnsavedChangesOptions {
  /** Function to call when saving */
  onSave?: () => Promise<void>;
  /** Function to call when confirming leave */
  onConfirmLeave?: () => Promise<boolean>;
}

/**
 * Hook for tracking unsaved changes and handling navigation warnings
 *
 * Provides count and hasChanges from store, along with confirmLeave
 * and save functions. Registers beforeunload handler when hasChanges is true.
 *
 * @param options - Optional callbacks for save and confirmLeave
 * @returns Object containing unsaved changes state and functions
 *
 * Requirements:
 * - 13.1: Return count from store
 * - 13.2: Return hasChanges from store
 * - 13.3: Return confirmLeave function with Promise<boolean>
 * - 13.4: Return save function and isSaving state
 * - 13.5: Register beforeunload handler when hasChanges
 */
export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}): UseUnsavedChangesReturn {
  const { onSave, onConfirmLeave } = options;

  const [isSaving, setIsSaving] = useState(false);

  // Get state from store using selectors
  const count = useScheduleStore(getUnsavedChangesCount);
  const hasChanges = useScheduleStore(getHasUnsavedChanges);

  // Confirm leave function (Requirement: 13.3)
  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (!hasChanges) {
      return true;
    }

    if (onConfirmLeave) {
      return onConfirmLeave();
    }

    // Default behavior: return false to block navigation
    // The caller should show a dialog to confirm
    return false;
  }, [hasChanges, onConfirmLeave]);

  // Save function (Requirement: 13.4)
  const save = useCallback(async (): Promise<void> => {
    if (!onSave) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // Register beforeunload handler when hasChanges (Requirement: 13.5)
  useEffect(() => {
    if (!hasChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Standard way to trigger browser's "unsaved changes" dialog
      event.preventDefault();
      // For older browsers
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  return {
    count,
    hasChanges,
    confirmLeave,
    save,
    isSaving,
  };
}
