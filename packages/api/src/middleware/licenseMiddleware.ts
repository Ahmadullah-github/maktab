/**
 * License middleware - soft blocking with license status headers
 *
 * Requirements: License System
 * - NO 403 blocking (soft block approach)
 * - Add license status headers to all responses
 * - Track trial status per machine ID
 * - Support read-only mode when license expired
 */

import { NextFunction, Request, Response } from 'express';
import { DeviceTrialService, TrialStatus } from '../services/deviceTrialService';
import { LicenseService, LicenseStatus } from '../services/licenseService';
import { logger } from '../utils/logger';
import { createOperationIssue, createOperationResponse } from '../types/operation.types';
import {
  createDevelopmentLicenseStatus,
  isDevelopmentLicenseBypassEnabled,
} from '../utils/developmentLicense';

// Routes that don't need license status headers
const SKIP_STATUS_ROUTES = ['/api/health'];

// Routes that are always allowed (license endpoints)
const LICENSE_ROUTES = [
  '/api/license/status',
  '/api/license/activate',
  '/api/license/contact',
  '/api/license/contact-info',
  '/api/license/payment-info',
  '/api/license/machine-id',
  '/api/license/request-template',
  '/api/license/current',
];

/**
 * Combined license status for frontend consumption
 */
export interface CombinedLicenseStatus {
  // Overall status
  mode: 'trial' | 'licensed' | 'trial_expired' | 'license_expired' | 'grace_period';
  isReadOnly: boolean;
  canGenerate: boolean;

  // Trial info
  trial: TrialStatus | null;

  // License info
  license: LicenseStatus | null;

  // Display info
  message: string;
  messageType: 'success' | 'info' | 'warning' | 'error';
  showBanner: boolean;
  bannerType: 'info' | 'warning' | 'blocking' | 'readonly' | null;
}

/**
 * Determine combined license status from trial and license
 */
function determineCombinedStatus(
  trialStatus: TrialStatus | null,
  licenseStatus: LicenseStatus
): CombinedLicenseStatus {
  // Case 1: Valid license (not expired)
  if (licenseStatus.isValid && !licenseStatus.isExpired) {
    const showWarning = licenseStatus.daysRemaining <= 30;
    return {
      mode: 'licensed',
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: licenseStatus.message,
      messageType: showWarning ? 'warning' : 'success',
      showBanner: showWarning,
      bannerType: showWarning ? 'warning' : null,
    };
  }

  // Case 2: License in grace period
  if (licenseStatus.isValid && licenseStatus.isInGracePeriod) {
    return {
      mode: 'grace_period',
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: licenseStatus.message,
      messageType: 'warning',
      showBanner: true,
      bannerType: 'warning',
    };
  }

  // Case 3: License expired (read-only mode)
  if (licenseStatus.isExpired && licenseStatus.licenseType) {
    return {
      mode: 'license_expired',
      isReadOnly: true,
      canGenerate: false,
      trial: trialStatus,
      license: licenseStatus,
      message: 'لایسنس شما منقضی شده است. برنامه در حالت فقط خواندنی است.',
      messageType: 'error',
      showBanner: true,
      bannerType: 'readonly',
    };
  }

  // Case 4: Active trial (no license)
  if (trialStatus?.isTrialActive) {
    return {
      mode: 'trial',
      isReadOnly: false,
      canGenerate: true,
      trial: trialStatus,
      license: licenseStatus,
      message: trialStatus.message,
      messageType: trialStatus.messageType === 'warning' ? 'warning' : 'info',
      showBanner: true,
      bannerType: 'info',
    };
  }

  // Case 5: Trial expired, no license (blocking banner, generate disabled)
  if (trialStatus?.isTrialExpired) {
    return {
      mode: 'trial_expired',
      isReadOnly: false, // Can still edit data, just can't generate
      canGenerate: false,
      trial: trialStatus,
      license: licenseStatus,
      message: 'دوره آزمایشی به پایان رسیده است. برای تولید جدول زمانی، لایسنس فعال کنید.',
      messageType: 'error',
      showBanner: true,
      bannerType: 'blocking',
    };
  }

  // Case 6: No trial, no license (first time - will create trial)
  return {
    mode: 'trial',
    isReadOnly: false,
    canGenerate: true,
    trial: null,
    license: licenseStatus,
    message: 'دوره آزمایشی ۷ روزه شروع شد',
    messageType: 'info',
    showBanner: true,
    bannerType: 'info',
  };
}

/**
 * License middleware - adds license status to all requests
 * Does NOT block requests (soft blocking approach)
 */
