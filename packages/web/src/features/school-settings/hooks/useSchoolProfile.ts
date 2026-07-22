import { ApiError } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  createSchoolProfile,
  deleteSchoolLogo,
  fetchSchoolProfile,
  updateSchoolProfile,
  uploadSchoolLogo,
} from '../api';
import type { SchoolProfileFormValues } from '../schemas/schoolProfile.schema';
import type { SchoolProfileDto, SchoolProfileStatusDto } from '../schemas/schoolProfileDto.schema';

export const SCHOOL_PROFILE_QUERY_KEY = ['school-profile'] as const;

export function useSchoolProfile() {
  return useQuery({
    queryKey: SCHOOL_PROFILE_QUERY_KEY,
    queryFn: fetchSchoolProfile,
    staleTime: 5 * 60 * 1000,
  });
}

function useProfileMutationError() {
  const { t } = useTranslation();
  return (error: Error) => {
    if (error instanceof ApiError && error.status === 409) {
      toast.error(t('schoolSettings.profile.revisionConflict'));
      return;
    }
    toast.error(t('schoolSettings.profile.saveFailed'), { description: error.message });
  };
}

export function useCreateSchoolProfile() {
  const queryClient = useQueryClient();
  const onError = useProfileMutationError();
  return useMutation({
    mutationFn: (values: SchoolProfileFormValues) => createSchoolProfile(values),
    onSuccess: (profile) => {
      queryClient.setQueryData<SchoolProfileStatusDto>(SCHOOL_PROFILE_QUERY_KEY, {
        configured: true,
        profile,
      });
    },
    onError,
  });
}

export function useUpdateSchoolProfile() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onError = useProfileMutationError();
  return useMutation({
    mutationFn: ({ values, revision }: { values: SchoolProfileFormValues; revision: number }) =>
      updateSchoolProfile(values, revision),
    onSuccess: (profile) => {
      queryClient.setQueryData<SchoolProfileStatusDto>(SCHOOL_PROFILE_QUERY_KEY, {
        configured: true,
        profile,
      });
      toast.success(t('schoolSettings.profile.saved'));
    },
    onError,
  });
}

function setProfileCache(
  queryClient: ReturnType<typeof useQueryClient>,
  profile: SchoolProfileDto
) {
  queryClient.setQueryData<SchoolProfileStatusDto>(SCHOOL_PROFILE_QUERY_KEY, {
    configured: true,
    profile,
  });
}

export function useUploadSchoolLogo() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onError = useProfileMutationError();
  return useMutation({
    mutationFn: ({ file, revision }: { file: File; revision: number }) =>
      uploadSchoolLogo(file, revision),
    onSuccess: (profile) => {
      setProfileCache(queryClient, profile);
      toast.success(t('schoolSettings.profile.logoSaved'));
    },
    onError,
  });
}

export function useDeleteSchoolLogo() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onError = useProfileMutationError();
  return useMutation({
    mutationFn: (revision: number) => deleteSchoolLogo(revision),
    onSuccess: (profile) => {
      setProfileCache(queryClient, profile);
      toast.success(t('schoolSettings.profile.logoRemoved'));
    },
    onError,
  });
}
