import { ApiError } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchPreferences, savePreferences } from '../api';

export const optimizationPreferencesQueryKey = (schoolId: number | null) => [
  'optimization-preferences',
  schoolId,
] as const;

export function usePreferences(schoolId: number | null = null) {
  return useQuery({
    queryKey: optimizationPreferencesQueryKey(schoolId),
    queryFn: () => fetchPreferences(schoolId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: savePreferences,
    onSuccess: (profile) => {
      queryClient.setQueryData(optimizationPreferencesQueryKey(profile.schoolId), profile);
      toast.success(t('constraints.success.saved'));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ['optimization-preferences'] });
        toast.error(t('constraints.errors.revisionConflict'), {
          description: t('constraints.errors.revisionConflictDescription'),
        });
        return;
      }
      console.error('Failed to save preferences:', error);
      toast.error(t('constraints.errors.saveFailed'));
    },
  });
}
