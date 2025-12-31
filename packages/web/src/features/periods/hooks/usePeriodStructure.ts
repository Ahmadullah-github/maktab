/**
 * TanStack Query hooks for Period Structure data management
 *
 * Provides hooks for fetching and updating period structure settings
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 2.2, 5.2, 5.3, 5.4, 5.5, 9.2
 */

import { SCHOOL_SETTINGS_QUERY_KEY } from '@/features/school-settings/hooks/useSchoolSettings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { periodStructureApi } from '../api';
import type { PeriodStructureFormValues } from '../schemas/periodStructure.schema';

/**
 * Query key for period structure data
 * Used for cache management and invalidation
 */
export const PERIOD_STRUCTURE_QUERY_KEY = ['period-structure'] as const;

/**
 * Hook for fetching period structure
 *
 * @returns Query result with period structure form values
 *
 * Requirements: 2.2, 5.2, 9.2
 */
export function usePeriodStructure() {
  return useQuery({
    queryKey: PERIOD_STRUCTURE_QUERY_KEY,
    queryFn: periodStructureApi.fetch,
  });
}

/**
 * Hook for updating period structure
 *
 * Automatically invalidates the period structure cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 9.2
 */
export function useUpdatePeriodStructure() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: PeriodStructureFormValues) => periodStructureApi.update(data),
    onSuccess: () => {
      // Invalidate period structure cache to ensure data consistency
      // Also invalidate school settings since they share the same backend entity
      // Requirements: 5.5
      queryClient.invalidateQueries({ queryKey: PERIOD_STRUCTURE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SCHOOL_SETTINGS_QUERY_KEY });

      // Show success toast in Farsi
      // Requirements: 5.3
      toast.success(t('periodStructure.success.saved'));
    },
    onError: (error: Error) => {
      // Show error toast in Farsi with error details
      // Requirements: 5.4
      toast.error(t('periodStructure.errors.saveFailed'), {
        description: error.message,
      });
    },
  });
}
