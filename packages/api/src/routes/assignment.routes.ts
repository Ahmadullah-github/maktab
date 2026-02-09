/**
 * Assignment routes
 * @module routes/assignment
 *
 * Requirements: 5.4, 6.5, 1.6, 3.5, 2.1, 4.2
 * - Assignment validation endpoints
 * - Assignment operation endpoints
 * - Analysis endpoints (workload, coverage, conflicts)
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { validateRequest } from '../middleware/validation.middleware';
import {
  assignTeacherSchema,
  unassignTeacherSchema,
  validateAssignmentSchema,
} from '../schemas/assignment.schema';
import { AssignmentService } from '../services/assignment.service';
import { logger } from '../utils/logger';

/**
 * Creates assignment routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createAssignmentRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): Router {
  const router = Router();
  const assignmentService = AssignmentService.getInstance(dataSource, cacheManager);

  // =========================================================================
  // Validation Endpoints
  // =========================================================================

  /**
   * POST /assignments/validate
   * Validate an assignment request without making changes
   * Requirements: 5.4, 6.5
   */
  router.post(
    '/validate',
    validateRequest(validateAssignmentSchema),
    async (req: Request, res: Response) => {
      try {
        const { teacherId, subjectId, classIds, periodsPerWeek } = req.body;

        logger.debug('Validating assignment', { teacherId, subjectId, classIds });

        const result = await assignmentService.validateAssignment({
          teacherId,
          subjectId,
          classIds,
          periodsPerWeek,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json(result.data);
      } catch (error) {
        logger.error(
          'Error validating assignment',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to validate assignment' });
      }
    }
  );

  // =========================================================================
  // Assignment Operation Endpoints
  // =========================================================================

  /**
   * POST /assignments/assign
   * Assign a teacher to subject-class combinations
   * Requirements: 1.6, 3.5
   */
  router.post(
    '/assign',
    validateRequest(assignTeacherSchema),
    async (req: Request, res: Response) => {
      try {
        const { teacherId, subjectId, classIds, periodsPerWeek } = req.body;

        logger.info('[AssignmentRoutes] POST /assign received', {
          teacherId,
          subjectId,
          classIds,
          periodsPerWeek,
        });

        const result = await assignmentService.assignTeacher(
          teacherId,
          subjectId,
          classIds,
          periodsPerWeek
        );

        logger.info('[AssignmentRoutes] assignTeacher result', {
          success: result.success,
          error: result.error,
          data: result.data,
        });

        if (!result.success) {
          logger.warn('[AssignmentRoutes] Assignment failed', { error: result.error });
          return res.status(400).json({ error: result.error });
        }

        // If validation failed (conflicts), return 200 with success: false
        if (!result.data?.success) {
          logger.warn('[AssignmentRoutes] Assignment has conflicts', {
            conflicts: result.data?.conflicts,
          });
          return res.json(result.data);
        }

        logger.info('[AssignmentRoutes] Assignment successful', {
          updatedTeacherId: result.data?.updatedTeacherId,
          updatedClassIds: result.data?.updatedClassIds,
        });
        res.status(201).json(result.data);
      } catch (error) {
        logger.error(
          '[AssignmentRoutes] Error assigning teacher',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to assign teacher' });
      }
    }
  );

  /**
   * DELETE /assignments/unassign
   * Unassign a teacher from subject-class combinations
   * Requirements: 1.6, 3.5
   */
  router.delete(
    '/unassign',
    validateRequest(unassignTeacherSchema),
    async (req: Request, res: Response) => {
      try {
        const { teacherId, subjectId, classIds } = req.body;

        logger.debug('Unassigning teacher', { teacherId, subjectId, classIds });

        const result = await assignmentService.unassignTeacher(teacherId, subjectId, classIds);

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json(result.data);
      } catch (error) {
        logger.error(
          'Error unassigning teacher',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to unassign teacher' });
      }
    }
  );

  // =========================================================================
  // Analysis Endpoints
  // =========================================================================

  /**
   * GET /assignments/teacher/:id/workload
   * Get workload analysis for a specific teacher
   * Requirements: 2.1
   */
  router.get('/teacher/:id/workload', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      logger.debug('Getting teacher workload', { teacherId: id });

      const result = await assignmentService.calculateTeacherWorkload(id);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error getting teacher workload',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to get teacher workload' });
    }
  });

  /**
   * GET /assignments/subject/:id/coverage
   * Get coverage analysis for a specific subject
   * Requirements: 4.2
   */
  router.get('/subject/:id/coverage', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      logger.debug('Getting subject coverage', { subjectId: id });

      const result = await assignmentService.calculateSubjectCoverage(id);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error getting subject coverage',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to get subject coverage' });
    }
  });

  /**
   * GET /assignments/conflicts
   * Get all assignment conflicts across the system
   * Requirements: 6.5
   */
  router.get('/conflicts', async (_req: Request, res: Response) => {
    try {
      logger.debug('Getting all assignment conflicts');

      const result = await assignmentService.detectAllConflicts();

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error getting assignment conflicts',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to get assignment conflicts' });
    }
  });

  /**
   * GET /assignments/audit
   * Audit data consistency between old and new assignment systems
   * Requirements: Phase 0 - Data Consistency Foundation
   */
  router.get('/audit', async (_req: Request, res: Response) => {
    try {
      logger.debug('Running assignment consistency audit');

      const result = await assignmentService.auditAssignmentConsistency();

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error running assignment audit',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to run assignment audit' });
    }
  });

  /**
   * POST /assignments/cleanup-duplicates
   * Clean up duplicate assignments to enforce single-teacher per class-subject.
   * This is a migration utility to fix existing data.
   */
  router.post('/cleanup-duplicates', async (_req: Request, res: Response) => {
    try {
      logger.info('Running duplicate assignment cleanup');

      const result = await assignmentService.cleanupDuplicateAssignments();

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error cleaning up duplicate assignments',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to cleanup duplicate assignments' });
    }
  });

  return router;
}

export default createAssignmentRoutes;
