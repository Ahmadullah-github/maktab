// Constraints feature exports

// Components
export { ConstraintRanking, type ConstraintRankingProps } from './components/ConstraintRanking';
export {
  ConstraintRankItem as ConstraintRankItemComponent,
  ConstraintRankItemOverlay,
  type ConstraintRankItemProps,
} from './components/ConstraintRankItem';
export { ConstraintsPage, type ConstraintsPageProps } from './components/ConstraintsPage';
export { ConstraintSummary, type ConstraintSummaryProps } from './components/ConstraintSummary';
export { PresetCard, type PresetCardProps } from './components/PresetCard';
export { PresetSelector, type PresetSelectorProps } from './components/PresetSelector';
export { ProblemSizeWarning, type ProblemSizeWarningProps } from './components/ProblemSizeWarning';
export { WeightSlider } from './components/WeightSlider';

// Hooks
export { useConstraintRanking } from './hooks/useConstraintRanking';
export { usePreferences, useSavePreferences } from './hooks/useConstraints';
export { usePresets } from './hooks/usePresets';

// Types
export { CONSTRAINT_DEFINITIONS, DEFAULT_PREFERENCES } from './types';
export type {
  ConstraintCategory,
  ConstraintInfo,
  ConstraintRankItem,
  ConstraintWeightKey,
  OptimizationPreferences,
  PresetConfig,
  PresetId,
  ProblemSize,
  ProblemSizeInfo,
  SavedPreferences,
} from './types';

// Utils
export { PRESETS, detectPreset, getAllPresets, getPreset } from './utils/presets';
export {
  PROBLEM_SIZE_THRESHOLDS,
  estimateRequestCount,
  getProblemSize,
  getProblemSizeInfo,
  getProblemSizeWarningLevel,
  isPresetRecommendedForSize,
} from './utils/problemSize';
export {
  preferencesToRanking,
  rankToWeight,
  rankingToPreferences,
  reorderRanking,
  toggleConstraintEnabled,
  weightToRank,
} from './utils/rankingToWeights';

// API
export { fetchPreferences, savePreferences } from './api';

// i18n
export { constraintsTranslations } from './i18n';
