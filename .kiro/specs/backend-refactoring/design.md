# Design Document: Backend Refactoring

## Overview

This design document outlines the architectural refactoring of the Maktab backend API from a monolithic structure to a clean layered architecture. The refactoring introduces a Repository pattern for data access, a Service layer for business logic, and modular route organization. Additionally, it addresses critical performance issues including missing database indexes, inefficient bulk operations, lack of pagination, and unbounded caching.

## Architecture

### Current Architecture (Before)

```
┌─────────────────────────────────────────────────────────┐
│                    server.ts (829 lines)                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  All Routes (License, Teacher, Subject, Room,   │   │
│  │  Class, Timetable, Config, Wizard, Generate)    │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │     databaseService.ts (1750 lines)             │   │
│  │  - All entity CRUD operations                   │   │
│  │  - All caching logic                            │   │
│  │  - JSON parsing/serialization                   │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TypeORM Entities                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture (After)

```
┌──────────────────────────────────────────────────────────────────┐
│                     server.ts (~50 lines)                        │
│              (App setup, middleware, route mounting)             │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Routes Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ teacher  │ │ subject  │ │  room    │ │  class   │  ...       │
│  │ .routes  │ │ .routes  │ │ .routes  │ │ .routes  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Services Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Teacher  │ │ Subject  │ │  Room    │ │  Solver  │  ...       │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Repository Layer                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   BaseRepository                          │   │
│  │  - Generic CRUD operations                                │   │
│  │  - Cache integration                                      │   │
│  │  - Transaction support                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│       ▲           ▲           ▲           ▲                      │
│  ┌────┴───┐  ┌────┴───┐  ┌────┴───┐  ┌────┴───┐                 │
│  │Teacher │  │Subject │  │ Room   │  │ Class  │  ...            │
│  │  Repo  │  │  Repo  │  │  Repo  │  │  Repo  │                 │
│  └────────┘  └────────┘  └────────┘  └────────┘                 │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Cache Manager                                │
│  - LRU eviction                                                  │
│  - Configurable max size                                         │
│  - TTL management                                                │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    TypeORM Entities                               │
│                    (with indexes)                                 │
└──────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Directory Structure

```
packages/api/
├── src/
│   ├── app.ts                      # Express app configuration
│   ├── server.ts                   # Server bootstrap (entry point)
│   ├── config.ts                   # Environment configuration
│   ├── constants.ts                # Application constants
│   │
│   ├── types/
│   │   ├── index.ts                # Type exports
│   │   ├── common.types.ts         # Shared types (PaginationParams, etc.)
│   │   ├── teacher.types.ts        # Teacher DTOs
│   │   ├── subject.types.ts        # Subject DTOs
│   │   └── solver.types.ts         # Solver types
│   │
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   ├── health.routes.ts        # Health check endpoint
│   │   ├── license.routes.ts       # License management
│   │   ├── teacher.routes.ts       # Teacher CRUD
│   │   ├── subject.routes.ts       # Subject CRUD
│   │   ├── room.routes.ts          # Room CRUD
│   │   ├── class.routes.ts         # Class CRUD
│   │   ├── timetable.routes.ts     # Timetable CRUD
│   │   ├── config.routes.ts        # Configuration endpoints
│   │   ├── wizard.routes.ts        # Wizard step endpoints
│   │   └── generate.routes.ts      # Solver endpoint
│   │
│   ├── services/
│   │   ├── index.ts                # Service exports
│   │   ├── teacher.service.ts      # Teacher business logic
│   │   ├── subject.service.ts      # Subject business logic
│   │   ├── room.service.ts         # Room business logic
│   │   ├── class.service.ts        # Class business logic
│   │   ├── timetable.service.ts    # Timetable business logic
│   │   ├── solver.service.ts       # Python solver integration
│   │   ├── license.service.ts      # License management (existing)
│   │   └── audit.service.ts        # Audit logging (existing)
│   │
│   ├── database/
│   │   ├── index.ts                # Database exports
│   │   ├── dataSource.ts           # TypeORM DataSource config
│   │   ├── cache/
│   │   │   ├── cacheManager.ts     # Centralized cache management
│   │   │   └── lruCache.ts         # LRU cache implementation
│   │   └── repositories/
│   │       ├── base.repository.ts  # Abstract base repository
│   │       ├── teacher.repository.ts
│   │       ├── subject.repository.ts
│   │       ├── room.repository.ts
│   │       ├── class.repository.ts
│   │       ├── timetable.repository.ts
│   │       ├── config.repository.ts
│   │       ├── wizard.repository.ts
│   │       └── license.repository.ts
│   │
│   ├── middleware/
│   │   ├── index.ts                # Middleware exports
│   │   ├── license.middleware.ts   # License validation (existing)
│   │   ├── validation.middleware.ts # Request validation
│   │   ├── pagination.middleware.ts # Pagination parameter parsing
│   │   └── logging.middleware.ts   # Request logging
│   │
│   ├── entity/                     # TypeORM entities (existing, with index additions)
│   │
│   ├── schemas/
│   │   ├── index.ts                # Schema exports
│   │   ├── teacher.schema.ts       # Teacher validation schemas
│   │   ├── subject.schema.ts       # Subject validation schemas
│   │   ├── room.schema.ts          # Room validation schemas
│   │   └── class.schema.ts         # Class validation schemas
│   │
│   └── utils/
│       ├── index.ts                # Utility exports
│       ├── errorParser.ts          # Solver error parsing (existing)
│       ├── jsonTransformer.ts      # JSON field transformation
│       ├── logger.ts               # Structured logger
│       └── validation.ts           # Validation helpers
│
├── ormconfig.ts                    # TypeORM configuration (existing)
└── schema.ts                       # Solver schema (existing)
```

