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
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import {
  assignmentBatchSchema,
  assignTeacherSchema,
  unassignTeacherSchema,
  updateTeacherCapabilitySchema,
  validateAssignmentSchema,
} from '../schemas/assignment.schema';
import { AssignmentCommandService } from '../services/assignmentCommand.service';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { auditAssignmentStorageConsistency } from '../services/assignmentConsistency.service';
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
  router.param('id', positiveIntegerParam);
  const assignmentCommandService = AssignmentCommandService.getInstance(dataSource, cacheManager);
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  // =========================================================================
  // Validation Endpoints
  // =========================================================================

  router.post(
    '/batch/validate',
    validateRequest(assignmentBatchSchema),
    async (req: Request, res: Response) => {
      const result = await assignmentCommandService.validateBatch(req.body.changes);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'ASSIGNMENT_VALIDATION_FAILED',
            messageKey: 'assignments.errors.validationFailed',
            message: result.error ?? 'Assignment validation failed',
          },
        });
      }
      return res.json(result.data);
    }
  );

  router.post(
    '/batch',
    validateRequest(assignmentBatchSchema),
    async (req: Request, res: Response) => {
      const result = await assignmentCommandService.applyBatch(req.body.changes);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'ASSIGNMENT_BATCH_FAILED',
            messageKey: 'assignments.errors.batchFailed',
            message: result.error ?? 'Assignment batch failed',
          },
        });
      }
      if (!result.data?.isValid) {
        const isStale = result.data?.conflicts.some(
          (conflict) => conflict.type === 'stale_assignment'
        );
        return res.status(409).json({
          error: {
            code: isStale ? 'ASSIGNMENT_VERSION_CONFLICT' : 'ASSIGNMENT_CONFLICT',
            messageKey: isStale
              ? 'assignments.errors.staleAssignment'
              : 'assignments.errors.conflict',
            message: 'Assignment conflicts prevented the operation',
            conflicts: result.data?.conflicts ?? [],
          },
        });
      }
      return res.json(result.data);
    }
  );

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
        const {
          teacherId,
          subjectId,
          classIds,
          classPeriodOverrides,
          persistRequirementOverrides,
        } = req.body;

        logger.debug('Validating assignment', {
          teacherId,
          subjectId,
          classIds,
          classPeriodOverrides,
          persistRequirementOverrides,
        });

        const result = await assignmentCommandService.validateAssignment({
          teacherId,
          subjectId,
          classIds,
          classPeriodOverrides,
          persistRequirementOverrides,
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
        const {
          teacherId,
          subjectId,
          classIds,
          classPeriodOverrides,
          persistRequirementOverrides,
        } = req.body;

        logger.info('[AssignmentRoutes] POST /assign received', {
          teacherId,
          subjectId,
          classCount: classIds.length,
        });

        const result = await assignmentCommandService.assignTeacher(
          teacherId,
          subjectId,
          classIds,
          req.body.periodsPerWeek,
          classPeriodOverrides,
          persistRequirementOverrides
        );

        if (!result.success) {
          logger.warn('[AssignmentRoutes] Assignment failed', { error: result.error });
          return res.status(400).json({ error: result.error });
        }

        // A rejected command is an HTTP conflict, not a successful transport response.
        if (!result.data?.success) {
          logger.warn('[AssignmentRoutes] Assignment has conflicts', {
            conflicts: result.data?.conflicts,
          });
          return res.status(409).json({
            ...result.data,
            error: result.data?.conflicts?.map((conflict) => conflict.message).join('; ') ||
              'Assignment conflicts prevented the operation',
          });
        }

        logger.info('[AssignmentRoutes] Assignment successful', {
          updatedTeacherId: result.data?.updatedTeacherId,
          classCount: result.data?.updatedClassIds?.length ?? 0,
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

        const result = await assignmentCommandService.unassignTeacher(
          teacherId,
          subjectId,
          classIds
        );

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

  router.post(
    '/capability',
    validateRequest(updateTeacherCapabilitySchema),
    async (req: Request, res: Response) => {
      const result = await assignmentCommandService.updateTeacherCapability(req.body);
      return result.success
        ? res.json(result.data)
        : res.status(409).json({ error: result.error });
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
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      logger.debug('Getting teacher workload', { teacherId: id });

      const result = await assignmentProjectionService.calculateTeacherWorkload(id);

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
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      logger.debug('Getting subject coverage', { subjectId: id });

      const result = await assignmentProjectionService.calculateSubjectCoverage(id);

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

      const result = await assignmentProjectionService.detectAllConflicts();

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

      res.json(await auditAssignmentStorageConsistency(dataSource));
    } catch (error) {
      logger.error(
        'Error running assignment audit',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to run assignment audit' });
    }
  });

  return router;
}

export default createAssignmentRoutes;
