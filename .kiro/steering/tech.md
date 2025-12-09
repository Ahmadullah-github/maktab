# Technology Stack

## Architecture
- Monorepo using npm workspaces
- Desktop app built with Electron
- Backend API + Python solver architecture

## Packages

### packages/api (Backend)
- Runtime: Node.js with TypeScript
- Framework: Express.js 5.x
- Database: SQLite via better-sqlite3
- ORM: TypeORM with decorators
- Validation: Zod
- Build: TypeScript compiler (tsc)

### packages/solver (Constraint Solver)
- Language: Python 3.x
- Solver: Google OR-Tools (CP-SAT)
- Validation: Pydantic v2
- Logging: structlog

### electron/ (Desktop Shell)
- Electron 31.x
- electron-builder for packaging

## Key Dependencies
- TypeORM entities use decorator pattern with `reflect-metadata`
- Express middleware pattern for license validation
- Pydantic models mirror Zod schemas for cross-language validation

## Common Commands

```bash
# Development (runs web, api, and electron concurrently)
npm run dev

# Build all packages
npm run build

# Build individual packages
npm run build:web
npm run build:api
npm run build:solver

# Package for distribution
npm run dist

# Install Python solver dependencies
npm run install:deps
# Or directly:
cd packages/solver && pip install -r requirements.txt

# API development
cd packages/api && npm run dev

# Database management
cd packages/api
npm run db:stats          # Show database statistics
npm run db:backup         # Backup database
npm run db:restore        # Restore from backup
npm run db:teachers       # List teachers
npm run db:subjects       # List subjects

# License generation
cd packages/api
npm run license:generate        # Generate license
npm run license:generate:trial  # Generate trial license
npm run license:generate:annual # Generate annual license

# Docker development
npm run dev:docker
docker-compose up
```

## TypeScript Configuration
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Decorator metadata enabled (`experimentalDecorators`, `emitDecoratorMetadata`)

## Python Environment
- Virtual environment in `packages/solver/.venv`
- Requirements: ortools>=9.10, pydantic>=2.11, structlog>=25.4
