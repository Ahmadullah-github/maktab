/**
 * TanStack Query hooks for School Settings data management
 *
 * Provides hooks for fetching and updating school settings
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 1.2, 5.1, 5.3, 5.4, 5.5, 9.2
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { schoolSettingsApi } from '../api';
import type { SchoolSettingsFormValues } from '../schemas/schoolSettings.schema';

/**
 * Query key for school settings data
 * Used for cache management and invalidation
 */
export const SCHOOL_SETTINGS_QUERY_KEY = ['school-settings'] as const;

/**
 * Hook for fetching school settings
 *
 * @returns Query result with school settings form values
 *
 * Requirements: 1.2, 5.1, 9.2
 */
export function useSchoolSettings() {
  return useQuery({
    queryKey: SCHOOL_SETTINGS_QUERY_KEY,
    queryFn: schoolSettingsApi.fetch,
  });
}

/**
 * Hook for updating school settings
 *
 * Automatically invalidates the school settings cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 5.1, 5.3, 5.4, 5.5, 9.2
 */
export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: SchoolSettingsFormValues) => schoolSettingsApi.update(data),
    onSuccess: () => {
      // Invalidate school settings cache to ensure data consistency
      // Requirements: 5.5
      queryClient.invalidateQueries({ queryKey: SCHOOL_SETTINGS_QUERY_KEY });

      // Show success toast in Farsi
      // Requirements: 5.3
      toast.success(t('schoolSettings.success.saved'));
    },
    onError: (error: Error) => {
      // Show error toast in Farsi with error details
      // Requirements: 5.4
      toast.error(t('schoolSettings.errors.saveFailed'), {
        description: error.message,
      });
    },
  });
}
