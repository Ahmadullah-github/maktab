# System Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Shell                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React Frontend (Vite)                   │   │
│  │         http://localhost:5173 (dev)                  │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ HTTP/REST                         │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              Express API (Node.js)                   │   │
│  │         http://localhost:3000/api                    │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ Child Process (stdin/stdout)      │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           Python Solver (OR-Tools)                   │   │
│  │         packages/solver/solver.py                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Frontend → API

- Frontend uses `fetch` via `lib/api.ts`
- TanStack Query manages caching and refetching
- API base URL: `VITE_API_URL` env var or `http://localhost:3000/api`

### 2. API → Database

- TypeORM entities map to SQLite tables
- Repositories handle CRUD with LRU caching
- Soft delete pattern (`isDeleted`, `deletedAt`)

### 3. API → Solver (Timetable Generation)

```
Frontend                    API                         Solver
   │                         │                            │
   │ POST /api/generate      │                            │
   │ ─────────────────────►  │                            │
   │                         │ Validate input (Zod)       │
   │                         │ Spawn Python process       │
   │                         │ ──────────────────────────►│
   │                         │                            │ OR-Tools CP-SAT
   │                         │                            │ constraint solving
   │                         │ ◄──────────────────────────│
   │                         │ JSON result (stdout)       │
   │ ◄─────────────────────  │                            │
   │ Timetable result        │                            │
```

## API Endpoints

### Entity CRUD (all follow same pattern)

| Resource | Endpoints                                            |
| -------- | ---------------------------------------------------- |
| Teachers | `GET/POST /teachers`, `GET/PUT/DELETE /teachers/:id` |
| Subjects | `GET/POST /subjects`, `GET/PUT/DELETE /subjects/:id` |
| Classes  | `GET/POST /classes`, `GET/PUT/DELETE /classes/:id`   |
| Rooms    | `GET/POST /rooms`, `GET/PUT/DELETE /rooms/:id`       |

### Timetable Generation

| Endpoint              | Method | Description                    |
| --------------------- | ------ | ------------------------------ |
| `/api/generate`       | POST   | Trigger solver with input data |
| `/api/timetables`     | GET    | List saved timetables          |
| `/api/timetables/:id` | GET    | Get specific timetable         |

### Configuration

| Endpoint            | Method  | Description              |
| ------------------- | ------- | ------------------------ |
| `/api/config/:key`  | GET/PUT | Key-value config storage |
| `/api/wizard/:step` | GET/PUT | Wizard step persistence  |

### License

| Endpoint                | Method | Description            |
| ----------------------- | ------ | ---------------------- |
| `/api/license/validate` | POST   | Validate license key   |
| `/api/license/status`   | GET    | Current license status |

## Solver Integration

### Input Schema (API → Solver)

The API validates input with Zod (`packages/api/schema.ts`) before passing to
solver:

```typescript
// Key input structure
{
  teachers: [{ id, name, subjects, availability, maxPeriodsPerDay }],
  subjects: [{ id, name, periodsPerWeek, requiresLab }],
  classes: [{ id, name, grade, shift, subjects }],
  rooms: [{ id, name, type, capacity }],
  config: {
    daysPerWeek: number,
    periodsPerDay: number[],  // Can vary by day
    strategy: 'fast' | 'balanced' | 'thorough'
  }
}
```

### Output Schema (Solver → API)

```typescript
{
  success: boolean,
  timetable: {
    [classId]: {
      [day]: {
        [period]: {
          subjectId: number,
          teacherId: number,
          roomId: number
        }
      }
    }
  },
  stats: {
    solveTimeMs: number,
    constraintsSatisfied: number,
    optimizationScore: number
  },
  errors?: string[]
}
```

### Solver Strategies

| Strategy   | Use Case                     | Time Limit |
| ---------- | ---------------------------- | ---------- |
| `fast`     | Quick preview, small schools | 30s        |
| `balanced` | Default, most schools        | 120s       |
| `thorough` | Large schools, best quality  | 300s       |

## Frontend-API Type Sharing

### Pattern: Zod Schema → TypeScript Type

```typescript
// packages/api/src/schemas/teacher.schema.ts
export const teacherSchema = z.object({
  name: z.string().min(1),
  subjects: z.array(z.number()),
});
export type TeacherInput = z.infer<typeof teacherSchema>;

// packages/web/src/schemas/teacher.schema.ts (mirror)
// Keep in sync manually or use shared package
```

### API Response Types

Define response types in frontend to match API:

```typescript
// packages/web/src/types/api.ts
export interface Teacher {
  id: number;
  name: string;
  subjects: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

## Error Handling

### API Error Format

```typescript
{
  error: string,           // Error type
  message: string,         // User-friendly message (Farsi)
  details?: unknown,       // Additional context
  statusCode: number
}
```

### Frontend Error Handling

```typescript
// In TanStack Query
const { error } = useQuery({...});
if (error) {
  toast.error(error.message);  // Using sonner
}

// In mutations
const mutation = useMutation({
  onError: (error) => {
    toast.error(error.message);
  },
});
```

## Development Workflow

### Running Full Stack

```bash
npm run dev  # Runs all three: web (5173), api (3000), electron
```

### Running Individually

```bash
# Terminal 1: API
cd packages/api && npm run dev

# Terminal 2: Web
cd packages/web && npm run dev

# Terminal 3: Solver tests (optional)
cd packages/solver && source .venv/bin/activate && pytest
```

### Testing Solver Directly

```bash
cd packages/solver
source .venv/bin/activate
echo '{"teachers":[],"subjects":[],...}' | python solver.py
```

## Common Integration Issues

| Issue          | Cause                            | Solution                            |
| -------------- | -------------------------------- | ----------------------------------- |
| CORS errors    | API not allowing frontend origin | Check `cors` middleware in `app.ts` |
| Solver timeout | Complex constraints              | Use `fast` strategy or reduce input |
| Type mismatch  | Schema drift                     | Sync Zod schemas between packages   |
| Empty response | Solver crash                     | Check Python venv, stderr logs      |
