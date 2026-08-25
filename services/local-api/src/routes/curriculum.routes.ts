import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { validateRequest } from '../middleware/validation.middleware';
import { curriculumApplySchema, curriculumPreviewSchema } from '../schemas/schoolCurriculum.schema';
import {
  CurriculumConflictError,
  SchoolCurriculumOrchestrator,
} from '../services/schoolCurriculumOrchestrator.service';
import { logger } from '../utils/logger';

function querySchoolId(req: Request): number | null {
  if (req.query.schoolId === undefined || req.query.schoolId === '' || req.query.schoolId === 'null') {
    return null;
  }
  const schoolId = Number(req.query.schoolId);
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new Error('schoolId must be a positive integer or null');
  }
  return schoolId;
}

function sendError(res: Response, error: unknown): Response {
  if (error instanceof CurriculumConflictError) {
    return res.status(409).json({ error: error.message, code: error.code, details: error.details });
  }
  const message = error instanceof Error ? error.message : String(error);
  logger.error('School curriculum operation failed', error instanceof Error ? error : new Error(message));
  return res.status(500).json({ error: message });
}

export function createCurriculumRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cacheManager);

  router.get('/plan', async (req, res) => {
    try {
      return res.json(await orchestrator.getPlan(querySchoolId(req)));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/templates/afghanistan', async (req, res) => {
    try {
      return res.json(await orchestrator.getAfghanistanTemplate(querySchoolId(req)));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/plan/preview', validateRequest(curriculumPreviewSchema), async (req, res) => {
    try {
      return res.json(await orchestrator.preview(req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/plan/apply', validateRequest(curriculumApplySchema), async (req, res) => {
    try {
      return res.json(
        await orchestrator.apply(req.body.previewToken, req.body.confirmAssignmentRemoval)
      );
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
}
