/**
 * API functions for School Settings
 *
 * Handles communication with the /api/config/school-config endpoint
 * for fetching and updating school operational settings
 *
 * Requirements: 1.2, 5.1, 5.3, 5.4, 5.5, 9.2
 */

import { api } from '@/lib/api';
import {
  fromSchoolSettingsApiResponse,
  toSchoolSettingsApiPayload,
  type SchoolSettingsFormValues,
} from './schemas/schoolSettings.schema';
import type { SchoolSettingsResponse, UpdateSchoolSettingsPayload } from './types';

/**
 * Fetches current school settings from the API
 *
 * @returns Promise with school settings form values
 *
 * Requirements: 1.2, 5.1
 */
export async function fetchSchoolSettings(): Promise<SchoolSettingsFormValues> {
  const response = (await api.config.getSchoolConfig()) as SchoolSettingsResponse;
  return fromSchoolSettingsApiResponse(response);
}

/**
 * Updates school settings via the API
 *
 * @param values - Form values to save
 * @returns Promise with updated school settings
 *
 * Requirements: 5.1, 5.3
 */
export async function updateSchoolSettings(
  values: SchoolSettingsFormValues
): Promise<SchoolSettingsResponse> {
  const payload: UpdateSchoolSettingsPayload = toSchoolSettingsApiPayload(values);
  const response = (await api.config.updateSchoolConfig(payload)) as SchoolSettingsResponse;
  return response;
}

/**
 * School Settings API client object
 * Provides a consistent interface matching other feature modules
 */
export const schoolSettingsApi = {
  fetch: fetchSchoolSettings,
  update: updateSchoolSettings,
};
