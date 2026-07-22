import type { CombinedLicenseStatus } from '../middleware/licenseMiddleware';

const ENFORCE_LICENSE_IN_DEVELOPMENT = 'MAKTAB_ENFORCE_LICENSE_IN_DEV';

/**
 * Local development must remain usable after a trial expires, while packaged
 * and production builds must always use the real license checks.
 *
 * Set MAKTAB_ENFORCE_LICENSE_IN_DEV=true when license behavior itself needs to
 * be tested during development.
 */
export function isDevelopmentLicenseBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env[ENFORCE_LICENSE_IN_DEVELOPMENT]?.toLowerCase() !== 'true'
  );
}

export function createDevelopmentLicenseStatus(): CombinedLicenseStatus {
  return {
    mode: 'licensed',
    isReadOnly: false,
    canGenerate: true,
    trial: null,
    license: null,
    message: 'Development license bypass active',
    messageType: 'success',
    showBanner: false,
    bannerType: null,
  };
}
