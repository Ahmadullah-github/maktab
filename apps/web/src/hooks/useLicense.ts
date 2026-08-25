import { API_BASE_URL } from '@/lib/apiBase';
import { useLicenseStore, type CombinedLicenseStatus } from '@/stores/licenseStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const LICENSE_QUERY_KEY = ['license', 'status'];

async function fetchLicenseStatus(): Promise<CombinedLicenseStatus> {
  if (window.maktab) {
    const result = await window.maktab.license.getStatus();
    if (!result.ok) throw new Error(result.error.message);
    return result.value as CombinedLicenseStatus;
  }
  const response = await fetch(`${API_BASE_URL}/license/status`);
  if (!response.ok) throw new Error('Failed to fetch license status');
  return response.json() as Promise<CombinedLicenseStatus>;
}

export function useLicense() {
  const store = useLicenseStore();
  const query = useQuery({
    queryKey: LICENSE_QUERY_KEY,
    queryFn: fetchLicenseStatus,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
  useEffect(() => { if (query.data) store.setStatus(query.data); }, [query.data, store.setStatus]);
  useEffect(() => { if (query.error) store.setError(query.error.message); }, [query.error, store.setError]);
  useEffect(() => { store.setLoading(query.isLoading); }, [query.isLoading, store.setLoading]);
  return {
    status: store.status,
    isLoading: store.isLoading || query.isLoading,
    error: store.error || query.error?.message,
    mode: store.getMode(),
    isReadOnly: false,
    canGenerate: store.canGenerate(),
    shouldShowBanner: store.shouldShowBanner(),
    bannerType: store.getBannerType(),
    daysRemaining: store.getDaysRemaining(),
    dismissBanner: store.dismissBanner,
    refetch: query.refetch,
  };
}

export function useReadOnly(): false { return false; }
export function useCanGenerate(): boolean { return useLicenseStore((state) => state.canGenerate()); }
