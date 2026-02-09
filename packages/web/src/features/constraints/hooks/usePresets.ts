/**
 * usePresets Hook
 * Manages preset selection state and applies preset weights
 */

import { useCallback, useEffect, useState } from 'react';
import type { ConstraintRankItem, OptimizationPreferences, PresetId } from '../types';
import { DEFAULT_PREFERENCES } from '../types';
import { detectPreset, getPreset } from '../utils/presets';
import { preferencesToRanking } from '../utils/rankingToWeights';

interface UsePresetsOptions {
  /** Initial preferences from server */
  initialPreferences?: OptimizationPreferences;
  /** Callback when preferences change */
  onPreferencesChange?: (preferences: OptimizationPreferences) => void;
}

interface UsePresetsReturn {
  /** Currently selected preset */
  selectedPreset: PresetId;
  /** Current preferences (weights + toggle) */
  preferences: OptimizationPreferences;
  /** Current ranking for custom mode */
  ranking: ConstraintRankItem[];
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Select a preset and apply its weights */
  selectPreset: (presetId: PresetId) => void;
  /** Update preferences directly (switches to custom) */
  updatePreferences: (preferences: OptimizationPreferences) => void;
  /** Update ranking (for custom mode) */
  updateRanking: (ranking: ConstraintRankItem[]) => void;
  /** Update the consecutive periods toggle */
  updateAllowConsecutive: (value: boolean) => void;
  /** Reset to initial/default state */
  reset: () => void;
  /** Mark changes as saved */
  markSaved: () => void;
}

export function usePresets(options: UsePresetsOptions = {}): UsePresetsReturn {
  const { initialPreferences, onPreferencesChange } = options;

  // Determine initial preset from preferences
  const initialPreset = initialPreferences ? detectPreset(initialPreferences) : 'balanced';

  // State
  const [selectedPreset, setSelectedPreset] = useState<PresetId>(initialPreset);
  const [preferences, setPreferences] = useState<OptimizationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES
  );
  const [ranking, setRanking] = useState<ConstraintRankItem[]>(() =>
    preferencesToRanking(initialPreferences ?? DEFAULT_PREFERENCES)
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState<OptimizationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES
  );

  // Sync with initial preferences when they change (e.g., from server)
  useEffect(() => {
    if (initialPreferences) {
      const detectedPreset = detectPreset(initialPreferences);
      setSelectedPreset(detectedPreset);
      setPreferences(initialPreferences);
      setRanking(preferencesToRanking(initialPreferences));
      setSavedPreferences(initialPreferences);
      setHasChanges(false);
    }
  }, [initialPreferences]);

  // Notify parent of preference changes
  useEffect(() => {
    onPreferencesChange?.(preferences);
  }, [preferences, onPreferencesChange]);

  /**
   * Select a preset and apply its weights
   */
  const selectPreset = useCallback((presetId: PresetId) => {
    setSelectedPreset(presetId);

    if (presetId !== 'custom') {
      const preset = getPreset(presetId);
      setPreferences(preset.weights);
      setRanking(preferencesToRanking(preset.weights));
    }

    setHasChanges(true);
  }, []);

  /**
   * Update preferences directly (auto-switches to custom if not matching a preset)
   */
  const updatePreferences = useCallback((newPreferences: OptimizationPreferences) => {
    setPreferences(newPreferences);
    setRanking(preferencesToRanking(newPreferences));

    // Check if new preferences match any preset
    const detectedPreset = detectPreset(newPreferences);
    setSelectedPreset(detectedPreset);
    setHasChanges(true);
  }, []);

  /**
   * Update ranking (for custom mode drag-drop)
   */
  const updateRanking = useCallback((newRanking: ConstraintRankItem[]) => {
    setRanking(newRanking);
    setSelectedPreset('custom');
    setHasChanges(true);

    // Note: Actual weight conversion happens when saving
    // This allows the ranking UI to be responsive without constant recalculation
  }, []);

  /**
   * Update the consecutive periods toggle
   */
  const updateAllowConsecutive = useCallback((value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      allowConsecutivePeriodsForSameSubject: value,
    }));
    setHasChanges(true);
  }, []);

  /**
   * Reset to saved/initial state
   */
  const reset = useCallback(() => {
    const resetPrefs = savedPreferences;
    const detectedPreset = detectPreset(resetPrefs);

    setSelectedPreset(detectedPreset);
    setPreferences(resetPrefs);
    setRanking(preferencesToRanking(resetPrefs));
    setHasChanges(false);
  }, [savedPreferences]);

  /**
   * Mark current state as saved
   */
  const markSaved = useCallback(() => {
    setSavedPreferences(preferences);
    setHasChanges(false);
  }, [preferences]);

  return {
    selectedPreset,
    preferences,
    ranking,
    hasChanges,
    selectPreset,
    updatePreferences,
    updateRanking,
    updateAllowConsecutive,
    reset,
    markSaved,
  };
}
