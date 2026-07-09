/**
 * Configuration routes
 * @module routes/config
 * 
 * Requirements: 2.1, 7.1
 * - Configuration storage endpoints
 * - School config endpoints (SchoolConfig entity for Afghanistan features)
 * - Solver-compatible config endpoint
 * - Destructive reset endpoint
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { ConfigRepository } from '../database/repositories/config.repository';
import { SchoolConfigRepository } from '../database/repositories/schoolConfig.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassGroup } from '../entity/ClassGroup';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { logger } from '../utils/logger';

/**
 * Creates the config router with DataSource injection
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager
 * @returns Express Router
 */
export function createConfigRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const cache = cacheManager ?? CacheManager.getInstance();
  const configRepository = ConfigRepository.getInstance(dataSource, cache);

  /**
   * GET /config/school
   * Get school configuration
   */
  router.get('/school', async (_req: Request, res: Response) => {
    try {
      const cfg = await configRepository.getSchoolConfig();
      res.json(cfg || {});
    } catch (error) {
      logger.error('Error fetching school config', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch school config' });
    }
  });

  /**
   * PUT /config/school
   * Save school configuration (legacy Configuration entity)
   */
  router.put('/school', async (req: Request, res: Response) => {
    try {
      const saved = await configRepository.saveSchoolConfig(req.body || {});
      res.json(saved);
    } catch (error) {
      logger.error('Error saving school config', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to save school config' });
    }
  });

  // =========================================================================
  // SchoolConfig Entity Routes (Afghanistan-specific features)
  // Requirements: 7.1
  // =========================================================================

  const schoolConfigRepository = SchoolConfigRepository.getInstance(dataSource, cache);

  /**
   * GET /config/school-config
   * Get SchoolConfig entity (Afghanistan-specific settings)
   * Requirements: 7.1
   */
  router.get('/school-config', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : null;
      const config = await schoolConfigRepository.getOrCreate(schoolId);
      res.json(config);
    } catch (error) {
      logger.error('Error fetching school config entity', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch school config' });
    }
  });

  /**
   * PUT /config/school-config
   * Update SchoolConfig entity
   * Requirements: 7.1
   */
  router.put('/school-config', async (req: Request, res: Response) => {
    try {
      const { id, ...updates } = req.body;
      
      if (!id) {
        // If no ID provided, get or create the default config first
        const schoolId = req.body.schoolId ?? null;
        const existing = await schoolConfigRepository.getOrCreate(schoolId);
        const updated = await schoolConfigRepository.updateConfig(existing.id, updates);
        return res.json(updated);
      }

      const updated = await schoolConfigRepository.updateConfig(id, updates);
      res.json(updated);
    } catch (error) {
      logger.error('Error updating school config entity', error instanceof Error ? error : new Error(String(error)));
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message.startsWith('Invalid school config:')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update school config' });
    }
  });

  /**
   * GET /config/school-config/solver
   * Get SchoolConfig in solver-compatible format
   * Requirements: 7.2
   */
  router.get('/school-config/solver', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : null;
      const solverConfig = await schoolConfigRepository.getForSolver(schoolId);
      res.json(solverConfig);
    } catch (error) {
      logger.error('Error fetching solver config', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch solver config' });
    }
  });

  /**
   * GET /config/school-config/validate
   * Get SchoolConfig with validation errors
   * Requirements: 7.4
   */
  router.get('/school-config/validate', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parseInt(req.query.schoolId as string) : null;
      const result = await schoolConfigRepository.getWithValidation(schoolId);
      res.json(result);
    } catch (error) {
      logger.error('Error validating school config', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to validate school config' });
    }
  });

  /**
   * GET /config/:key
   * Get configuration by key
   */
  router.get('/:key', async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      
      logger.debug('Fetching configuration', { key });
      const value = await configRepository.getConfiguration(key);
      res.json({ key, value });
    } catch (error) {
      logger.error('Error fetching configuration', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  /**
   * POST /config/:key
   * Save configuration by key
   */
  router.post('/:key', async (req: Request, res: Response) => {
    try {
      logger.debug('Saving configuration', { key: req.params.key });
      
      const key = req.params.key;
      const { value } = req.body;
      
      // If value is an object, stringify it; otherwise use it as is (already a string)
      const stringValue = typeof value === 'object' && value !== null && !(value instanceof Date)
        ? JSON.stringify(value) 
        : String(value);
      
      const config = await configRepository.saveConfiguration(key, stringValue);
      res.status(201).json(config);
    } catch (error) {
      logger.error('Error saving configuration', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  return router;
}

/**
 * Creates the reset router with DataSource injection
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager
 * @returns Express Router
 */
export function createResetRouter(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const cache = cacheManager ?? CacheManager.getInstance();

  /**
   * POST /reset
   * Destructive reset - clears all data
   * Requirements: 11.1 - Wrap destructive reset operations in a single transaction
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { confirm, wipeTeachers } = req.body || {};
      if (confirm !== 'RESET_ALL_DATA') {
        return res.status(400).json({ error: 'Confirmation token invalid' });
      }
      
      // Use transaction to ensure atomicity
      await dataSource.transaction(async (transactionalEntityManager) => {
        // Order: class-subject links (embedded in classes), classes, subjects, optionally teachers
        await transactionalEntityManager.getRepository(ClassGroup).clear();
        await transactionalEntityManager.getRepository(Subject).clear();
        if (wipeTeachers) {
          await transactionalEntityManager.getRepository(Teacher).clear();
        }
      });
      
      // Invalidate caches after successful transaction
      cache.clear();
      
      logger.info('Destructive reset completed', { wipeTeachers: !!wipeTeachers });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error during reset', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to reset' });
    }
  });

  return router;
}

// For backward compatibility, export default router (will be removed after full migration)
export default createConfigRoutes;
