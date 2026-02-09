# Context Guide for Chat Prompts

Quick reference for what files to attach with each type of issue to get fast,
accurate help.

## UI/UX Issues (Screenshots + Files)

When reporting visual bugs, layout problems, or styling issues:

```
Attach:
1. Screenshot of the issue
2. Route file: packages/web/src/routes/[page].tsx
3. Component file (if known): packages/web/src/features/[feature]/components/[Component].tsx
   OR: packages/web/src/components/[folder]/[Component].tsx
```

### Route → Feature Mapping

| Route Path     | Feature Folder            | Key Components                        |
| -------------- | ------------------------- | ------------------------------------- |
| `/teachers/*`  | `features/teachers/`      | TeacherForm, TeacherList, TeacherCard |
| `/classes/*`   | `features/classes/`       | ClassForm, ClassList                  |
| `/subjects/*`  | `features/subjects/`      | SubjectForm, SubjectList              |
| `/rooms/*`     | `features/rooms/`         | RoomForm, RoomList                    |
| `/dashboard/*` | `features/dashboard/`     | DashboardStats, RecentActivity        |
| `/schedule/*`  | `features/schedule/`      | TimetableGrid, ScheduleView           |
| `/settings/*`  | `features/school-config/` | SchoolConfigForm                      |
| `/workspace/*` | `features/workspace/`     | WorkspaceSelector                     |

### Shared UI Components

For issues with buttons, inputs, dialogs, etc:

- `packages/web/src/components/ui/` - Shadcn primitives
- `packages/web/src/components/layout/` - Sidebar, Header, AppShell

### Styling Files

- Global styles: `packages/web/src/styles/globals.css`
- Tailwind config: `packages/web/tailwind.config.ts`

---

## API/Backend Issues

When debugging API errors, data problems, or server issues:

```
Attach:
1. Route handler: packages/api/src/routes/[resource].routes.ts
2. Service: packages/api/src/services/[Resource]Service.ts
3. Entity (if DB): packages/api/src/entity/[Entity].ts
4. Schema (if validation): packages/api/src/schemas/[resource].schema.ts
```

### API Route Files

| Resource   | Route File            | Service               | Entity         |
| ---------- | --------------------- | --------------------- | -------------- |
| Teachers   | `teacher.routes.ts`   | `TeacherService.ts`   | `Teacher.ts`   |
| Subjects   | `subject.routes.ts`   | `SubjectService.ts`   | `Subject.ts`   |
| Classes    | `class.routes.ts`     | `ClassService.ts`     | `Class.ts`     |
| Rooms      | `room.routes.ts`      | `RoomService.ts`      | `Room.ts`      |
| Timetables | `timetable.routes.ts` | `TimetableService.ts` | `Timetable.ts` |
| License    | `license.routes.ts`   | `LicenseService.ts`   | -              |
| Config     | `config.routes.ts`    | -                     | `Config.ts`    |

---

## Solver Issues

When timetable generation fails or produces bad results:

```
Attach:
1. Main solver: packages/solver/solver.py
2. Constraint file: packages/solver/constraints/[constraint].py
3. Strategy (if relevant): packages/solver/strategies/[strategy]_solver.py
4. Input JSON that's failing (if available)
```

### Solver Files

| Issue Type            | Files to Attach                 |
| --------------------- | ------------------------------- |
| Constraint violations | `constraints/` folder files     |
| Performance/timeout   | `strategies/` folder + `utils/` |
| Input validation      | `models/` folder (Pydantic)     |
| General solver bugs   | `solver.py`                     |

---

## Form/Validation Issues

When forms don't validate correctly or show wrong errors:

```
Attach:
1. Frontend schema: packages/web/src/schemas/[resource].schema.ts
2. Backend schema: packages/api/src/schemas/[resource].schema.ts
3. Form component: packages/web/src/features/[feature]/components/[Form].tsx
```

---

## Prompt Templates

### UI Bug Report

```
Issue: [Brief description]
Screenshot: [attached]
Route: packages/web/src/routes/[path].tsx
Component: packages/web/src/features/[feature]/components/[Component].tsx
Expected: [What should happen]
Actual: [What's happening]
```

### API Error Report

```
Issue: [Brief description]
Endpoint: [METHOD /api/path]
Error: [Error message or status code]
Route: packages/api/src/routes/[resource].routes.ts
Service: packages/api/src/services/[Service].ts
```

### Solver Issue Report

```
Issue: [Brief description]
Strategy: [fast/balanced/thorough]
Error: [Error message or unexpected behavior]
Input size: [X teachers, Y classes, Z subjects]
Files: [List relevant solver files]
```
