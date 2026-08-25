/**
 * Hook for registering keyboard shortcuts for undo/redo/save
 *
 * Registers Ctrl+Z for undo, Ctrl+Y/Ctrl+Shift+Z for redo, and Ctrl+S for save.
 * Only active when enabled option is true.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { useCallback, useEffect } from 'react';

/**
 * Options for useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled: boolean;
  /** Callback for undo action (Ctrl+Z) */
  onUndo?: () => void;
  /** Callback for redo action (Ctrl+Y or Ctrl+Shift+Z) */
  onRedo?: () => void;
  /** Callback for save action (Ctrl+S) */
  onSave?: () => void;
}

/**
 * Hook for registering keyboard shortcuts
 *
 * Registers keyboard event handlers for:
 * - Ctrl+Z: undo (Requirement: 9.1)
 * - Ctrl+Y: redo (Requirement: 9.2)
 * - Ctrl+Shift+Z: redo alternative (Requirement: 9.3)
 * - Ctrl+S: save (Requirement: 9.4)
 *
 * Only active when enabled option is true (Requirement: 9.5).
 * Prevents default browser behavior for these shortcuts.
 *
 * @param options - Configuration options including enabled state and callbacks
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled, onUndo, onRedo, onSave } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Ctrl key (or Cmd on Mac)
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (!isCtrlOrCmd) {
        return;
      }

      // Ctrl+S: Save (Requirement: 9.4)
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl+Shift+Z: Redo alternative (Requirement: 9.3)
      if ((event.key === 'z' || event.key === 'Z') && event.shiftKey) {
        event.preventDefault();
        onRedo?.();
        return;
      }

      // Ctrl+Z: Undo (Requirement: 9.1)
      if ((event.key === 'z' || event.key === 'Z') && !event.shiftKey) {
        event.preventDefault();
        onUndo?.();
        return;
      }

      // Ctrl+Y: Redo (Requirement: 9.2)
      if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        onRedo?.();
        return;
      }
    },
    [onUndo, onRedo, onSave]
  );

  useEffect(() => {
    // Only register when enabled (Requirement: 9.5)
    if (!enabled) {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
