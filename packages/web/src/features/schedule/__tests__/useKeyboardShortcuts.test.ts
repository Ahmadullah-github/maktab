/**
 * Unit tests for useKeyboardShortcuts hook
 *
 * Tests:
 * - Keyboard event handling
 * - Enabled/disabled state
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // Helper to create and dispatch keyboard events
  const dispatchKeyboardEvent = (
    key: string,
    options: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey ?? false,
      shiftKey: options.shiftKey ?? false,
      metaKey: options.metaKey ?? false,
      bubbles: true,
      cancelable: true,
    });
    // Mock preventDefault
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    return preventDefaultSpy;
  };

  describe('enabled/disabled state', () => {
    it('registers keydown handler when enabled is true (Requirement: 9.5)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('does not register keydown handler when enabled is false (Requirement: 9.5)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: false,
        })
      );

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keydown handler on unmount', () => {
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keydown handler when enabled becomes false', () => {
      const { rerender } = renderHook(({ enabled }) => useKeyboardShortcuts({ enabled }), {
        initialProps: { enabled: true },
      });

      removeEventListenerSpy.mockClear();

      rerender({ enabled: false });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Ctrl+Z for undo', () => {
    it('calls onUndo when Ctrl+Z is pressed (Requirement: 9.1)', () => {
      const onUndo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onUndo,
        })
      );

      dispatchKeyboardEvent('z', { ctrlKey: true });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('calls onUndo when Cmd+Z is pressed on Mac (Requirement: 9.1)', () => {
      const onUndo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onUndo,
        })
      );

      dispatchKeyboardEvent('z', { metaKey: true });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('prevents default browser behavior for Ctrl+Z (Requirement: 9.1)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onUndo: vi.fn(),
        })
      );

      const preventDefaultSpy = dispatchKeyboardEvent('z', { ctrlKey: true });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not call onUndo when disabled', () => {
      const onUndo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: false,
          onUndo,
        })
      );

      dispatchKeyboardEvent('z', { ctrlKey: true });

      expect(onUndo).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Y for redo', () => {
    it('calls onRedo when Ctrl+Y is pressed (Requirement: 9.2)', () => {
      const onRedo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo,
        })
      );

      dispatchKeyboardEvent('y', { ctrlKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('calls onRedo when Cmd+Y is pressed on Mac (Requirement: 9.2)', () => {
      const onRedo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo,
        })
      );

      dispatchKeyboardEvent('y', { metaKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('prevents default browser behavior for Ctrl+Y (Requirement: 9.2)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo: vi.fn(),
        })
      );

      const preventDefaultSpy = dispatchKeyboardEvent('y', { ctrlKey: true });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Ctrl+Shift+Z for redo alternative', () => {
    it('calls onRedo when Ctrl+Shift+Z is pressed (Requirement: 9.3)', () => {
      const onRedo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo,
        })
      );

      dispatchKeyboardEvent('z', { ctrlKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('calls onRedo when Cmd+Shift+Z is pressed on Mac (Requirement: 9.3)', () => {
      const onRedo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo,
        })
      );

      dispatchKeyboardEvent('z', { metaKey: true, shiftKey: true });

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('prevents default browser behavior for Ctrl+Shift+Z (Requirement: 9.3)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo: vi.fn(),
        })
      );

      const preventDefaultSpy = dispatchKeyboardEvent('z', {
        ctrlKey: true,
        shiftKey: true,
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Ctrl+S for save', () => {
    it('calls onSave when Ctrl+S is pressed (Requirement: 9.4)', () => {
      const onSave = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onSave,
        })
      );

      dispatchKeyboardEvent('s', { ctrlKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when Cmd+S is pressed on Mac (Requirement: 9.4)', () => {
      const onSave = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onSave,
        })
      );

      dispatchKeyboardEvent('s', { metaKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('prevents default browser behavior for Ctrl+S (Requirement: 9.4)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onSave: vi.fn(),
        })
      );

      const preventDefaultSpy = dispatchKeyboardEvent('s', { ctrlKey: true });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('no action without Ctrl/Cmd', () => {
    it('does not call onUndo when Z is pressed without Ctrl', () => {
      const onUndo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onUndo,
        })
      );

      dispatchKeyboardEvent('z');

      expect(onUndo).not.toHaveBeenCalled();
    });

    it('does not call onRedo when Y is pressed without Ctrl', () => {
      const onRedo = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onRedo,
        })
      );

      dispatchKeyboardEvent('y');

      expect(onRedo).not.toHaveBeenCalled();
    });

    it('does not call onSave when S is pressed without Ctrl', () => {
      const onSave = vi.fn();
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onSave,
        })
      );

      dispatchKeyboardEvent('s');

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('missing callbacks', () => {
    it('does not throw when onUndo is not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
        })
      );

      expect(() => {
        dispatchKeyboardEvent('z', { ctrlKey: true });
      }).not.toThrow();
    });

    it('does not throw when onRedo is not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
        })
      );

      expect(() => {
        dispatchKeyboardEvent('y', { ctrlKey: true });
      }).not.toThrow();
    });

    it('does not throw when onSave is not provided', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
        })
      );

      expect(() => {
        dispatchKeyboardEvent('s', { ctrlKey: true });
      }).not.toThrow();
    });
  });
});
