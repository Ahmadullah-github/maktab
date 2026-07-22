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
import { validateOperationRequest } from '../../middleware/validation.middleware';
import {
  analyzeRequestSchema,
  generateRequestSchema,
  generationJobRequestSchema,
} from '../../schemas/generate.schema';
import {
  handleCancelGenerate,
  handleAnalyze,
  handleGenerate,
  handleGetStatus,
  handleTest,
} from './handlers';
import {
  handleAcceptCandidate,
  handleCancelGenerationJob,
  handleCreateGenerationJob,
  handleDiscardCandidate,
  handleGetActiveGenerationJob,
  handleGetCandidate,
  handleGetGenerationJob,
  handleListCandidates,
} from './jobHandlers';

/**
 * Create generate routes with app-scoped dependencies.
 */
export function createGenerateRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();

  router.post('/jobs', validateOperationRequest(generationJobRequestSchema), (req, res) =>
    handleCreateGenerationJob(dataSource, cacheManager, req, res)
  );
  router.get('/jobs/active', (req, res) =>
    handleGetActiveGenerationJob(dataSource, cacheManager, req, res)
  );
  router.get('/jobs/:id', (req, res) =>
    handleGetGenerationJob(dataSource, cacheManager, req, res)
  );
  router.delete('/jobs/:id', (req, res) =>
    handleCancelGenerationJob(dataSource, cacheManager, req, res)
  );
  router.get('/candidates', (req, res) =>
    handleListCandidates(dataSource, cacheManager, req, res)
  );
  router.get('/candidates/:id', (req, res) =>
    handleGetCandidate(dataSource, cacheManager, req, res)
  );
  router.post('/candidates/:id/accept', (req, res) =>
    handleAcceptCandidate(dataSource, cacheManager, req, res)
  );
  router.delete('/candidates/:id', (req, res) =>
    handleDiscardCandidate(dataSource, cacheManager, req, res)
  );

  // Backward-compatible path, now asynchronous so no client keeps a 10-minute
  // HTTP socket open. The durable job resource is returned with HTTP 202.
  router.post('/', validateOperationRequest(generationJobRequestSchema), (req, res) =>
    handleCreateGenerationJob(dataSource, cacheManager, req, res)
  );
  router.get('/status', handleGetStatus);
  router.delete('/cancel', handleCancelGenerate);
  router.post('/analyze', validateOperationRequest(analyzeRequestSchema), (req, res) =>
    handleAnalyze(dataSource, cacheManager, req, res)
  );
  if (process.env.NODE_ENV !== 'production') {
    router.post('/legacy-sync', validateOperationRequest(generateRequestSchema), (req, res) =>
      handleGenerate(dataSource, cacheManager, req, res)
    );
    router.post('/test', (req, res) => handleTest(dataSource, cacheManager, req, res));
  }

  return router;
}

export default createGenerateRoutes;
