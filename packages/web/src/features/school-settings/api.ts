import { api } from '@/lib/api';
import {
  toSchoolSettingsApiPayload,
  type SchoolSettingsFormValues,
} from './schemas/schoolSettings.schema';
import type { SchoolConfigDto } from './types';
import { parseSchoolConfigDto } from './schemas/schoolConfigDto.schema';
import {
  schoolProfileDtoSchema,
  schoolProfileStatusDtoSchema,
  type SchoolProfileDto,
  type SchoolProfileStatusDto,
} from './schemas/schoolProfileDto.schema';
import {
  toSchoolProfilePayload,
  type SchoolProfileFormValues,
} from './schemas/schoolProfile.schema';

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

export async function fetchSchoolProfile(): Promise<SchoolProfileStatusDto> {
  return schoolProfileStatusDtoSchema.parse(await api.config.getSchoolProfile());
}

export async function createSchoolProfile(
  values: SchoolProfileFormValues
): Promise<SchoolProfileDto> {
  return schoolProfileDtoSchema.parse(
    await api.config.createSchoolProfile(toSchoolProfilePayload(values))
  );
}

export async function updateSchoolProfile(
  values: SchoolProfileFormValues,
  revision: number
): Promise<SchoolProfileDto> {
  return schoolProfileDtoSchema.parse(
    await api.config.updateSchoolProfile({ revision, ...toSchoolProfilePayload(values) })
  );
}

export async function uploadSchoolLogo(file: File, revision: number): Promise<SchoolProfileDto> {
  return schoolProfileDtoSchema.parse(await api.config.uploadSchoolLogo(file, revision));
}

export async function deleteSchoolLogo(revision: number): Promise<SchoolProfileDto> {
  return schoolProfileDtoSchema.parse(await api.config.deleteSchoolLogo(revision));
}
