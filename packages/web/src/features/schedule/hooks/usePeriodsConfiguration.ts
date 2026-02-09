/**
 * usePeriodsConfiguration Hook
 *
 * Derives periods configuration from metadata or lessons
 * Single source of truth for grid layout
 *
 * Phase 2 Enhancement: Addresses Issue #6
 * - Consistent periods per day logic
 * - Single source of truth
 * - Proper fallback hierarchy
 * - Handles variable periods correctly
 */

import { useMemo } from 'react';
import type { DayOfWeek, EnrichedLesson, SolutionMetadata } from '../types';
import { logger } from '../utils/logger';

export interface PeriodsConfiguration {
  /** Map of day to period count */
  periodsMap: Map<DayOfWeek, number>;
  /** Maximum periods across all days */
  maxPeriods: number;
  /** Whether periods vary by day */
  hasVariablePeriods: boolean;
  /** Source of configuration */
  source: 'prop' | 'metadata' | 'lessons' | 'default';
}

/**
 * Derives periods configuration from multiple sources
 * Priority: prop > metadata > lessons > default
 *
 * @param periodsPerDay - Explicit periods configuration (from props)
 * @param days - Array of days to include
 * @param lessons - Enriched lessons array
 * @param metadata - Solution metadata
 * @returns Periods configuration with source tracking
 *
 * @example
 * ```tsx
 * const periodsConfig = usePeriodsConfiguration(
 *   periodsPerDay,
 *   days,
 *   enrichedLessons,
 *   metadata
 * );
 *
 * // Use in grid layout
 * const columns = periodsConfig.maxPeriods;
 * const periodsForSaturday = periodsConfig.periodsMap.get('Saturday');
 * ```
 */
export function usePeriodsConfiguration(
  periodsPerDay: number | Map<DayOfWeek, number> | undefined,
  days: DayOfWeek[],
  lessons: EnrichedLesson[],
  metadata: SolutionMetadata | null
): PeriodsConfiguration {
  return useMemo(() => {
    // Priority 1: Explicit prop (highest priority)
    if (periodsPerDay !== undefined) {
      if (typeof periodsPerDay === 'number') {
        // Fixed periods for all days
        const map = new Map<DayOfWeek, number>();
        for (const day of days) {
          map.set(day, periodsPerDay);
        }

        logger.debug('Periods configuration from prop (fixed)', {
          periods: periodsPerDay,
          source: 'prop',
        });

        return {
          periodsMap: map,
          maxPeriods: periodsPerDay,
          hasVariablePeriods: false,
          source: 'prop',
        };
      } else {
        // Variable periods per day
        let max = 0;
        for (const count of periodsPerDay.values()) {
          if (count > max) max = count;
        }
        const hasVariable = new Set(periodsPerDay.values()).size > 1;

        logger.debug('Periods configuration from prop (variable)', {
          maxPeriods: max,
          hasVariable,
          source: 'prop',
        });

        return {
          periodsMap: periodsPerDay,
          maxPeriods: max,
          hasVariablePeriods: hasVariable,
          source: 'prop',
        };
      }
    }

    // Priority 2: Metadata period configuration
    if (metadata?.periodConfiguration) {
      const config = metadata.periodConfiguration;
      const map = new Map<DayOfWeek, number>();
      let max = 0;

      for (const day of days) {
        const count = config.periodsPerDayMap[day] || 0;
        map.set(day, count);
        if (count > max) max = count;
      }

      logger.debug('Periods configuration from metadata', {
        maxPeriods: max,
        hasVariable: config.hasVariablePeriods,
        source: 'metadata',
      });

      return {
        periodsMap: map,
        maxPeriods: max,
        hasVariablePeriods: config.hasVariablePeriods,
        source: 'metadata',
      };
    }

    // Priority 3: Derive from lessons (fallback)
    if (lessons.length > 0) {
      const map = new Map<DayOfWeek, number>();

      for (const day of days) {
        let maxPeriodForDay = 0;

        for (const lesson of lessons) {
          if (lesson.day === day) {
            // Use periodsThisDay if available (most reliable)
            if (lesson.periodsThisDay !== null && lesson.periodsThisDay > maxPeriodForDay) {
              maxPeriodForDay = lesson.periodsThisDay;
            }
            // Fallback: use periodIndex + 1
            else if (lesson.periodIndex + 1 > maxPeriodForDay) {
              maxPeriodForDay = lesson.periodIndex + 1;
            }
          }
        }

        map.set(day, maxPeriodForDay);
      }

      const max = Math.max(...Array.from(map.values()));
      const hasVariable = new Set(map.values()).size > 1;

      logger.warn('Periods configuration derived from lessons (metadata missing)', {
        maxPeriods: max,
        hasVariable,
        periodsMap: Object.fromEntries(map),
        source: 'lessons',
      });

      return {
        periodsMap: map,
        maxPeriods: max,
        hasVariablePeriods: hasVariable,
        source: 'lessons',
      };
    }

    // Priority 4: Default fallback (last resort)
    const defaultPeriods = 6;
    const map = new Map<DayOfWeek, number>();
    for (const day of days) {
      map.set(day, defaultPeriods);
    }

    logger.warn('Using default periods configuration (no data available)', {
      defaultPeriods,
      source: 'default',
    });

    return {
      periodsMap: map,
      maxPeriods: defaultPeriods,
      hasVariablePeriods: false,
      source: 'default',
    };
  }, [periodsPerDay, days, lessons, metadata]);
}

export default usePeriodsConfiguration;
