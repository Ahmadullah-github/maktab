/**
 * Curriculum Routes
 * @module routes/curriculum
 *
 * API endpoints for curriculum management:
 * - Get ministry curriculum (read-only baseline)
 * - Get/update school-specific curriculum customizations
 * - Validate curriculum against ministry requirements
 * - Get effective curriculum (ministry + customizations)
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { CurriculumConfigRepository } from '../database/repositories/curriculum.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { logger } from '../utils/logger';
import {
  integerParamInRange,
  parsePositiveInteger,
  textParam,
  validateOptionalPositiveIntegerQuery,
  validateRequest,
} from '../middleware/validation.middleware';
import {
  addCustomCurriculumSubjectSchema,
  bulkSaveCurriculumSchema,
  curriculumSchoolIdSchema,
  overrideCurriculumPeriodsSchema,
  saveGradeCurriculumSchema,
} from '../schemas/curriculum.schema';
import {
  MINISTRY_CURRICULUM,
  GRADE_CATEGORIES,
  getGradeCategory,
  getExpectedTotalPeriods,
  getMinistrySubjectsForGrade,
  getAllGrades,
  getMinistryTotalPeriods,
} from '../curriculum';

/**
 * Creates the curriculum router with DataSource injection
 */
export function createCurriculumRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): Router {
  const router = Router();
  router.param('grade', integerParamInRange(1, 12));
  router.param('code', textParam(1, 50));
  router.use(validateOptionalPositiveIntegerQuery('schoolId'));
  const cache = cacheManager ?? CacheManager.getInstance();
  const curriculumRepo = CurriculumConfigRepository.getInstance(dataSource, cache);

  // =========================================================================
  // Ministry Curriculum (Read-Only)
  // =========================================================================

  /**
   * GET /curriculum/ministry
   * Get full ministry curriculum for all grades
   */
  router.get('/ministry', (_req: Request, res: Response) => {
    try {
      const curriculum: Record<string, any> = {};

      for (const grade of getAllGrades()) {
        const subjects = getMinistrySubjectsForGrade(grade);
        const category = getGradeCategory(grade);

        curriculum[`grade_${grade}`] = {
          grade,
          category,
          categoryInfo: category ? GRADE_CATEGORIES[category] : null,
          subjects,
          totalPeriods: getMinistryTotalPeriods(grade),
          expectedPeriods: getExpectedTotalPeriods(grade),
        };
      }

      res.json({
        gradeCategories: GRADE_CATEGORIES,
        curriculum,
      });
    } catch (error) {
      logger.error(
        'Error fetching ministry curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch ministry curriculum' });
    }
  });

  /**
   * GET /curriculum/ministry/:grade
   * Get ministry curriculum for a specific grade
   */
  router.get('/ministry/:grade', (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);

      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
      }

      const subjects = getMinistrySubjectsForGrade(grade);
      const category = getGradeCategory(grade);

      res.json({
        grade,
        category,
        categoryInfo: category ? GRADE_CATEGORIES[category] : null,
        subjects,
        totalPeriods: getMinistryTotalPeriods(grade),
        expectedPeriods: getExpectedTotalPeriods(grade),
      });
    } catch (error) {
      logger.error(
        'Error fetching ministry curriculum for grade',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch ministry curriculum' });
    }
  });

  /**
   * GET /curriculum/categories
   * Get grade category information
   */
  router.get('/categories', (_req: Request, res: Response) => {
    res.json(GRADE_CATEGORIES);
  });

  // =========================================================================
  // School Curriculum Customization
  // =========================================================================

  /**
   * GET /curriculum/school
   * Get school's curriculum configuration (all grades)
   */
  router.get('/school', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      const config = await curriculumRepo.getSchoolCurriculumConfig(schoolId);
      res.json(config);
    } catch (error) {
      logger.error(
        'Error fetching school curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch school curriculum' });
    }
  });

  /**
   * GET /curriculum/school/:grade
   * Get school's curriculum config for a specific grade
   */
  router.get('/school/:grade', async (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;

      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
      }

      const config = await curriculumRepo.getForGrade(grade, schoolId);
      res.json(
        config?.toGradeCurriculumData() ?? {
          grade,
          overrides: [],
          customSubjects: [],
        }
      );
    } catch (error) {
      logger.error(
        'Error fetching school curriculum for grade',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch school curriculum' });
    }
  });

  /**
   * PUT /curriculum/school/:grade
   * Update school's curriculum config for a specific grade
   */
  router.put(
    '/school/:grade',
    validateRequest(saveGradeCurriculumSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        const schoolId = req.body.schoolId ?? null;

        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
        }

        const { overrides, customSubjects } = req.body;
        const saved = await curriculumRepo.saveForGrade(
          grade,
          { overrides, customSubjects },
          schoolId
        );

        res.json(saved.toGradeCurriculumData());
      } catch (error) {
        logger.error(
          'Error saving school curriculum',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to save school curriculum' });
      }
    }
  );

  /**
   * PUT /curriculum/school
   * Bulk update school's curriculum config for multiple grades
   */
  router.put(
    '/school',
    validateRequest(bulkSaveCurriculumSchema),
    async (req: Request, res: Response) => {
      try {
        const { gradeConfigs, schoolId } = req.body;

        if (!Array.isArray(gradeConfigs)) {
          return res.status(400).json({ error: 'gradeConfigs must be an array' });
        }

        const saved = await curriculumRepo.bulkSave(gradeConfigs, schoolId ?? null);
        res.json(
          saved.map((c: { toGradeCurriculumData: () => unknown }) => c.toGradeCurriculumData())
        );
      } catch (error) {
        logger.error(
          'Error bulk saving school curriculum',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to save school curriculum' });
      }
    }
  );

  /**
   * POST /curriculum/school/:grade/reset
   * Reset a grade's curriculum to ministry defaults
   */
  router.post(
    '/school/:grade/reset',
    validateRequest(curriculumSchoolIdSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        const schoolId = req.body.schoolId ?? null;

        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
        }

        const saved = await curriculumRepo.resetToDefaults(grade, schoolId);
        res.json(saved.toGradeCurriculumData());
      } catch (error) {
        logger.error(
          'Error resetting curriculum',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to reset curriculum' });
      }
    }
  );

  /**
   * POST /curriculum/school/reset-all
   * Reset all grades to ministry defaults
   */
  router.post(
    '/school/reset-all',
    validateRequest(curriculumSchoolIdSchema),
    async (req: Request, res: Response) => {
      try {
        const schoolId = req.body.schoolId ?? null;
        await curriculumRepo.resetAllToDefaults(schoolId);
        res.json({ success: true, message: 'All grades reset to ministry defaults' });
      } catch (error) {
        logger.error(
          'Error resetting all curriculum',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to reset curriculum' });
      }
    }
  );

  // =========================================================================
  // Custom Subjects Management
  // =========================================================================

  /**
   * POST /curriculum/school/:grade/custom-subject
   * Add a custom subject to a grade
   */
  router.post(
    '/school/:grade/custom-subject',
    validateRequest(addCustomCurriculumSubjectSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        const schoolId = req.body.schoolId ?? null;

        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
        }

        const { name, nameEn, code, periodsPerWeek, isDifficult, requiredRoomType } = req.body;

        if (!name || !code || !periodsPerWeek) {
          return res.status(400).json({ error: 'name, code, and periodsPerWeek are required' });
        }

        // Get current config and add custom subject
        const config = await curriculumRepo.getForGrade(grade, schoolId);
        const customSubjects = config?.customSubjects ?? [];
        if (customSubjects.some((s: { code: string }) => s.code === code)) {
          return res.status(409).json({ error: `Subject with code "${code}" already exists` });
        }
        customSubjects.push({
          name,
          nameEn: nameEn || name,
          code,
          periodsPerWeek,
          isDifficult,
          requiredRoomType,
        });
        const saved = await curriculumRepo.saveForGrade(grade, { customSubjects }, schoolId);
        res.json(saved.toGradeCurriculumData());
      } catch (error) {
        logger.error(
          'Error adding custom subject',
          error instanceof Error ? error : new Error(String(error))
        );
        if (error instanceof Error && error.message.includes('already exists')) {
          return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to add custom subject' });
      }
    }
  );

  /**
   * DELETE /curriculum/school/:grade/custom-subject/:code
   * Remove a custom subject from a grade
   */
  router.delete('/school/:grade/custom-subject/:code', async (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);
      const code = req.params.code;
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;

      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
      }

      const config = await curriculumRepo.getForGrade(grade, schoolId);
      const customSubjects = (config?.customSubjects ?? []).filter(
        (s: { code: string }) => s.code !== code
      );
      const saved = await curriculumRepo.saveForGrade(grade, { customSubjects }, schoolId);
      res.json(saved.toGradeCurriculumData());
    } catch (error) {
      logger.error(
        'Error removing custom subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to remove custom subject' });
    }
  });

  // =========================================================================
  // Subject Overrides
  // =========================================================================

  /**
   * PUT /curriculum/school/:grade/override/:code
   * Override periods for a ministry subject
   */
  router.put(
    '/school/:grade/override/:code',
    validateRequest(overrideCurriculumPeriodsSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        const code = req.params.code;
        const schoolId = req.body.schoolId ?? null;
        const { periodsPerWeek } = req.body;

        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
        }

        if (typeof periodsPerWeek !== 'number' || periodsPerWeek < 0) {
          return res.status(400).json({ error: 'periodsPerWeek must be a non-negative number' });
        }

        const config = await curriculumRepo.getForGrade(grade, schoolId);
        const overrides = config?.overrides ?? [];
        const idx = overrides.findIndex((o: { code: string }) => o.code === code);
        if (idx >= 0) overrides[idx].periodsPerWeek = periodsPerWeek;
        else overrides.push({ code, periodsPerWeek });
        const saved = await curriculumRepo.saveForGrade(grade, { overrides }, schoolId);
        res.json(saved.toGradeCurriculumData());
      } catch (error) {
        logger.error(
          'Error overriding subject periods',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to override subject periods' });
      }
    }
  );

  /**
   * DELETE /curriculum/school/:grade/subject/:code
   * Remove a ministry subject from curriculum
   */
  router.delete('/school/:grade/subject/:code', async (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);
      const code = req.params.code;
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;

      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
      }

      const config = await curriculumRepo.getForGrade(grade, schoolId);
      const overrides = config?.overrides ?? [];
      const idx = overrides.findIndex((o: { code: string }) => o.code === code);
      if (idx >= 0) overrides[idx].isRemoved = true;
      else overrides.push({ code, isRemoved: true });
      const saved = await curriculumRepo.saveForGrade(grade, { overrides }, schoolId);
      res.json(saved.toGradeCurriculumData());
    } catch (error) {
      logger.error(
        'Error removing ministry subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to remove subject' });
    }
  });

  /**
   * POST /curriculum/school/:grade/subject/:code/restore
   * Restore a removed ministry subject
   */
  router.post(
    '/school/:grade/subject/:code/restore',
    validateRequest(curriculumSchoolIdSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        const code = req.params.code;
        const schoolId = req.body.schoolId ?? null;

        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
        }

        const config = await curriculumRepo.getForGrade(grade, schoolId);
        const overrides = (config?.overrides ?? []).filter(
          (o: { code: string }) => o.code !== code
        );
        const saved = await curriculumRepo.saveForGrade(grade, { overrides }, schoolId);
        res.json(saved.toGradeCurriculumData());
      } catch (error) {
        logger.error(
          'Error restoring ministry subject',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to restore subject' });
      }
    }
  );

  // =========================================================================
  // Effective Curriculum & Validation
  // =========================================================================

  /**
   * GET /curriculum/effective
   * Get effective curriculum (ministry + school customizations)
   */
  router.get('/effective', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      const solverFormat = await curriculumRepo.getForSolver(schoolId);
      res.json(solverFormat);
    } catch (error) {
      logger.error(
        'Error fetching effective curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch effective curriculum' });
    }
  });

  /**
   * GET /curriculum/effective/:grade
   * Get effective subjects for a specific grade
   */
  router.get('/effective/:grade', async (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;

      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be 1-12.' });
      }

      const subjects = await curriculumRepo.getEffectiveSubjectsForGrade(grade, schoolId);
      const category = getGradeCategory(grade);

      res.json({
        grade,
        category,
        subjects,
        totalPeriods: subjects.reduce((sum: number, s: any) => sum + s.periodsPerWeek, 0),
        expectedPeriods: getExpectedTotalPeriods(grade),
      });
    } catch (error) {
      logger.error(
        'Error fetching effective curriculum for grade',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch effective curriculum' });
    }
  });

  /**
   * GET /curriculum/validate
   * Validate school curriculum against ministry requirements
   */
  router.get('/validate', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      const strictMode = req.query.strict === 'true';

      const result = await curriculumRepo.validateConfig(schoolId, strictMode);
      res.json(result);
    } catch (error) {
      logger.error(
        'Error validating curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to validate curriculum' });
    }
  });

  /**
   * GET /curriculum/solver
   * Get curriculum in solver-compatible format
   */
  router.get('/solver', async (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId ? parsePositiveInteger(req.query.schoolId) : null;
      const solverData = await curriculumRepo.getForSolver(schoolId);
      res.json(solverData);
    } catch (error) {
      logger.error(
        'Error fetching solver curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch solver curriculum' });
    }
  });

  return router;
}

export default createCurriculumRoutes;
