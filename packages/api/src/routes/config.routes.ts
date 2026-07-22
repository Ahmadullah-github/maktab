/** Application and school configuration routes. */

import express, { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ConfigRepository } from '../database/repositories/config.repository';
import {
  parsePositiveInteger,
  textParam,
  validateOptionalPositiveIntegerQuery,
  validateRequest,
} from '../middleware/validation.middleware';
import {
  configurationValueSchema,
  generalSchoolConfigUpdateSchema,
  optimizationPreferencesUpdateSchema,
  periodStructureUpdateSchema,
} from '../schemas/config.schema';
import {
  createSchoolProfileSchema,
  updateSchoolProfileSchema,
} from '../schemas/schoolProfile.schema';
import { SchoolConfigCorruptError } from '../schemas/schoolConfigStorage.schema';
import {
  AvailabilityOutOfBoundsError,
  ConfigRevisionConflictError,
  GradeBandInUseError,
  SchoolConfigService,
} from '../services/schoolConfig.service';
import {
  InvalidSchoolLogoError,
  isSchoolLogoMimeType,
  MAX_SCHOOL_LOGO_BYTES,
  SCHOOL_LOGO_MIME_TYPES,
  SchoolLogoStorageService,
} from '../services/schoolLogoStorage.service';
import {
  SchoolProfileAlreadyConfiguredError,
  SchoolProfileNotConfiguredError,
  SchoolProfileRevisionConflictError,
  SchoolProfileService,
} from '../services/schoolProfile.service';
import { logger } from '../utils/logger';

