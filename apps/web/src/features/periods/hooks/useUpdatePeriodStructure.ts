import { SCHOOL_CONFIG_QUERY_KEY } from '@/features/school-settings/hooks/useSchoolSettings';
import type { SchoolConfigDto } from '@/features/school-settings/types';
import { ApiError } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { updatePeriodStructure } from '../api';
import type { PeriodStructureFormValues } from '../schemas/periodStructure.schema';

export function useUpdatePeriodStructure() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: PeriodStructureFormValues) => updatePeriodStructure(data),
    onSuccess: (config: SchoolConfigDto) => {
      queryClient.setQueryData(SCHOOL_CONFIG_QUERY_KEY, config);
      toast.success(t('periodStructure.success.saved'));
    },
    onError: (error: Error) => {
      if (
        error instanceof ApiError &&
        typeof error.payload === 'object' &&
        error.payload?.code === 'CONFIG_REVISION_CONFLICT'
      ) {
        void queryClient.invalidateQueries({
          queryKey: SCHOOL_CONFIG_QUERY_KEY,
        });
        toast.error(t('periodStructure.errors.revisionConflict'), {
          description: t('periodStructure.errors.revisionConflictDescription'),
        });
        return;
      }
      toast.error(t('periodStructure.errors.saveFailed'), { description: error.message });
    },
  });
}
