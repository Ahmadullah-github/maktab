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
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import {
  bulkCreateTeacherClassSubjectAssignmentSchema,
  createTeacherClassSubjectAssignmentSchema,
  updateTeacherClassSubjectAssignmentSchema,
  validateLegacyAssignmentSchema,
} from '../schemas/teacherClassSubjectAssignment.schema';
import { AssignmentCommandService } from '../services/assignmentCommand.service';
import { AssignmentCompatibilityService } from '../services/assignmentCompatibility.service';
import { logger } from '../utils/logger';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import type { AssignmentBatchChangeInput } from '../services/assignment.types';

/**
 * Creates teacher-class-subject assignment routes
 */
export function createTeacherClassSubjectAssignmentRoutes(
  dataSource: DataSource,
  cacheManager?: CacheManager
): Router {
  const router = Router();
  for (const parameter of ['id', 'classId', 'teacherId', 'subjectId']) {
    router.param(parameter, positiveIntegerParam);
  }
  const assignmentCommandService = AssignmentCommandService.getInstance(dataSource, cacheManager);
  const assignmentCompatibilityService = new AssignmentCompatibilityService(dataSource);

  const applyCanonicalChanges = async (changes: AssignmentBatchChangeInput[]) => {
    const result = await assignmentCommandService.applyBatch(changes);
    if (!result.success) throw new Error(result.error ?? 'Assignment command failed');
    if (!result.data?.isValid) {
      const error = new Error(
        result.data?.conflicts.map((conflict) => conflict.message).join('; ') ||
          'Assignment conflict'
      ) as Error & { statusCode?: number; conflicts?: unknown[] };
      error.statusCode = 409;
      error.conflicts = result.data?.conflicts ?? [];
      throw error;
    }
  };

  const loadRequirement = async (classId: number, subjectId: number) => {
    const requirement = await dataSource.getRepository(ClassSubjectRequirement).findOne({
      where: { classId, subjectId, isDeleted: false },
    });
    if (!requirement) throw new Error(`Class ${classId} does not require subject ${subjectId}`);
    return requirement;
  };

  const getAllocations = async (requirementId: number) =>
    (await dataSource.getRepository(TeachingAssignment).find({
      where: { classSubjectRequirementId: requirementId, isDeleted: false },
    })).map((assignment) => ({
      teacherId: assignment.teacherId,
      periodsPerWeek: assignment.assignedPeriodsPerWeek,
    }));

  const sendWriteError = (res: Response, error: unknown, operation: string) => {
    const typed = error as Error & { statusCode?: number; conflicts?: unknown[] };
    const message = typed instanceof Error ? typed.message : String(error);
    const status = typed.statusCode ?? (message.includes('does not require') || message.includes('not found') ? 404 : 400);
    logger.warn(`Compatibility ${operation} rejected`, { message, status });
    return res.status(status).json({
      error: {
        code: status === 409 ? 'ASSIGNMENT_CONFLICT' : 'ASSIGNMENT_WRITE_REJECTED',
        message,
        conflicts: typed.conflicts ?? [],
      },
    });
  };

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
      const id = Number(req.params.id);
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
      const classId = Number(req.params.classId);
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
      const teacherId = Number(req.params.teacherId);
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
      const classId = Number(req.params.classId);
      const subjectId = Number(req.params.subjectId);

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
      const classId = Number(req.params.classId);
      const subjectId = Number(req.params.subjectId);

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
        const requirement = await loadRequirement(req.body.classId, req.body.subjectId);
        const allocations = await getAllocations(requirement.id);
        if (allocations.some((allocation) => allocation.teacherId === req.body.teacherId)) {
          throw new Error('Assignment already exists');
        }
        await applyCanonicalChanges([{
          requirementId: requirement.id,
          expectedVersion: requirement.assignmentVersion,
          allocations: [...allocations, {
            teacherId: req.body.teacherId,
            periodsPerWeek: req.body.periodsPerWeek,
          }],
        }]);
        const assignment = (await assignmentCompatibilityService.getLegacyAssignments({
          classId: req.body.classId,
          subjectId: req.body.subjectId,
          teacherId: req.body.teacherId,
        }))[0];
        res.status(201).json(assignment);
      } catch (error) {
        return sendWriteError(res, error, 'create');
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
        const requirementByKey = new Map<string, ClassSubjectRequirement>();
        for (const input of inputs) {
          const key = `${input.classId}:${input.subjectId}`;
          if (!requirementByKey.has(key)) {
            requirementByKey.set(key, await loadRequirement(input.classId, input.subjectId));
          }
        }
        const changes: AssignmentBatchChangeInput[] = [];
        for (const [key, requirement] of requirementByKey) {
          const [classId, subjectId] = key.split(':').map(Number);
          const additions = inputs
            .filter((input: any) => input.classId === classId && input.subjectId === subjectId)
            .map((input: any) => ({
              teacherId: input.teacherId,
              periodsPerWeek: input.periodsPerWeek,
            }));
          changes.push({
            requirementId: requirement.id,
            expectedVersion: requirement.assignmentVersion,
            allocations: [...await getAllocations(requirement.id), ...additions],
          });
        }
        await applyCanonicalChanges(changes);
        const assignments = (await assignmentCompatibilityService.getLegacyAssignments())
          .filter((assignment) => inputs.some((input: any) =>
            input.classId === assignment.classId &&
            input.subjectId === assignment.subjectId &&
            input.teacherId === assignment.teacherId
          ));
        res.status(201).json(assignments);
      } catch (error) {
        return sendWriteError(res, error, 'bulk create');
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
        const id = Number(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid assignment ID' });
        }

        const existing = await assignmentCompatibilityService.getLegacyAssignment(id);
        if (!existing) {
          return res.status(404).json({ error: 'Assignment not found' });
        }
        const destination = {
          teacherId: req.body.teacherId ?? existing.teacherId,
          classId: req.body.classId ?? existing.classId,
          subjectId: req.body.subjectId ?? existing.subjectId,
          periodsPerWeek: req.body.periodsPerWeek ?? existing.periodsPerWeek,
        };
        const sourceRequirement = await loadRequirement(existing.classId, existing.subjectId);
        const destinationRequirement = await loadRequirement(destination.classId, destination.subjectId);
        const sourceAllocations = (await getAllocations(sourceRequirement.id))
          .filter((allocation) => allocation.teacherId !== existing.teacherId);
        const changes: AssignmentBatchChangeInput[] = [];
        if (sourceRequirement.id === destinationRequirement.id) {
          changes.push({
            requirementId: sourceRequirement.id,
            expectedVersion: sourceRequirement.assignmentVersion,
            allocations: [...sourceAllocations, {
              teacherId: destination.teacherId,
              periodsPerWeek: destination.periodsPerWeek,
            }],
          });
        } else {
          changes.push({
            requirementId: sourceRequirement.id,
            expectedVersion: sourceRequirement.assignmentVersion,
            allocations: sourceAllocations,
          }, {
            requirementId: destinationRequirement.id,
            expectedVersion: destinationRequirement.assignmentVersion,
            allocations: [...await getAllocations(destinationRequirement.id), {
              teacherId: destination.teacherId,
              periodsPerWeek: destination.periodsPerWeek,
            }],
          });
        }
        await applyCanonicalChanges(changes);
        const updated = (await assignmentCompatibilityService.getLegacyAssignments({
          classId: destination.classId,
          subjectId: destination.subjectId,
          teacherId: destination.teacherId,
        }))[0];
        res.json(updated);
      } catch (error) {
        return sendWriteError(res, error, 'update');
      }
    }
  );

  /**
   * DELETE /teacher-assignments/:id
   * Soft delete an assignment
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid assignment ID' });
      }

      const existing = await assignmentCompatibilityService.getLegacyAssignment(id);
      if (!existing) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      const requirement = await loadRequirement(existing.classId, existing.subjectId);
      await applyCanonicalChanges([{
        requirementId: requirement.id,
        expectedVersion: requirement.assignmentVersion,
        allocations: (await getAllocations(requirement.id))
          .filter((allocation) => allocation.teacherId !== existing.teacherId),
      }]);
      res.status(204).send();
    } catch (error) {
      return sendWriteError(res, error, 'delete');
    }
  });

  /**
   * POST /teacher-assignments/validate
   * Validate if an assignment can be made without exceeding class requirements
   */
  router.post(
    '/validate',
    validateRequest(validateLegacyAssignmentSchema),
    async (req: Request, res: Response) => {
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
    }
  );

  return router;
}

export default createTeacherClassSubjectAssignmentRoutes;
