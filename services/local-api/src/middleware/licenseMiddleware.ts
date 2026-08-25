import type { NextFunction, Request, Response } from 'express';
import { LicenseLeaseService, type PublicLicenseStatus } from '../services/licenseLease.service';

declare global {
  namespace Express {
    interface Request { licenseStatus?: PublicLicenseStatus; }
  }
}

export function licenseMiddleware(req: Request, res: Response, next: NextFunction): void {
  const status = LicenseLeaseService.getInstance().getStatus();
  req.licenseStatus = status;
  res.setHeader('X-License-State', status.state);
  res.setHeader('X-License-Can-Generate', String(status.canGenerate));
  res.setHeader('X-License-Read-Only', 'false');
  next();
}

/** Kept as a compatibility no-op: expiry never blocks timetable data mutations. */
export function readOnlyMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export function generateGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isNewGeneration = req.method === 'POST' && req.originalUrl.split('?')[0] === '/local-api/v1/generate';
  if (!isNewGeneration || req.licenseStatus?.canGenerate) {
    next();
    return;
  }
  res.status(403).json({
    error: {
      code: 'GENERATION_LICENSE_REQUIRED',
      message: req.licenseStatus?.message || 'A valid license is required to generate a timetable.',
      correlationId: req.requestContext?.requestId,
    },
    licenseStatus: req.licenseStatus,
  });
}

export type CombinedLicenseStatus = PublicLicenseStatus;
