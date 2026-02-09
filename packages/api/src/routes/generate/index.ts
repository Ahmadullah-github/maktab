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
import {
  handleAnalyze,
  handleGenerate,
  handleGetStatus,
  handleTest,
  initializeHandlers,
} from './handlers';

const router = Router();

/**
 * Initialize the generate routes with DataSource
 * This must be called before using the routes
 */
export function initializeGenerateRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): void {
  initializeHandlers(dataSource, cacheManager);
}

// Route definitions
router.post('/', handleGenerate);
router.get('/status', handleGetStatus);
router.post('/analyze', handleAnalyze);
router.post('/test', handleTest);

export default router;
