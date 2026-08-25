/**
 * Navigation Guard Store
 *
 * Simple store to track if current page has unsaved changes.
 * Used to disable navigation links when dirty.
 */

import { create } from 'zustand';

interface NavigationGuardState {
  // Whether the current page has unsaved changes
  isDirty: boolean;
  // Whether the current route owns an interactive router blocker.
  // Routes without one keep the sidebar's conservative disabled-link behavior.
  hasRouteBlocker: boolean;
  setDirty: (dirty: boolean) => void;
  setHasRouteBlocker: (hasRouteBlocker: boolean) => void;
}

export const useNavigationGuardStore = create<NavigationGuardState>((set, get) => ({
  isDirty: false,
  hasRouteBlocker: false,
  setDirty: (dirty) => {
    // Only update if changed to prevent re-renders
    if (get().isDirty !== dirty) {
      set({ isDirty: dirty });
    }
  },
  setHasRouteBlocker: (hasRouteBlocker) => {
    if (get().hasRouteBlocker !== hasRouteBlocker) {
      set({ hasRouteBlocker });
    }
  },
}));
