import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { fetchSchoolConfig, updateSchoolSettings } from '../api';
import {
  fromSchoolSettingsApiResponse,
  type SchoolSettingsFormValues,
} from '../schemas/schoolSettings.schema';
import type { SchoolConfigDto } from '../types';

export const SCHOOL_CONFIG_QUERY_KEY = ['school-config'] as const;
export const SCHOOL_SETTINGS_QUERY_KEY = SCHOOL_CONFIG_QUERY_KEY;

export function useSchoolConfig() {
  return useQuery({
    queryKey: SCHOOL_CONFIG_QUERY_KEY,
    queryFn: fetchSchoolConfig,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSchoolSettings() {
  return useQuery({
    queryKey: SCHOOL_CONFIG_QUERY_KEY,
    queryFn: fetchSchoolConfig,
    select: fromSchoolSettingsApiResponse,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: SchoolSettingsFormValues) => updateSchoolSettings(data),
    onSuccess: (config: SchoolConfigDto) => {
      queryClient.setQueryData(SCHOOL_CONFIG_QUERY_KEY, config);
      toast.success(t('schoolSettings.success.saved'));
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && typeof error.payload === 'object' && error.payload) {
        if (error.payload.code === 'CONFIG_REVISION_CONFLICT') {
          void queryClient.invalidateQueries({
            queryKey: SCHOOL_CONFIG_QUERY_KEY,
            refetchType: 'none',
          });
          toast.error(t('schoolSettings.errors.revisionConflict'), {
            description: t('schoolSettings.errors.revisionConflictDescription'),
          });
          return;
        }
        if (error.payload.code === 'GRADE_BAND_IN_USE') {
          toast.error(t('schoolSettings.errors.gradeBandInUse'), {
            description: error.message,
          });
          return;
        }
      }
      toast.error(t('schoolSettings.errors.saveFailed'), { description: error.message });
    },
  });
}

export function calculateMaxPeriodsPerWeek(config: SchoolConfigDto): number {
  return config.daysOfWeek.reduce((total, day) => total + getPeriodsForDay(config, day), 0);
}

export function getPeriodsForDay(config: SchoolConfigDto, day: string): number {
  if (config.categoryPeriodsEnabled) {
    const enabledCategories: Array<keyof typeof config.categoryPeriodsMap> = [
      ...(config.enablePrimary ? (['Alpha-Primary', 'Beta-Primary'] as const) : []),
      ...(config.enableMiddle ? (['Middle'] as const) : []),
      ...(config.enableHigh ? (['High'] as const) : []),
    ];
    return Math.max(
      ...enabledCategories.map(
        (category) =>
          config.categoryPeriodsMap[category]?.[
            day as keyof NonNullable<(typeof config.categoryPeriodsMap)[typeof category]>
          ] ?? config.defaultPeriodsPerDay
      )
    );
  }
  return config.dynamicPeriodsEnabled
    ? (config.periodsPerDayMap[day as keyof typeof config.periodsPerDayMap] ??
        config.defaultPeriodsPerDay)
    : config.defaultPeriodsPerDay;
}

export function getMaxPeriodsPerDay(config: SchoolConfigDto): number {
  const maximum = config.daysOfWeek.reduce(
    (maximum, day) => Math.max(maximum, getPeriodsForDay(config, day)),
    0
  );
  return maximum || config.defaultPeriodsPerDay;
}

export function getEffectivePeriodsPerDayMap(
  config: SchoolConfigDto
): SchoolConfigDto['periodsPerDayMap'] {
  return Object.fromEntries(config.daysOfWeek.map((day) => [day, getPeriodsForDay(config, day)]));
}