### 2. Core Interfaces

```typescript
// src/types/common.types.ts

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 3. BaseRepository Interface

```typescript
// src/database/repositories/base.repository.ts

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract entityClass: EntityTarget<T>;
  protected abstract cachePrefix: string;
  
  constructor(
    protected dataSource: DataSource,
    protected cacheManager: CacheManager
  ) {}

  // Core CRUD with caching
  async findById(id: number): Promise<T | null>;
  async findAll(pagination?: PaginationParams): Promise<PaginatedResponse<T>>;
  async save(entity: Partial<T>): Promise<T>;
  async update(id: number, data: Partial<T>): Promise<T | null>;
  async delete(id: number): Promise<boolean>;
  
  // Bulk operations
  async bulkSave(entities: Partial<T>[]): Promise<T[]>;
  async bulkDelete(ids: number[]): Promise<number>;
  
  // Transaction support
  async withTransaction<R>(
    operation: (manager: EntityManager) => Promise<R>
  ): Promise<R>;
  
  // Cache management
  protected invalidateCache(id?: number): void;
  protected getCacheKey(id: number): string;
}
```

### 4. CacheManager Interface

```typescript
// src/database/cache/cacheManager.ts

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export class CacheManager {
  private caches: Map<string, LRUCache<any>>;
  
  constructor(private defaultConfig: CacheConfig) {}
  
  getCache<T>(prefix: string): LRUCache<T>;
  get<T>(prefix: string, key: string): T | undefined;
  set<T>(prefix: string, key: string, value: T): void;
  delete(prefix: string, key: string): void;
  invalidatePrefix(prefix: string): void;
  clear(): void;
  getStats(): CacheStats;
}
```

### 5. Route Handler Pattern

```typescript
// src/routes/teacher.routes.ts

import { Router } from 'express';
import { TeacherService } from '../services/teacher.service';
import { validateRequest } from '../middleware/validation.middleware';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import { createTeacherSchema, updateTeacherSchema } from '../schemas/teacher.schema';

const router = Router();
const teacherService = TeacherService.getInstance();

router.get('/', paginationMiddleware, async (req, res) => {
  const result = await teacherService.findAll(req.pagination);
  res.json(result);
});

router.post('/', validateRequest(createTeacherSchema), async (req, res) => {
  const result = await teacherService.create(req.body);
  res.status(201).json(result);
});

export default router;
```

## Data Models

### Entity Index Additions

```typescript
// src/entity/Teacher.ts
@Entity()
@Index(['fullName'])
@Index(['schoolId'])
export class Teacher extends BaseEntity {
  // ... existing fields
}

// src/entity/Subject.ts
@Entity()
@Index(['grade', 'name'])
@Index(['grade', 'code'])
@Index(['schoolId'])
export class Subject extends BaseEntity {
  // ... existing fields
}

// src/entity/Room.ts
@Entity()
@Index(['name'])
@Index(['schoolId'])
export class Room extends BaseEntity {
  // ... existing fields
}

