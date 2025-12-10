# Requirements Document

## Introduction

This specification covers a comprehensive refactoring of the Maktab school timetable application's backend (`packages/api`). The current codebase suffers from monolithic file structures, missing database optimizations, and architectural issues that impact maintainability, performance, and scalability. This refactoring will reorganize the code into a clean layered architecture, add critical performance optimizations, and establish patterns for future development.

## Glossary

- **Repository**: A class responsible for data access operations (CRUD) for a specific entity
- **Service**: A class containing business logic that orchestrates repository operations
- **Route/Controller**: Express route handlers that process HTTP requests and delegate to services
- **DTO (Data Transfer Object)**: Objects used to transfer data between layers with specific shapes
- **Index**: Database structure that improves query performance on specific columns
- **N+1 Problem**: Performance anti-pattern where N additional queries are executed for N records
- **Cache Invalidation**: Process of removing or updating stale cached data
- **Pagination**: Technique to return data in chunks/pages rather than all at once
- **Transaction**: Database operation that ensures multiple queries succeed or fail together

---

## Requirements

### Requirement 1: Repository Layer Extraction

**User Story:** As a developer, I want database operations separated into individual repository files, so that the codebase is maintainable and each entity's data access logic is isolated.

#### Acceptance Criteria

1. WHEN a developer needs to modify Teacher data access logic THEN the system SHALL have a dedicated `teacherRepository.ts` file containing only Teacher-related database operations
2. WHEN a developer needs to modify Subject data access logic THEN the system SHALL have a dedicated `subjectRepository.ts` file containing only Subject-related database operations
3. WHEN a developer needs to modify Room data access logic THEN the system SHALL have a dedicated `roomRepository.ts` file containing only Room-related database operations
4. WHEN a developer needs to modify Class data access logic THEN the system SHALL have a dedicated `classRepository.ts` file containing only ClassGroup-related database operations
5. WHEN a developer needs to modify Timetable data access logic THEN the system SHALL have a dedicated `timetableRepository.ts` file containing only Timetable-related database operations
6. WHEN a developer needs to modify Configuration data access logic THEN the system SHALL have a dedicated `configRepository.ts` file containing only Configuration-related database operations
7. WHEN a developer needs to modify WizardStep data access logic THEN the system SHALL have a dedicated `wizardRepository.ts` file containing only WizardStep-related database operations
8. WHEN repositories share common caching and CRUD patterns THEN the system SHALL have a `BaseRepository` class that provides reusable cache management and common operations

---

### Requirement 2: Route Module Separation

**User Story:** As a developer, I want API routes organized into separate module files by domain, so that the server.ts file is concise and route logic is easy to locate.

#### Acceptance Criteria

1. WHEN the Express application starts THEN the main server.ts file SHALL contain only application setup, middleware registration, and route mounting (target: under 100 lines)
2. WHEN a developer needs to modify Teacher API endpoints THEN the system SHALL have a dedicated `teacher.routes.ts` file containing all Teacher-related routes
3. WHEN a developer needs to modify Subject API endpoints THEN the system SHALL have a dedicated `subject.routes.ts` file containing all Subject-related routes
4. WHEN a developer needs to modify Room API endpoints THEN the system SHALL have a dedicated `room.routes.ts` file containing all Room-related routes
5. WHEN a developer needs to modify Class API endpoints THEN the system SHALL have a dedicated `class.routes.ts` file containing all Class-related routes
6. WHEN a developer needs to modify Timetable API endpoints THEN the system SHALL have a dedicated `timetable.routes.ts` file containing all Timetable-related routes
7. WHEN a developer needs to modify License API endpoints THEN the system SHALL have a dedicated `license.routes.ts` file containing all License-related routes
8. WHEN a developer needs to modify Solver/Generate API endpoints THEN the system SHALL have a dedicated `generate.routes.ts` file containing the timetable generation endpoint

---

### Requirement 3: Service Layer Introduction

**User Story:** As a developer, I want business logic separated from route handlers and data access, so that the application follows separation of concerns and is easier to test.

#### Acceptance Criteria

1. WHEN a route handler processes a Teacher-related request THEN the handler SHALL delegate business logic to a `TeacherService` class
2. WHEN a route handler processes a Subject-related request THEN the handler SHALL delegate business logic to a `SubjectService` class
3. WHEN a route handler processes a timetable generation request THEN the handler SHALL delegate to a `SolverService` class that encapsulates Python solver interaction
4. WHEN services need to perform data validation beyond schema validation THEN the service layer SHALL contain that validation logic
5. WHEN services need to coordinate multiple repository operations THEN the service layer SHALL manage transaction boundaries

---

### Requirement 4: Database Index Optimization

**User Story:** As a system administrator, I want database queries to execute efficiently, so that the application responds quickly even with large datasets.

#### Acceptance Criteria

1. WHEN querying Teachers by fullName THEN the database SHALL have an index on the Teacher.fullName column
2. WHEN querying Subjects by grade and name combination THEN the database SHALL have a composite index on Subject.grade and Subject.name columns
3. WHEN querying Subjects by grade and code combination THEN the database SHALL have a composite index on Subject.grade and Subject.code columns
4. WHEN querying Rooms by name THEN the database SHALL have an index on the Room.name column
5. WHEN querying Classes by name THEN the database SHALL have an index on the ClassGroup.name column
6. WHEN querying Classes by fixedRoomId THEN the database SHALL have an index on the ClassGroup.fixedRoomId column
7. WHEN querying Licenses by isActive status THEN the database SHALL have an index on the License.isActive column
8. WHEN querying entities by schoolId for future multi-tenancy THEN all entities with schoolId SHALL have an index on that column

