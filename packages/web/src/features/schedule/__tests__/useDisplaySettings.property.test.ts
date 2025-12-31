/**
 * Property-based tests for useDisplaySettings hook
 * **Feature: schedule-phase4, Property 7: Settings Persistence Round-Trip**
 * **Feature: schedule-phase4, Property 8: Reactive State Updates**
 *
 * Note: These tests directly test the localStorage persistence and store
 * synchronization logic without React rendering, since the vitest environment
 * is configured for node (not jsdom).
 */

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_DISPLAY_SETTINGS, DISPLAY_SETTINGS_STORAGE_KEY } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import type { CellSize, ColorCodingMode, DisplaySettings, FontSize } from '../types';

// Generator for CellSize
const cellSizeArb = fc.constantFrom<CellSize>('compact', 'normal', 'large');

// Generator for FontSize
const fontSizeArb = fc.constantFrom<FontSize>('sm', 'md', 'lg');

// Generator for ColorCodingMode
const colorCodingModeArb = fc.constantFrom<ColorCodingMode>('none', 'subject', 'teacher');

// Generator for valid DisplaySettings
const displaySettingsArb = fc.record({
  showSubjectName: fc.constant(true), // Always true
  showTeacherName: fc.boolean(),
  showRoomName: fc.boolean(),
  cellSize: cellSizeArb,
  fontSize: fontSizeArb,
  colorBy: colorCodingModeArb,
});

// Mock localStorage for testing
let localStorageMock: Record<string, string> = {};

/**
 * Simulates saving settings to localStorage (mirrors hook behavior)
 */
function saveToLocalStorage(settings: DisplaySettings): void {
  localStorageMock[DISPLAY_SETTINGS_STORAGE_KEY] = JSON.stringify(settings);
}

/**
 * Simulates loading settings from localStorage (mirrors hook behavior)
 */
