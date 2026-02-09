/**
 * License Store - manages license state across the app
 *
 * Requirements: License System
 * - Track license/trial status
 * - Provide read-only and canGenerate flags
 * - Show appropriate banners based on status
 */

import { create } from 'zustand';

export type LicenseMode =
  | 'trial'
  | 'licensed'
  | 'trial_expired'
  | 'license_expired'
  | 'grace_period'
  | 'loading'
  | 'error';
export type BannerType = 'info' | 'warning' | 'blocking' | 'readonly' | null;
export type MessageType = 'success' | 'info' | 'warning' | 'error';

export interface TrialStatus {
  hasTrial: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  message: string;
  messageType: 'info' | 'warning' | 'expired';
}

export interface LicenseStatus {
  isValid: boolean;
  isExpired: boolean;
  isInGracePeriod: boolean;
  daysRemaining: number;
  graceDaysRemaining: number;
  licenseType: string;
  expiresAt: string | null;
  schoolName: string;
  message: string;
  messageType: 'success' | 'warning' | 'error' | 'blocked';
}

export interface CombinedLicenseStatus {
  mode: LicenseMode;
  isReadOnly: boolean;
  canGenerate: boolean;
  trial: TrialStatus | null;
  license: LicenseStatus | null;
  message: string;
  messageType: MessageType;
  showBanner: boolean;
  bannerType: BannerType;
}

interface LicenseStore {
  // Status
  status: CombinedLicenseStatus | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;

  // Machine ID (from Electron or generated)
  machineId: string | null;

  // Banner dismissal (per session)
  bannerDismissed: boolean;

  // Actions
  setStatus: (status: CombinedLicenseStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMachineId: (machineId: string) => void;
  dismissBanner: () => void;
  resetBannerDismissal: () => void;

  // Computed helpers
  getMode: () => LicenseMode;
  isReadOnly: () => boolean;
  canGenerate: () => boolean;
  shouldShowBanner: () => boolean;
  getBannerType: () => BannerType;
  getDaysRemaining: () => number;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  // Initial state
  status: null,
  isLoading: true,
  error: null,
  lastFetchedAt: null,
  machineId: null,
  bannerDismissed: false,

  // Actions
  setStatus: (status) =>
    set({
      status,
      isLoading: false,
      error: null,
      lastFetchedAt: new Date(),
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setMachineId: (machineId) => set({ machineId }),

  dismissBanner: () => set({ bannerDismissed: true }),

  resetBannerDismissal: () => set({ bannerDismissed: false }),

  // Computed helpers
  getMode: () => {
    const { status, isLoading, error } = get();
    if (isLoading) return 'loading';
    if (error) return 'error';
    return status?.mode || 'loading';
  },

  isReadOnly: () => {
    const { status } = get();
    return status?.isReadOnly ?? false;
  },

  canGenerate: () => {
    const { status } = get();
    return status?.canGenerate ?? false;
  },

  shouldShowBanner: () => {
    const { status, bannerDismissed } = get();
    if (!status?.showBanner) return false;
    // Only allow dismissing info banners, not blocking/readonly
    if (bannerDismissed && status.bannerType === 'info') return false;
    return true;
  },

  getBannerType: () => {
    const { status } = get();
    return status?.bannerType ?? null;
  },

  getDaysRemaining: () => {
    const { status } = get();
    if (status?.license?.daysRemaining) {
      return status.license.daysRemaining;
    }
    if (status?.trial?.trialDaysRemaining) {
      return status.trial.trialDaysRemaining;
    }
    return 0;
  },
}));
