/**
 * Problem size detection and constraint budget utilities
 *
 * Based on solver's constraint budget system:
 * - Small (<80 requests): All constraints, 5000 max penalty vars
 * - Medium (80-150): Critical + Important, 2000 max penalty vars
 * - Large (>150): Critical only, 1000 max penalty vars
 */

import type { PresetId, ProblemSize, ProblemSizeInfo } from '../types';

/**
 * Thresholds for problem size categories
 */
export const PROBLEM_SIZE_THRESHOLDS = {
  small: 80,
  medium: 150,
} as const;

/**
 * Determine problem size from request count
 */
export function getProblemSize(requestCount: number): ProblemSize {
  if (requestCount < PROBLEM_SIZE_THRESHOLDS.small) {
    return 'small';
  }
  if (requestCount < PROBLEM_SIZE_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'large';
}

/**
 * Get full problem size info with recommendations
 */
export function getProblemSizeInfo(requestCount: number): ProblemSizeInfo {
  const size = getProblemSize(requestCount);

  const sizeConfig: Record<ProblemSize, Omit<ProblemSizeInfo, 'size' | 'requestCount'>> = {
    small: {
      activeConstraintLevel: 'all',
      recommendedPreset: 'balanced',
    },
    medium: {
      activeConstraintLevel: 'critical-important',
      recommendedPreset: 'balanced',
    },
    large: {
      activeConstraintLevel: 'critical-only',
      recommendedPreset: 'fast',
    },
  };

  return {
    size,
    requestCount,
    ...sizeConfig[size],
  };
}

/**
 * Check if a preset is recommended for the given problem size
 */
export function isPresetRecommendedForSize(presetId: PresetId, requestCount: number): boolean {
  const info = getProblemSizeInfo(requestCount);
  return info.recommendedPreset === presetId;
}

/**
 * Get warning level for problem size
 * - 'none': Small problems, all constraints work
 * - 'info': Medium problems, some constraints may be ignored
 * - 'warning': Large problems, only critical constraints apply
 */
export function getProblemSizeWarningLevel(requestCount: number): 'none' | 'info' | 'warning' {
  const size = getProblemSize(requestCount);

  switch (size) {
    case 'small':
      return 'none';
    case 'medium':
      return 'info';
    case 'large':
      return 'warning';
  }
}

/**
 * Estimate request count from entity counts
 * Request = class × subject assignments
 * This is a rough estimate for UI purposes
 */
export function estimateRequestCount(classCount: number, avgSubjectsPerClass: number = 8): number {
  return classCount * avgSubjectsPerClass;
}
