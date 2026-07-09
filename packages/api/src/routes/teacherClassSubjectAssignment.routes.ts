/**
 * TeacherClassSubjectAssignment routes
 * @module routes/teacherClassSubjectAssignment
 *
 * API endpoints for managing multi-teacher subject assignments.
 * Supports partial period assignments (e.g., Teacher A teaches 1 of 2 History periods).
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { validateRequest } from '../middleware/validation.middleware';
import {
  bulkCreateTeacherClassSubjectAssignmentSchema,
  createTeacherClassSubjectAssignmentSchema,
  updateTeacherClassSubjectAssignmentSchema,
} from '../schemas/teacherClassSubjectAssignment.schema';
import { AssignmentCommandService } from '../services/assignmentCommand.service';
import { AssignmentCompatibilityService } from '../services/assignmentCompatibility.service';
import { logger } from '../utils/logger';

/**
 * Creates teacher-class-subject assignment routes
 */
export function createTeacherClassSubjectAssignmentRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): Router {
  const router = Router();
  const assignmentCommandService = AssignmentCommandService.getInstance(dataSource, cacheManager);
  const assignmentCompatibilityService = new AssignmentCompatibilityService(dataSource);

  /**
   * GET /teacher-assignments
   * Get all assignments
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const assignments = await assignmentCompatibilityService.getLegacyAssignments();
      res.json(assignments);
    } catch (error) {
      logger.error(
        'Error fetching assignments',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  /**
   * GET /teacher-assignments/:id
   * Get a specific assignment by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid assignment ID' });
      }

      const assignment = await assignmentCompatibilityService.getLegacyAssignment(id);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.json(assignment);
    } catch (error) {
      logger.error(
        'Error fetching assignment',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  });

  /**
   * GET /teacher-assignments/class/:classId
   * Get all assignments for a class
   */
  router.get('/class/:classId', async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.classId);
      if (isNaN(classId)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }

      const assignments = await assignmentCompatibilityService.getLegacyAssignments({ classId });
      res.json(assignments);
    } catch (error) {
      logger.error(
        'Error fetching assignments by class',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  /**
   * GET /teacher-assignments/teacher/:teacherId
   * Get all assignments for a teacher
   */
  router.get('/teacher/:teacherId', async (req: Request, res: Response) => {
    try {
      const teacherId = parseInt(req.params.teacherId);
      if (isNaN(teacherId)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      const assignments = await assignmentCompatibilityService.getLegacyAssignments({ teacherId });
      res.json(assignments);
    } catch (error) {
      logger.error(
        'Error fetching assignments by teacher',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  /**
   * GET /teacher-assignments/class/:classId/subject/:subjectId
   * Get assignments for a specific class-subject pair
   */
  router.get('/class/:classId/subject/:subjectId', async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.classId);
      const subjectId = parseInt(req.params.subjectId);

      if (isNaN(classId) || isNaN(subjectId)) {
        return res.status(400).json({ error: 'Invalid class ID or subject ID' });
      }

      const assignments = await assignmentCompatibilityService.getLegacyAssignments({
        classId,
        subjectId,
      });
      res.json(assignments);
    } catch (error) {
      logger.error(
        'Error fetching assignments by class-subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  /**
   * GET /teacher-assignments/summary/:classId/:subjectId
   * Get assignment summary for a class-subject pair
   */
  router.get('/summary/:classId/:subjectId', async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.classId);
      const subjectId = parseInt(req.params.subjectId);

      if (isNaN(classId) || isNaN(subjectId)) {
        return res.status(400).json({ error: 'Invalid class ID or subject ID' });
      }

      const summary = await assignmentCompatibilityService.getLegacyAssignmentSummary(
        classId,
        subjectId
      );
      res.json(summary);
    } catch (error) {
      logger.error(
        'Error fetching assignment summary',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch assignment summary' });
    }
  });

  /**
   * POST /teacher-assignments
   * Create a new assignment
   */
  router.post(
    '/',
    validateRequest(createTeacherClassSubjectAssignmentSchema),
    async (req: Request, res: Response) => {
      try {
        const assignment = await assignmentCommandService.createLegacyAssignment(req.body);
        res.status(201).json(assignment);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already exists')) {
          return res.status(409).json({ error: message });
        }
        if (message.includes('not found') || message.includes('does not require')) {
          return res.status(404).json({ error: message });
        }
        logger.error(
          'Error creating assignment',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to create assignment' });
      }
    }
  );

  /**
   * POST /teacher-assignments/bulk
   * Bulk create assignments
   */
  router.post(
    '/bulk',
    validateRequest(bulkCreateTeacherClassSubjectAssignmentSchema),
    async (req: Request, res: Response) => {
      try {
        const { assignments: inputs } = req.body;
        const assignments = await assignmentCommandService.bulkCreateLegacyAssignments(inputs);
        res.status(201).json(assignments);
      } catch (error) {
        logger.error(
          'Error bulk creating assignments',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to bulk create assignments' });
      }
    }
  );

  /**
   * PUT /teacher-assignments/:id
   * Update an existing assignment
   */
  router.put(
    '/:id',
    validateRequest(updateTeacherClassSubjectAssignmentSchema),
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid assignment ID' });
        }

        const updated = await assignmentCommandService.updateLegacyAssignment(id, req.body);
        if (!updated) {
          return res.status(404).json({ error: 'Assignment not found' });
        }
        res.json(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already exists')) {
          return res.status(409).json({ error: message });
        }
        if (message.includes('not found') || message.includes('does not require')) {
          return res.status(404).json({ error: message });
        }
        logger.error(
          'Error updating assignment',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to update assignment' });
      }
    }
  );

  /**
   * DELETE /teacher-assignments/:id
   * Soft delete an assignment
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid assignment ID' });
      }

      const deleted = await assignmentCommandService.deleteLegacyAssignment(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting assignment',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  });

  /**
   * POST /teacher-assignments/validate
   * Validate if an assignment can be made without exceeding class requirements
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { classId, subjectId, requiredPeriods, excludeAssignmentId } = req.body;

      if (!classId || !subjectId || requiredPeriods === undefined) {
        return res.status(400).json({
          error: 'classId, subjectId, and requiredPeriods are required',
        });
      }

      const validation = await assignmentCommandService.validateLegacyAssignment(
        classId,
        subjectId,
        requiredPeriods,
        excludeAssignmentId
      );

      res.json(validation);
    } catch (error) {
      logger.error(
        'Error validating assignment',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to validate assignment' });
    }
  });

  return router;
}

export default createTeacherClassSubjectAssignmentRoutes;
