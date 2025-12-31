# Maktab Frontend Spec (AI Reference)

## Core Config

- **Lang**: Persian/Dari (fa), RTL-first, `dir="rtl"`
- **Platform**: Electron + React + Vite
- **Design**: Naqsh UI (Afghan RTL-first design system)

## Tech Stack

```
React 19 | TanStack Router | TanStack Query | Zustand | React Hook Form + Zod
shadcn/ui | Tailwind CSS + tailwindcss-rtl | @dnd-kit | i18next
Fonts: Vazirmatn (Persian), Inter (Latin), JetBrains Mono (code)
```

## Layout: Hybrid Manager Pattern (3-column)

```
┌─────────────────────────────────────────────────┐
│ HEADER: Logo | AppName | [UnsavedIndicator] | Save | Settings │
├─────────────────────────────────────────────────┤
│ SIDEBAR(R) │ MAIN STAGE (DataGrid) │ INSPECTOR(L) │
│ 64-240px   │ flex-1                │ 320-480px    │
└─────────────────────────────────────────────────┘
RTL: Sidebar=right, Inspector=left, content flows right-to-left
```

## Routes

| Path         | View          | Description                           |
| ------------ | ------------- | ------------------------------------- |
| `/`          | redirect      | → `/teachers`                         |
| `/teachers`  | TeachersPage  | DataGrid + TeacherInspector           |
| `/subjects`  | SubjectsPage  | DataGrid + SubjectInspector           |
| `/classes`   | ClassesPage   | DataGrid + ClassInspector             |
| `/rooms`     | RoomsPage     | DataGrid + RoomInspector              |
| `/timetable` | TimetablePage | ScheduleBoard + drag-drop             |
| `/config`    | ConfigPage    | School settings (days/periods/grades) |

## State Management

| Type    | Tool                          | Data                                                             |
| ------- | ----------------------------- | ---------------------------------------------------------------- |
| Server  | TanStack Query                | teachers, subjects, classes, rooms, timetables                   |
| UI      | Zustand (uiStore)             | sidebarCollapsed, inspectorOpen, selectedEntity, theme, language |
| Changes | Zustand (unsavedChangesStore) | pending CRUD operations                                          |
| Forms   | React Hook Form               | validation via Zod                                               |
| Drag    | @dnd-kit                      | timetable editing                                                |

## Key Components

### DataGrid (Airtable-style)

- In-place cell editing (click to edit)
- Column types: text, number, select, boolean, badge
- Toolbar: search, filter, add button
- Row selection → opens Inspector panel
- "Add row" button at bottom

### AvailabilityMatrix

- 2D grid: Days (cols) × Periods (rows)
- Click-drag painting to toggle cells
- States: available (green), busy (red), disabled (gray)
- Supports variable periods per day

### DetailInspector (Sheet/Drawer)

- Opens on row select, closes on X or deselect
- Tabbed interface per entity type
- Teacher tabs: Availability, Subjects, Details
- Side: left (in RTL layout)

## Entity Schemas (Zod)

### Teacher

```ts
{ name: string, code?: /^T\d{3}$/, status: 'active'|'inactive',
  maxPeriodsPerWeek: 1-40, maxPeriodsPerDay: 1-10,
  preferredTimeSlots: 'morning'|'afternoon'|'any',
  qualifiedSubjects: number[], availability?: boolean[][] }
```

### Subject

```ts
{ name: string, code: string, category: 'core'|'elective'|'religious'|'physical',
  defaultPeriodsPerWeek: number, requiresLab: boolean }
```

### Class

```ts
{ name: string, grade: 1-12, section?: string, shift: 'morning'|'afternoon',
  studentCount?: number, isSingleTeacher: boolean, assignedTeacherId?: number }
```

### Room

```ts
{ name: string, code: string, type: 'classroom'|'lab'|'gym'|'library',
  capacity: number, isAvailable: boolean }
```

## Afghan-Specific

### Grade Categories

- alphaPrimary: 1-3 (ابتدایی الف) - single-teacher mode
- betaPrimary: 4-6 (ابتدایی ب)
- middle: 7-9 (متوسطه)
- high: 10-12 (لیسه)

### Days (Saturday-Thursday)

```ts
['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه'];
// IDs: 0-5, Friday (6) is off
```

### Numerals

- Support both: ۰۱۲۳۴۵۶۷۸۹ (Persian) and 0123456789 (Latin)
- `toPersianNumerals(n)`, `toLatinNumerals(s)`

## Colors (Naqsh Design System)

```css
--primary:
  #003366 (Lapis Blue) --background: #f9f7f2 (Paper) --text: #1a1a1a (Ink)
    --success: #10b981,
  --error: #dc2626, --warning: #f59e0b;
```

## File Structure

```
src/
├── components/{ui,layout,schedule,common}/
├── features/{teachers,subjects,classes,rooms,timetable,config}/
│   └── {components/,hooks/,api.ts,types.ts}
├── stores/{uiStore,unsavedChangesStore,scheduleStore}.ts
├── schemas/*.schema.ts
├── hooks/{useNumeral,useDirection,useTheme,useKeyboardShortcuts}.ts
├── lib/{api,utils,date,numeral,validation}.ts
├── i18n/locales/{fa,en}/*.json
├── routes/*.tsx
└── styles/globals.css
```

## API Endpoints

```
GET/POST/PUT/DELETE /api/{teachers,subjects,classes,rooms}
GET /api/timetables/current
POST /api/generate
GET/PUT /api/config
```

## i18n Keys (fa namespace)

- common: appName, save, cancel, delete, edit, add, search, noData, days._,
  periods._
- teachers: title, columns._, status._, form._, availability._
- classes: grades._, gradeCategory._, shift.\*
- timetable: generate, view._, empty._, conflicts.\*

## Implementation Order

1. Infrastructure (Router, Query, Zustand, i18n, Tailwind RTL)
2. Layout (AppShell, Sidebar, Header, Inspector)
3. DataGrid + AvailabilityMatrix
4. Resource pages (Teachers → Subjects → Classes → Rooms)
5. Config page
6. Timetable page with drag-drop
