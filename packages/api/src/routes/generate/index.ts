/**
 * Generate (Solver) routes - Main router
 * @module routes/generate
 *
 * Requirements: 2.8, 7.2
 * - Timetable generation endpoint
 * - Integrates with SolverService
 * - Loads SchoolConfig and merges into solver input
 */

import { Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { validateRequest } from '../../middleware/validation.middleware';
import { analyzeRequestSchema, generateRequestSchema } from '../../schemas/generate.schema';
import {
  handleCancelGenerate,
  handleAnalyze,
  handleGenerate,
  handleGetStatus,
  handleTest,
} from './handlers';

/**
 * Create generate routes with app-scoped dependencies.
 */
export function createGenerateRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();

  router.post('/', validateRequest(generateRequestSchema), (req, res) =>
    handleGenerate(dataSource, cacheManager, req, res)
  );
  router.get('/status', handleGetStatus);
  router.delete('/cancel', handleCancelGenerate);
  router.post('/analyze', validateRequest(analyzeRequestSchema), (req, res) =>
    handleAnalyze(dataSource, cacheManager, req, res)
  );
  router.post('/test', (req, res) => handleTest(dataSource, cacheManager, req, res));

  return router;
}

export default createGenerateRoutes;
