# Implementation Plan

## Phase 1: Foundation and Infrastructure

- [ ] 1. Set up project structure and shared utilities
  - [ ] 1.1 Create directory structure for new architecture
    - Create `src/types/`, `src/routes/`, `src/services/`, `src/database/repositories/`, `src/database/cache/`, `src/schemas/` directories
    - Create index.ts files for each directory to manage exports
    - _Requirements: 12.1, 12.2_
  - [ ] 1.2 Create common types and interfaces
    - Create `src/types/common.types.ts` with PaginationParams, PaginatedResponse, CacheConfig, ServiceResult interfaces
    - Create `src/types/index.ts` to export all types
    - _Requirements: 12.4_
  - [ ] 1.3 Create application constants file
    - Create `src/constants.ts` with cache defaults, pagination limits, timeout values
    - Move hardcoded values from existing code to constants
    - _Requirements: 12.5_
  - [ ] 1.4 Create structured logger utility
    - Create `src/utils/logger.ts` with configurable log levels (DEBUG, INFO, WARN, ERROR)
    - Support JSON output format for production
    - Include request context in log entries
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 2. Implement Cache Management System
  - [ ] 2.1 Create LRU Cache implementation
    - Create `src/database/cache/lruCache.ts` with max size and TTL support
    - Implement get, set, delete, clear operations
    - Track access times for LRU eviction
    - _Requirements: 7.1, 7.2_
  - [ ] 2.2 Write property test for LRU cache eviction
    - **Property 4: Cache LRU eviction**
    - **Validates: Requirements 7.1, 7.2**
  - [ ] 2.3 Create CacheManager class
    - Create `src/database/cache/cacheManager.ts` to manage multiple entity caches
    - Implement per-prefix cache isolation
    - Add cache statistics method
    - _Requirements: 7.4, 7.5_
  - [ ] 2.4 Write property test for cache update granularity
    - **Property 5: Cache update granularity**
    - **Validates: Requirements 7.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: Repository Layer Extraction

- [ ] 4. Create Base Repository
  - [ ] 4.1 Create abstract BaseRepository class
    - Create `src/database/repositories/base.repository.ts`
    - Implement generic CRUD operations with TypeORM
    - Integrate CacheManager for caching
    - Add transaction support via withTransaction method
    - _Requirements: 1.8, 11.4_
  - [ ] 4.2 Create JSON transformer utility
    - Create `src/utils/jsonTransformer.ts` for parsing/stringifying JSON fields
    - Handle error cases gracefully
    - _Requirements: 12.4_

- [ ] 5. Extract Teacher Repository
  - [ ] 5.1 Create TeacherRepository class
    - Create `src/database/repositories/teacher.repository.ts` extending BaseRepository
    - Move all Teacher CRUD logic from databaseService.ts
    - Implement findByName for upsert lookups
    - _Requirements: 1.1_
  - [ ] 5.2 Add database index to Teacher entity
    - Add @Index decorator on fullName column
    - Add @Index decorator on schoolId column
    - _Requirements: 4.1, 4.8_
  - [ ] 5.3 Implement bulk import with batch operations
    - Create bulkImport method using TypeORM batch save
    - Wrap in transaction for atomicity
    - _Requirements: 5.1, 5.3_
  - [ ] 5.4 Write property test for bulk operations
    - **Property 1: Bulk operations use batch database calls**
    - **Property 2: Bulk operations are atomic**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 6. Extract Subject Repository
  - [ ] 6.1 Create SubjectRepository class
    - Create `src/database/repositories/subject.repository.ts` extending BaseRepository
    - Move all Subject CRUD logic from databaseService.ts
    - Implement findByGradeAndName, findByGradeAndCode for upsert lookups
    - _Requirements: 1.2_
  - [ ] 6.2 Add database indexes to Subject entity
    - Add composite @Index on [grade, name]
    - Add composite @Index on [grade, code]
    - Add @Index on schoolId
    - _Requirements: 4.2, 4.3, 4.8_
  - [ ] 6.3 Implement bulk upsert with batch operations
    - Create bulkUpsert method using TypeORM batch operations
    - Wrap in transaction for atomicity
    - _Requirements: 5.2, 5.3_

- [ ] 7. Extract Room Repository
  - [ ] 7.1 Create RoomRepository class
    - Create `src/database/repositories/room.repository.ts` extending BaseRepository
    - Move all Room CRUD logic from databaseService.ts
    - Implement findByName for upsert lookups
    - _Requirements: 1.3_
  - [ ] 7.2 Add database indexes to Room entity
    - Add @Index on name column
    - Add @Index on schoolId column
    - _Requirements: 4.4, 4.8_

