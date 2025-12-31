/**
 * Hook for managing display settings with localStorage persistence
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2
 */

import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_DISPLAY_SETTINGS, DISPLAY_SETTINGS_STORAGE_KEY } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import type { DisplayPreset, DisplaySettings } from '../types';
import { logger } from '../utils/logger';

/**
 * Return type for useDisplaySettings hook
 */
export interface UseDisplaySettingsReturn {
  settings: DisplaySettings;
  updateSettings: (updates: Partial<DisplaySettings>) => void;
  applyPreset: (preset: DisplayPreset) => void;
  resetToDefaults: () => void;
}

/**
 * Validates and merges settings with defaults
 * Handles corrupted or partial settings from localStorage
 */
function validateSettings(parsed: unknown): DisplaySettings {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }

  const settings = parsed as Record<string, unknown>;

  // Validate cellSize
  const validCellSizes = ['compact', 'normal', 'large'];
  const cellSize = validCellSizes.includes(settings.cellSize as string)
    ? (settings.cellSize as DisplaySettings['cellSize'])
    : DEFAULT_DISPLAY_SETTINGS.cellSize;

  // Validate fontSize
  const validFontSizes = ['sm', 'md', 'lg'];
  const fontSize = validFontSizes.includes(settings.fontSize as string)
    ? (settings.fontSize as DisplaySettings['fontSize'])
    : DEFAULT_DISPLAY_SETTINGS.fontSize;

  // Validate colorBy
  const validColorBy = ['none', 'subject', 'teacher'];
  const colorBy = validColorBy.includes(settings.colorBy as string)
    ? (settings.colorBy as DisplaySettings['colorBy'])
    : DEFAULT_DISPLAY_SETTINGS.colorBy;

  return {
    showSubjectName: true, // Always true
    showTeacherName:
      typeof settings.showTeacherName === 'boolean'
        ? settings.showTeacherName
        : DEFAULT_DISPLAY_SETTINGS.showTeacherName,
    showRoomName:
      typeof settings.showRoomName === 'boolean'
        ? settings.showRoomName
        : DEFAULT_DISPLAY_SETTINGS.showRoomName,
    cellSize,
    fontSize,
    colorBy,
  };
}

/**
 * Loads settings from localStorage
 * Returns default settings if localStorage is unavailable or contains invalid data
 */
function loadFromLocalStorage(): DisplaySettings {
  try {
    const stored = localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_DISPLAY_SETTINGS };
    }

    const parsed = JSON.parse(stored);
    return validateSettings(parsed);
  } catch (error) {
    logger.warn('Failed to load display settings from localStorage', { error });
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

/**
 * Saves settings to localStorage
 */
function saveToLocalStorage(settings: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.error('Failed to save display settings to localStorage', { error });
  }
}

/**
 * Hook for managing display settings with localStorage persistence
 *
 * Features:
 * - Loads settings from localStorage on mount
 * - Syncs with Zustand store's displaySettings
 * - Debounces localStorage writes (300ms)
 * - Provides updateSettings, applyPreset, resetToDefaults functions
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2
 */
export function useDisplaySettings(): UseDisplaySettingsReturn {
  const settings = useScheduleStore((state) => state.displaySettings);
  const setDisplaySettings = useScheduleStore((state) => state.setDisplaySettings);

  // Ref for debounce timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if initial load has happened
  const initialLoadRef = useRef(false);

  /**
   * Load settings from localStorage on mount
   * Requirements: 5.2, 5.4
   */
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const loadedSettings = loadFromLocalStorage();
    setDisplaySettings(loadedSettings);

    logger.debug('Loaded display settings from localStorage', { loadedSettings });
  }, [setDisplaySettings]);

  /**
   * Debounced save to localStorage when settings change
   * Requirements: 5.1, 5.3
   */
  useEffect(() => {
    // Skip the initial render
    if (!initialLoadRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce localStorage write by 300ms
    saveTimeoutRef.current = setTimeout(() => {
      saveToLocalStorage(settings);
      logger.debug('Saved display settings to localStorage', { settings });
    }, 300);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);

  /**
   * Updates display settings partially
   * Requirements: 6.1, 6.2
   */
  const updateSettings = useCallback(
    (updates: Partial<DisplaySettings>) => {
      // Ensure showSubjectName is always true
      const safeUpdates = { ...updates };
      if ('showSubjectName' in safeUpdates) {
        safeUpdates.showSubjectName = true;
      }

      setDisplaySettings(safeUpdates);
    },
    [setDisplaySettings]
  );

  /**
   * Applies a preset configuration
   * Requirements: 4.2, 4.3, 4.4
   */
  const applyPreset = useCallback(
    (preset: DisplayPreset) => {
      setDisplaySettings({
        ...DEFAULT_DISPLAY_SETTINGS,
        ...preset.settings,
        showSubjectName: true, // Always true
      });

      logger.debug('Applied display preset', { preset: preset.key });
    },
    [setDisplaySettings]
  );

  /**
   * Resets settings to defaults
   */
  const resetToDefaults = useCallback(() => {
    setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS });
    logger.debug('Reset display settings to defaults');
  }, [setDisplaySettings]);

  return {
    settings,
    updateSettings,
    applyPreset,
    resetToDefaults,
  };
}
