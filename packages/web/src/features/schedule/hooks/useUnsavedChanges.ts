/**
 * Hook for tracking unsaved changes and handling navigation warnings
 *
 * Provides state and functions for managing unsaved changes,
 * including beforeunload handler registration.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';

import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../stores/scheduleStore';

const SCHEDULE_EDITOR_PATHS = new Set(['/classes-schedule', '/teachers-schedule']);

function readScheduleId(search: unknown): string | null {
  if (typeof search !== 'object' || search === null) return null;
  const value = (search as { scheduleId?: unknown }).scheduleId;
  return value == null ? null : String(value);
}

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
  /** Whether router navigation is waiting for the user's decision. */
  isLeaveDialogOpen: boolean;
  /** Stay on the editor and cancel the pending navigation. */
  stay: () => void;
  /** Restore the persisted snapshot and continue navigation. */
  discardAndLeave: () => void;
  /** Save the current snapshot, then continue navigation. */
  saveAndLeave: () => Promise<void>;
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
  const discardChanges = useScheduleStore((state) => state.discardChanges);
  const setHasRouteBlocker = useNavigationGuardStore((state) => state.setHasRouteBlocker);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      hasChanges &&
      !(
        SCHEDULE_EDITOR_PATHS.has(current.pathname) &&
        SCHEDULE_EDITOR_PATHS.has(next.pathname) &&
        readScheduleId(current.search) === readScheduleId(next.search)
      ),
    enableBeforeUnload: () => hasChanges,
    withResolver: true,
  });

  useEffect(() => {
    setHasRouteBlocker(true);
    return () => setHasRouteBlocker(false);
  }, [setHasRouteBlocker]);

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

  const stay = useCallback(() => {
    if (blocker.status === 'blocked') blocker.reset();
  }, [blocker]);

  const discardAndLeave = useCallback(() => {
    if (blocker.status !== 'blocked') return;
    discardChanges();
    blocker.proceed();
  }, [blocker, discardChanges]);

  const saveAndLeave = useCallback(async () => {
    if (blocker.status !== 'blocked') return;
    await save();
    if (!getHasUnsavedChanges(useScheduleStore.getState())) {
      blocker.proceed();
    }
  }, [blocker, save]);

  return {
    count,
    hasChanges,
    confirmLeave,
    save,
    isSaving,
    isLeaveDialogOpen: blocker.status === 'blocked',
    stay,
    discardAndLeave,
    saveAndLeave,
  };
}