- [ ] 8. Extract Class Repository
  - [ ] 8.1 Create ClassRepository class
    - Create `src/database/repositories/class.repository.ts` extending BaseRepository
    - Move all ClassGroup CRUD logic from databaseService.ts
    - Implement findByName, findByFixedRoomId methods
    - _Requirements: 1.4_
  - [ ] 8.2 Add database indexes to ClassGroup entity
    - Add @Index on name column
    - Add @Index on fixedRoomId column
    - Add @Index on schoolId column
    - _Requirements: 4.5, 4.6, 4.8_

- [ ] 9. Extract Remaining Repositories
  - [ ] 9.1 Create TimetableRepository class
    - Create `src/database/repositories/timetable.repository.ts` extending BaseRepository
    - Move Timetable CRUD logic from databaseService.ts
    - _Requirements: 1.5_
  - [ ] 9.2 Create ConfigRepository class
    - Create `src/database/repositories/config.repository.ts` extending BaseRepository
    - Move Configuration and SchoolConfig logic from databaseService.ts
    - _Requirements: 1.6_
  - [ ] 9.3 Create WizardRepository class
    - Create `src/database/repositories/wizard.repository.ts` extending BaseRepository
    - Move WizardStep CRUD logic from databaseService.ts
    - _Requirements: 1.7_
  - [ ] 9.4 Create LicenseRepository class
    - Create `src/database/repositories/license.repository.ts` extending BaseRepository
    - Add @Index on isActive column to License entity
    - _Requirements: 4.7_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: Service Layer Introduction

- [ ] 11. Create Entity Services
  - [ ] 11.1 Create TeacherService class
    - Create `src/services/teacher.service.ts`
    - Inject TeacherRepository
    - Implement business logic methods (create, update, delete, findAll with pagination)
    - Add validation logic
    - _Requirements: 3.1_
  - [ ] 11.2 Create SubjectService class
    - Create `src/services/subject.service.ts`
    - Inject SubjectRepository
    - Implement business logic methods with pagination
    - _Requirements: 3.2_
  - [ ] 11.3 Create RoomService class
    - Create `src/services/room.service.ts`
    - Inject RoomRepository
    - Implement business logic methods with pagination
    - _Requirements: 3.2_
  - [ ] 11.4 Create ClassService class
    - Create `src/services/class.service.ts`
    - Inject ClassRepository and RoomRepository (for fixedRoomId validation)
    - Implement business logic methods with pagination
    - _Requirements: 3.2_
  - [ ] 11.5 Create TimetableService class
    - Create `src/services/timetable.service.ts`
    - Inject TimetableRepository
    - Implement business logic methods
    - _Requirements: 3.2_

- [ ] 12. Create Solver Service
  - [ ] 12.1 Refactor Python solver integration
    - Rename `pyhonSolverNodeFunction.ts` to `src/services/solver.service.ts`
    - Convert to SolverService class with singleton pattern
    - Add concurrent request tracking (semaphore)
    - _Requirements: 3.3, 8.1, 12.3_
  - [ ] 12.2 Implement solver queue/busy handling
    - Add isRunning flag to track active solver process
    - Return 503 SOLVER_BUSY when another request is in progress
    - _Requirements: 8.1, 8.2_
  - [ ] 12.3 Write property test for concurrent solver handling
    - **Property 6: Concurrent solver request handling**
    - **Validates: Requirements 8.1**
  - [ ] 12.4 Implement large data file handling
    - Write data to temp file for payloads > 1MB
    - Pass file path to solver instead of stdin
    - Clean up temp files after completion
    - _Requirements: 8.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Route Module Separation

- [ ] 14. Create Validation Middleware and Schemas
  - [ ] 14.1 Create validation middleware
    - Create `src/middleware/validation.middleware.ts`
    - Implement validateRequest function using Zod
    - Return 400 with field-level errors on validation failure
    - _Requirements: 9.5_
  - [ ] 14.2 Create entity validation schemas
    - Create `src/schemas/teacher.schema.ts` with createTeacher, updateTeacher schemas
    - Create `src/schemas/subject.schema.ts` with createSubject, updateSubject schemas
    - Create `src/schemas/room.schema.ts` with createRoom, updateRoom schemas
    - Create `src/schemas/class.schema.ts` with createClass, updateClass schemas
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ] 14.3 Write property test for request validation
    - **Property 7: Request validation rejects invalid input**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 15. Create Pagination Middleware
  - [ ] 15.1 Create pagination middleware
    - Create `src/middleware/pagination.middleware.ts`
    - Parse page and limit query parameters
    - Apply defaults (page=1, limit=50) when not provided
    - Cap limit at 100
    - _Requirements: 6.6, 6.7_
  - [ ] 15.2 Write property test for pagination
    - **Property 3: Pagination returns correct subset**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [ ] 16. Create Logging Middleware
  - [ ] 16.1 Create request logging middleware
    - Create `src/middleware/logging.middleware.ts`
    - Log request method, path, status code, and duration
    - Use structured logger from utils
    - _Requirements: 10.5_

