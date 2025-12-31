/**
 * API functions for Period Structure
 *
 * Handles communication with the /api/config/school-config endpoint
 * for fetching and updating period structure settings
 *
 * Requirements: 2.2, 5.2, 5.3, 5.4, 5.5, 9.2
 */

import { api } from '@/lib/api';
import {
  fromPeriodStructureApiResponse,
  toPeriodStructureApiPayload,
  type PeriodStructureFormValues,
} from './schemas/periodStructure.schema';
import type { PeriodStructureResponse, UpdatePeriodStructurePayload } from './types';

/**
 * Fetches current period structure from the API
 *
 * @returns Promise with period structure form values
 *
 * Requirements: 2.2, 5.2
 */
export async function fetchPeriodStructure(): Promise<PeriodStructureFormValues> {
  const response = (await api.config.getSchoolConfig()) as PeriodStructureResponse;
  return fromPeriodStructureApiResponse(response);
}

/**
 * Updates period structure via the API
 *
 * @param values - Form values to save
 * @returns Promise with updated period structure
 *
 * Requirements: 5.2, 5.3
 */
export async function updatePeriodStructure(
  values: PeriodStructureFormValues
): Promise<PeriodStructureResponse> {
  const payload: UpdatePeriodStructurePayload = toPeriodStructureApiPayload(values);
  const response = (await api.config.updateSchoolConfig(payload)) as PeriodStructureResponse;
  return response;
}

/**
 * Period Structure API client object
 * Provides a consistent interface matching other feature modules
 */
export const periodStructureApi = {
  fetch: fetchPeriodStructure,
  update: updatePeriodStructure,
};
