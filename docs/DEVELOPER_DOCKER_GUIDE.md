# Maktab Timetable - Developer Docker Guide (Windows)

Quick guide for developers to run the app using Docker on Windows.

---

## Prerequisites

1. **Docker Desktop for Windows** - [Download](https://www.docker.com/products/docker-desktop/)
   - Enable WSL2 backend during installation
   - Restart after installation

2. **Git** - [Download](https://git-scm.com/download/win)

---

## Quick Start (5 minutes)

```powershell
# 1. Clone the repo
git clone <repo-url>
cd maktab-timetable

# 2. Start with Docker Compose
docker-compose up --build

# 3. Open browser
# Web UI: http://localhost:5173
# API:    http://localhost:4000
```

That's it! The app should be running.

---

## What's Running

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │   Web UI    │────▶│  Express    │────▶│   Python    │  │
│   │   (Vite)    │     │    API      │     │   Solver    │  │
│   │  :5173      │     │   :4000     │     │  (OR-Tools) │  │
│   └─────────────┘     └──────┬──────┘     └─────────────┘  │
│                              │                              │
│                       ┌──────▼──────┐                       │
│                       │   SQLite    │                       │
│                       │  Database   │                       │
│                       └─────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| Web UI | 5173 | React frontend (Vite dev server) |
| API | 4000 | Express.js backend |
| Solver | - | Python constraint solver (spawned by API) |

---

## Application Flow

### 1. Data Entry Flow
```
User enters data in wizard steps:
  School Info → Teachers → Subjects → Rooms → Classes → Constraints
                    ↓
              Saved to SQLite via API
```

### 2. Timetable Generation Flow
```
User clicks "Generate"
        ↓
    API receives request
        ↓
    Spawns Python solver (OR-Tools CP-SAT)
        ↓
    Solver returns schedule JSON
        ↓
    API saves to database
        ↓
    UI displays timetable
```

### 3. Key API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/teachers` | Manage teachers |
| `GET/POST /api/subjects` | Manage subjects |
| `GET/POST /api/rooms` | Manage rooms |
| `GET/POST /api/classes` | Manage classes |
| `POST /api/generate` | Generate timetable |
| `GET /api/timetables` | Get saved timetables |

---

## Common Docker Commands

```powershell
# Start (foreground with logs)
docker-compose up

# Start (background)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up --build

# Shell into container
docker exec -it maktab-dev bash

# Clean restart (removes volumes)
docker-compose down -v
docker-compose up --build
```

---

## Hot Reload

The Docker setup supports hot reload for development:

| What | Hot Reload? |
|------|-------------|
| Web UI (React) | ✅ Yes - changes reflect immediately |
| API (TypeScript) | ✅ Yes - nodemon restarts on changes |
| Solver (Python) | ⚠️ No - restart container for changes |

---

## Project Structure Overview

```
maktab-timetable/
├── packages/
│   ├── api/              # Express.js backend
│   │   ├── server.ts     # Main API routes
│   │   ├── schema.ts     # Zod validation
│   │   └── src/
│   │       ├── entity/   # TypeORM entities
│   │       └── database/ # Database service
│   │
│   ├── web/              # React frontend (if exists)
│   │
│   └── solver/           # Python constraint solver
│       ├── solver_enhanced.py  # Main solver
│       ├── strategies/   # Fast/Balanced/Thorough
│       └── constraints/  # Constraint definitions
│
├── electron/             # Desktop shell (not used in Docker)
├── docker-compose.yml    # Docker config
└── Dockerfile            # Container definition
```

---

## Troubleshooting

### Port already in use
```powershell
# Find and kill process on port
netstat -ano | findstr :5173
taskkill /PID <pid> /F
```

### Container won't start
```powershell
# Check Docker is running
docker info

# View detailed logs
docker-compose logs --tail=100
```

### Database issues
```powershell
# Reset database (removes all data)
docker-compose down -v
docker-compose up --build
```

### Native module errors
```powershell
# Rebuild native modules inside container
docker-compose exec app npm rebuild better-sqlite3
```

---

## Development Without Docker (Alternative)

If you prefer running natively:

```powershell
# Install Node.js 20+ and Python 3.10+

# Install dependencies
npm install
cd packages/solver && pip install -r requirements.txt

# Run development
npm run dev

# This starts:
# - Web UI on :5173
# - API on :4000
# - Electron app
```

---

## Key Technologies

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Backend | Express.js + TypeScript |
| Database | SQLite + TypeORM |
| Solver | Python + OR-Tools (CP-SAT) |
| Validation | Zod (API) + Pydantic (Solver) |
| Desktop | Electron (for distribution) |

---

## Questions?

Check the other docs:
- `docs/ARCHITECTURE_FOUNDATION.md` - System architecture
- `docs/WINDOWS_DEPLOYMENT_GUIDE.md` - Building installers
- `BACKEND_FEATURES_AND_SCENARIOS.md` - Feature details
