/**
 * Health check routes
 * @module routes/health
 * 
 * Requirements: 2.1
 * - Health check endpoint for monitoring
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  logger.debug('Health check requested');
  res.json({ status: 'ok', protocolVersion: 1, buildId: req.app.locals.readiness?.buildId || 'development' });
});

router.get('/ready', (req: Request, res: Response) => {
  res.json({ status: 'ready', protocolVersion: 1, ...req.app.locals.readiness });
});

export default router;
