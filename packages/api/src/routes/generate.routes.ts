/**
 * Generate (Solver) routes
 * @module routes/generate
 * 
 * Requirements: 2.8, 7.2
 * - Timetable generation endpoint
 * - Integrates with SolverService
 * - Loads SchoolConfig and merges into solver input
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { SolverService, SolverError } from '../services/solver.service';
import { SchoolConfigRepository, SolverConfigInput } from '../database/repositories/schoolConfig.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { parseSolverError } from '../utils/errorParser';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../constants';

// Store DataSource reference for use in routes
let dataSourceRef: DataSource | null = null;
let cacheManagerRef: CacheManager | null = null;

/**
 * Initialize the generate routes with DataSource
 * This must be called before using the routes
 */
export function initializeGenerateRoutes(dataSource: DataSource, cacheManager?: CacheManager): void {
  dataSourceRef = dataSource;
  cacheManagerRef = cacheManager ?? CacheManager.getInstance();
}



/**
 * Helper to get SchoolConfig for solver
 * Requirements: 7.2
 */
async function getSchoolConfigForSolver(schoolId: number | null = null): Promise<SolverConfigInput | null> {
  if (!dataSourceRef) {
    logger.warn('DataSource not initialized for generate routes, skipping SchoolConfig loading');
    return null;
  }
  
  try {
    const schoolConfigRepo = SchoolConfigRepository.getInstance(dataSourceRef, cacheManagerRef ?? undefined);
    return await schoolConfigRepo.getForSolver(schoolId);
  } catch (error) {
    logger.error('Failed to load SchoolConfig for solver', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

const router = Router();

/**
 * Helper function to save timetable data before solving
 * This prepares the data structure for the solver
 */
const prepareTimetableData = (data: any) => {
  return {
    id: Date.now().toString(),
    config: data.config,
    preferences: data.preferences,
    teachers: data.teachers,
    subjects: data.subjects,
    rooms: data.rooms,
    classes: data.classes,
    createdAt: new Date(),
    status: 'processing'
  };
};

/**
 * Merge SchoolConfig into solver input data
 * Requirements: 7.2
 * 
 * @param data - Original solver input data
 * @param schoolConfig - SchoolConfig in solver-compatible format
 * @returns Merged data with SchoolConfig settings
 */
const mergeSchoolConfig = (data: any, schoolConfig: SolverConfigInput | null): any => {
  if (!schoolConfig) {
    return data;
  }

  // Merge SchoolConfig into the config section
  const mergedConfig = {
    ...data.config,
    // Afghanistan-specific settings from SchoolConfig
    ramadanModeEnabled: schoolConfig.ramadanModeEnabled,
    ramadanPeriodDuration: schoolConfig.ramadanPeriodDuration,
    ramadanBreakConfig: schoolConfig.ramadanBreakConfig,
    enableMinistryValidation: schoolConfig.enableMinistryValidation,
    ministryValidationMode: schoolConfig.ministryValidationMode,
    customCurriculumMode: schoolConfig.customCurriculumMode,
    lowResourceMode: schoolConfig.lowResourceMode,
    // Day configuration - only override if not already set in request
    daysOfWeek: data.config?.daysOfWeek ?? schoolConfig.daysOfWeek,
    periodsPerDayMap: data.config?.periodsPerDayMap ?? schoolConfig.periodsPerDayMap,
    defaultPeriodsPerDay: data.config?.defaultPeriodsPerDay ?? schoolConfig.defaultPeriodsPerDay,
  };

  return {
    ...data,
    config: mergedConfig,
  };
};

/**
 * POST /generate
 * Generate a timetable using the Python solver
 * Requirements: 7.2 - Load SchoolConfig and merge into solver input
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    logger.info('Received timetable generation request');
    
    // Load SchoolConfig from database (Requirements: 7.2)
    const schoolId = data.config?.schoolId ?? null;
    const schoolConfig = await getSchoolConfigForSolver(schoolId);
    if (schoolConfig) {
      logger.info('Loaded SchoolConfig for solver', { 
        ramadanModeEnabled: schoolConfig.ramadanModeEnabled,
        lowResourceMode: schoolConfig.lowResourceMode,
        enableMinistryValidation: schoolConfig.enableMinistryValidation
      });
    }
    
    // Validate that only enabled section subjects are included
    if (data.config && (data.config.sectionTimings || (data.config.enablePrimary !== undefined || data.config.enableMiddle !== undefined || data.config.enableHigh !== undefined))) {
      const hasSectionInfo = data.config.sectionTimings || 
        (data.config.enablePrimary !== undefined || data.config.enableMiddle !== undefined || data.config.enableHigh !== undefined);
      
      if (hasSectionInfo && data.subjects && Array.isArray(data.subjects)) {
        const subjectCount = data.subjects.length;
        logger.info('Generating timetable with subjects', { count: subjectCount });
        
        // Warn about subjects without grade information
        const subjectsWithoutGrade = data.subjects.filter((s: any) => !s.grade && !s.meta?.grade);
        if (subjectsWithoutGrade.length > 0) {
          logger.warn('Subjects without grade information', { count: subjectsWithoutGrade.length });
        }
      }
    }
    
    // Prepare the data for the solver
    const preparedData = prepareTimetableData(data);
    
    // Merge SchoolConfig into solver input (Requirements: 7.2)
    const mergedData = mergeSchoolConfig(preparedData, schoolConfig);
    
    // Run the solver
    const solverService = SolverService.getInstance();
    const result = await solverService.runSolver(mergedData);
    
    res.json({
      success: true,
      data: result,
      message: 'Timetable generated successfully'
    });
  } catch (error: unknown) {
    logger.error('Timetable generation failed', error instanceof Error ? error : new Error(String(error)));
    
    const err = error as SolverError;
    
    // Handle SOLVER_BUSY error (503)
    if (err.code === ERROR_CODES.SOLVER_BUSY) {
      return res.status(503).json({
        success: false,
        error: {
          type: 'SOLVER_BUSY',
          message: err.clientMessage || 'Solver is currently busy',
          details: err.message
        },
        message: 'Timetable generation is already in progress'
      });
    }
    
    // Handle SOLVER_TIMEOUT error (504)
    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      return res.status(504).json({
        success: false,
        error: {
          type: 'SOLVER_TIMEOUT',
          message: err.clientMessage || 'Solver timed out',
          details: err.message
        },
        message: 'Timetable generation timed out'
      });
    }
    
    // Try to extract structured error information
    let structuredError: any = null;
    if (err.parsedError) {
      structuredError = err.parsedError;
    } else {
      // Try to parse error from message if it contains stderr
      const message = err.message || '';
      if (message.includes('stderr:') || message.includes('validation error')) {
        const parsed = parseSolverError(message);
        if (parsed) {
          structuredError = parsed;
        }
      }
    }
    
    // Return structured error response if available
    if (structuredError) {
      res.status(500).json({
        success: false,
        error: {
          type: structuredError.errorType,
          entityType: structuredError.entityType,
          entityId: structuredError.entityId,
          field: structuredError.field,
          day: structuredError.day || null,
          expected: structuredError.expected || null,
          actual: structuredError.actual || null,
          details: structuredError.details,
          suggestedStep: structuredError.suggestedStep,
          message: structuredError.details
        },
        message: 'Failed to generate timetable'
      });
    } else {
      // Fallback to simple error response
      res.status(500).json({
        success: false,
        error: err.clientMessage || err.message,
        message: 'Failed to generate timetable'
      });
    }
  }
});

/**
 * GET /generate/status
 * Get the current status of the solver
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const solverService = SolverService.getInstance();
    const status = solverService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting solver status', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to get solver status' });
  }
});

/**
 * POST /generate/analyze
 * Run pre-solve analysis without generating a timetable
 * 
 * Requirements: 3.6, 7.2
 * - Validates input data and returns potential issues
 * - Returns PreSolveResult with can_proceed, errors, warnings, suggestions
 * - Loads SchoolConfig and merges into solver input
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    logger.info('Received pre-solve analysis request');
    
    // Load SchoolConfig from database (Requirements: 7.2)
    const schoolId = data.config?.schoolId ?? null;
    const schoolConfig = await getSchoolConfigForSolver(schoolId);
    
    // Prepare the data for the solver (same as generate)
    const preparedData = prepareTimetableData(data);
    
    // Merge SchoolConfig into solver input (Requirements: 7.2)
    const mergedData = mergeSchoolConfig(preparedData, schoolConfig);
    
    // Run pre-solve analysis
    const solverService = SolverService.getInstance();
    const result = await solverService.runPreSolveAnalysis(mergedData);
    
    // Return PreSolveResult directly (passthrough)
    res.json(result);
  } catch (error: unknown) {
    logger.error('Pre-solve analysis failed', error instanceof Error ? error : new Error(String(error)));
    
    const err = error as SolverError;
    
    // Handle SOLVER_TIMEOUT error (504)
    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      return res.status(504).json({
        can_proceed: false,
        errors: [{
          error_code: 'ANALYSIS_TIMEOUT',
          severity: 'error',
          message_key: 'error.analysis.timeout',
          message_farsi: 'تحلیل پیش از حل زمان‌بر شد',
          message_english: 'Pre-solve analysis timed out',
          affected_entities: [],
          context: {}
        }],
        warnings: [],
        suggestions: [],
        analysis_time_ms: 0
      });
    }
    
    // Return error as PreSolveResult format
    res.status(500).json({
      can_proceed: false,
      errors: [{
        error_code: 'ANALYSIS_ERROR',
        severity: 'error',
        message_key: 'error.analysis.failed',
        message_farsi: 'تحلیل پیش از حل با خطا مواجه شد',
        message_english: err.clientMessage || err.message || 'Pre-solve analysis failed',
        affected_entities: [],
        context: { details: err.message }
      }],
      warnings: [],
      suggestions: [],
      analysis_time_ms: 0
    });
  }
});

export default router;