export async function licenseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const path = req.path.toLowerCase();

  // Skip status for health check
  if (SKIP_STATUS_ROUTES.some((route) => path.startsWith(route))) {
    next();
    return;
  }

  // License routes are always allowed
  if (LICENSE_ROUTES.some((route) => path.startsWith(route))) {
    next();
    return;
  }

  try {
    if (isDevelopmentLicenseBypassEnabled()) {
      const developmentStatus = createDevelopmentLicenseStatus();
      (req as any).licenseStatus = developmentStatus;

      res.setHeader('X-License-Mode', developmentStatus.mode);
      res.setHeader('X-License-ReadOnly', 'false');
      res.setHeader('X-License-CanGenerate', 'true');
      res.setHeader('X-License-ShowBanner', 'false');
      res.setHeader('X-License-Development-Bypass', 'true');

      next();
      return;
    }

    // Get machine ID from header (sent by Electron app)
    const machineId = req.headers['x-machine-id'] as string;

    const licenseService = LicenseService.getInstance();
    const deviceTrialService = DeviceTrialService.getInstance();

    // Get license status
    const licenseStatus = await licenseService.checkLicenseStatus(machineId);

    // Get or create trial status (only if machine ID provided)
    let trialStatus: TrialStatus | null = null;
    if (machineId) {
      trialStatus = await deviceTrialService.getOrCreateTrial(machineId);
    }

    // Determine combined status
    const combinedStatus = determineCombinedStatus(trialStatus, licenseStatus);

    // Add status to request for use in routes
    (req as any).licenseStatus = combinedStatus;

    // Add status headers for frontend
    res.setHeader('X-License-Mode', combinedStatus.mode);
    res.setHeader('X-License-ReadOnly', combinedStatus.isReadOnly.toString());
    res.setHeader('X-License-CanGenerate', combinedStatus.canGenerate.toString());
    res.setHeader('X-License-ShowBanner', combinedStatus.showBanner.toString());
    if (combinedStatus.bannerType) {
      res.setHeader('X-License-BannerType', combinedStatus.bannerType);
    }

    // Add warning headers for expiring licenses
    if (combinedStatus.license?.daysRemaining && combinedStatus.license.daysRemaining <= 30) {
      res.setHeader('X-License-DaysRemaining', combinedStatus.license.daysRemaining.toString());
    }
    if (combinedStatus.trial?.trialDaysRemaining) {
      res.setHeader('X-Trial-DaysRemaining', combinedStatus.trial.trialDaysRemaining.toString());
    }

    next();
  } catch (error) {
    logger.error(
      'License middleware error',
      error instanceof Error ? error : new Error(String(error))
    );
    // On error, allow access but log the issue
    next();
  }
}

/**
 * Read-only middleware - blocks write operations when license expired
 * Apply this to routes that should be blocked in read-only mode
 */
export function readOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const licenseStatus = (req as any).licenseStatus as CombinedLicenseStatus | undefined;

  // If no status or not read-only, allow
  if (!licenseStatus || !licenseStatus.isReadOnly) {
    next();
    return;
  }

  // Block write operations in read-only mode
  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (writeMethod) {
    res.status(403).json({
      success: false,
      error: 'READ_ONLY_MODE',
      message: 'برنامه در حالت فقط خواندنی است. برای ویرایش، لایسنس خود را تمدید کنید.',
      licenseStatus: {
        mode: licenseStatus.mode,
        isReadOnly: true,
      },
    });
    return;
  }

  next();
}

/**
 * Generate guard middleware - blocks generate when trial expired or no license
 * Apply this specifically to the /generate route
 */
export function generateGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const licenseStatus = (req as any).licenseStatus as CombinedLicenseStatus | undefined;

  // Status and cancellation must remain available for an already-running operation.
  if (req.method === 'GET' || req.method === 'DELETE') {
    next();
    return;
  }

  // If no status, allow (shouldn't happen but be safe)
  if (!licenseStatus) {
    next();
    return;
  }

  // Block generate if not allowed
  if (!licenseStatus.canGenerate) {
    const code = licenseStatus.mode === 'license_expired' ? 'LICENSE_EXPIRED' : 'TRIAL_EXPIRED';
    res.status(403).json(
      createOperationResponse('failed', req.requestContext?.requestId ?? 'untracked', {
        issues: [
          createOperationIssue(code, 'request', {
            category: 'system',
            messageParams: { mode: licenseStatus.mode },
          }),
        ],
        metadata: {
          licenseStatus: { mode: licenseStatus.mode, canGenerate: false },
        },
      })
    );
    return;
  }

  next();
}

/**
 * Middleware to add license status to all responses
 * @deprecated Use licenseMiddleware instead which adds headers
 */
export async function licenseStatusMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  next();
}