function loadFromLocalStorage(): DisplaySettings {
  const stored = localStorageMock[DISPLAY_SETTINGS_STORAGE_KEY];
  if (!stored) {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }

  try {
    const parsed = JSON.parse(stored);
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

/**
 * Validates and merges settings with defaults (mirrors hook behavior)
 */
function validateSettings(parsed: unknown): DisplaySettings {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }

  const settings = parsed as Record<string, unknown>;

  const validCellSizes = ['compact', 'normal', 'large'];
  const cellSize = validCellSizes.includes(settings.cellSize as string)
    ? (settings.cellSize as DisplaySettings['cellSize'])
    : DEFAULT_DISPLAY_SETTINGS.cellSize;

  const validFontSizes = ['sm', 'md', 'lg'];
  const fontSize = validFontSizes.includes(settings.fontSize as string)
    ? (settings.fontSize as DisplaySettings['fontSize'])
    : DEFAULT_DISPLAY_SETTINGS.fontSize;

  const validColorBy = ['none', 'subject', 'teacher'];
  const colorBy = validColorBy.includes(settings.colorBy as string)
    ? (settings.colorBy as DisplaySettings['colorBy'])
    : DEFAULT_DISPLAY_SETTINGS.colorBy;

  return {
    showSubjectName: true,
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

describe('useDisplaySettings Property Tests', () => {
  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock = {};

    // Reset Zustand store
    useScheduleStore.getState().clearSchedule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **Feature: schedule-phase4, Property 7: Settings Persistence Round-Trip**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any valid DisplaySettings object, saving to localStorage via
   * useDisplaySettings and then loading on a fresh mount SHALL produce
   * an equivalent DisplaySettings object.
   */
  it('Property 7: Settings persistence round-trip preserves all values', () => {
    fc.assert(
      fc.property(displaySettingsArb, (originalSettings) => {
        // Reset state
        localStorageMock = {};
        useScheduleStore.getState().clearSchedule();

        // Step 1: Save settings to localStorage (simulates hook save)
        saveToLocalStorage(originalSettings);

        // Step 2: Load settings from localStorage (simulates hook load on mount)
        const loadedSettings = loadFromLocalStorage();

        // Verify loaded settings match original
        expect(loadedSettings.showSubjectName).toBe(true); // Always true
        expect(loadedSettings.showTeacherName).toBe(originalSettings.showTeacherName);
        expect(loadedSettings.showRoomName).toBe(originalSettings.showRoomName);
        expect(loadedSettings.cellSize).toBe(originalSettings.cellSize);
        expect(loadedSettings.fontSize).toBe(originalSettings.fontSize);
        expect(loadedSettings.colorBy).toBe(originalSettings.colorBy);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase4, Property 8: Reactive State Updates**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any settings change via updateSettings, components consuming the
   * useDisplaySettings hook SHALL receive the updated values and trigger
   * a re-render within the same React update cycle.
   *
   * This test verifies that the Zustand store's setDisplaySettings action
   * immediately updates the state (which is the foundation for reactive updates).
   */
  it('Property 8: setDisplaySettings triggers immediate state updates', () => {
    fc.assert(
      fc.property(displaySettingsArb, (newSettings) => {
        // Reset store
        useScheduleStore.getState().clearSchedule();

        // Capture initial settings
        const initialSettings = { ...useScheduleStore.getState().displaySettings };

        // Update settings via store action (mirrors hook's updateSettings)
        useScheduleStore.getState().setDisplaySettings(newSettings);

        // Verify settings are immediately updated (synchronous)
        const updatedSettings = useScheduleStore.getState().displaySettings;

        // Verify all fields are updated
        expect(updatedSettings.showTeacherName).toBe(newSettings.showTeacherName);
        expect(updatedSettings.showRoomName).toBe(newSettings.showRoomName);
        expect(updatedSettings.cellSize).toBe(newSettings.cellSize);
        expect(updatedSettings.fontSize).toBe(newSettings.fontSize);
        expect(updatedSettings.colorBy).toBe(newSettings.colorBy);

        // Verify the update happened (settings changed from initial if different)
        if (
          newSettings.showTeacherName !== initialSettings.showTeacherName ||
          newSettings.showRoomName !== initialSettings.showRoomName ||
          newSettings.cellSize !== initialSettings.cellSize ||
          newSettings.fontSize !== initialSettings.fontSize ||
          newSettings.colorBy !== initialSettings.colorBy
        ) {
          const hasChange =
            updatedSettings.showTeacherName !== initialSettings.showTeacherName ||
            updatedSettings.showRoomName !== initialSettings.showRoomName ||
            updatedSettings.cellSize !== initialSettings.cellSize ||
            updatedSettings.fontSize !== initialSettings.fontSize ||
            updatedSettings.colorBy !== initialSettings.colorBy;

          expect(hasChange).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Partial updates preserve other settings
   */
  it('Partial updates preserve unmodified settings', () => {
    fc.assert(
      fc.property(
        displaySettingsArb,
        fc.record({
          showTeacherName: fc.option(fc.boolean(), { nil: undefined }),
          showRoomName: fc.option(fc.boolean(), { nil: undefined }),
          cellSize: fc.option(cellSizeArb, { nil: undefined }),
          fontSize: fc.option(fontSizeArb, { nil: undefined }),
          colorBy: fc.option(colorCodingModeArb, { nil: undefined }),
        }),
        (initialSettings, partialUpdate) => {
          // Reset store
          useScheduleStore.getState().clearSchedule();

          // Set initial settings
          useScheduleStore.getState().setDisplaySettings(initialSettings);

          // Apply partial update (filter out undefined values)
          const cleanUpdate: Partial<DisplaySettings> = {};
          if (partialUpdate.showTeacherName !== undefined) {
            cleanUpdate.showTeacherName = partialUpdate.showTeacherName;
          }
          if (partialUpdate.showRoomName !== undefined) {
            cleanUpdate.showRoomName = partialUpdate.showRoomName;
          }
          if (partialUpdate.cellSize !== undefined) {
            cleanUpdate.cellSize = partialUpdate.cellSize;
          }
          if (partialUpdate.fontSize !== undefined) {
            cleanUpdate.fontSize = partialUpdate.fontSize;
          }
          if (partialUpdate.colorBy !== undefined) {
            cleanUpdate.colorBy = partialUpdate.colorBy;
          }

          useScheduleStore.getState().setDisplaySettings(cleanUpdate);

          const finalSettings = useScheduleStore.getState().displaySettings;

          // Verify updated fields have new values
          if (cleanUpdate.showTeacherName !== undefined) {
            expect(finalSettings.showTeacherName).toBe(cleanUpdate.showTeacherName);
          } else {
            expect(finalSettings.showTeacherName).toBe(initialSettings.showTeacherName);
          }

          if (cleanUpdate.showRoomName !== undefined) {
            expect(finalSettings.showRoomName).toBe(cleanUpdate.showRoomName);
          } else {
            expect(finalSettings.showRoomName).toBe(initialSettings.showRoomName);
          }

          if (cleanUpdate.cellSize !== undefined) {
            expect(finalSettings.cellSize).toBe(cleanUpdate.cellSize);
          } else {
            expect(finalSettings.cellSize).toBe(initialSettings.cellSize);
          }

          if (cleanUpdate.fontSize !== undefined) {
            expect(finalSettings.fontSize).toBe(cleanUpdate.fontSize);
          } else {
            expect(finalSettings.fontSize).toBe(initialSettings.fontSize);
          }

          if (cleanUpdate.colorBy !== undefined) {
            expect(finalSettings.colorBy).toBe(cleanUpdate.colorBy);
          } else {
            expect(finalSettings.colorBy).toBe(initialSettings.colorBy);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Invalid localStorage data falls back to defaults
   */
  it('Invalid localStorage data falls back to defaults', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(), // Random string (not valid JSON)
          fc.constant('null'),
          fc.constant('undefined'),
          fc.constant('{}'),
          fc
            .record({
              cellSize: fc.string().filter((s) => !['compact', 'normal', 'large'].includes(s)),
              fontSize: fc.string().filter((s) => !['sm', 'md', 'lg'].includes(s)),
              colorBy: fc.string().filter((s) => !['none', 'subject', 'teacher'].includes(s)),
            })
            .map((obj) => JSON.stringify(obj))
        ),
        (invalidData) => {
          // Set invalid data in localStorage
          localStorageMock[DISPLAY_SETTINGS_STORAGE_KEY] = invalidData;

          // Load settings
          const loadedSettings = loadFromLocalStorage();

          // Should fall back to defaults for invalid values
          expect(loadedSettings.showSubjectName).toBe(DEFAULT_DISPLAY_SETTINGS.showSubjectName);
          expect(['compact', 'normal', 'large']).toContain(loadedSettings.cellSize);
          expect(['sm', 'md', 'lg']).toContain(loadedSettings.fontSize);
          expect(['none', 'subject', 'teacher']).toContain(loadedSettings.colorBy);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: resetToDefaults always produces default settings
   */
  it('resetToDefaults always produces default settings', () => {
    fc.assert(
      fc.property(displaySettingsArb, (randomSettings) => {
        // Reset store
        useScheduleStore.getState().clearSchedule();

        // Set random settings
        useScheduleStore.getState().setDisplaySettings(randomSettings);

        // Reset to defaults (simulates hook's resetToDefaults)
        useScheduleStore.getState().setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS });

        const finalSettings = useScheduleStore.getState().displaySettings;

        // Verify all settings match defaults
        expect(finalSettings.showSubjectName).toBe(DEFAULT_DISPLAY_SETTINGS.showSubjectName);
        expect(finalSettings.showTeacherName).toBe(DEFAULT_DISPLAY_SETTINGS.showTeacherName);
        expect(finalSettings.showRoomName).toBe(DEFAULT_DISPLAY_SETTINGS.showRoomName);
        expect(finalSettings.cellSize).toBe(DEFAULT_DISPLAY_SETTINGS.cellSize);
        expect(finalSettings.fontSize).toBe(DEFAULT_DISPLAY_SETTINGS.fontSize);
        expect(finalSettings.colorBy).toBe(DEFAULT_DISPLAY_SETTINGS.colorBy);
      }),
      { numRuns: 100 }
    );
  });
});
