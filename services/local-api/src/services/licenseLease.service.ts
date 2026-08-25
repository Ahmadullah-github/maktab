import crypto from 'crypto';
import fs from 'fs';

export type LicenseState =
  | 'unactivated'
  | 'active'
  | 'renewal_due'
  | 'grace'
  | 'expired'
  | 'revoked'
  | 'disabled'
  | 'device_mismatch'
  | 'clock_suspect'
  | 'service_unavailable';

interface LeaseClaims {
  ver: 1;
  jti: string;
  iss: string;
  aud: 'maktab-desktop';
  product: 'desktop-timetable';
  activation_id: string;
  license_id: string;
  device_id: string;
  entitlements: string[];
  channel: 'pilot' | 'stable';
  iat: number;
  nbf: number;
  exp: number;
  grace_until: number;
  key_id: string;
}

interface LeaseHeader {
  alg: 'EdDSA';
  typ: 'JWT';
  kid: string;
}

export interface PublicLicenseStatus {
  state: LicenseState;
  canGenerate: boolean;
  isReadOnly: false;
  expiresAt: string | null;
  graceUntil: string | null;
  keyId: string | null;
  activationId: string | null;
  message: string;
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function unavailable(state: LicenseState, message: string): PublicLicenseStatus {
  return {
    state,
    canGenerate: false,
    isReadOnly: false,
    expiresAt: null,
    graceUntil: null,
    keyId: null,
    activationId: null,
    message,
  };
}

function trustedKeys(): Record<string, string> {
  try {
    const value = JSON.parse(process.env.MAKTAB_LICENSE_PUBLIC_KEYS || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  } catch {
    return {};
  }
}

export class LicenseLeaseService {
  private static instance: LicenseLeaseService | null = null;

  static getInstance(): LicenseLeaseService {
    if (!this.instance) this.instance = new LicenseLeaseService();
    return this.instance;
  }

  getStatus(nowMs = Date.now()): PublicLicenseStatus {
    if (process.env.NODE_ENV !== 'production' && process.env.LICENSE_ENFORCEMENT !== '1') {
      return {
        state: 'active', canGenerate: true, isReadOnly: false,
        expiresAt: null, graceUntil: null, keyId: 'development', activationId: 'development',
        message: 'Development license enforcement is disabled.',
      };
    }

    const leasePath = process.env.MAKTAB_LICENSE_LEASE_PATH;
    const deviceId = process.env.MAKTAB_LICENSE_DEVICE_ID;
    if (!leasePath || !fs.existsSync(leasePath)) return unavailable('unactivated', 'Activation is required to generate a timetable.');
    const keyRing = trustedKeys();
    if (!Object.keys(keyRing).length || !deviceId) return unavailable('service_unavailable', 'License verification is not configured.');

    try {
      const compact = fs.readFileSync(leasePath, 'utf8').trim();
      const parts = compact.split('.');
      if (parts.length !== 3) throw new Error('Invalid lease envelope');
      const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8')) as LeaseHeader;
      const claims = JSON.parse(decodeBase64Url(parts[1]).toString('utf8')) as LeaseClaims;
      const publicKey = keyRing[header.kid];
      if (!publicKey || header.alg !== 'EdDSA' || header.typ !== 'JWT' || claims.key_id !== header.kid) {
        throw new Error('Lease signing key is not trusted');
      }
      const verified = crypto.verify(
        null,
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey.replace(/\\n/g, '\n'),
        decodeBase64Url(parts[2])
      );
      if (!verified || claims.ver !== 1 || claims.iss !== 'maktab-release' || claims.aud !== 'maktab-desktop' || claims.product !== 'desktop-timetable') {
        throw new Error('Lease signature or audience is invalid');
      }
      if (claims.device_id !== deviceId) return unavailable('device_mismatch', 'This activation belongs to another device.');
      if (!claims.entitlements.includes('timetable.generate')) return unavailable('expired', 'Timetable generation is not entitled.');

      const now = Math.floor(nowMs / 1000);
      const trustedTime = Number(process.env.MAKTAB_TRUSTED_TIME_MS || 0);
      if (trustedTime > 0 && nowMs + 5 * 60_000 < trustedTime) return unavailable('clock_suspect', 'System clock verification is required.');
      if (now < claims.nbf) return unavailable('clock_suspect', 'The license is not valid at the current system time.');

      let state: LicenseState;
      if (now <= claims.exp) state = claims.exp - now <= 7 * 86_400 ? 'renewal_due' : 'active';
      else if (now <= claims.grace_until) state = 'grace';
      else state = 'expired';
      return {
        state,
        canGenerate: state === 'active' || state === 'renewal_due' || state === 'grace',
        isReadOnly: false,
        expiresAt: new Date(claims.exp * 1000).toISOString(),
        graceUntil: new Date(claims.grace_until * 1000).toISOString(),
        keyId: claims.key_id,
        activationId: claims.activation_id,
        message: state === 'expired' ? 'The license has expired; existing timetable data remains available.' : 'License verified.',
      };
    } catch {
      return unavailable('service_unavailable', 'The local license lease could not be verified.');
    }
  }
}
