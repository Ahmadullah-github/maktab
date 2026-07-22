import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { CurriculumConfigRepository, CurriculumRevisionConflictError } from '../database/repositories/curriculum.repository';
import { getAfghanistanTemplateForGrade, getAllGrades, getEffectiveCurriculum } from '../curriculum';
import { integerParamInRange, positiveIntegerParam, validateOptionalPositiveIntegerQuery, validateRequest } from '../middleware/validation.middleware';
import { applyCurriculumPlanSchema, bulkSaveCurriculumSchema, curriculumPlanSchema, overrideCurriculumPeriodsSchema, saveGradeCurriculumSchema } from '../schemas/curriculum.schema';
import { CurriculumMaterializationService } from '../services/curriculumMaterialization.service';
import { CurriculumPlanError, CurriculumPlanService } from '../services/curriculumPlan.service';
import { runCommittedTransaction } from '../database/transaction';
import { logger } from '../utils/logger';

export function createCurriculumRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('grade', integerParamInRange(1, 12));
  router.param('subjectId', positiveIntegerParam);
  router.use(validateOptionalPositiveIntegerQuery('schoolId'));
  const cache = cacheManager ?? CacheManager.getInstance();
  const repository = CurriculumConfigRepository.getInstance(dataSource, cache);
  const materializer = CurriculumMaterializationService.getInstance(dataSource, cache);
  const planner = new CurriculumPlanService(dataSource);

  const schoolIdFrom = (req: Request): number | null => {
    const raw = req.body?.schoolId ?? req.query.schoolId;
    return raw === undefined || raw === null || raw === '' ? null : Number(raw);
  };

  router.get('/template', (_req, res) => {
    res.json({
      name: 'Afghanistan curriculum template',
      gradeConfigs: getAllGrades().map((grade) => ({ grade, subjects: getAfghanistanTemplateForGrade(grade) })),
    });
  });

  router.get('/school', async (req, res, next) => {
    try { res.json(await repository.getSchoolCurriculumConfig(schoolIdFrom(req))); } catch (error) { next(error); }
  });

  router.get('/school/:grade', async (req, res, next) => {
    try {
      const grade = Number(req.params.grade);
      const config = await repository.getForGrade(grade, schoolIdFrom(req));
      res.json(config?.toGradeCurriculumData() ?? { grade, revision: 0, subjects: [] });
    } catch (error) { next(error); }
  });

  router.put('/school/:grade', validateRequest(saveGradeCurriculumSchema), async (req, res) => {
    try {
      const grade = Number(req.params.grade);
      const schoolId = schoolIdFrom(req);
      const saved = await runCommittedTransaction(dataSource, cache, async (manager) => {
        const result = await repository.saveForGrade(
          grade,
          { subjects: req.body.subjects },
          schoolId,
          manager,
          req.body.revision
        );
        await materializer.materializeGrades([grade], schoolId, { manager });
        return result;
      });
      res.json(saved.toGradeCurriculumData());
    } catch (error) {
      const status = error instanceof CurriculumRevisionConflictError ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.put('/school', validateRequest(bulkSaveCurriculumSchema), async (req, res) => {
    try {
      const schoolId = schoolIdFrom(req);
      const saved = await runCommittedTransaction(dataSource, cache, async (manager) => {
        const result = await repository.bulkSave(req.body.gradeConfigs, schoolId, manager);
        await materializer.materializeGrades(
          req.body.gradeConfigs.map((entry: { grade: number }) => entry.grade),
          schoolId,
          { manager }
        );
        return result;
      });
      res.json(saved.map((entry) => entry.toGradeCurriculumData()));
    } catch (error) {
      const status = error instanceof CurriculumRevisionConflictError ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.post('/plan/preview', validateRequest(curriculumPlanSchema), async (req, res) => {
    try { res.json(await planner.preview(req.body)); }
    catch (error) {
      logger.error('Curriculum preview failed', error instanceof Error ? error : new Error(String(error)));
      const status = error instanceof CurriculumPlanError ? error.statusCode : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : String(error), code: error instanceof CurriculumPlanError ? error.code : undefined });
    }
  });

  router.post('/plan/apply', validateRequest(applyCurriculumPlanSchema), async (req, res) => {
    try { res.json(await planner.apply(req.body)); }
    catch (error) {
      logger.error('Curriculum apply failed', error instanceof Error ? error : new Error(String(error)));
      const status = error instanceof CurriculumPlanError || error instanceof CurriculumRevisionConflictError ? 409 : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : String(error), code: error instanceof CurriculumPlanError ? error.code : undefined });
    }
  });

  router.get('/effective', async (req, res, next) => {
    try {
      const school = await repository.getSchoolCurriculumConfig(schoolIdFrom(req));
      res.json(Object.fromEntries(school.gradeConfigs.map((config) => [`grade_${config.grade}`, {
        category: null,
        subjects: getEffectiveCurriculum(config.grade, config),
        totalPeriods: config.subjects.reduce((sum, subject) => sum + subject.periodsPerWeek, 0),
        capacityPeriods: null,
      }])));
    } catch (error) { next(error); }
  });

  router.put('/school/:grade/subject/:subjectId/periods', validateRequest(overrideCurriculumPeriodsSchema), async (req, res) => {
    try {
      const result = await materializer.updateGradeSubjectPeriods(Number(req.params.grade), Number(req.params.subjectId), req.body.periodsPerWeek, schoolIdFrom(req));
      res.json(result);
    } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : String(error) }); }
  });

  return router;
}

export default createCurriculumRoutes;
