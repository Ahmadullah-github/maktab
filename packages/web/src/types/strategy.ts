/**
 * Strategy Configuration Types
 * Visual configuration for solver strategy selection
 */

import type { LucideIcon } from 'lucide-react';
import { Scale, Sparkles, Zap } from 'lucide-react';
import type { SolverStrategy } from '../features/schedule/types';

// ============================================================================
// Strategy Configuration Types
// ============================================================================

/**
 * Configuration for a solver strategy with visual data
 */
export interface StrategyConfig {
  /** Strategy key */
  key: SolverStrategy;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Persian label */
  labelFa: string;
  /** English label */
  labelEn: string;
  /** Estimated time in Persian */
  estimatedTimeFa: string;
  /** Estimated time in English */
  estimatedTimeEn: string;
  /** Persian description */
  descriptionFa: string;
  /** English description */
  descriptionEn: string;
  /** Estimated time in seconds (for progress display) */
  estimatedSeconds: number;
}

/**
 * Strategy configuration with icons and visual data
 * Used by StrategyCard and StrategySelector components
 */
export const STRATEGY_CONFIG: Record<SolverStrategy, StrategyConfig> = {
  fast: {
    key: 'fast',
    icon: Zap,
    labelFa: 'سریع',
    labelEn: 'Fast',
    estimatedTimeFa: '~۳۰ ثانیه',
    estimatedTimeEn: '~30 seconds',
    descriptionFa: 'تولید سریع برای پیش‌نمایش',
    descriptionEn: 'Quick generation for preview',
    estimatedSeconds: 30,
  },
  balanced: {
    key: 'balanced',
    icon: Scale,
    labelFa: 'متعادل',
    labelEn: 'Balanced',
    estimatedTimeFa: '~۲ دقیقه',
    estimatedTimeEn: '~2 minutes',
    descriptionFa: 'تعادل بین سرعت و کیفیت',
    descriptionEn: 'Balance between speed and quality',
    estimatedSeconds: 120,
  },
  thorough: {
    key: 'thorough',
    icon: Sparkles,
    labelFa: 'کامل',
    labelEn: 'Thorough',
    estimatedTimeFa: '~۵ دقیقه',
    estimatedTimeEn: '~5 minutes',
    descriptionFa: 'بهترین کیفیت ممکن',
    descriptionEn: 'Best possible quality',
    estimatedSeconds: 300,
  },
};

/**
 * Get strategy config by key
 */
export function getStrategyConfig(strategy: SolverStrategy): StrategyConfig {
  return STRATEGY_CONFIG[strategy];
}

/**
 * Get all strategy configs as array (for iteration)
 */
export function getAllStrategyConfigs(): StrategyConfig[] {
  return Object.values(STRATEGY_CONFIG);
}

/**
 * Default strategy for new generations
 */
export const DEFAULT_STRATEGY: SolverStrategy = 'balanced';

// ============================================================================
// Strategy Selection State Types
// ============================================================================

/**
 * Props for strategy selection components
 */
export interface StrategySelectionProps {
  /** Currently selected strategy */
  selectedStrategy: SolverStrategy;
  /** Callback when strategy is selected */
  onStrategyChange: (strategy: SolverStrategy) => void;
  /** Whether selection is disabled */
  disabled?: boolean;
}

/**
 * Strategy card visual states
 */
export type StrategyCardState = 'default' | 'selected' | 'disabled' | 'hover';

/**
 * Get CSS classes for strategy card state
 */
export function getStrategyCardClasses(state: StrategyCardState, isSelected: boolean): string {
  const baseClasses = 'relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200';

  if (state === 'disabled') {
    return `${baseClasses} opacity-50 cursor-not-allowed border-gray-200 bg-gray-50`;
  }

  if (isSelected) {
    return `${baseClasses} border-primary bg-primary/5 shadow-md`;
  }

  return `${baseClasses} border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm`;
}
