# Quick Fix for generate.routes.ts

## Problem

The file still has old code that references removed functions. We need to use
the new `SolverDataTransformerService` instead.

## Quick Fix

Replace the POST `/generate` route (around line 992) with this simplified
version:

```typescript
router.post('/', async (req: Request, res: Response) => {
  try {
    const requestConfig = req.body.config || {};
    const strategy = req.body.strategy || 'balanced';

    logger.info('Received timetable generation request', { strategy });

    // Use transformer service to get clean solver input
    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
      strategy,
    });

    logger.info('Transformed data for solver', {
      teachers: solverInput.teachers.length,
      subjects: solverInput.subjects.length,
      classes: solverInput.classes.length,
      rooms: solverInput.rooms.length,
    });

    // Run pre-solve analysis
    const solverService = SolverService.getInstance();
    const preSolveResult = await solverService.runPreSolveAnalysis(solverInput);

    if (!preSolveResult.can_proceed && preSolveResult.errors?.length > 0) {
      logger.warn('Pre-solve analysis found blocking errors');
      return res.status(422).json({
        success: false,
        status: 'failed',
        data: null,
        errors: preSolveResult.errors,
        warnings: preSolveResult.warnings || [],
        quality_score: null,
        metadata: { analysis_time_ms: preSolveResult.analysis_time_ms },
      });
    }

    // Run the solver
    const result = await solverService.runSolver(solverInput);

    if (result.status === 'failed') {
      return res.status(422).json({
        success: false,
        status: 'failed',
        data: null,
        errors: result.errors || [],
        warnings: result.warnings || [],
        quality_score: null,
        metadata: result.metadata || {},
      });
    }

    // Success
    res.json({
      success: true,
      status: result.status || 'success',
      data: result.data,
      errors: result.errors || [],
      warnings: result.warnings || [],
      quality_score: result.quality_score || null,
      metadata: result.metadata || {},
    });
  } catch (error: unknown) {
    logger.error(
      'Timetable generation failed',
      error instanceof Error ? error : new Error(String(error))
    );

    const err = error as SolverError;

    if (err.code === ERROR_CODES.SOLVER_BUSY) {
      return res.status(503).json({
        success: false,
        error: {
          type: 'SOLVER_BUSY',
          message: err.clientMessage || 'Solver is currently busy',
        },
      });
    }

    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      return res.status(504).json({
        success: false,
        error: {
          type: 'SOLVER_TIMEOUT',
          message: err.clientMessage || 'Solver timed out',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: err.clientMessage || err.message,
    });
  }
});
```

And replace POST `/analyze` route (around line 1300) with:

```typescript
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const requestConfig = req.body.config || {};

    logger.info('Received pre-solve analysis request');

    // Use transformer service
    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
    });

    // Run pre-solve analysis
    const solverService = SolverService.getInstance();
    const result = await solverService.runPreSolveAnalysis(solverInput);

    res.json(result);
  } catch (error: unknown) {
    logger.error(
      'Pre-solve analysis failed',
      error instanceof Error ? error : new Error(String(error))
    );

    res.status(500).json({
      can_proceed: false,
      errors: [
        {
          error_code: 'ANALYSIS_ERROR',
          severity: 'error',
          message_farsi: 'تحلیل پیش از حل با خطا مواجه شد',
          message_english: 'Pre-solve analysis failed',
          affected_entities: [],
          context: {},
        },
      ],
      warnings: [],
      suggestions: [],
      analysis_time_ms: 0,
    });
  }
});
```

## Alternative: Comment Out Old Routes Temporarily

If you want to test the transformer service first, comment out the entire POST
routes and add a simple test route:

```typescript
// Temporary test route
router.post('/test-transform', async (req: Request, res: Response) => {
  try {
    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({});

    res.json({
      success: true,
      message: 'Transformation successful',
      stats: {
        teachers: solverInput.teachers.length,
        subjects: solverInput.subjects.length,
        classes: solverInput.classes.length,
        rooms: solverInput.rooms.length,
      },
      sample: {
        firstTeacher: solverInput.teachers[0],
        firstClass: solverInput.classes[0],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

Then test with:

```bash
curl -X POST http://localhost:4000/api/generate/test-transform
```
