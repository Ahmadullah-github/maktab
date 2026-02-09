/**
 * API functions for Constraints (Optimization Preferences)
 * Uses the config/:key endpoint for storage
 */

import { api } from '@/lib/api';
import type { OptimizationPreferences } from './types';
import { DEFAULT_PREFERENCES } from './types';

const CONFIG_KEY = 'optimization-preferences';

/**
 * Fetches optimization preferences from the server
 * Returns default values if not found
 */
export async function fetchPreferences(): Promise<OptimizationPreferences> {
  try {
    const response = await api.config.get(CONFIG_KEY);
    if (response && response.value) {
      const parsed =
        typeof response.value === 'string' ? JSON.parse(response.value) : response.value;
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
    return DEFAULT_PREFERENCES;
  } catch (error) {
    // If not found (404), return defaults
    if (error instanceof Error && error.message.includes('404')) {
      return DEFAULT_PREFERENCES;
    }
    throw error;
  }
}

/**
 * Saves optimization preferences to the server
 */
export async function savePreferences(
  preferences: OptimizationPreferences
): Promise<OptimizationPreferences> {
  await api.config.save(CONFIG_KEY, preferences);
  return preferences;
}
