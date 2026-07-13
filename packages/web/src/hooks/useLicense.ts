import { API_BASE_URL } from '@/lib/apiBase';
/**
 * License hook - fetches and manages license status
 *
 * Requirements: License System
 * - Fetch license status on app load
 * - Provide machine ID to backend
 * - Update store with status
 */

import { useLicenseStore, type CombinedLicenseStatus } from '@/stores/licenseStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';


// Cache key for license status
export const LICENSE_QUERY_KEY = ['license', 'status'];

/**
 * Generate a simple machine ID for web (fallback when not in Electron)
 * In production, Electron provides the real machine ID
 */
function generateWebMachineId(): string {
  // Check if we have a stored machine ID
  const stored = localStorage.getItem('maktab_machine_id');
  if (stored) return stored;

  // Generate a new one based on browser fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Maktab', 2, 2);
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');

  // Create a hash-like string
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  // Format as XXXX-XXXX-XXXX
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
  const machineId = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;

  // Store for consistency
  localStorage.setItem('maktab_machine_id', machineId);
  return machineId;
}

/**
 * Get machine ID from Electron or generate web fallback
 */
function getMachineId(): string {
  // Check if running in Electron with the legacy licensing bridge.
  if (typeof window !== 'undefined') {
    const electronWindow = window as Window & {
      electronAPI?: { getMachineId?: () => string };
    };
    if (electronWindow.electronAPI?.getMachineId) {
      return electronWindow.electronAPI.getMachineId();
    }
  }

  // Fallback for web development
  return generateWebMachineId();
}

/**
 * Fetch license status from API
 */
async function fetchLicenseStatus(machineId: string): Promise<CombinedLicenseStatus> {
  const response = await fetch(
    `${API_BASE_URL}/license/status?machineId=${encodeURIComponent(machineId)}`,
    {
      headers: {
        'X-Machine-Id': machineId,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Failed to fetch license status' }));
    throw new Error(error.message || 'Failed to fetch license status');
  }

  return response.json();
}

/**
 * Hook to manage license status
 * Fetches on mount and updates store
 */
export function useLicense() {
  const {
    status,
    isLoading: storeLoading,
    error: storeError,
    machineId,
    setStatus,
    setLoading,
    setError,
    setMachineId,
    getMode,
    isReadOnly,
    canGenerate,
    shouldShowBanner,
    getBannerType,
    getDaysRemaining,
    dismissBanner,
  } = useLicenseStore();

  // Get machine ID on mount
  useEffect(() => {
    if (!machineId) {
      const id = getMachineId();
      setMachineId(id);
    }
  }, [machineId, setMachineId]);

  // Fetch license status
  const query = useQuery({
    queryKey: [...LICENSE_QUERY_KEY, machineId],
    queryFn: () => fetchLicenseStatus(machineId!),
    enabled: !!machineId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Update store when query succeeds
  useEffect(() => {
    if (query.data) {
      setStatus(query.data);
    }
  }, [query.data, setStatus]);

  // Update store on error
  useEffect(() => {
    if (query.error) {
      setError(query.error.message);
    }
  }, [query.error, setError]);

  // Update loading state
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  return {
    // Status
    status,
    isLoading: storeLoading || query.isLoading,
    error: storeError || query.error?.message,
    machineId,

    // Computed
    mode: getMode(),
    isReadOnly: isReadOnly(),
    canGenerate: canGenerate(),
    shouldShowBanner: shouldShowBanner(),
    bannerType: getBannerType(),
    daysRemaining: getDaysRemaining(),

    // Actions
    dismissBanner,
    refetch: query.refetch,
  };
}

/**
 * Hook to check if app is in read-only mode
 * Use this in components that need to disable editing
 */
export function useReadOnly(): boolean {
  const { isReadOnly } = useLicenseStore();
  return isReadOnly();
}

/**
 * Hook to check if generation is allowed
 * Use this in generate button/components
 */
export function useCanGenerate(): boolean {
  const { canGenerate } = useLicenseStore();
  return canGenerate();
}
