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
  setDirty: (dirty: boolean) => void;
}

export const useNavigationGuardStore = create<NavigationGuardState>((set, get) => ({
  isDirty: false,
  setDirty: (dirty) => {
    // Only update if changed to prevent re-renders
    if (get().isDirty !== dirty) {
      set({ isDirty: dirty });
    }
  },
}));
