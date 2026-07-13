import { api } from '@/lib/api';
import {
  toSchoolSettingsApiPayload,
  type SchoolSettingsFormValues,
} from './schemas/schoolSettings.schema';
import type { SchoolConfigDto } from './types';

export async function fetchSchoolConfig(): Promise<SchoolConfigDto> {
  return (await api.config.getSchoolConfig()) as SchoolConfigDto;
}

export async function updateSchoolSettings(
  values: SchoolSettingsFormValues
): Promise<SchoolConfigDto> {
  return (await api.config.updateGeneralSchoolConfig(
    toSchoolSettingsApiPayload(values)
  )) as SchoolConfigDto;
}
