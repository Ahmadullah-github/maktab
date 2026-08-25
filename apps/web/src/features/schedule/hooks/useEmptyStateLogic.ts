/**
 * Hook for determining which empty state to display
 *
 * Logic:
 * - Show OnboardingEmptyState when no schedules AND critical data missing
 * - Show encouragement when data exists but no schedules
 * - Show normal dashboard when schedules exist
 *
 * Requirements: 8.1, 8.5
 */

import type { ReadinessData } from '@/types/readiness';
import { isCriticalDataReady } from '@/types/readiness';
import { useMemo } from 'react';

/**
 * Empty state type
 */
export type EmptyStateType = 'onboarding' | 'encouragement' | 'none';

/**
 * Return type for useEmptyStateLogic hook
 */
export interface UseEmptyStateLogicReturn {
  /** Type of empty state to display */
  emptyStateType: EmptyStateType;
  /** Whether to show the onboarding empty state */
  showOnboarding: boolean;
  /** Whether to show the encouragement empty state */
  showEncouragement: boolean;
  /** Whether to show the normal dashboard */
  showNormalDashboard: boolean;
  /** Whether critical data is ready for generation */
  isCriticalReady: boolean;
}

/**
 * Hook for determining which empty state to display
 *
 * @param readinessData - Data about entity counts
 * @param hasSchedules - Whether any schedules exist
 * @returns Object with empty state type and boolean flags
 *
 * Requirements: 8.1, 8.5
 */
export function useEmptyStateLogic(
  readinessData: ReadinessData,
  hasSchedules: boolean
): UseEmptyStateLogicReturn {
  return useMemo(() => {
    // Check if critical data (teachers, classes, subjects) is ready
    const isCriticalReady = isCriticalDataReady(readinessData);

    // Determine empty state type
    let emptyStateType: EmptyStateType;

    if (hasSchedules) {
      // Has schedules - show normal dashboard
      emptyStateType = 'none';
    } else if (!isCriticalReady) {
      // No schedules AND critical data missing - show onboarding (Requirement: 8.1)
      emptyStateType = 'onboarding';
    } else {
      // Data exists but no schedules - show encouragement (Requirement: 8.5)
      emptyStateType = 'encouragement';
    }

    return {
      emptyStateType,
      showOnboarding: emptyStateType === 'onboarding',
      showEncouragement: emptyStateType === 'encouragement',
      showNormalDashboard: emptyStateType === 'none',
      isCriticalReady,
    };
  }, [readinessData, hasSchedules]);
}

/**
 * Determine empty state type (pure function for testing)
 *
 * @param readinessData - Data about entity counts
 * @param hasSchedules - Whether any schedules exist
 * @returns Empty state type
 */
export function determineEmptyStateType(
  readinessData: ReadinessData,
  hasSchedules: boolean
): EmptyStateType {
  if (hasSchedules) {
    return 'none';
  }

  const isCriticalReady = isCriticalDataReady(readinessData);

  if (!isCriticalReady) {
    return 'onboarding';
  }

  return 'encouragement';
}
