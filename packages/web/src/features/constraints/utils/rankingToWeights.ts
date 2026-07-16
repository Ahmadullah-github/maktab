/**
 * Conversion utilities between ranking order and weight values
 *
 * Ranking system:
 * - Position 1 (top) = highest priority = weight 2.0
 * - Position 2 = weight 1.5
 * - Position 3 = weight 1.0
 * - Position 4 = weight 0.7
 * - Position 5 = weight 0.5
 * - Position 6 = weight 0.3
 * - Position 7+ = weight 0.2
 * - Disabled = weight 0
 */

import type { ConstraintRankItem, ConstraintWeightKey, OptimizationPreferences } from '../types';
import { CONSTRAINT_DEFINITIONS, DEFAULT_PREFERENCES } from '../types';

/**
 * Weight values mapped to ranking positions
 * Index 0 = rank 1 (highest), etc.
 */
const RANK_TO_WEIGHT: number[] = [2.0, 1.5, 1.0, 0.7, 0.5, 0.3, 0.2, 0.2, 0.2, 0.2];

/**
 * Convert a rank position to weight value
 * @param rank - 1-based rank (1 = highest priority)
 * @param enabled - whether the constraint is enabled
 */
export function rankToWeight(rank: number, enabled: boolean): number {
  if (!enabled) return 0;

  const index = Math.max(0, rank - 1);
  return RANK_TO_WEIGHT[Math.min(index, RANK_TO_WEIGHT.length - 1)];
}

/**
 * Convert weight value to approximate rank position
 * Used when initializing ranking from existing weights
 */
export function weightToRank(weight: number): { rank: number; enabled: boolean } {
  if (weight === 0) {
    return { rank: 99, enabled: false };
  }

  // Find closest rank
  let closestRank = 1;
  let closestDiff = Math.abs(RANK_TO_WEIGHT[0] - weight);

  for (let i = 1; i < RANK_TO_WEIGHT.length; i++) {
    const diff = Math.abs(RANK_TO_WEIGHT[i] - weight);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestRank = i + 1;
    }
  }

  return { rank: closestRank, enabled: true };
}

/**
 * Convert ranking items to OptimizationPreferences
 */
export function rankingToPreferences(
  ranking: ConstraintRankItem[],
  allowConsecutive: boolean
): OptimizationPreferences {
  const preferences: OptimizationPreferences = {
    ...DEFAULT_PREFERENCES,
    allowConsecutivePeriodsForSameSubject: allowConsecutive,
  };

  for (const item of ranking) {
    const weight =
      item.key === 'preferClassHomeRoomWeight' && item.enabled && item.rank === 1
        ? 5.0
        : rankToWeight(item.rank, item.enabled);
    (preferences[item.key] as number) = weight;
  }

  return preferences;
}

/**
 * Convert OptimizationPreferences to ranking items
 * Sorted by weight (highest first)
 */
export function preferencesToRanking(preferences: OptimizationPreferences): ConstraintRankItem[] {
  const weightKeys = CONSTRAINT_DEFINITIONS.filter((def) => def.type === 'weight').map(
    (def) => def.key as ConstraintWeightKey
  );

  // Create items with weight info
  const items: Array<{
    key: ConstraintWeightKey;
    weight: number;
    category: ConstraintRankItem['category'];
  }> = [];

  for (const key of weightKeys) {
    const weight = preferences[key] as number;
    const def = CONSTRAINT_DEFINITIONS.find((d) => d.key === key);
    items.push({
      key,
      weight,
      category: def?.category ?? 'general',
    });
  }

  // Sort by weight descending (highest priority first)
  items.sort((a, b) => b.weight - a.weight);

  // Convert to ranking items
  let enabledRank = 1;
  let disabledRank = 100;

  return items.map((item) => {
    const enabled = item.weight > 0;
    return {
      key: item.key,
      enabled,
      rank: enabled ? enabledRank++ : disabledRank++,
      category: item.category,
    };
  });
}

/**
 * Reorder ranking after drag-drop
 * @param ranking - current ranking
 * @param fromIndex - source index
 * @param toIndex - destination index
 */
export function reorderRanking(
  ranking: ConstraintRankItem[],
  fromIndex: number,
  toIndex: number
): ConstraintRankItem[] {
  const result = [...ranking];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // Recalculate ranks
  let enabledRank = 1;
  let disabledRank = 100;

  return result.map((item) => ({
    ...item,
    rank: item.enabled ? enabledRank++ : disabledRank++,
  }));
}

/**
 * Toggle a constraint's enabled state
 * Disabled items move to bottom, enabled items get next available rank
 */
export function toggleConstraintEnabled(
  ranking: ConstraintRankItem[],
  key: ConstraintWeightKey
): ConstraintRankItem[] {
  const updated = ranking.map((item) => {
    if (item.key === key) {
      return { ...item, enabled: !item.enabled };
    }
    return item;
  });

  // Re-sort: enabled items first (by current rank), then disabled
  const enabled = updated.filter((i) => i.enabled).sort((a, b) => a.rank - b.rank);
  const disabled = updated.filter((i) => !i.enabled);

  // Reassign ranks
  let enabledRank = 1;
  let disabledRank = 100;

  return [
    ...enabled.map((item) => ({ ...item, rank: enabledRank++ })),
    ...disabled.map((item) => ({ ...item, rank: disabledRank++ })),
  ];
}
