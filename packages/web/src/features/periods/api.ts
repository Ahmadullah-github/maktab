import type { SchoolConfigDto } from '@/features/school-settings/types';
import { parseSchoolConfigDto } from '@/features/school-settings/schemas/schoolConfigDto.schema';
import { api } from '@/lib/api';
import {
  toPeriodStructureApiPayload,
  type PeriodStructureFormValues,
} from './schemas/periodStructure.schema';

export async function updatePeriodStructure(
  values: PeriodStructureFormValues
): Promise<SchoolConfigDto> {
  return parseSchoolConfigDto(
    await api.config.updatePeriodStructure(toPeriodStructureApiPayload(values))
  );
}
