/**
 * Route aggregator - exports all route modules
 * @module routes
 *
 * This module aggregates all route modules and provides a factory function
 * to create the main router with all routes mounted.
 */

import { Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';

// Import route modules
import { createAssignmentRoutes } from './assignment.routes';
import { createClassRoutes } from './class.routes';
import { createConfigRoutes, createResetRouter } from './config.routes';
import { createCurriculumRoutes } from './curriculum.routes';
import { createExportRoutes } from './export.routes';
import generateRoutes, { initializeGenerateRoutes } from './generate';
import healthRoutes from './health.routes';
import licenseRoutes from './license.routes';
import { createRoomRoutes } from './room.routes';
import { createRoomTypeRoutes } from './roomType.routes';
import { createSubjectRoutes } from './subject.routes';
import swapRoutes from './swap.routes';
import { createTeacherRoutes } from './teacher.routes';
import { createTeacherClassSubjectAssignmentRoutes } from './teacherClassSubjectAssignment.routes';
import { createTimetableRoutes } from './timetable.routes';
import { createWizardRoutes } from './wizard.routes';

/**
 * Creates the main API router with all routes mounted
 *
 * @param dataSource - TypeORM DataSource for database operations
 * @param cacheManager - Optional CacheManager for caching
 * @returns Express Router with all API routes
 */
export function createApiRouter(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();

  // Mount routes that don't require DataSource injection
  router.use('/health', healthRoutes);
  router.use('/swap', swapRoutes);

  // Initialize generate routes with DataSource for SchoolConfig loading (Requirements: 7.2)
  initializeGenerateRoutes(dataSource, cacheManager);
  router.use('/generate', generateRoutes);

  // Mount routes that require DataSource injection
  router.use('/config', createConfigRoutes(dataSource, cacheManager));
  router.use('/reset', createResetRouter(dataSource, cacheManager));
  router.use('/wizard', createWizardRoutes(dataSource, cacheManager));
  router.use('/teachers', createTeacherRoutes(dataSource, cacheManager));
  router.use('/subjects', createSubjectRoutes(dataSource, cacheManager));
  router.use('/rooms', createRoomRoutes(dataSource, cacheManager));
  router.use('/classes', createClassRoutes(dataSource, cacheManager));
  router.use('/timetables', createTimetableRoutes(dataSource, cacheManager));
  router.use('/curriculum', createCurriculumRoutes(dataSource, cacheManager));
  router.use('/export', createExportRoutes(dataSource, cacheManager));
  router.use('/assignments', createAssignmentRoutes(dataSource, cacheManager));
  router.use(
    '/teacher-assignments',
    createTeacherClassSubjectAssignmentRoutes(dataSource, cacheManager)
  );
  router.use('/room-types', createRoomTypeRoutes(dataSource, cacheManager));

  return router;
}

/**
 * Creates the license router (must be mounted BEFORE license middleware)
 *
 * @returns Express Router with license routes
 */
export function createLicenseRouter(): Router {
  return licenseRoutes;
}

// Export individual route modules for direct use if needed
export { createAssignmentRoutes } from './assignment.routes';
export { createClassRoutes } from './class.routes';
export { createConfigRoutes, createResetRouter } from './config.routes';
export { createCurriculumRoutes } from './curriculum.routes';
export { createExportRoutes } from './export.routes';
export { default as generateRoutes } from './generate';
export { default as healthRoutes } from './health.routes';
export { default as licenseRoutes } from './license.routes';
export { createRoomRoutes } from './room.routes';
export { createRoomTypeRoutes } from './roomType.routes';
export { createSubjectRoutes } from './subject.routes';
export { default as swapRoutes } from './swap.routes';
export { createTeacherRoutes } from './teacher.routes';
export { createTeacherClassSubjectAssignmentRoutes } from './teacherClassSubjectAssignment.routes';
export { createTimetableRoutes } from './timetable.routes';
export { createWizardRoutes } from './wizard.routes';
