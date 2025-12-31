/**
 * TanStack Query hook for SchoolConfig data
 *
 * Fetches school configuration for dynamic constraint limits
 * Used by teacher forms to validate constraint values
 *
 * Requirements: 4.1, 5.1, 5.2, 5.3
 */

import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../utils/logger';

/**
 * SchoolConfig interface for frontend use
 * Contains the fields needed for teacher constraint validation
 */
export interface SchoolConfig {
  id: number;
  schoolId: number | null;
  schoolName: string | null;
  daysPerWeek: number;
  periodsPerDay: number;
  defaultPeriodsPerDay: number;
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number> | null;
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;
  enableMinistryValidation: boolean;
  ministryValidationMode: string;
  lowResourceMode: boolean;
}

/**
 * Raw API response for SchoolConfig
 */
interface SchoolConfigResponse {
  id: number;
  schoolId: number | null;
  schoolName: string | null;
  daysPerWeek: number;
  periodsPerDay: number;
  defaultPeriodsPerDay: number;
  daysOfWeekJson: string | null;
  periodsPerDayMapJson: string | null;
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;
  enableMinistryValidation: boolean;
  ministryValidationMode: string;
  lowResourceMode: boolean;
}

/**
 * Default Afghan school week days
 */
const DEFAULT_DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/**
 * Deserializes the raw API response to SchoolConfig
 */
function deserializeSchoolConfig(response: SchoolConfigResponse): SchoolConfig {
  let daysOfWeek: string[] = DEFAULT_DAYS_OF_WEEK;
  let periodsPerDayMap: Record<string, number> | null = null;

  // Parse daysOfWeekJson
  if (response.daysOfWeekJson) {
    try {
      daysOfWeek = JSON.parse(response.daysOfWeekJson);
    } catch {
      logger.warn('Failed to parse daysOfWeekJson, using defaults');
    }
  }

  // Parse periodsPerDayMapJson
  if (response.periodsPerDayMapJson) {
    try {
      periodsPerDayMap = JSON.parse(response.periodsPerDayMapJson);
    } catch {
      logger.warn('Failed to parse periodsPerDayMapJson');
    }
  }

  return {
    id: response.id,
    schoolId: response.schoolId,
    schoolName: response.schoolName,
    daysPerWeek: response.daysPerWeek,
    periodsPerDay: response.periodsPerDay,
    defaultPeriodsPerDay: response.defaultPeriodsPerDay,
    daysOfWeek,
    periodsPerDayMap,
    ramadanModeEnabled: response.ramadanModeEnabled,
    ramadanPeriodDuration: response.ramadanPeriodDuration,
    enableMinistryValidation: response.enableMinistryValidation,
    ministryValidationMode: response.ministryValidationMode,
    lowResourceMode: response.lowResourceMode,
  };
}

/**
 * Query key for school config data
 */
export const SCHOOL_CONFIG_QUERY_KEY = ['school-config'] as const;

/**
 * Hook for fetching school configuration
 *
 * Used to get dynamic constraint limits for teacher validation:
 * - maxPeriodsPerWeek: daysPerWeek × defaultPeriodsPerDay
 * - maxPeriodsPerDay: from SchoolConfig
 * - daysOfWeek: for availability matrix
 * - periodsPerDayMap: for variable periods per day
 *
 * @returns Query result with SchoolConfig data
 *
 * Requirements: 4.1, 5.1, 5.2, 5.3
 */
export function useSchoolConfig() {
  return useQuery({
    queryKey: SCHOOL_CONFIG_QUERY_KEY,
    queryFn: async () => {
      logger.debug('Fetching school config');
      const response = (await api.config.getSchoolConfig()) as SchoolConfigResponse;
      const config = deserializeSchoolConfig(response);
      logger.debug('School config fetched', {
        daysPerWeek: config.daysPerWeek,
        periodsPerDay: config.periodsPerDay,
      });
      return config;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - config doesn't change often
  });
}

/**
 * Calculates the maximum periods per week based on SchoolConfig
 *
 * @param config - SchoolConfig data
 * @returns Maximum periods per week
 *
 * Requirements: 5.1
 */
export function calculateMaxPeriodsPerWeek(config: SchoolConfig): number {
  return config.daysPerWeek * config.defaultPeriodsPerDay;
}

/**
 * Gets the number of periods for a specific day
 *
 * @param config - SchoolConfig data
 * @param day - Day name (e.g., 'Saturday')
 * @returns Number of periods for that day
 *
 * Requirements: 4.1, 4.5
 */
export function getPeriodsForDay(config: SchoolConfig, day: string): number {
  if (config.periodsPerDayMap && config.periodsPerDayMap[day] !== undefined) {
    return config.periodsPerDayMap[day];
  }
  return config.defaultPeriodsPerDay;
}
