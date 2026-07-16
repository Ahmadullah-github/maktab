import { api } from '@/lib/api';
import {
  toSchoolSettingsApiPayload,
  type SchoolSettingsFormValues,
} from './schemas/schoolSettings.schema';
import type { SchoolConfigDto } from './types';
import { parseSchoolConfigDto } from './schemas/schoolConfigDto.schema';

export async function fetchSchoolConfig(): Promise<SchoolConfigDto> {
  return parseSchoolConfigDto(await api.config.getSchoolConfig());
}

export async function updateSchoolSettings(
  values: SchoolSettingsFormValues
): Promise<SchoolConfigDto> {
  return parseSchoolConfigDto(
    await api.config.updateGeneralSchoolConfig(toSchoolSettingsApiPayload(values))
  );
}
