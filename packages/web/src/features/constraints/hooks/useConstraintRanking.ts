/**
 * useConstraintRanking Hook
 * Manages constraint ranking state and converts between ranking and weights
 */

import { useCallback, useMemo } from 'react';
import type { ConstraintRankItem, ConstraintWeightKey, OptimizationPreferences } from '../types';
import {
  preferencesToRanking,
  rankingToPreferences,
  reorderRanking,
  toggleConstraintEnabled,
} from '../utils/rankingToWeights';

interface UseConstraintRankingOptions {
  /** Current ranking state */
  ranking: ConstraintRankItem[];
  /** Callback when ranking changes */
  onRankingChange: (ranking: ConstraintRankItem[]) => void;
  /** Current value of allowConsecutivePeriodsForSameSubject */
  allowConsecutive: boolean;
}

interface UseConstraintRankingReturn {
  /** Current ranking */
  ranking: ConstraintRankItem[];
  /** Enabled items sorted by rank */
  enabledItems: ConstraintRankItem[];
  /** Disabled items */
  disabledItems: ConstraintRankItem[];
  /** Number of enabled constraints */
  enabledCount: number;
  /** Total number of constraints */
  totalCount: number;
  /** Reorder items after drag-drop */
  handleReorder: (fromIndex: number, toIndex: number) => void;
  /** Toggle a constraint's enabled state */
  handleToggle: (key: ConstraintWeightKey) => void;
  /** Convert current ranking to preferences */
  toPreferences: () => OptimizationPreferences;
  /** Reset ranking from preferences */
  fromPreferences: (preferences: OptimizationPreferences) => void;
}

export function useConstraintRanking({
  ranking,
  onRankingChange,
  allowConsecutive,
}: UseConstraintRankingOptions): UseConstraintRankingReturn {
  // Split into enabled and disabled
  const { enabledItems, disabledItems } = useMemo(() => {
    const enabled = ranking.filter((item) => item.enabled).sort((a, b) => a.rank - b.rank);
    const disabled = ranking.filter((item) => !item.enabled);
    return { enabledItems: enabled, disabledItems: disabled };
  }, [ranking]);

  // Counts
  const enabledCount = enabledItems.length;
  const totalCount = ranking.length;

  // Reorder handler
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newRanking = reorderRanking(ranking, fromIndex, toIndex);
      onRankingChange(newRanking);
    },
    [ranking, onRankingChange]
  );

  // Toggle handler
  const handleToggle = useCallback(
    (key: ConstraintWeightKey) => {
      const newRanking = toggleConstraintEnabled(ranking, key);
      onRankingChange(newRanking);
    },
    [ranking, onRankingChange]
  );

  // Convert to preferences
  const toPreferences = useCallback(() => {
    return rankingToPreferences(ranking, allowConsecutive);
  }, [ranking, allowConsecutive]);

  // Reset from preferences
  const fromPreferences = useCallback(
    (preferences: OptimizationPreferences) => {
      const newRanking = preferencesToRanking(preferences);
      onRankingChange(newRanking);
    },
    [onRankingChange]
  );

  return {
    ranking,
    enabledItems,
    disabledItems,
    enabledCount,
    totalCount,
    handleReorder,
    handleToggle,
    toPreferences,
    fromPreferences,
  };
}
