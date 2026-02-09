/**
 * TanStack Query hooks for Constraints (Optimization Preferences)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchPreferences, savePreferences } from '../api';
import type { OptimizationPreferences } from '../types';

const QUERY_KEY = ['optimization-preferences'];

/**
 * Hook to fetch optimization preferences
 */
export function usePreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to save optimization preferences
 */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (preferences: OptimizationPreferences) => savePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(t('constraints.success.saved'));
    },
    onError: (error) => {
      console.error('Failed to save preferences:', error);
      toast.error(t('constraints.errors.saveFailed'));
    },
  });
}