---

### Requirement 5: Bulk Operation Optimization

**User Story:** As a school administrator importing teacher data, I want bulk imports to complete quickly, so that initial setup does not take excessive time.

#### Acceptance Criteria

1. WHEN importing multiple teachers via bulk import THEN the system SHALL use batch database operations instead of individual saves
2. WHEN importing multiple subjects via curriculum insert THEN the system SHALL use batch database operations instead of individual saves
3. WHEN performing bulk operations THEN the system SHALL wrap operations in a database transaction for atomicity
4. WHEN a bulk operation partially fails THEN the system SHALL rollback all changes and report the error

---

### Requirement 6: API Pagination

**User Story:** As a frontend developer, I want list endpoints to support pagination, so that the UI can efficiently display large datasets without loading all records.

#### Acceptance Criteria

1. WHEN requesting the teachers list THEN the endpoint SHALL accept optional `page` and `limit` query parameters
2. WHEN requesting the subjects list THEN the endpoint SHALL accept optional `page` and `limit` query parameters
3. WHEN requesting the rooms list THEN the endpoint SHALL accept optional `page` and `limit` query parameters
4. WHEN requesting the classes list THEN the endpoint SHALL accept optional `page` and `limit` query parameters
5. WHEN pagination parameters are provided THEN the response SHALL include `data`, `total`, `page`, and `limit` fields
6. WHEN pagination parameters are omitted THEN the endpoint SHALL use default values (page=1, limit=50) for backward compatibility
7. WHEN the limit parameter exceeds 100 THEN the system SHALL cap it at 100 to prevent excessive data transfer

---

### Requirement 7: Cache Management Improvement

**User Story:** As a system operator, I want the caching system to be efficient and bounded, so that memory usage remains stable under load.

#### Acceptance Criteria

1. WHEN caching entity data THEN the cache SHALL have a configurable maximum size per entity type
2. WHEN the cache reaches maximum size THEN the system SHALL evict least-recently-used entries
3. WHEN a single entity is updated THEN the system SHALL update only that entity's cache entry instead of invalidating the entire collection cache
4. WHEN cache operations occur THEN the system SHALL use a centralized CacheManager class for consistency
5. WHEN the application starts THEN cache configuration SHALL be loaded from environment variables or defaults

---

### Requirement 8: Solver Resource Management

**User Story:** As a system administrator, I want solver processes to be resource-controlled, so that the server remains stable during timetable generation.

#### Acceptance Criteria

1. WHEN a timetable generation request is received while another is running THEN the system SHALL queue the request or return a "busy" response
2. WHEN the solver process runs THEN the system SHALL enforce a configurable timeout (default: 15 minutes)
3. WHEN the solver process is spawned THEN the system SHALL log the process ID for monitoring
4. WHEN the solver completes or fails THEN the system SHALL clean up all associated resources
5. WHEN large data is sent to the solver THEN the system SHALL write to a temporary file instead of piping through stdin for datasets exceeding 1MB

---

### Requirement 9: Request Validation

**User Story:** As an API consumer, I want invalid requests to be rejected with clear error messages, so that I can correct my requests quickly.

#### Acceptance Criteria

1. WHEN a Teacher create/update request is received THEN the system SHALL validate the request body against a Zod schema
2. WHEN a Subject create/update request is received THEN the system SHALL validate the request body against a Zod schema
3. WHEN a Room create/update request is received THEN the system SHALL validate the request body against a Zod schema
4. WHEN a Class create/update request is received THEN the system SHALL validate the request body against a Zod schema
5. WHEN validation fails THEN the response SHALL include field-level error details with a 400 status code

---

### Requirement 10: Logging and Monitoring

**User Story:** As a system administrator, I want structured logging with configurable levels, so that I can debug issues in production without excessive log noise.

#### Acceptance Criteria

1. WHEN the application logs messages THEN the system SHALL use a structured logger (not console.log) with JSON output capability
2. WHEN running in production THEN the system SHALL log at INFO level or above by default
3. WHEN running in development THEN the system SHALL log at DEBUG level by default
4. WHEN an error occurs THEN the log entry SHALL include error stack traces and request context
5. WHEN a request completes THEN the system SHALL log the request method, path, status code, and duration

---

### Requirement 11: Transaction Management

**User Story:** As a data integrity stakeholder, I want related database operations to be atomic, so that data remains consistent even when errors occur.

#### Acceptance Criteria

1. WHEN performing destructive reset operations THEN the system SHALL wrap all deletions in a single transaction
2. WHEN saving an entity with related updates THEN the system SHALL use transactions to ensure consistency
3. WHEN a transaction fails THEN the system SHALL rollback all changes and throw an appropriate error
4. WHEN repositories need transaction support THEN they SHALL accept an optional EntityManager parameter for transaction participation

---

### Requirement 12: File and Code Organization

**User Story:** As a developer, I want the codebase to follow consistent organization patterns, so that new team members can navigate the code easily.

#### Acceptance Criteria

1. WHEN organizing source files THEN the system SHALL follow the structure: `src/{routes,services,database/repositories,middleware,entity,utils,types}`
2. WHEN naming files THEN the system SHALL use consistent naming: `*.routes.ts`, `*.service.ts`, `*.repository.ts`
3. WHEN the solver integration file exists THEN it SHALL be renamed from `pyhonSolverNodeFunction.ts` to `solver.service.ts` or `pythonSolver.ts`
4. WHEN TypeScript interfaces are defined THEN they SHALL be placed in `src/types/` directory
5. WHEN constants and configuration values are used THEN they SHALL be centralized in `src/constants.ts` or `src/config.ts`
