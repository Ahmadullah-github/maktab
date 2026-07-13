/**
 * Wizard step routes
 * @module routes/wizard
 *
 * Requirements: 2.1
 * - Wizard step persistence endpoints
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { WizardRepository } from '../database/repositories/wizard.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { logger } from '../utils/logger';
import {
  positiveIntegerParam,
  textParam,
  validateRequest,
} from '../middleware/validation.middleware';
import { saveWizardStepSchema } from '../schemas/wizard.schema';

/**
 * Creates the wizard router with DataSource injection
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager
 * @returns Express Router
 */
export function createWizardRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('wizardId', positiveIntegerParam);
  router.param('stepKey', textParam(1, 100));
  const cache = cacheManager ?? CacheManager.getInstance();
  const wizardRepository = WizardRepository.getInstance(dataSource, cache);

  /**
   * GET /wizard/:wizardId/steps
   * Get all wizard steps for a wizard
   */
  router.get('/:wizardId/steps', async (req: Request, res: Response) => {
    try {
      const wizardId = Number(req.params.wizardId);
      if (isNaN(wizardId)) {
        return res.status(400).json({ error: 'Invalid wizard ID' });
      }

      logger.debug('Fetching all wizard steps', { wizardId });
      const steps = await wizardRepository.getAllWizardSteps(wizardId);
      res.json(steps);
    } catch (error) {
      logger.error(
        'Error fetching wizard steps',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch wizard steps' });
    }
  });

  /**
   * GET /wizard/:wizardId/steps/:stepKey
   * Get a specific wizard step
   */
  router.get('/:wizardId/steps/:stepKey', async (req: Request, res: Response) => {
    try {
      const wizardId = Number(req.params.wizardId);
      if (isNaN(wizardId)) {
        return res.status(400).json({ error: 'Invalid wizard ID' });
      }
      const stepKey = req.params.stepKey;

      logger.debug('Fetching wizard step', { wizardId, stepKey });
      const step = await wizardRepository.getWizardStep(wizardId, stepKey);
      if (step) {
        res.json(step);
      } else {
        res.status(404).json({ error: 'Wizard step not found' });
      }
    } catch (error) {
      logger.error(
        'Error fetching wizard step',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch wizard step' });
    }
  });

  /**
   * POST /wizard/:wizardId/steps/:stepKey
   * Save a wizard step
   */
  router.post(
    '/:wizardId/steps/:stepKey',
    validateRequest(saveWizardStepSchema),
    async (req: Request, res: Response) => {
      try {
        const wizardId = Number(req.params.wizardId);
        if (isNaN(wizardId)) {
          return res.status(400).json({ error: 'Invalid wizard ID' });
        }
        const stepKey = req.params.stepKey;
        const { data } = req.body;

        logger.debug('Saving wizard step', { wizardId, stepKey });
        const step = await wizardRepository.saveWizardStep({ wizardId, stepKey, data });
        res.status(201).json(step);
      } catch (error) {
        logger.error(
          'Error saving wizard step',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to save wizard step' });
      }
    }
  );

  /**
   * DELETE /wizard/:wizardId/steps
   * Delete all wizard steps for a wizard
   */
  router.delete('/:wizardId/steps', async (req: Request, res: Response) => {
    try {
      const wizardId = Number(req.params.wizardId);
      if (isNaN(wizardId)) {
        return res.status(400).json({ error: 'Invalid wizard ID' });
      }

      logger.debug('Deleting all wizard steps', { wizardId });
      const success = await wizardRepository.deleteWizardSteps(wizardId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Wizard steps not found' });
      }
    } catch (error) {
      logger.error(
        'Error deleting wizard steps',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete wizard steps' });
    }
  });

  return router;
}

// For backward compatibility, export default (will be removed after full migration)
export default createWizardRoutes;
