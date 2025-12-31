# Maktab Backend - Complete Features & Scenarios Documentation

## System Overview

The Maktab backend consists of two main components:
1. **API Server** (Node.js/Express + TypeORM/SQLite) - Handles data persistence and HTTP endpoints
2. **Solver Engine** (Python/OR-Tools) - Generates optimal timetables using constraint satisfaction

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/Web)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API SERVER (Node.js/Express)                           │
│  Port: 4000                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ REST Endpoints:                                                      │   │
│  │  • /api/health          - Health check                               │   │
│  │  • /api/license/*       - License management                         │   │
│  │  • /api/config/*        - School configuration                       │   │
│  │  • /api/teachers/*      - Teacher CRUD (with pagination)             │   │
│  │  • /api/subjects/*      - Subject CRUD (with pagination)             │   │
│  │  • /api/rooms/*         - Room CRUD (with pagination)                │   │
│  │  • /api/classes/*       - Class CRUD (with pagination)               │   │
│  │  • /api/timetables/*    - Timetable storage                          │   │
│  │  • /api/wizard/*        - Wizard step persistence                    │   │
│  │  • /api/generate        - Timetable generation (calls Python solver) │   │
│  │  • /api/reset           - Destructive data reset                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Layered Architecture                                                 │   │
│  │  Routes → Services → Repositories → Entities                         │   │
│  │                                                                       │   │
│  │ Features:                                                            │   │
│  │  • LRU Caching with configurable max size (default: 1000 entries)   │   │
│  │  • Cache TTL: 5 minutes                                              │   │
│  │  • Database indexes for optimized queries                            │   │
│  │  • Request validation with Zod schemas                               │   │
│  │  • Pagination support (default: 50, max: 100)                        │   │
│  │  • Structured logging with configurable levels                       │   │
│  │  • Transaction support for atomic operations                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ POST /api/generate
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PYTHON SOLVER (OR-Tools CP-SAT)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Input: JSON via stdin (or temp file for payloads > 1MB)              │   │
│  │ Output: JSON via stdout                                              │   │
│  │ Timeout: 15 minutes (configurable)                                   │   │
│  │                                                                       │   │
│  │ Features:                                                            │   │
│  │  • Pydantic data validation                                          │   │
│  │  • Three solving strategies (Fast/Balanced/Thorough)                 │   │
│  │  • Automatic decomposition for large problems                        │   │
│  │  • Progressive constraint management                                 │   │
│  │  • Graceful degradation for infeasible problems                      │   │
│  │  • Concurrent request protection (one solve at a time)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Architecture

The backend follows a clean layered architecture with separation of concerns:

```text
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
│  │  - Cache integration (LRU with TTL)                       │   │
│  │  - Transaction support                                    │   │
│  │  - Bulk operations                                        │   │
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
│  - LRU eviction (configurable max size per entity)               │
│  - TTL management (default: 5 minutes)                           │
│  - Granular cache invalidation                                   │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    TypeORM Entities                               │
│                    (with database indexes)                        │
└──────────────────────────────────────────────────────────────────┘
```

### Database Indexes

Optimized indexes for common query patterns:

| Entity | Indexed Columns | Purpose |
|--------|-----------------|---------|
| Teacher | `fullName`, `schoolId` | Name lookups, multi-tenancy |
| Subject | `[grade, name]`, `[grade, code]`, `schoolId` | Grade+name/code queries |
| Room | `name`, `schoolId` | Name lookups, multi-tenancy |
| ClassGroup | `name`, `fixedRoomId`, `schoolId` | Name/room queries |
| License | `isActive` | Active license queries |

### Middleware Stack

| Middleware | Purpose |
|------------|---------|
| `loggingMiddleware` | Request logging with method, path, status, duration |
| `licenseMiddleware` | License validation (blocks expired licenses) |
| `validationMiddleware` | Zod schema validation for request bodies |
| `paginationMiddleware` | Parse and validate pagination parameters |

### Source File Organization

```text
packages/api/
├── server.ts                       # Server bootstrap (entry point, ~50 lines)
├── ormconfig.ts                    # TypeORM DataSource configuration
├── schema.ts                       # Zod validation schemas for solver
├── src/
│   ├── app.ts                      # Express app configuration
│   ├── constants.ts                # Application constants
│   ├── types/
│   │   ├── common.types.ts         # Shared types (PaginationParams, etc.)
│   │   └── index.ts                # Type exports
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
│   ├── services/
│   │   ├── teacher.service.ts      # Teacher business logic
│   │   ├── subject.service.ts      # Subject business logic
│   │   ├── room.service.ts         # Room business logic
│   │   ├── class.service.ts        # Class business logic
│   │   ├── timetable.service.ts    # Timetable business logic
│   │   ├── solver.service.ts       # Python solver integration (singleton)
│   │   ├── licenseService.ts       # License management
│   │   └── auditService.ts         # Audit logging
│   ├── database/
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
│   ├── middleware/
│   │   ├── licenseMiddleware.ts    # License validation
│   │   ├── validation.middleware.ts # Request validation
│   │   ├── pagination.middleware.ts # Pagination parameter parsing
│   │   └── logging.middleware.ts   # Request logging
│   ├── schemas/
│   │   ├── teacher.schema.ts       # Teacher validation schemas
│   │   ├── subject.schema.ts       # Subject validation schemas
│   │   ├── room.schema.ts          # Room validation schemas
│   │   └── class.schema.ts         # Class validation schemas
│   ├── entity/                     # TypeORM entities (with indexes)
│   └── utils/
│       ├── logger.ts               # Structured logger
│       ├── errorParser.ts          # Solver error parsing
│       └── jsonTransformer.ts      # JSON field transformation
```

---

## Part 1: Supported Features

### 1.1 School Configuration Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Days of Week** | Configure which days school operates (Mon-Sun) | ✅ Supported |
| **Periods per Day** | Set number of teaching periods (1-12) | ✅ Supported |
| **Dynamic Periods** | Different periods for different days (e.g., Friday shorter) | ✅ Supported |
| **Category-based Periods** | Different periods for different grade categories | ✅ Supported |
| **School Start Time** | Define when school day begins (HH:mm) | ✅ Supported |
| **Period Duration** | Set default period length in minutes | ✅ Supported |
| **Break Periods** | Configure breaks after specific periods | ✅ Supported |
| **Prayer Breaks** | Special breaks for religious observance | ✅ Supported |
| **Multi-shift Support** | Morning/afternoon shifts | ✅ Supported |
| **Timezone** | School timezone setting | ✅ Supported |

### 1.2 Teacher Management Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Basic Info** | Name, ID | ✅ Supported |
| **Primary Subjects** | Subjects teacher is qualified to teach | ✅ Supported |
| **Allowed Subjects** | Additional subjects teacher can teach | ✅ Supported |
| **Restrict to Primary** | Only allow primary subjects | ✅ Supported |
| **Daily Availability** | Per-day, per-period availability matrix | ✅ Supported |
| **Unavailable Slots** | Specific blocked time slots | ✅ Supported |
| **Max Periods/Week** | Weekly teaching limit | ✅ Supported |
| **Max Periods/Day** | Daily teaching limit | ✅ Supported |
| **Max Consecutive** | Maximum back-to-back periods | ✅ Supported |
| **Time Preference** | Morning/Afternoon preference | ✅ Supported |
| **Preferred Rooms** | Room preferences | ✅ Supported |
| **Preferred Colleagues** | Collaboration preferences | ✅ Supported |
| **Gender** | For gender separation constraints | ✅ Supported |
| **Class Assignments** | Pre-assigned class-teacher relationships | ✅ Supported |
| **Bulk Import** | Import multiple teachers at once | ✅ Supported |

### 1.3 Subject Management Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Basic Info** | Name, ID, Code | ✅ Supported |
| **Required Room Type** | Must be taught in specific room type | ✅ Supported |
| **Required Features** | Room must have specific features | ✅ Supported |
| **Desired Features** | Preferred room features (soft) | ✅ Supported |
| **Is Difficult** | Mark as difficult subject | ✅ Supported |
| **Min Room Capacity** | Minimum room size required | ✅ Supported |
| **Custom Subject** | Beyond standard curriculum | ✅ Supported |
| **Custom Category** | Which grade category custom subject applies to | ✅ Supported |
| **Grade-specific Subjects** | Subjects tied to specific grades | ✅ Supported |
| **Curriculum Insert** | Bulk insert curriculum for a grade | ✅ Supported |

### 1.4 Room Management Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Basic Info** | Name, ID, Capacity | ✅ Supported |
| **Room Type** | Classroom, Lab, Gym, etc. | ✅ Supported |
| **Features** | Projector, Whiteboard, Computers, etc. | ✅ Supported |
| **Unavailable Slots** | Blocked time slots | ✅ Supported |
| **Metadata** | Custom key-value data | ✅ Supported |

### 1.5 Class Management Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Basic Info** | Name, ID, Student Count | ✅ Supported |
| **Subject Requirements** | Which subjects and how many periods/week | ✅ Supported |
| **Periods per Week** | Per-subject weekly requirement | ✅ Supported |
| **Min/Max Consecutive** | Consecutive period constraints | ✅ Supported |
| **Min/Max Days per Week** | Day distribution constraints | ✅ Supported |
| **Grade Level** | Grade 1-12 | ✅ Supported |
| **Category** | Auto-determined from grade | ✅ Supported |
| **Single-Teacher Mode** | One teacher for all subjects | ✅ Supported |
| **Class Teacher ID** | Assigned class teacher | ✅ Supported |
| **Fixed Room** | Lock class to specific room | ✅ Supported |
| **Gender** | For gender separation | ✅ Supported |
| **Metadata** | Custom key-value data | ✅ Supported |

### 1.6 Scheduling Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Fixed Lessons** | Pre-scheduled lessons that cannot move | ✅ Supported |
| **School Events** | Block time for assemblies, events | ✅ Supported |
| **Event Date Ranges** | Events with start/end dates | ✅ Supported |
| **Class-specific Events** | Events for specific classes only | ✅ Supported |

### 1.7 Optimization Preferences (Soft Constraints)

| Preference | Description | Default Weight |
|------------|-------------|----------------|
| **Avoid Teacher Gaps** | Minimize free periods between classes | 1.0 |
| **Avoid Class Gaps** | Minimize free periods for students | 1.0 |
| **Distribute Difficult Subjects** | Spread hard subjects across week | 0.8 |
| **Balance Teacher Load** | Even distribution of teaching hours | 0.7 |
| **Minimize Room Changes** | Keep classes in same room | 0.3 |
| **Prefer Morning for Difficult** | Schedule hard subjects in morning | 0.5 |
| **Respect Teacher Time Preference** | Honor morning/afternoon preferences | 0.5 |
| **Respect Teacher Room Preference** | Honor room preferences | 0.2 |
| **Allow Consecutive Periods** | Same subject back-to-back | true |
| **Avoid First/Last Period** | Don't schedule at day edges | 0.0 |
| **Subject Spread** | Distribute subject across week | 0.0 |

---

## Part 2: Afghanistan-Specific Features

### 2.1 Grade Classification System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AFGHANISTAN EDUCATION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Grade 1-3   →  Alpha-Primary  (ابتداییه دوره اول)                          │
│  Grade 4-6   →  Beta-Primary   (ابتداییه دوره دوم)                          │
│  Grade 7-9   →  Middle         (متوسطه)                                     │
│  Grade 10-12 →  High           (لیسه)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Single-Teacher Mode (Primary Classes)

For Alpha-Primary and Beta-Primary classes where one teacher teaches all subjects:

```json
{
  "id": "CLASS_1A",
  "name": "Class 1-A",
  "gradeLevel": 1,
  "singleTeacherMode": true,
  "classTeacherId": "TEACHER_MARYAM",
  "subjectRequirements": {
    "MATH": { "periodsPerWeek": 6 },
    "DARI": { "periodsPerWeek": 5 },
    "PASHTO": { "periodsPerWeek": 4 }
  }
}
```

### 2.3 Class Teacher / استاد نگران (Middle/High School)

For Middle and High school classes, a Class Teacher (استاد نگران) can be assigned as a supervisor. Unlike single-teacher mode, the class teacher doesn't teach all subjects—they must teach at least one lesson per week from subjects they're qualified to teach.

**Key Differences:**
| Mode | Behavior |
|------|----------|
| `singleTeacherMode: true` | Teacher teaches ALL subjects for the class |
| `singleTeacherMode: false` + `classTeacherId` | Teacher must teach ≥1 lesson/week (Class Teacher constraint) |

```json
{
  "id": "CLASS_7A",
  "name": "Class 7-A",
  "gradeLevel": 7,
  "singleTeacherMode": false,
  "classTeacherId": "TEACHER_AHMAD",
  "subjectRequirements": {
    "MATH": { "periodsPerWeek": 5 },
    "PHYSICS": { "periodsPerWeek": 4 },
    "DARI": { "periodsPerWeek": 4 }
  }
}
```

**Validation Rules:**
- Class teacher must exist in the teachers list
- Class teacher must be qualified to teach at least one subject from the class's requirements
- If validation fails, a clear error is returned before solving begins

### 2.4 Custom Subjects

Beyond standard curriculum (e.g., Advanced Quran Studies, Computer Science):

```json
{
  "id": "SUBJ_QURAN_ADV",
  "name": "Advanced Quran Studies",
  "isCustom": true,
  "customCategory": "Alpha-Primary"
}
```

### 2.5 Dynamic Periods (Weekend Schedule)

Different periods for different days:

```json
{
  "config": {
    "periodsPerDayMap": {
      "Monday": 7,
      "Tuesday": 7,
      "Wednesday": 7,
      "Thursday": 7,
      "Friday": 5,
      "Saturday": 3
    }
  }
}
```

### 2.6 Category-Based Periods

Different periods for different grade categories:

```json
{
  "config": {
    "categoryPeriodsPerDayMap": {
      "Alpha-Primary": { "Monday": 5, "Tuesday": 5, "Friday": 3 },
      "Beta-Primary": { "Monday": 6, "Tuesday": 6, "Friday": 4 },
      "Middle": { "Monday": 7, "Tuesday": 7, "Friday": 5 },
      "High": { "Monday": 8, "Tuesday": 8, "Friday": 6 }
    }
  }
}
```

---

## Part 3: Supported Scenarios

### Scenario 1: Small School (< 100 lessons/week)

**Characteristics:**
- 5-10 classes
- 10-20 teachers
- 10-15 subjects
- Single shift

**Solver Behavior:**
- Uses Thorough strategy
- All soft constraints enabled
- Solves in < 1 minute
- Optimal solution quality

### Scenario 2: Medium School (100-300 lessons/week)

**Characteristics:**
- 10-25 classes
- 20-40 teachers
- 15-25 subjects
- Single or dual shift

**Solver Behavior:**
- Uses Balanced strategy
- Most soft constraints enabled
- Solves in 1-5 minutes
- Good solution quality

### Scenario 3: Large School (300-500 lessons/week)

**Characteristics:**
- 25-50 classes
- 40-80 teachers
- 20-30 subjects
- Multiple shifts possible

**Solver Behavior:**
- Uses Fast strategy or Decomposition
- Critical soft constraints only
- Solves in 5-15 minutes
- Feasible solution quality

### Scenario 4: Very Large School (> 500 lessons/week)

**Characteristics:**
- 50+ classes
- 80+ teachers
- 30+ subjects

**Solver Behavior:**
- Automatic decomposition
- Clusters classes by shared teachers
- Solves sub-problems independently
- Merges solutions
- May take 10-30 minutes

### Scenario 5: Primary School (Single-Teacher Mode)

**Characteristics:**
- Grades 1-6
- Each class has one teacher for all subjects
- Simple room requirements

**Solver Behavior:**
- Restricts each class to assigned teacher
- Validates teacher can teach all required subjects
- Validates teacher has enough availability

### Scenario 6: High School (Specialist Teachers)

**Characteristics:**
- Grades 10-12
- Each subject has specialist teachers
- Lab requirements for science subjects

**Solver Behavior:**
- Matches subjects to qualified teachers
- Respects room type requirements
- Handles complex teacher availability

### Scenario 7: Mixed School (K-12)

**Characteristics:**
- All grades 1-12
- Mix of single-teacher and specialist modes
- Multiple room types

**Solver Behavior:**
- Handles both modes simultaneously
- Category-based period configuration
- Complex constraint management

### Scenario 8: Weekend Schedule

**Characteristics:**
- Friday/Saturday shorter days
- Different periods per day

**Solver Behavior:**
- Respects periodsPerDayMap
- Validates teacher availability matches
- Adjusts lesson distribution

### Scenario 9: Multi-Shift School

**Characteristics:**
- Morning shift (7:00-12:00)
- Afternoon shift (13:00-18:00)
- Shared teachers/rooms between shifts

**Solver Behavior:**
- Handles shift definitions
- Prevents resource conflicts across shifts
- Respects shift-specific availability

### Scenario 10: Gender-Separated School

**Characteristics:**
- Boys and girls in separate classes
- Gender-matched teachers required

**Solver Behavior:**
- Enforces gender separation constraints
- Matches teacher gender to class gender
- Allows "mixed" gender for flexibility

---

## Part 4: Hard Constraints (Always Enforced)

| Constraint | Description |
|------------|-------------|
| **No Class Overlap** | A class cannot have two lessons at the same time |
| **No Teacher Overlap** | A teacher cannot teach two classes at the same time |
| **No Room Overlap** | A room cannot host two classes at the same time |
| **Same-Day Lessons** | Multi-period lessons must be on the same day |
| **Max 2 Periods/Day/Subject** | No subject can have more than 2 periods per day |
| **Consecutive Must Be Adjacent** | If 2 periods of same subject on same day, they must be back-to-back |
| **Teacher Availability** | Teachers can only teach when available |
| **Room Availability** | Rooms can only be used when available |
| **Room Compatibility** | Room must meet subject requirements (type, capacity, features) |
| **Teacher Qualification** | Teacher must be qualified to teach the subject |
| **Fixed Lessons** | Pre-scheduled lessons cannot be moved |
| **School Events** | Blocked time slots cannot have lessons |
| **Single-Teacher Mode** | If enabled, only assigned teacher can teach the class |
| **Class Teacher Min Lesson** | If classTeacherId set (without singleTeacherMode), teacher must have ≥1 lesson/week |
| **Fixed Room** | If set, class can only use the assigned room |

---

## Part 5: Error Handling

### 5.1 Validation Errors

| Error Type | Description | Suggested Fix |
|------------|-------------|---------------|
| `VALIDATION_ERROR` | Invalid input data structure | Check JSON format and required fields |
| `Period Configuration Error` | Missing/invalid periods | Ensure all days have period counts |
| `Teacher Availability Error` | Availability doesn't match periods | Update teacher availability array lengths |
| `Subject Reference Error` | Unknown subject ID | Check subject definitions |
| `Custom Subject Error` | Invalid custom category | Use valid category names |
| `Single-Teacher Mode Error` | Teacher can't teach all subjects | Update teacher qualifications |
| `Class Teacher Error` | Class teacher can't teach any class subjects | Assign a teacher qualified for at least one subject |
| `Empty Periods Error` | Total required ≠ total available | Adjust subject requirements |

### 5.2 Solver Errors

| Error Type | Description | Suggested Fix |
|------------|-------------|---------------|
| `MODEL_TOO_COMPLEX` | Problem too large (> 500,000 complexity) | Reduce classes, teachers, or requirements |
| `INFEASIBLE` | No solution exists | Relax constraints, add teachers/rooms |
| `SOLVER_TIMEOUT` | Exceeded time limit | Increase time limit or simplify problem |
| `SOLVER_RUNTIME_ERROR` | Python solver crashed | Check server logs |

### 5.3 API Errors

| Error Type | HTTP Status | Description | Suggested Fix |
|------------|-------------|-------------|---------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed | Check JSON format and required fields |
| `NOT_FOUND` | 404 | Requested resource not found | Verify entity ID exists |
| `CONFLICT` | 409 | Resource already exists (duplicate) | Use unique identifiers |
| `SOLVER_BUSY` | 503 | Solver is processing another request | Wait for current solve to complete |
| `SOLVER_TIMEOUT` | 504 | Solver exceeded time limit | Increase timeout or simplify problem |
| `SOLVER_NOT_FOUND` | 500 | Python solver not installed | Install solver dependencies |
| `SOLVER_SPAWN_ERROR` | 500 | Failed to start solver | Check Python installation |
| `SOLVER_PARSE_ERROR` | 500 | Invalid solver output | Check solver logs |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Check server logs |

---

## Part 6: API Endpoints Reference

### Health & License

```http
GET  /api/health                    - Health check
GET  /api/license                   - Get current license status
POST /api/license/activate          - Activate a license key
```

### Config

```http
GET  /api/config/school             - Get school config
PUT  /api/config/school             - Save school config
GET  /api/config/:key               - Get configuration value
POST /api/config/:key               - Save configuration value
```

### Teachers (with pagination & validation)

```http
GET    /api/teachers                - Get all teachers (paginated)
GET    /api/teachers?page=1&limit=50 - Pagination parameters
POST   /api/teachers                - Create teacher (validated)
PUT    /api/teachers/:id            - Update teacher (validated)
DELETE /api/teachers/:id            - Delete teacher (soft delete)
POST   /api/teachers/bulk           - Bulk import teachers (batch operation)
```

### Subjects (with pagination & validation)

```http
GET    /api/subjects                - Get all subjects (paginated)
POST   /api/subjects                - Create subject (validated)
PUT    /api/subjects/:id            - Update subject (validated)
DELETE /api/subjects/:id            - Delete subject (soft delete)
DELETE /api/subjects                - Clear all subjects
DELETE /api/subjects/grade/:grade   - Clear subjects by grade
POST   /api/subjects/grade/:grade/insert-curriculum - Insert curriculum (batch)
```

### Rooms (with pagination & validation)

```http
GET    /api/rooms                   - Get all rooms (paginated)
POST   /api/rooms                   - Create room (validated)
PUT    /api/rooms/:id               - Update room (validated)
DELETE /api/rooms/:id               - Delete room (soft delete)
```

### Classes (with pagination & validation)

```http
GET    /api/classes                 - Get all classes (paginated)
POST   /api/classes                 - Create class (validated)
PUT    /api/classes/:id             - Update class (validated)
DELETE /api/classes/:id             - Delete class (soft delete)
```

### Timetables

```http
GET    /api/timetables              - Get all timetables
POST   /api/timetables              - Save timetable
GET    /api/timetables/:id          - Get timetable by ID
PUT    /api/timetables/:id          - Update timetable
DELETE /api/timetables/:id          - Delete timetable
```

### Wizard

```http
GET    /api/wizard/:wizardId/steps           - Get all wizard steps
GET    /api/wizard/:wizardId/steps/:stepKey  - Get specific step
POST   /api/wizard/:wizardId/steps/:stepKey  - Save step
DELETE /api/wizard/:wizardId/steps           - Delete all steps
```

### Generation

```http
POST   /api/generate                - Generate timetable (calls Python solver)
POST   /api/reset                   - Destructive reset (requires confirmation)
```

### Pagination Response Format

All paginated endpoints return:

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

Pagination defaults: `page=1`, `limit=50`, max `limit=100`

---

## Part 7: Performance Characteristics

| Problem Size | Lessons/Week | Strategy | Expected Time | Memory |
|--------------|--------------|----------|---------------|--------|
| Small | < 100 | Thorough | < 1 min | < 500 MB |
| Medium | 100-200 | Balanced | 1-5 min | 500 MB - 1 GB |
| Large | 200-400 | Fast/Balanced | 5-10 min | 1-2 GB |
| Very Large | > 400 | Decomposition | 10-30 min | 2-4 GB |

### Solver Configuration Options

```json
{
  "config": {
    "solverTimeLimitSeconds": 600,      // Max solving time (default: 10 min)
    "solverOptimizationLevel": 2,       // 0=Fast, 1=Balanced, 2=Thorough
    "enableGracefulDegradation": true   // Return partial solution if infeasible
  }
}
```

---

## Part 8: Output Format

### Successful Generation

```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "day": "Monday",
        "periodIndex": 0,
        "classId": "CLASS_1A",
        "subjectId": "MATH",
        "teacherIds": ["TEACHER_1"],
        "roomId": "ROOM_101",
        "isFixed": false,
        "periodsThisDay": 7
      }
    ],
    "metadata": {
      "classes": [
        {
          "classId": "CLASS_1A",
          "className": "Class 1-A",
          "gradeLevel": 1,
          "category": "Alpha-Primary",
          "categoryDari": "ابتداییه دوره اول",
          "singleTeacherMode": true,
          "classTeacherId": "TEACHER_1",
          "classTeacherName": "Maryam Ahmadi"
        }
      ],
      "subjects": [...],
      "teachers": [...],
      "periodConfiguration": {
        "periodsPerDayMap": { "Monday": 7, "Friday": 5 },
        "totalPeriodsPerWeek": 37,
        "hasVariablePeriods": true
      }
    },
    "statistics": {
      "totalClasses": 10,
      "singleTeacherClasses": 3,
      "multiTeacherClasses": 7,
      "totalSubjects": 15,
      "customSubjects": 2,
      "totalTeachers": 20,
      "totalRooms": 12,
      "totalLessons": 350,
      "categoryCounts": {
        "Alpha-Primary": 3,
        "Beta-Primary": 3,
        "Middle": 2,
        "High": 2
      }
    }
  },
  "message": "Timetable generated successfully"
}
```

### Failed Generation

```json
{
  "success": false,
  "error": {
    "type": "INFEASIBLE",
    "entityType": "teacher",
    "entityId": "TEACHER_1",
    "field": "availability",
    "day": "Monday",
    "expected": 7,
    "actual": 5,
    "details": "Teacher availability mismatch",
    "suggestedStep": "teachers",
    "message": "Teacher 'Maryam Ahmadi' has 5 periods for Monday but configuration expects 7"
  },
  "message": "Failed to generate timetable"
}
```

---

## Part 9: Dependencies

### API Server (Node.js)

```json
{
  "express": "^5.x",
  "cors": "^2.x",
  "typeorm": "^0.3.x",
  "better-sqlite3": "^9.x",
  "zod": "^3.x",
  "reflect-metadata": "^0.1.x"
}
```

### Solver Engine (Python)

```text
ortools>=9.10.4067
pydantic>=2.11.9
structlog>=25.4.0
```

---

## Part 10: Quick Start

### 1. Install Dependencies

```bash
# API Server
cd packages/api
npm install

# Solver (in virtual environment)
cd packages/solver
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start API Server

```bash
cd packages/api
npm run dev
# Server runs on http://localhost:4000
```

### 3. Test Health Check

```bash
curl http://localhost:4000/api/health
# {"status":"ok","message":"Backend is running!"}
```

### 4. Generate Timetable

```bash
curl -X POST http://localhost:4000/api/generate \
  -H "Content-Type: application/json" \
  -d @test_data.json
```

---

## Part 11: Configuration Constants

Key configuration values defined in `src/constants.ts`:

| Constant | Default Value | Description |
|----------|---------------|-------------|
| `DEFAULT_PORT` | 4000 | Server port |
| `DEFAULT_PAGE_LIMIT` | 50 | Default pagination limit |
| `MAX_PAGE_LIMIT` | 100 | Maximum pagination limit |
| `DEFAULT_CACHE_MAX_SIZE` | 1000 | Max cache entries per entity |
| `DEFAULT_CACHE_TTL_MS` | 300000 (5 min) | Cache time-to-live |
| `DEFAULT_SOLVER_TIMEOUT_MS` | 900000 (15 min) | Solver timeout |
| `SOLVER_MAX_STDIN_SIZE_BYTES` | 1048576 (1 MB) | Threshold for file-based input |
| `DEFAULT_BATCH_SIZE` | 100 | Bulk operation batch size |

---

## Summary

The Maktab backend is a comprehensive school timetabling system that supports:

✅ **Full CRUD** for teachers, subjects, rooms, classes, and timetables
✅ **Afghanistan-specific** grade classification and single-teacher mode
✅ **Flexible scheduling** with dynamic periods, shifts, and events
✅ **Intelligent solving** with automatic strategy selection and decomposition
✅ **Robust validation** with Zod schemas and detailed error messages
✅ **Production-ready** with LRU caching, structured logging, and graceful degradation
✅ **Clean architecture** with layered design (Routes → Services → Repositories)
✅ **Database optimization** with indexes on frequently queried columns
✅ **API pagination** for efficient data transfer on large datasets
✅ **Concurrent request protection** for solver operations
