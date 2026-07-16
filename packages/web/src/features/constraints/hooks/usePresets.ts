import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConstraintWeightKey, OptimizationPreferences, OptimizationStrength, PresetId } from '../types';
import { DEFAULT_PREFERENCES } from '../types';
import { detectPreset, getPreset } from '../utils/presets';

interface UsePresetsOptions {
  initialPreferences?: OptimizationPreferences;
}

export function usePresets({ initialPreferences }: UsePresetsOptions = {}) {
  const [preferences, setPreferences] = useState<OptimizationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES
  );
  const [savedPreferences, setSavedPreferences] = useState<OptimizationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES
  );

  useEffect(() => {
    if (!initialPreferences) return;
    setPreferences((current) =>
      JSON.stringify(current) === JSON.stringify(savedPreferences)
        ? initialPreferences
        : current
    );
    setSavedPreferences(initialPreferences);
  }, [initialPreferences, savedPreferences]);

  const hasChanges = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(savedPreferences),
    [preferences, savedPreferences]
  );
  const selectedPreset = useMemo(() => detectPreset(preferences), [preferences]);

  const selectPreset = useCallback((presetId: PresetId) => {
    if (presetId !== 'custom') setPreferences({ ...getPreset(presetId).weights });
  }, []);
  const updateStrength = useCallback((key: ConstraintWeightKey, value: OptimizationStrength) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);
  const updateAllowConsecutive = useCallback((value: boolean) => {
    setPreferences((current) => ({
      ...current,
      allowConsecutivePeriodsForSameSubject: value,
    }));
  }, []);
  const discardChanges = useCallback(() => setPreferences(savedPreferences), [savedPreferences]);
  const restoreDefaults = useCallback(() => setPreferences({ ...DEFAULT_PREFERENCES }), []);
  const markSaved = useCallback((saved: OptimizationPreferences) => {
    setPreferences(saved);
    setSavedPreferences(saved);
  }, []);

  return {
    selectedPreset,
    preferences,
    hasChanges,
    selectPreset,
    updateStrength,
    updateAllowConsecutive,
    discardChanges,
    restoreDefaults,
    markSaved,
  };
}