- [ ] 17. Extract Route Modules
  - [ ] 17.1 Create health routes
    - Create `src/routes/health.routes.ts`
    - Move health check endpoint from server.ts
    - _Requirements: 2.1_
  - [ ] 17.2 Create license routes
    - Create `src/routes/license.routes.ts`
    - Move all license endpoints from server.ts
    - _Requirements: 2.7_
  - [ ] 17.3 Create teacher routes
    - Create `src/routes/teacher.routes.ts`
    - Move all teacher endpoints from server.ts
    - Apply validation middleware to POST/PUT
    - Apply pagination middleware to GET list
    - _Requirements: 2.2, 6.1_
  - [ ] 17.4 Create subject routes
    - Create `src/routes/subject.routes.ts`
    - Move all subject endpoints from server.ts
    - Apply validation and pagination middleware
    - _Requirements: 2.3, 6.2_
  - [ ] 17.5 Create room routes
    - Create `src/routes/room.routes.ts`
    - Move all room endpoints from server.ts
    - Apply validation and pagination middleware
    - _Requirements: 2.4, 6.3_
  - [ ] 17.6 Create class routes
    - Create `src/routes/class.routes.ts`
    - Move all class endpoints from server.ts
    - Apply validation and pagination middleware
    - _Requirements: 2.5, 6.4_
  - [ ] 17.7 Create timetable routes
    - Create `src/routes/timetable.routes.ts`
    - Move all timetable endpoints from server.ts
    - _Requirements: 2.6_
  - [ ] 17.8 Create config and wizard routes
    - Create `src/routes/config.routes.ts` for configuration endpoints
    - Create `src/routes/wizard.routes.ts` for wizard step endpoints
    - _Requirements: 2.1_
  - [ ] 17.9 Create generate routes
    - Create `src/routes/generate.routes.ts`
    - Move solver endpoint from server.ts
    - Integrate with SolverService
    - _Requirements: 2.8_

- [ ] 18. Refactor server.ts
  - [ ] 18.1 Create app.ts for Express configuration
    - Create `src/app.ts` with Express app setup
    - Configure middleware (cors, json, logging)
    - Mount all route modules
    - _Requirements: 2.1_
  - [ ] 18.2 Simplify server.ts
    - Reduce server.ts to bootstrap only (import app, start server)
    - Target: under 50 lines
    - _Requirements: 2.1_
  - [ ] 18.3 Create route index file
    - Create `src/routes/index.ts` to aggregate all routes
    - Export single router for app.ts to mount
    - _Requirements: 2.1_

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 5: Transaction Management and Cleanup

- [ ] 20. Implement Transaction Support
  - [ ] 20.1 Add transaction wrapper to destructive operations
    - Wrap destructiveReset in transaction
    - Wrap bulk operations in transactions
    - _Requirements: 11.1, 11.2_
  - [ ] 20.2 Write property test for transaction atomicity
    - **Property 8: Transaction atomicity**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [ ] 21. Remove Legacy Code
  - [ ] 21.1 Remove old databaseService.ts
    - Delete `src/database/databaseService.ts` after all references updated
    - Update all imports to use new repositories/services
    - _Requirements: 1.1-1.8_
  - [ ] 21.2 Clean up server.ts
    - Remove all route definitions (now in route modules)
    - Remove direct database calls
    - _Requirements: 2.1_
  - [ ] 21.3 Remove console.log statements
    - Replace all console.log with structured logger
    - Remove debug logging in production
    - _Requirements: 10.1, 10.2_

- [ ] 22. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Summary

| Phase | Tasks | Focus Area |
|-------|-------|------------|
| 1 | 1-3 | Foundation: types, constants, logger, cache |
| 2 | 4-10 | Repository layer extraction with indexes |
| 3 | 11-13 | Service layer with business logic |
| 4 | 14-19 | Route modules with validation/pagination |
| 5 | 20-22 | Transactions and cleanup |

**Total Tasks:** 22 top-level tasks with 60+ sub-tasks
**Property Tests:** 8 properties to implement
