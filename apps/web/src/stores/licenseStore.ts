import { create } from 'zustand';

export type LicenseMode =
  | 'unactivated' | 'active' | 'renewal_due' | 'grace' | 'expired'
  | 'revoked' | 'disabled' | 'device_mismatch' | 'clock_suspect' | 'service_unavailable' | 'loading' | 'error';
export type BannerType = 'info' | 'warning' | 'blocking' | null;

export interface CombinedLicenseStatus {
  state: Exclude<LicenseMode, 'loading' | 'error'>;
  canGenerate: boolean;
  isReadOnly: false;
  expiresAt: string | null;
  graceUntil: string | null;
  keyId: string | null;
  activationId: string | null;
  message: string;
}

interface LicenseStore {
  status: CombinedLicenseStatus | null;
  isLoading: boolean;
  error: string | null;
  bannerDismissed: boolean;
  setStatus: (status: CombinedLicenseStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  dismissBanner: () => void;
  getMode: () => LicenseMode;
  isReadOnly: () => false;
  canGenerate: () => boolean;
  shouldShowBanner: () => boolean;
  getBannerType: () => BannerType;
  getDaysRemaining: () => number;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  status: null,
  isLoading: true,
  error: null,
  bannerDismissed: false,
  setStatus: (status) => set({ status, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  dismissBanner: () => set({ bannerDismissed: true }),
  getMode: () => get().isLoading ? 'loading' : get().error ? 'error' : get().status?.state || 'unactivated',
  isReadOnly: () => false,
  canGenerate: () => get().status?.canGenerate ?? false,
  shouldShowBanner: () => {
    const state = get().status?.state;
    if (!state || state === 'active') return false;
    return !(get().bannerDismissed && state === 'renewal_due');
  },
  getBannerType: () => {
    const state = get().status?.state;
    if (state === 'renewal_due' || state === 'grace') return 'warning';
    if (state === 'active' || !state) return null;
    return 'blocking';
  },
  getDaysRemaining: () => {
    const target = get().status?.expiresAt;
    return target ? Math.max(0, Math.ceil((Date.parse(target) - Date.now()) / 86_400_000)) : 0;
  },
}));
