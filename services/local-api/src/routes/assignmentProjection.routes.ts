import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { logger } from '../utils/logger';

export function createAssignmentProjectionRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): Router {
  const router = Router();
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const result = await assignmentProjectionService.getAssignmentMatrix();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json(result.data);
    } catch (error) {
      logger.error(
        'Error building assignment matrix',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(500).json({ error: 'Failed to build assignment matrix' });
    }
  });

  return router;
}

export default createAssignmentProjectionRoutes;
