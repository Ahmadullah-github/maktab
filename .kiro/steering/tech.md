# Technology Stack

## Architecture

- Monorepo using npm workspaces
- Desktop app built with Electron
- Backend API + Python solver architecture

## Packages

### packages/web (Frontend)

- Framework: React 18.3 with TypeScript
- Build: Vite 7.x
- Routing: TanStack Router (file-based)
- Server State: TanStack Query v5
- UI State: Zustand
- Forms: React Hook Form + Zod
- UI Components: Shadcn/ui (New York style) + Radix primitives
- Styling: Tailwind CSS 4.x with RTL support
- i18n: i18next + react-i18next
- Icons: Lucide React
- Toasts: Sonner
- Drag & Drop: dnd-kit

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

## Key Dependencies & Patterns

### Frontend

- TanStack Query for server state (caching, refetching, optimistic updates)
- Zustand for UI state (sidebar, modals, preferences)
- React Hook Form + Zod for form validation
- Shadcn/ui components are copy-pasted (you own the code)
- CSS variables for theming in `globals.css`

### Backend

- TypeORM entities use decorator pattern with `reflect-metadata`
- Express middleware pattern for license validation

### Cross-Package

- Zod schemas should be kept in sync between `packages/api` and `packages/web`
- Pydantic models mirror Zod schemas for cross-language validation
- API types defined in frontend should match backend response shapes

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

# Frontend development
cd packages/web && npm run dev     # Vite dev server on :5173
cd packages/web && npm run build   # Production build
cd packages/web && npm run lint    # ESLint check
cd packages/web && npm run type-check  # TypeScript check

# Add Shadcn/ui components
cd packages/web && npx shadcn@latest add button
cd packages/web && npx shadcn@latest add dialog

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

# Install Python solver dependencies
npm run install:deps
# Or directly:
cd packages/solver && pip install -r requirements.txt

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

### Python Virtual Environment Setup & Usage

Always use the virtual environment when working with Python code:

```bash
# Create virtual environment (first time only)
cd packages/solver
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run Python scripts (with venv activated)
python solver_enhanced.py

# Run tests
pytest tests/

# Run specific test file
pytest tests/property/test_prop_pre_solve_analyzer.py -v

# Deactivate when done
deactivate
```

### Running Python from Project Root

When running Python commands from the project root or via npm scripts:

```bash
# Use the venv Python directly
packages/solver/.venv/bin/python packages/solver/solver_enhanced.py

# Or activate first, then run
source packages/solver/.venv/bin/activate
python packages/solver/solver_enhanced.py
```

### Important Notes

- Always ensure the virtual environment is activated before running Python code
- The solver is invoked by the API service using the venv Python path
- New Python dependencies should be added to `packages/solver/requirements.txt`
- Run `pip freeze > requirements.txt` after adding new packages to update the
  requirements file
