# Generate Routes Module

Refactored from a single 1000+ line file into focused, maintainable modules.

## Structure

```
generate/
├── index.ts           # Main router (40 lines)
├── handlers.ts        # Route handlers (200 lines)
├── transformation.ts  # Data transformation (200 lines)
├── validation.ts      # Pre-validation logic (500 lines)
└── types.ts          # Shared types (30 lines)
```

## Files

### `index.ts`

- Main router setup
- Route definitions
- Initialization function

### `handlers.ts`

- `handleGenerate` - POST /generate
- `handleGetStatus` - GET /generate/status
- `handleAnalyze` - POST /generate/analyze
- `handleTest` - POST /generate/test

### `transformation.ts`

- `convertAvailabilityFormat` - Convert availability to solver format
- `transformUnavailable` - Transform unavailable slots
- `normalizeTimePreference` - Normalize time preferences
- `transformForSolver` - Main transformation function
- `mergeSchoolConfig` - Merge school config into solver input

### `validation.ts`

- `preValidateData` - Main validation entry point
- Individual validators:
  - `validateTeachers`
  - `validateClasses`
  - `validateRooms`
  - `validateSubjects`
  - `validateRoomTypes`
  - `validateQualifiedTeachers`
  - `validateClassPeriods`
  - `validateTeacherLoad`
  - `validateSingleTeacherMode`

### `types.ts`

- `PreValidationError` - Error structure
- `TransformOptions` - Transformation options
- `GenerateRequestBody` - Request body type

## Usage

Import from the module root:

```typescript
import generateRoutes, { initializeGenerateRoutes } from './generate';

// Initialize with DataSource
initializeGenerateRoutes(dataSource, cacheManager);

// Use router
app.use('/api/generate', generateRoutes);
```

## Benefits

- **Maintainability**: Each file has a single responsibility
- **Testability**: Functions can be tested in isolation
- **Readability**: Easier to navigate and understand
- **Scalability**: Easy to add new validators or transformations
