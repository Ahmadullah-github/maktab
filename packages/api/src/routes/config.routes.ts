/** Application and school configuration routes. */

import { Request, Response, Router } from 'express';
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
import { SchoolConfigCorruptError } from '../schemas/schoolConfigStorage.schema';
import {
  AvailabilityOutOfBoundsError,
  ConfigRevisionConflictError,
  GradeBandInUseError,
  SchoolConfigService,
} from '../services/schoolConfig.service';
import { logger } from '../utils/logger';

export function createConfigRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('key', textParam(1, 100));
  router.use(validateOptionalPositiveIntegerQuery('schoolId'));

  const cache = cacheManager ?? CacheManager.getInstance();
  const configRepository = ConfigRepository.getInstance(dataSource, cache);
  const schoolConfigService = SchoolConfigService.getInstance(dataSource, cache);

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