export function createConfigRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('key', textParam(1, 100));
  router.use(validateOptionalPositiveIntegerQuery('schoolId'));

  const cache = cacheManager ?? CacheManager.getInstance();
  const configRepository = ConfigRepository.getInstance(dataSource, cache);
  const schoolConfigService = SchoolConfigService.getInstance(dataSource, cache);
  const schoolProfileService = new SchoolProfileService(dataSource, cache);
  const schoolLogoStorage = new SchoolLogoStorageService(dataSource);

  router.get('/school-profile', async (_req: Request, res: Response) => {
    try {
      res.json(await schoolProfileService.getStatus());
    } catch (error) {
      return handleSchoolProfileError(error, res);
    }
  });

  router.post(
    '/school-profile',
    validateRequest(createSchoolProfileSchema),
    async (req: Request, res: Response) => {
      try {
        res.status(201).json(await schoolProfileService.create(req.body));
      } catch (error) {
        return handleSchoolProfileError(error, res);
      }
    }
  );

  router.patch(
    '/school-profile',
    validateRequest(updateSchoolProfileSchema),
    async (req: Request, res: Response) => {
      try {
        res.json(await schoolProfileService.update(req.body));
      } catch (error) {
        return handleSchoolProfileError(error, res);
      }
    }
  );

  router.get('/school-profile/logo', async (_req: Request, res: Response) => {
    try {
      const profile = await schoolProfileService.getRequired();
      if (!profile.logoFileName || !profile.logoMimeType) {
        return res.status(404).json({ code: 'SCHOOL_LOGO_NOT_FOUND', error: 'School logo not found' });
      }
      const bytes = await schoolLogoStorage.read(profile.logoFileName);
      res.setHeader('Content-Type', profile.logoMimeType);
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return res.status(404).json({ code: 'SCHOOL_LOGO_NOT_FOUND', error: 'School logo not found' });
      }
      return handleSchoolProfileError(error, res);
    }
  });

  router.put(
    '/school-profile/logo',
    express.raw({ type: [...SCHOOL_LOGO_MIME_TYPES], limit: MAX_SCHOOL_LOGO_BYTES }),
    async (req: Request, res: Response) => {
      let newFileName: string | null = null;
      try {
        const revisionValue = parseProfileRevisionHeader(req);
        const mimeType = req.headers['content-type']?.split(';', 1)[0]?.trim() ?? '';
        if (!isSchoolLogoMimeType(mimeType)) {
          return res.status(415).json({
            code: 'UNSUPPORTED_SCHOOL_LOGO_TYPE',
            error: 'School logo must be PNG, JPEG, or WebP',
          });
        }
        if (!Buffer.isBuffer(req.body)) {
          return res.status(400).json({ code: 'INVALID_SCHOOL_LOGO', error: 'School logo is required' });
        }
        newFileName = await schoolLogoStorage.write(req.body, mimeType);
        const result = await schoolProfileService.setLogo(revisionValue, newFileName, mimeType);
        newFileName = null;
        await schoolLogoStorage.remove(result.previousFileName).catch((cleanupError) => {
          logger.warn('Could not remove previous school logo after replacement', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        });
        return res.json(result.profile);
      } catch (error) {
        if (newFileName) await schoolLogoStorage.remove(newFileName).catch(() => undefined);
        return handleSchoolProfileError(error, res);
      }
    }
  );

  router.delete('/school-profile/logo', async (req: Request, res: Response) => {
    try {
      const result = await schoolProfileService.clearLogo(parseProfileRevisionHeader(req));
      await schoolLogoStorage.remove(result.previousFileName).catch((cleanupError) => {
        logger.warn('Could not remove cleared school logo', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      });
      return res.json(result.profile);
    } catch (error) {
      return handleSchoolProfileError(error, res);
    }
  });

  router.get('/school-config', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      res.json(await schoolConfigService.getConfig(schoolId));
    } catch (error) {
      logger.error(
        'Error fetching school config',
        error instanceof Error ? error : new Error(String(error))
      );
      if (error instanceof SchoolConfigCorruptError) {
        res.status(500).json({ code: error.code, error: error.message, field: error.field });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch school config' });
    }
  });

  router.patch(
    '/school-config/general',
    validateRequest(generalSchoolConfigUpdateSchema),
    async (req: Request, res: Response) => {
      try {
        res.json(await schoolConfigService.updateGeneral(req.body));
      } catch (error) {
        if (error instanceof AvailabilityOutOfBoundsError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            conflicts: error.conflicts,
          });
        }
        if (error instanceof ConfigRevisionConflictError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision,
          });
        }
        if (error instanceof GradeBandInUseError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            band: error.band,
            classCount: error.classCount,
            sampleClasses: error.sampleClasses,
          });
        }
        return handleSchoolConfigError(error, res);
      }
    }
  );

  router.patch(
    '/school-config/periods',
    validateRequest(periodStructureUpdateSchema),
    async (req: Request, res: Response) => {
      try {
        res.json(await schoolConfigService.updatePeriods(req.body));
      } catch (error) {
        if (error instanceof AvailabilityOutOfBoundsError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            conflicts: error.conflicts,
          });
        }
        if (error instanceof ConfigRevisionConflictError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision,
          });
        }
        return handleSchoolConfigError(error, res);
      }
    }
  );

  router.get('/optimization-preferences', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      res.json(await schoolConfigService.getOptimizationPreferences(schoolId));
    } catch (error) {
      return handleSchoolConfigError(error, res);
    }
  });

  router.patch(
    '/optimization-preferences',
    validateRequest(optimizationPreferencesUpdateSchema),
    async (req: Request, res: Response) => {
      try {
        res.json(await schoolConfigService.updateOptimizationPreferences(req.body));
      } catch (error) {
        if (error instanceof ConfigRevisionConflictError) {
          return res.status(409).json({
            code: error.code,
            error: error.message,
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision,
          });
        }
        return handleSchoolConfigError(error, res);
      }
    }
  );

  router.get('/:key', async (req: Request, res: Response) => {
    try {
      if (req.params.key === 'optimization-preferences') {
        res.setHeader('Allow', 'GET, PATCH');
        return res.status(405).json({
          error: 'optimization-preferences is managed by its canonical school-scoped endpoint',
        });
      }
      const value = await configRepository.getConfiguration(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (error) {
      logger.error(
        'Error fetching configuration',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  router.post(
    '/:key',
    validateRequest(configurationValueSchema),
    async (req: Request, res: Response) => {
      try {
        if (req.params.key === 'school-config' || req.params.key === 'optimization-preferences') {
          res.setHeader('Allow', 'GET, PATCH');
          return res.status(405).json({
            error: `${req.params.key} is managed by its canonical school configuration endpoint`,
          });
        }
        const { value } = req.body;
        const stringValue =
          typeof value === 'object' && value !== null && !(value instanceof Date)
            ? JSON.stringify(value)
            : String(value);
        res.status(201).json(await configRepository.saveConfiguration(req.params.key, stringValue));
      } catch (error) {
        logger.error(
          'Error saving configuration',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to save configuration' });
      }
    }
  );

  return router;
}

function parseProfileRevisionHeader(req: Request): number {
  const rawValue = req.headers['if-match'];
  const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const value = Number(normalized?.replace(/^W\//, '').replaceAll('"', ''));
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('If-Match must contain the current positive profile revision') as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }
  return value;
}

function handleSchoolProfileError(error: unknown, res: Response): Response {
  if (error instanceof SchoolProfileAlreadyConfiguredError) {
    return res.status(409).json({ code: error.code, error: error.message });
  }
  if (error instanceof SchoolProfileNotConfiguredError) {
    return res.status(409).json({ code: error.code, error: error.message });
  }
  if (error instanceof SchoolProfileRevisionConflictError) {
    return res.status(409).json({
      code: error.code,
      error: error.message,
      expectedRevision: error.expectedRevision,
      actualRevision: error.actualRevision,
    });
  }
  if (error instanceof InvalidSchoolLogoError) {
    return res.status(400).json({ code: error.code, error: error.message });
  }
  const normalized = error instanceof Error ? error : new Error(String(error));
  const status = (normalized as Error & { status?: number }).status;
  logger.error('Error managing school profile', normalized);
  return res.status(status === 400 ? 400 : 500).json({
    code: status === 400 ? 'INVALID_PROFILE_REVISION' : 'SCHOOL_PROFILE_ERROR',
    error: status === 400 ? normalized.message : 'Failed to manage school profile',
  });
}

function handleSchoolConfigError(error: unknown, res: Response): Response {
  const normalized = error instanceof Error ? error : new Error(String(error));
  logger.error('Error updating school config', normalized);
  if (normalized.message.startsWith('Invalid school config:')) {
    return res.status(400).json({ error: normalized.message });
  }
  if (error instanceof SchoolConfigCorruptError) {
    return res.status(500).json({ code: error.code, error: error.message, field: error.field });
  }
  return res.status(500).json({ error: 'Failed to update school config' });
}

export default createConfigRoutes;
