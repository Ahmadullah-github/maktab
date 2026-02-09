# Project Structure

```
├── packages/
│   ├── web/                    # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/         # Shadcn/ui primitives
│   │   │   │   ├── layout/     # App shell (Sidebar, Header)
│   │   │   │   └── schedule/   # Timetable components
│   │   │   ├── features/       # Feature modules
│   │   │   │   ├── classes/    # Class management
│   │   │   │   ├── teachers/   # Teacher management
│   │   │   │   ├── dashboard/  # Dashboard views
│   │   │   │   ├── school-config/  # School configuration
│   │   │   │   └── workspace/  # Workspace management
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # API client, utilities
│   │   │   ├── routes/         # TanStack Router pages
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── styles/         # Global CSS (Tailwind)
│   │   │   ├── types/          # TypeScript types
│   │   │   └── i18n/           # Internationalization
│   │   ├── components.json     # Shadcn/ui config
│   │   └── tailwind.config.ts  # Tailwind config
│   │
│   ├── api/                    # Express.js backend
│   │   ├── server.ts           # Server bootstrap (entry point)
│   │   ├── ormconfig.ts        # TypeORM DataSource configuration
│   │   ├── schema.ts           # Zod validation schemas for solver
│   │   ├── src/
│   │   │   ├── app.ts          # Express app configuration
│   │   │   ├── constants.ts    # Application constants
│   │   │   ├── database/
│   │   │   │   ├── cache/      # LRU cache implementation
│   │   │   │   ├── repositories/  # Repository pattern (CRUD)
│   │   │   │   └── migrations/ # Database migrations
│   │   │   ├── entity/         # TypeORM entities
│   │   │   ├── middleware/     # Express middleware
│   │   │   ├── routes/         # API route handlers
│   │   │   ├── schemas/        # Zod schemas for validation
│   │   │   ├── services/       # Business logic
│   │   │   ├── types/          # TypeScript types
│   │   │   └── utils/          # Helpers (logger, etc.)
│   │   ├── db-manager.js       # Database CLI tool
│   │   ├── generate-license.js # License key generator
│   │   └── reset-database.js   # Database reset utility
│   │
│   └── solver/                 # Python constraint solver
│       ├── solver.py           # Main solver with modular architecture
│       ├── models/             # Input data models
│       ├── strategies/         # Solver strategies (fast, balanced, thorough)
│       ├── constraints/        # Constraint definitions
│       ├── decomposition/      # Problem decomposition
│       ├── utils/              # Optimization utilities
│       └── tests/              # Test files
│
├── electron/                   # Electron desktop shell
│   ├── main.js                 # Main process
│   └── preload.js              # Preload scripts
│
├── docs/                       # Documentation
└── .kiro/                      # Kiro configuration
    ├── specs/                  # Feature specifications
    └── steering/               # Steering rules
```

## Key Patterns

### Frontend Feature Module Pattern

Each feature in `packages/web/src/features/` follows:

```
features/[name]/
├── components/     # Feature-specific components
├── hooks/          # TanStack Query hooks (useXxx, useCreateXxx)
├── api.ts          # API functions
├── types.ts        # TypeScript types
└── index.ts        # Public exports
```

### Frontend State Management

- Server state: TanStack Query (caching, refetching, mutations)
- UI state: Zustand stores (`stores/uiStore.ts`)
- Form state: React Hook Form with Zod validation

### Layered Architecture (API)

The API follows a clean layered architecture:

1. **Routes** (`src/routes/`) - HTTP request handling, validation
2. **Services** (`src/services/`) - Business logic
3. **Repositories** (`src/database/repositories/`) - Data access with caching
4. **Entities** (`src/entity/`) - TypeORM entity definitions

### Entity Pattern (TypeORM)

All entities in `packages/api/src/entity/` follow:

- `schoolId` field for future multi-tenancy (currently null)
- `isDeleted` / `deletedAt` for soft delete
- `createdAt` / `updatedAt` timestamps
- JSON string columns for complex data (arrays, objects)
- Database indexes on frequently queried columns

### Repository Pattern

Repositories in `packages/api/src/database/repositories/`:

- Extend `BaseRepository` for common CRUD operations
- Integrate with `CacheManager` for LRU caching
- Support transactions via `withTransaction()` method
- Entity-specific methods (e.g., `findByName`, `bulkImport`)

### Solver Strategies

Three solver strategies in `packages/solver/strategies/`:

- `fast_solver.py` - Quick solutions, fewer optimizations
- `balanced_solver.py` - Default, good balance
- `thorough_solver.py` - Maximum optimization, slower

### API Routes (Modular)

Routes organized by domain in `packages/api/src/routes/`:

- `/api/health` - Health check
- `/api/license/*` - License management
- `/api/teachers`, `/api/subjects`, `/api/rooms`, `/api/classes` - CRUD
- `/api/timetables` - Saved timetables
- `/api/generate` - Trigger solver
- `/api/config/*` - Configuration storage
- `/api/wizard/*` - Wizard step persistence

### Services

Services in `packages/api/src/services/`:

- `SolverService` - Python solver integration (singleton, concurrent request
  handling)
- `TeacherService`, `SubjectService`, etc. - Entity business logic
- `LicenseService` - License validation
- `AuditService` - Audit logging
