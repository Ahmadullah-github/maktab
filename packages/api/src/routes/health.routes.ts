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
router.get('/', (_req: Request, res: Response) => {
  logger.debug('Health check requested');
  res.json({ status: 'ok', message: 'Backend is running!' });
});

export default router;
