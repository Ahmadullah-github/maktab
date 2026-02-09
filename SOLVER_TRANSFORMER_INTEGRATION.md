# Solver Data Transformer Integration Guide

## Overview

Created a dedicated `SolverDataTransformerService` that handles the complete
transformation from database entities to solver input format. This service
ensures clean, validated data without any database metadata.

## New Service

**File:** `packages/api/src/services/solverDataTransformer.service.ts`

### Key Features

1. **Complete Transformation Pipeline**
   - Fetches all entities from database repositories
   - Loads school configuration
   - Transforms each entity type to solver format
   - Strips all database metadata fields
   - Converts IDs to strings
   - Formats availability matrices correctly
   - Handles unavailable slots
   - Builds config and preferences

2. **Clean Output**
   - No `schoolId`, `isDeleted`, `createdAt`, `updatedAt` fields
   - No `classAssignments` field from teachers
   - Only fields expected by Pydantic models
   - Proper type conversions (number[] → string[])

3. **Singleton Pattern**
   - Reusable across requests
   - Efficient caching support

## Integration Steps

### Step 1: Update Imports in `generate.routes.ts`

```typescript
import { SolverDataTransformerService } from '../services/solverDataTransformer.service';
```

### Step 2: Replace POST /generate Route

Replace the current implementation with:

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

    // Log for debugging
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

### Step 3: Remove Old Helper Functions

You can now remove these functions from `generate.routes.ts`:

- `fetchEntitiesForSolver()`
- `getSchoolConfigForSolver()`
- `getFixedTeacherAssignmentsForSolver()`
- `transformForSolver()`
- `convertAvailabilityFormat()`
- `prepareTimetableData()`
- `mergeSchoolConfig()`

All this logic is now in the transformer service.

### Step 4: Update POST /analyze Route

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

## Verification

### Check Transformed Data

Add this debug logging after transformation:

```typescript
if (solverInput.teachers.length > 0) {
  const t = solverInput.teachers[0];
  console.log('Sample Teacher:', {
    id: t.id,
    idType: typeof t.id,
    primarySubjectIds: t.primarySubjectIds,
    availabilityKeys: Object.keys(t.availability),
    hasDbFields: {
      schoolId: 'schoolId' in t,
      isDeleted: 'isDeleted' in t,
      classAssignments: 'classAssignments' in t,
    },
  });
}
```

### Expected Output

```
Sample Teacher: {
  id: '21',
  idType: 'string',
  primarySubjectIds: ['43', '57', '71'],
  availabilityKeys: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  hasDbFields: {
    schoolId: false,
    isDeleted: false,
    classAssignments: false
  }
}
```

## Benefits

1. **Clean Architecture**: Single responsibility - one service for
   transformation
2. **Testable**: Can unit test transformation logic independently
3. **Maintainable**: All transformation logic in one place
4. **Type Safe**: TypeScript interfaces ensure correct structure
5. **Reusable**: Can be used by other endpoints if needed
6. **Debuggable**: Clear logging at each step

## Testing

```bash
# Compile
npx tsc --noEmit --project packages/api/tsconfig.json

# Run API
npm run dev

# Test generation
curl -X POST http://localhost:4000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"strategy": "balanced", "config": {}}'
```

Check the console logs to verify:

- No database fields in output
- IDs are strings
- Availability is properly formatted
- Subject requirements are objects (not arrays)