// src/entity/ClassGroup.ts
@Entity()
@Index(['name'])
@Index(['fixedRoomId'])
@Index(['schoolId'])
export class ClassGroup extends BaseEntity {
  // ... existing fields
}

// src/entity/License.ts
@Entity()
@Index(['isActive'])
export class License extends BaseEntity {
  // ... existing fields
}
```

### Pagination Response Model

```typescript
// Example paginated response
{
  "data": [
    { "id": 1, "fullName": "Ahmad Khan", ... },
    { "id": 2, "fullName": "Sara Ahmadi", ... }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bulk operations use batch database calls
*For any* bulk import of N entities (where N > 1), the number of database INSERT/UPDATE operations SHALL be less than N (ideally 1 batch operation).
**Validates: Requirements 5.1, 5.2**

### Property 2: Bulk operations are atomic
*For any* bulk operation that fails partway through, the database state SHALL be unchanged from before the operation started (rollback).
**Validates: Requirements 5.3, 5.4**

### Property 3: Pagination returns correct subset
*For any* valid page P and limit L on a collection of size N, the returned data SHALL contain exactly min(L, N - (P-1)*L) items starting from index (P-1)*L.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 4: Cache LRU eviction
*For any* sequence of cache operations that exceeds the maximum cache size M, the cache SHALL contain at most M entries, with the least-recently-accessed entries evicted first.
**Validates: Requirements 7.1, 7.2**

### Property 5: Cache update granularity
*For any* single entity update, only that entity's cache entry SHALL be modified; other entities' cache entries SHALL remain valid and unchanged.
**Validates: Requirements 7.3**

### Property 6: Concurrent solver request handling
*For any* two concurrent timetable generation requests, at most one SHALL be actively running at any time; the other SHALL be queued or rejected with a "busy" status.
**Validates: Requirements 8.1**

### Property 7: Request validation rejects invalid input
*For any* request body that violates the defined Zod schema, the endpoint SHALL return a 400 status with validation error details.
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

### Property 8: Transaction atomicity
*For any* operation wrapped in a transaction that encounters an error, all database changes within that transaction SHALL be rolled back.
**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>; // Field-level validation errors
  };
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `NOT_FOUND` | 404 | Requested resource not found |
| `CONFLICT` | 409 | Resource already exists (duplicate) |
| `SOLVER_BUSY` | 503 | Solver is currently processing another request |
| `SOLVER_TIMEOUT` | 504 | Solver exceeded time limit |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Handling Strategy

1. **Validation Errors**: Caught by validation middleware, return 400 with field details
2. **Repository Errors**: Wrapped in try-catch, logged, return appropriate HTTP status
3. **Service Errors**: Business logic errors return ServiceResult with error message
4. **Solver Errors**: Parsed by errorParser.ts, return structured error response

## Testing Strategy

### Dual Testing Approach

This refactoring will use both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property-based tests**: Verify universal properties that should hold across all inputs

### Property-Based Testing Library

We will use **fast-check** for TypeScript property-based testing.

```bash
npm install --save-dev fast-check
```

### Test Organization

```
packages/api/
├── src/
│   └── ...
└── __tests__/
    ├── unit/
    │   ├── repositories/
    │   │   ├── teacher.repository.test.ts
    │   │   └── ...
    │   ├── services/
    │   │   ├── teacher.service.test.ts
    │   │   └── ...
    │   └── middleware/
    │       └── validation.middleware.test.ts
    ├── property/
    │   ├── bulk-operations.property.test.ts
    │   ├── pagination.property.test.ts
    │   ├── cache.property.test.ts
    │   └── validation.property.test.ts
    └── integration/
        ├── teacher.integration.test.ts
        └── ...
```

### Property Test Configuration

Each property-based test MUST:
1. Run a minimum of 100 iterations
2. Be tagged with a comment referencing the correctness property
3. Use smart generators that constrain to valid input space

Example:
```typescript
// **Feature: backend-refactoring, Property 3: Pagination returns correct subset**
test('pagination returns correct subset', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),  // page
      fc.integer({ min: 1, max: 100 }),  // limit
      fc.array(fc.record({ id: fc.integer() }), { minLength: 0, maxLength: 500 }),
      (page, limit, items) => {
        const result = paginate(items, { page, limit });
        const expectedStart = (page - 1) * limit;
        const expectedCount = Math.min(limit, Math.max(0, items.length - expectedStart));
        return result.data.length === expectedCount;
      }
    ),
    { numRuns: 100 }
  );
});
```
