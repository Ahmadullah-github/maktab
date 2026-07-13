import type { SchoolConfigDto } from '@/features/school-settings/types';
import { api } from '@/lib/api';
import {
  toPeriodStructureApiPayload,
  type PeriodStructureFormValues,
} from './schemas/periodStructure.schema';

export async function updatePeriodStructure(
  values: PeriodStructureFormValues
): Promise<SchoolConfigDto> {
  return (await api.config.updatePeriodStructure(
    toPeriodStructureApiPayload(values)
  )) as SchoolConfigDto;
}
