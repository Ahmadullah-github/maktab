# Solver Data Flow Fix

## Problem

The frontend was sending raw database entities to the `/api/generate` endpoint,
which included:

- Database metadata fields (`isDeleted`, `deletedAt`, `createdAt`, `updatedAt`)
- Frontend-specific fields (`classAssignments`)
- Empty or incorrectly formatted data (empty `availability` arrays)

This caused the solver to fail with validation errors because the data didn't
match the expected Pydantic schema.

## Root Cause

The data flow was:

1. Frontend fetches entities via hooks (useTeachers, useSubjects, etc.)
2. API deserializes data and adds parsed fields
3. Frontend sends ALL fields (including database metadata) to `/api/generate`
4. API tries to transform but fails due to unexpected fields

## Solution

**Architectural Change: API-Driven Data Fetching**

The API now fetches entities directly from the database when generating
schedules, ensuring clean data without frontend serialization artifacts.

### New Data Flow

1. Frontend sends only `strategy` and `config` to `/api/generate`
2. API fetches entities directly from database repositories
3. API transforms clean data using existing `transformForSolver()` function
4. API feeds properly formatted data to Python solver

### Benefits

- **Clean separation of concerns**: Frontend = UI, API = Business Logic
- **No data corruption**: Database entities go directly to transformer
- **Simpler frontend**: No need to manage entity state for generation
- **Consistent data**: API always gets fresh data from database
- **Better performance**: No large payloads sent from frontend

## Files Modified

### 1. `packages/api/src/routes/generate.routes.ts`

**Added:**

```typescript
async function fetchEntitiesForSolver() {
  // Fetches teachers, subjects, classes, rooms from repositories
  // Returns clean data without frontend serialization
}
```

**Modified:**

```typescript
router.post('/', async (req: Request, res: Response) => {
  // Now fetches entities from database instead of using req.body
  const { teachers, subjects, classes, rooms } = await fetchEntitiesForSolver();

  // Rest of transformation logic remains the same
});
```

### 2. `packages/web/src/features/schedule/hooks/useEnhancedGenerateSchedule.ts`

**Removed:**

- Entity fetching hooks (useTeachers, useSubjects, useClasses, useRooms)
- `isLoadingInputData` state
- Large payload construction

**Simplified:**

```typescript
interface GenerateInput {
  strategy: SolverStrategy;
  config: {
    schoolId?: number | null;
    strategy?: SolverStrategy;
  };
  // No more teachers, subjects, classes, rooms arrays
}
```

**Result:**

- Frontend sends minimal payload (~100 bytes instead of ~100KB)
- No entity state management needed
- Simpler, cleaner code

## Testing

### Before Testing

1. Ensure database has data:
   - Teachers with subjects and availability
   - Classes with subject requirements
   - Subjects
   - Rooms

2. Start services:
   ```bash
   npm run dev  # Starts web, api, and electron
   ```

### Test Cases

1. **Basic Generation**
   - Navigate to Schedule Dashboard
   - Click "Generate Schedule"
   - Should fetch entities from database and generate successfully

2. **Strategy Selection**
   - Try different strategies (fast, balanced, thorough)
   - API should fetch fresh data each time

3. **Error Handling**
   - Test with incomplete data (e.g., no teachers)
   - Should show proper validation errors from pre-solve analysis

### Expected Behavior

**Console Logs (API):**

```
=== API: Fetched from Database ===
Teachers count: 12
Subjects count: 42
Classes count: 6
Rooms count: 20
```

**Console Logs (Frontend):**

```
=== FRONTEND: Sending to API ===
Strategy: balanced
Config: { strategy: 'balanced' }
Note: API will fetch entities from database
```

## Rollback Plan

If issues occur, revert these commits:

1. `packages/api/src/routes/generate.routes.ts` - Revert to accept entities from
   request body
2. `packages/web/src/features/schedule/hooks/useEnhancedGenerateSchedule.ts` -
   Restore entity hooks

## Future Improvements

1. **Caching**: Cache fetched entities for repeated generation attempts
2. **Incremental Updates**: Only refetch changed entities
3. **Validation**: Add pre-fetch validation to fail fast
4. **Monitoring**: Add metrics for entity fetch time

## Related Files

- `packages/api/src/routes/generate.routes.ts` - Main route handler
- `packages/api/src/database/repositories/*.repository.ts` - Entity repositories
- `packages/web/src/features/schedule/hooks/useEnhancedGenerateSchedule.ts` -
  Frontend hook
- `packages/solver/models/input.py` - Pydantic input models
- `packages/api/schema.ts` - Zod validation schemas
