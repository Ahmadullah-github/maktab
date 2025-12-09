# Project Structure

```
├── packages/
│   ├── api/                    # Express.js backend
│   │   ├── server.ts           # Main API server with all routes
│   │   ├── schema.ts           # Zod validation schemas
│   │   ├── pyhonSolverNodeFunction.ts  # Python solver bridge
│   │   ├── src/
│   │   │   ├── database/       # DatabaseService singleton
│   │   │   ├── entity/         # TypeORM entities
│   │   │   ├── middleware/     # Express middleware (license)
│   │   │   ├── services/       # Business logic (audit, license)
│   │   │   └── utils/          # Helpers (error parsing, validation)
│   │   └── data/               # SQLite database files
│   │
│   └── solver/                 # Python constraint solver
│       ├── solver_enhanced.py  # Main solver with Pydantic models
│       ├── models/             # Input data models
│       ├── strategies/         # Solver strategies (fast, balanced, thorough)
│       ├── constraints/        # Constraint definitions
│       ├── decomposition/      # Problem decomposition for large inputs
│       ├── utils/              # Optimization utilities
│       └── test_*.py           # Test files
│
├── electron/                   # Electron desktop shell
│   ├── main.js                 # Main process
│   └── preload.js              # Preload scripts
│
├── scripts/                    # Development/analysis scripts
│   └── analyzers/              # Code analysis tools
│
└── docs/                       # Documentation
    ├── ARCHITECTURE_FOUNDATION.md  # Future LMS/ERP expansion plans
    └── V1_RELEASE_CHECKLIST.md
```

## Key Patterns

### Entity Pattern (TypeORM)
All entities in `packages/api/src/entity/` follow:
- `schoolId` field for future multi-tenancy (currently null)
- `isDeleted` / `deletedAt` for soft delete
- `createdAt` / `updatedAt` timestamps
- JSON string columns for complex data (arrays, objects)

### Solver Strategies
Three solver strategies in `packages/solver/strategies/`:
- `fast_solver.py` - Quick solutions, fewer optimizations
- `balanced_solver.py` - Default, good balance
- `thorough_solver.py` - Maximum optimization, slower

### API Routes
All routes defined in `packages/api/server.ts`:
- `/api/license/*` - License management (before middleware)
- `/api/config/*` - Configuration storage
- `/api/teachers`, `/api/subjects`, `/api/rooms`, `/api/classes` - CRUD
- `/api/timetables` - Saved timetables
- `/api/generate` - Trigger solver
- `/api/wizard/*` - Wizard step persistence

### Database Service
Singleton pattern: `DatabaseService.getInstance()`
- Handles all TypeORM operations
- Located in `packages/api/src/database/databaseService.ts`
