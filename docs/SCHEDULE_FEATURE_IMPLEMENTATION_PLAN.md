# Schedule Feature Implementation Plan

## Document Purpose

This document provides a comprehensive, phase-by-phase implementation plan for
the Maktab Schedule Generation & Viewing System. It merges architectural
decisions, technical specifications, and implementation details into actionable
phases with Kiro-ready prompts.

**Owner:** Ahmadullah Ahmadi **Feature:** Timetable Generation & Viewing System
**Estimated Duration:** 5-6 weeks **Last Updated:** December 2024

---

## Table of Contents

- [Schedule Feature Implementation Plan](#schedule-feature-implementation-plan)
  - [Document Purpose](#document-purpose)
  - [Table of Contents](#table-of-contents)
  - [1. Feature Overview](#1-feature-overview)
    - [What We're Building](#what-were-building)
    - [Key Capabilities](#key-capabilities)
    - [Core Constraints](#core-constraints)
  - [2. Architecture Summary](#2-architecture-summary)
    - [Data Flow](#data-flow)
    - [State Machine for Manual Editing](#state-machine-for-manual-editing)
    - [Constraint Severity](#constraint-severity)
  - [3. Implementation Phases](#3-implementation-phases)

---

## 1. Feature Overview

### What We're Building

A complete schedule viewing and editing system with three interconnected
screens:

1. **Schedule Dashboard** - Analytics, generation controls, saved schedules
   management
2. **Classes Schedule** - View/edit schedules grouped by grade category
   (Alpha-Primary, Beta-Primary, Middle, High)
3. **Teachers Schedule** - View/edit schedules by teacher with tab navigation

### Key Capabilities

- View generated schedules from multiple perspectives (class-centric,
  teacher-centric)
- Manual schedule editing via constraint-aware swap system
- Real-time conflict detection with visual feedback
- Undo/redo for all manual edits
- Export to PDF/Excel with RTL support for Persian/Dari
- Generation tracking for license management

### Core Constraints

- Schedule is always fully filled (no empty time slots)
- Every move is a swap (dragging lesson A to slot B means lesson B goes to slot
  A)
- All swaps must satisfy hard constraints (teacher availability, conflicts)
- Soft constraints show warnings but allow swap with confirmation
- Single source of truth across all views

---

## 2. Architecture Summary

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                  │
│  GET /timetables/:id    POST /timetables/:id    GET /teachers, etc.    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TANSTACK QUERY                                  │
│  useSchedule()  useSaveSchedule()  useTeachers()  useRooms()  etc.     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZUSTAND STORE                                   │
│  scheduleStore: lessons, indexes, editState, interactionState          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Class View  │ │Teacher View │ │  Dashboard  │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### State Machine for Manual Editing

```
IDLE → SELECTING → PREVIEWING → EXECUTING → IDLE
  ↑        │            │            │
  └────────┴────────────┴────────────┘ (Escape cancels)
```

### Constraint Severity

| Type                           | Severity | Behavior                |
| ------------------------------ | -------- | ----------------------- |
| Teacher unavailable            | Hard     | Block swap (RED)        |
| Teacher conflict               | Hard     | Block swap (RED)        |
| Room conflict                  | Hard     | Block swap (RED)        |
| Class conflict                 | Hard     | Block swap (RED)        |
| Room type mismatch             | Hard     | Block swap (RED)        |
| Teacher preference violated    | Soft     | Warning dialog (YELLOW) |
| Consecutive periods exceeded   | Soft     | Warning dialog (YELLOW) |
| Difficult subject in afternoon | Soft     | Warning dialog (YELLOW) |

---

## 3. Implementation Phases

---

### Phase 1: Core Infrastructure & Data Layer

**Duration:** 3-4 days **Dependencies:** None **Deliverables:** Zustand store,
type definitions, index utilities, API hooks

#### Objectives

1. Create normalized data structure for schedule storage
2. Build O(1) lookup indexes for constraint checking
3. Define TypeScript types matching solver output
4. Create TanStack Query hooks for schedule CRUD
5. Set up feature folder structure

#### Technical Requirements

**Zustand Store Structure:**

```typescript
interface ScheduleState {
  // Data
  scheduleId: number | null;
  scheduleName: string;
  lessons: ScheduledLesson[];
  indexes: ScheduleIndexes;

  // Metadata
  metadata: SolutionMetadata | null;
  statistics: SolutionStatistics | null;

  // Reference data
  teachers: Map<string, Teacher>;
  rooms: Map<string, Room>;
  classes: Map<string, ClassGroup>;
  subjects: Map<string, Subject>;
}

interface ScheduleIndexes {
  bySlot: Map<string, ScheduledLesson[]>; // "Saturday-0" → lessons
  byTeacherAndSlot: Map<string, ScheduledLesson>; // "t1-Saturday-0" → lesson
  byRoomAndSlot: Map<string, ScheduledLesson>; // "r1-Saturday-0" → lesson
  byClassAndSlot: Map<string, ScheduledLesson>; // "c1-Saturday-0" → lesson
  byTeacher: Map<string, ScheduledLesson[]>; // All lessons for teacher
  byClass: Map<string, ScheduledLesson[]>; // All lessons for class
  byRoom: Map<string, ScheduledLesson[]>; // All lessons in room
}
```

**Index Building:**

- Build indexes once when schedule loads
- Incremental updates on swap (not full rebuild)
- O(1) constraint lookups

#### Files to Create

```
features/schedule/
├── types.ts                    # All TypeScript interfaces
├── constants.ts                # Constraint definitions, day mappings
├── stores/
│   └── scheduleStore.ts        # Main Zustand store
├── utils/
│   ├── indexBuilder.ts         # Build and update indexes
│   └── scheduleTransformer.ts  # Transform solver output to normalized form
├── hooks/
│   ├── useSchedule.ts          # TanStack Query: fetch schedule
│   ├── useSchedules.ts         # TanStack Query: list all schedules
│   ├── useSaveSchedule.ts      # TanStack Query: save mutation
│   └── useDeleteSchedule.ts    # TanStack Query: delete mutation
└── index.ts                    # Public exports
```

#### Acceptance Criteria

- [ ] Schedule store initializes with empty state
- [ ] `loadSchedule(id)` fetches from API and normalizes data
- [ ] Indexes are built correctly (verified by unit tests)
- [ ] Index lookups return correct results in O(1)
- [ ] Types match solver output schema exactly

---

#### Kiro Spec Prompt: Phase 1

```
Create a Kiro spec for the Schedule Feature - Phase 1: Core Infrastructure & Data Layer.

## Context
This is for the Maktab school timetable application (packages/web). The schedule feature displays and allows editing of generated timetables. This phase establishes the data layer foundation.

## Existing Code References
- Solver output types: packages/solver/models/output.py (ScheduledLesson, SolutionMetadata, SolutionStatistics)
- API schema: packages/api/schema.ts (TimetableDataSchema)
- Timetable entity: packages/api/src/entity/Timetable.ts
- Timetable service: packages/api/src/services/timetable.service.ts
- Existing store pattern: packages/web/src/stores/uiStore.ts

## Requirements

### 1. TypeScript Types (features/schedule/types.ts)
Define interfaces matching solver output:
- ScheduledLesson: day, periodIndex, classId, className, subjectId, subjectName, teacherIds, teacherNames, roomId, roomName, isFixed
- SolutionMetadata: classes[], subjects[], teachers[], periodConfiguration
- SolutionStatistics: totalClasses, totalLessons, solveTimeSeconds, etc.
- ScheduleIndexes: bySlot, byTeacherAndSlot, byRoomAndSlot, byClassAndSlot, byTeacher, byClass, byRoom
- DisplaySettings: showSubjectName, showTeacherName, showRoomName, cellSize, fontSize

### 2. Zustand Store (features/schedule/stores/scheduleStore.ts)
Create store with:
- State: scheduleId, scheduleName, lessons[], indexes, metadata, statistics, teachers Map, rooms Map, classes Map, subjects Map
- Actions: loadSchedule(id), clearSchedule(), updateIndexes()
- Use immer middleware for immutable updates
- Follow existing uiStore.ts patterns

### 3. Index Builder Utility (features/schedule/utils/indexBuilder.ts)
Functions:
- buildIndexes(lessons: ScheduledLesson[]): ScheduleIndexes
- Key format: "${day}-${periodIndex}" for slots, "${entityId}-${day}-${periodIndex}" for entity+slot
- Must handle multi-teacher lessons (lesson.teacherIds is array)

### 4. Schedule Transformer (features/schedule/utils/scheduleTransformer.ts)
Functions:
- normalizeSchedule(apiResponse): { lessons, metadata, statistics }
- Transform API response to store format
- Parse JSON data field from timetable entity

### 5. TanStack Query Hooks (features/schedule/hooks/)
- useSchedule(id): Fetch single schedule, transform, return { data, isLoading, error }
- useSchedules(): Fetch all schedules list (for dashboard)
- useSaveSchedule(): Mutation to save schedule changes
- useDeleteSchedule(): Mutation to delete schedule
- Use query keys: ['schedule', id], ['schedules']
- Invalidate appropriately on mutations

### 6. Constants (features/schedule/constants.ts)
- DAYS_OF_WEEK: Array with Persian names and enum values
- GRADE_CATEGORIES: Alpha-Primary, Beta-Primary, Middle, High with Persian translations
- CONSTRAINT_TYPES: Enum of all constraint types

## Technical Constraints
- All user-facing strings must use i18n (t() function)
- Follow existing feature module pattern (see features/teachers/)
- Use Zod for runtime validation where needed
- Indexes must support O(1) lookups for performance with 700+ lessons

## Acceptance Criteria
- Store initializes correctly
- loadSchedule fetches and normalizes data
- All indexes built correctly
- Types are strict (no 'any')
- Unit tests for index builder
```

---

### Phase 2: Grid Rendering & View System

**Duration:** 4-5 days **Dependencies:** Phase 1 **Deliverables:** ScheduleGrid
component, Class view, Teacher view, view switching

#### Objectives

1. Create reusable ScheduleGrid component
2. Implement Class view with grade category grouping
3. Implement Teacher view with tab navigation
4. Enable view switching with shared state
5. Render cells with lesson data

#### Technical Requirements

**Grid Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│         │ Period 1 │ Period 2 │ Period 3 │ ... │ Period N │
├─────────┼──────────┼──────────┼──────────┼─────┼──────────┤
│ شنبه    │  Cell    │  Cell    │  Cell    │     │  Cell    │
│ یکشنبه  │  Cell    │  Cell    │  Cell    │     │  Cell    │
│ دوشنبه  │  Cell    │  Cell    │  Cell    │     │  Cell    │
│ ...     │          │          │          │     │          │
└─────────────────────────────────────────────────────────────┘
```

**Class View Hierarchy:**

```
Classes Schedule Page
├── CategoryAccordion: Alpha-Primary (ابتداییه دوره اول)
│   ├── ClassTab: Grade 1-A
│   ├── ClassTab: Grade 1-B
│   └── ...
├── CategoryAccordion: Beta-Primary (ابتداییه دوره دوم)
├── CategoryAccordion: Middle (متوسطه)
└── CategoryAccordion: High (لیسه)
```

**Teacher View:**

```
Teachers Schedule Page
├── TeacherTabs: All | Ahmad | Shafiq | Karim | ...
└── ScheduleGrid (filtered by selected teacher)
```

#### Files to Create

```
features/schedule/
├── components/
│   ├── grid/
│   │   ├── ScheduleGrid.tsx        # Main grid container
│   │   ├── ScheduleHeader.tsx      # Period column headers
│   │   ├── ScheduleRow.tsx         # Single day row
│   │   ├── ScheduleCell.tsx        # Individual cell
│   │   └── CellContent.tsx         # Cell inner content
│   ├── views/
│   │   ├── ClassScheduleView.tsx   # Class-centric view
│   │   ├── TeacherScheduleView.tsx # Teacher-centric view
│   │   └── ViewSwitcher.tsx        # Toggle between views
│   └── navigation/
│       ├── CategoryAccordion.tsx   # Grade category grouping
│       ├── ClassTabs.tsx           # Class selection tabs
│       └── TeacherTabs.tsx         # Teacher selection tabs
└── hooks/
    └── useScheduleView.ts          # Derived view data from store
```

#### Acceptance Criteria

- [ ] Grid renders correct number of days and periods
- [ ] Cells display lesson information (subject, teacher, room)
- [ ] Class view groups classes by grade category
- [ ] Teacher view shows tabs for each teacher
- [ ] View switching preserves selected schedule
- [ ] RTL layout correct (days on right, periods flow left)
- [ ] Empty state shown when no schedule loaded

---

#### Kiro Spec Prompt: Phase 2

```
Create a Kiro spec for the Schedule Feature - Phase 2: Grid Rendering & View System.

## Context
Building on Phase 1's data layer, this phase creates the visual grid components for displaying schedules. The app is RTL-first (Persian/Dari) and runs as an Electron desktop app.

## Existing Code References
- Phase 1 store: features/schedule/stores/scheduleStore.ts
- Phase 1 types: features/schedule/types.ts
- UI components: packages/web/src/components/ui/ (shadcn/ui)
- Layout pattern: packages/web/src/components/layout/
- Existing tabs: components/ui/tabs.tsx
- Existing accordion: components/ui/accordion.tsx

## Requirements

### 1. ScheduleGrid Component (features/schedule/components/grid/ScheduleGrid.tsx)
Props:
- lessons: ScheduledLesson[] (filtered for current view)
- days: DayOfWeek[] (from config)
- periodsPerDay: number | Map<DayOfWeek, number> (supports variable periods)
- displaySettings: DisplaySettings
- onCellClick?: (day, period, lesson) => void (for future editing)
- isReadOnly?: boolean

Structure:
- CSS Grid layout (not HTML table)
- Sticky header row for period numbers
- Sticky first column for day names
- Responsive cell sizing

### 2. ScheduleCell Component (features/schedule/components/grid/ScheduleCell.tsx)
Props:
- lesson: ScheduledLesson | null
- displaySettings: DisplaySettings
- isSelected?: boolean
- isFocused?: boolean
- validationStatus?: 'valid' | 'warning' | 'blocked' | null

Display:
- Subject name (always visible, prominent)
- Teacher name (configurable, smaller font)
- Room name (configurable, smallest font)
- Visual states: normal, selected, focused, hover
- Color coding based on subject or teacher (optional)

### 3. ClassScheduleView (features/schedule/components/views/ClassScheduleView.tsx)
Layout:
- Left sidebar: CategoryAccordion with class list
- Main area: ScheduleGrid for selected class

Features:
- Group classes by category (Alpha-Primary, Beta-Primary, Middle, High)
- Accordion expands to show classes in category
- Click class to view its schedule
- Show class metadata (student count, single-teacher badge)
- Persian category names from constants

### 4. TeacherScheduleView (features/schedule/components/views/TeacherScheduleView.tsx)
Layout:
- Top: TeacherTabs (horizontal scrollable)
- Main area: ScheduleGrid for selected teacher

Features:
- "All" tab shows combined view (read-only)
- Individual teacher tabs show their schedule
- Show teacher metadata (subject badges, period count)
- Highlight cells where teacher is assigned

### 5. CategoryAccordion (features/schedule/components/navigation/CategoryAccordion.tsx)
Props:
- categories: { name: string, nameFa: string, classes: ClassMetadata[] }[]
- selectedClassId: string | null
- onSelectClass: (classId: string) => void

Features:
- Collapsible sections per category
- Class count badge per category
- Single-teacher mode indicator for Alpha-Primary classes

### 6. useScheduleView Hook (features/schedule/hooks/useScheduleView.ts)
Returns:
- currentView: 'class' | 'teacher'
- currentViewId: string (classId or teacherId)
- filteredLessons: ScheduledLesson[] (for current view)
- setView: (view, id) => void
- availableClasses: ClassMetadata[] (grouped by category)
- availableTeachers: TeacherMetadata[]

Logic:
- Derive filtered lessons from store indexes
- Use byClass or byTeacher index based on view
- Memoize filtered results

### 7. Route Pages Update
Update existing placeholder pages:
- routes/classes-schedule.tsx → render ClassScheduleView
- routes/teachers-schedule.tsx → render TeacherScheduleView

## Technical Constraints
- Use CSS Grid for layout (better performance than flexbox for grids)
- Memoize cell components (React.memo) for performance with 700+ cells
- Support variable periods per day (some days may have fewer periods)
- All text via i18n
- RTL layout: days column on right, periods flow right-to-left
- Use Tailwind CSS with logical properties (ms-, me-, ps-, pe-)

## Acceptance Criteria
- Grid renders 6 days × 8 periods correctly
- Cells show subject/teacher/room based on settings
- Class view groups by 4 categories
- Teacher view has scrollable tabs
- View switching is instant (no re-fetch)
- Performance: <16ms render for full grid
```

---

### Phase 3: Dashboard & Schedule Management

**Duration:** 3-4 days **Dependencies:** Phase 2 **Deliverables:** Dashboard
page, generation history, save/delete, statistics

#### Objectives

1. Build Schedule Dashboard page
2. Display generation history (saved schedules list)
3. Implement generate button → solver API
4. Add save/delete operations
5. Show schedule statistics and analytics

#### Technical Requirements

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Schedule Dashboard                              [Generate]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Total       │ │ Classes     │ │ Teachers    │            │
│ │ Schedules   │ │ Scheduled   │ │ Assigned    │            │
│ │     5       │ │     24      │ │     18      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ Saved Schedules                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Name          │ Created    │ Status   │ Actions       │  │
│ │ Schedule v1   │ 2024-12-20 │ Active   │ Load │ Delete │  │
│ │ Schedule v2   │ 2024-12-21 │ Draft    │ Load │ Delete │  │
│ └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Files to Create

```
features/schedule/
├── components/
│   └── dashboard/
│       ├── ScheduleDashboard.tsx    # Main dashboard container
│       ├── StatsCards.tsx           # Statistics cards row
│       ├── ScheduleList.tsx         # Saved schedules table
│       ├── ScheduleListItem.tsx     # Single schedule row
│       ├── GenerateButton.tsx       # Generate new schedule
│       └── GenerationProgress.tsx   # Progress during generation
└── hooks/
    ├── useGenerateSchedule.ts       # Mutation for solver API
    └── useScheduleStats.ts          # Computed statistics
```

#### Acceptance Criteria

- [ ] Dashboard shows statistics cards
- [ ] Saved schedules list with load/delete actions
- [ ] Generate button triggers solver API
- [ ] Progress indicator during generation
- [ ] Success/error toast notifications
- [ ] Load schedule navigates to class/teacher view
- [ ] Delete shows confirmation dialog
- [ ] Generation count tracked for license

---

#### Kiro Spec Prompt: Phase 3

````
Create a Kiro spec for the Schedule Feature - Phase 3: Dashboard & Schedule Management.

## Context
The dashboard is the control center for schedule generation and management. Users generate schedules via the solver, view history, and manage saved schedules.

## Existing Code References
- Generate API: packages/api/src/routes/generate.routes.ts (POST /generate)
- Timetable API: packages/api/src/routes/timetable.routes.ts
- Solver service: packages/api/src/services/solver.service.ts
- Toast notifications: sonner (already installed)
- Card component: components/ui/card.tsx
- Table component: components/ui/table.tsx
- Dialog component: components/ui/dialog.tsx

## Requirements

### 1. ScheduleDashboard Component (features/schedule/components/dashboard/ScheduleDashboard.tsx)
Layout:
- Header with title and Generate button
- Stats cards row (3-4 cards)
- Saved schedules table
- Settings panel (collapsible)

### 2. StatsCards Component (features/schedule/components/dashboard/StatsCards.tsx)
Cards to display:
- Total Saved Schedules (count)
- Total Classes Scheduled (from current/latest schedule)
- Total Teachers Assigned
- Last Generated (timestamp)
- Generation Count (for license tracking)

Use shadcn Card component with icon, value, label.

### 3. ScheduleList Component (features/schedule/components/dashboard/ScheduleList.tsx)
Table columns:
- Name (editable inline)
- Created Date
- Status (Active/Draft/Archived)
- Classes Count
- Actions (Load, Delete)

Features:
- Sort by date (newest first)
- Empty state when no schedules
- Pagination if >10 schedules

### 4. GenerateButton Component (features/schedule/components/dashboard/GenerateButton.tsx)
Behavior:
- Click opens confirmation dialog
- Shows strategy selector (Fast/Balanced/Thorough)
- Displays estimated time based on strategy
- Triggers POST /api/generate
- Shows progress during generation
- On success: save to database, show toast, optionally load

### 5. GenerationProgress Component (features/schedule/components/dashboard/GenerationProgress.tsx)
Display during generation:
- Progress bar (if solver reports progress)
- Current phase text
- Elapsed time
- Cancel button (if supported)

### 6. useGenerateSchedule Hook (features/schedule/hooks/useGenerateSchedule.ts)
Mutation that:
- Collects all required data (teachers, subjects, classes, rooms, config)
- Calls POST /api/generate
- Handles progress events (if streaming)
- On success: invalidates schedules query, returns result
- On error: shows appropriate error message

### 7. useScheduleStats Hook (features/schedule/hooks/useScheduleStats.ts)
Computes from store:
- totalSchedules: number
- totalClasses: number (from metadata)
- totalTeachers: number
- totalLessons: number
- generationCount: number (from API/license)

### 8. Delete Confirmation Dialog
- "Are you sure?" message in Persian
- Shows schedule name
- Confirm/Cancel buttons
- On confirm: call delete mutation, show toast

### 9. Route Page Update
Update routes/schedule-dashboard.tsx to render ScheduleDashboard.

## API Integration

### Generate Schedule
```typescript
POST /api/generate
Body: { strategy: 'fast' | 'balanced' | 'thorough' }
Response: { success: boolean, schedule: ScheduledLesson[], metadata, statistics }
````

### Save Schedule

```typescript
POST /api/timetables
Body: { name: string, data: { schedule, metadata, statistics } }
Response: { id: number, ... }
```

### Delete Schedule

```typescript
DELETE /api/timetables/:id
Response: { success: boolean }
```

## Technical Constraints

- Generation can take 30s-300s depending on strategy
- Show loading state, don't block UI
- Track generation count for license enforcement
- All text via i18n
- Use optimistic updates where appropriate

## Acceptance Criteria

- Stats cards show correct values
- Schedule list loads and displays
- Generate triggers solver and shows progress
- Save creates new timetable record
- Delete removes with confirmation
- Toast notifications for all actions
- Error states handled gracefully

```

---

### Phase 4: Display Customization

**Duration:** 2-3 days
**Dependencies:** Phase 2
**Deliverables:** Settings dialog, cell content toggles, localStorage persistence

#### Objectives

1. Create display settings dialog
2. Implement cell content toggles (subject/teacher/room visibility)
3. Add font size and cell size options
4. Persist settings to localStorage
5. Apply settings to both views

#### Files to Create

```

features/schedule/ ├── components/ │ └── settings/ │ ├──
DisplaySettingsDialog.tsx # Settings modal │ ├── CellContentToggles.tsx #
Checkboxes for visibility │ ├── SizeSelector.tsx # Font/cell size options │ └──
PresetButtons.tsx # Quick presets └── hooks/ └── useDisplaySettings.ts #
Settings state + persistence

```

#### Acceptance Criteria

- [ ] Settings dialog opens from dashboard/header
- [ ] Toggle subject/teacher/room visibility
- [ ] Font size options (small/medium/large)
- [ ] Cell size options (compact/normal/large)
- [ ] Settings persist across sessions
- [ ] Changes apply immediately to grid
- [ ] Preset buttons for common configurations

---

#### Kiro Spec Prompt: Phase 4

```

Create a Kiro spec for the Schedule Feature - Phase 4: Display Customization.

## Context

Users need to customize how schedule cells display information. Settings should
persist and apply to both class and teacher views.

## Existing Code References

- Dialog component: components/ui/dialog.tsx
- Switch component: components/ui/switch.tsx
- Select component: components/ui/select.tsx
- Label component: components/ui/label.tsx
- Existing settings pattern: features/settings/

## Requirements

### 1. DisplaySettings Type (add to types.ts)

```typescript
interface DisplaySettings {
  // Cell content visibility
  showSubjectName: boolean; // Always true, not toggleable
  showTeacherName: boolean; // Default: true
  showRoomName: boolean; // Default: true

  // Styling
  cellSize: 'compact' | 'normal' | 'large';
  fontSize: 'sm' | 'md' | 'lg';

  // Color coding
  colorBy: 'none' | 'subject' | 'teacher';

  // View-specific (optional overrides)
  classViewOverrides?: Partial<DisplaySettings>;
  teacherViewOverrides?: Partial<DisplaySettings>;
}
```

### 2. DisplaySettingsDialog Component

Sections:

- Cell Content: toggles for teacher name, room name
- Appearance: cell size selector, font size selector
- Color Coding: radio for none/subject/teacher
- Presets: "Full Detail", "Compact", "Print-Friendly"

### 3. useDisplaySettings Hook

Features:

- Load from localStorage on mount
- Save to localStorage on change (debounced)
- Provide current settings
- Provide update function
- Merge view-specific overrides

Storage key: 'maktab-schedule-display-settings'

### 4. Apply Settings to Grid

- ScheduleCell receives displaySettings prop
- Conditionally render teacher/room based on settings
- Apply font size classes: text-sm, text-base, text-lg
- Apply cell size via CSS variables or classes

### 5. Preset Configurations

- Full Detail: all visible, normal size, md font
- Compact: teacher only, compact size, sm font
- Print-Friendly: all visible, large size, lg font

## Technical Constraints

- Settings must apply without page reload
- Use CSS variables for dynamic sizing
- Debounce localStorage writes (300ms)
- Default settings if localStorage empty

## Acceptance Criteria

- Dialog opens and closes correctly
- Toggles update grid immediately
- Settings persist after page refresh
- Presets apply all settings at once
- Both views respect settings

```

---

### Phase 5: Export System

**Duration:** 4-5 days
**Dependencies:** Phase 2, Phase 4
**Deliverables:** Export dialog, PDF generation, Excel generation, batch export

#### Objectives

1. Create export dialog with options
2. Implement PDF export with RTL support
3. Implement Excel export
4. Support single and batch export
5. Handle Persian text correctly

#### Technical Requirements

**Export Options:**
- Format: PDF or Excel
- Scope: Single class/teacher or All
- Language: Persian or English
- Apply current display settings

**Backend Approach (Recommended):**
- Frontend sends export request to API
- Backend generates file (better RTL handling)
- Returns download URL
- Frontend triggers download

#### Files to Create

```

features/schedule/ ├── components/ │ └── export/ │ ├── ExportDialog.tsx # Export
options modal │ ├── ExportFormatSelect.tsx # PDF/Excel selector │ ├──
ExportScopeSelect.tsx # Single/All selector │ └── ExportProgress.tsx # Progress
for batch └── hooks/ └── useExportSchedule.ts # Export mutation

# Backend additions

packages/api/src/ ├── routes/ │ └── export.routes.ts # Export endpoints └──
services/ └── export.service.ts # PDF/Excel generation

```

#### Acceptance Criteria

- [ ] Export dialog with format/scope/language options
- [ ] PDF exports with correct RTL layout
- [ ] Excel exports with proper column headers
- [ ] Persian text renders correctly
- [ ] Batch export shows progress
- [ ] Downloaded files open correctly
- [ ] Display settings applied to export

---

#### Kiro Spec Prompt: Phase 5

```

Create a Kiro spec for the Schedule Feature - Phase 5: Export System.

## Context

Users need to export schedules to PDF and Excel for printing and sharing.
Persian/Dari text with RTL layout must be handled correctly.

## Existing Code References

- Display settings: features/schedule/hooks/useDisplaySettings.ts
- API patterns: packages/api/src/routes/

## Requirements

### 1. ExportDialog Component (features/schedule/components/export/ExportDialog.tsx)

Options:

- Format: PDF | Excel (radio buttons)
- Scope: Current Class/Teacher | All Classes | All Teachers
- Language: Persian | English
- Include: checkboxes matching display settings
- Paper size (PDF only): A4 | Letter | A3

### 2. useExportSchedule Hook (features/schedule/hooks/useExportSchedule.ts)

```typescript
interface ExportRequest {
  scheduleId: number;
  format: 'pdf' | 'excel';
  scope: 'single' | 'all-classes' | 'all-teachers';
  targetType: 'class' | 'teacher';
  targetId?: string;
  language: 'fa' | 'en';
  displaySettings: DisplaySettings;
  paperSize?: 'a4' | 'letter' | 'a3';
}

interface ExportResponse {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}
```

Mutation:

- POST /api/timetables/:id/export
- Returns download URL
- Trigger browser download
- Handle progress for batch

### 3. Backend Export Routes (packages/api/src/routes/export.routes.ts)

```typescript
POST /api/timetables/:id/export
Body: ExportRequest
Response: ExportResponse
```

### 4. Backend Export Service (packages/api/src/services/export.service.ts)

PDF Generation:

- Use puppeteer or pdfkit with RTL support
- Embed Vazirmatn font for Persian
- Generate HTML template → PDF
- Table layout matching grid

Excel Generation:

- Use exceljs library
- RTL worksheet direction
- Styled headers
- One sheet per class/teacher (batch)

### 5. Export Progress Component

For batch exports:

- Show "Exporting 1 of 24..."
- Progress bar
- Cancel button
- Completion notification

### 6. File Naming Convention

Pattern: `schedule_{type}_{name}_{lang}_{date}.{ext}` Example:
`schedule_class_10A_fa_2024-12-22.pdf`

## Technical Constraints

- PDF must embed Persian font (Vazirmatn)
- Excel RTL: set worksheet.views[0].rightToLeft = true
- Batch export: generate ZIP file with all PDFs/sheets
- Clean up generated files after download (or use temp URLs)
- Max batch size: 50 files

## Acceptance Criteria

- PDF opens with correct RTL layout
- Persian text renders correctly (not boxes)
- Excel opens in Excel/LibreOffice correctly
- Batch export creates ZIP with all files
- Progress shown for batch operations
- Files download with correct names

```

---

```

### Phase 6: Manual Editing Foundation

**Duration:** 5-6 days **Dependencies:** Phase 2 **Deliverables:** Drag-drop
setup, keyboard navigation, focus management, selection state

#### Objectives

1. Set up dnd-kit for drag-drop
2. Implement keyboard navigation (arrow keys)
3. Add focus management and indicators
4. Create selection state (first step of swap)
5. Visual feedback for focused/selected cells

#### Technical Requirements

**Interaction Model:**

- Arrow keys navigate focus between cells
- Enter/Space selects cell for swap
- Escape cancels selection
- Tab moves to next interactive element
- Drag also initiates selection

**State Additions to Store:**

```typescript
interface InteractionState {
  interactionMode: 'idle' | 'selecting' | 'previewing' | 'executing';
  focusedSlot: { day: DayOfWeek; period: number } | null;
  selectedLesson: ScheduledLesson | null;
  isLocked: boolean; // Prevent concurrent edits
}
```

#### Files to Create

```
features/schedule/
├── components/
│   └── grid/
│       ├── DraggableCell.tsx       # dnd-kit draggable wrapper
│       ├── DroppableCell.tsx       # dnd-kit droppable wrapper
│       └── FocusIndicator.tsx      # Visual focus ring
├── hooks/
│   ├── useKeyboardNavigation.ts    # Arrow key handling
│   ├── useCellSelection.ts         # Selection logic
│   └── useDragDrop.ts              # dnd-kit setup
└── stores/
    └── interactionStore.ts         # Or extend scheduleStore
```

#### Acceptance Criteria

- [ ] Arrow keys move focus between cells
- [ ] Focus indicator visible on current cell
- [ ] Enter selects cell, shows selection state
- [ ] Escape cancels selection
- [ ] Drag initiates selection
- [ ] Lock prevents other interactions during selection
- [ ] RTL navigation correct (left = next day)

---

#### Kiro Spec Prompt: Phase 6

````
Create a Kiro spec for the Schedule Feature - Phase 6: Manual Editing Foundation.

## Context
This phase establishes the interaction foundation for manual schedule editing. Users will navigate with keyboard and mouse, select cells, and prepare for swap operations.

## Existing Code References
- dnd-kit: already in package.json (@dnd-kit/core, @dnd-kit/sortable)
- Schedule store: features/schedule/stores/scheduleStore.ts
- ScheduleCell: features/schedule/components/grid/ScheduleCell.tsx

## Requirements

### 1. Extend Schedule Store with Interaction State
Add to scheduleStore.ts:
```typescript
interface InteractionState {
  interactionMode: 'idle' | 'selecting' | 'previewing' | 'executing';
  focusedSlot: { day: DayOfWeek; period: number } | null;
  selectedLesson: ScheduledLesson | null;
  isLocked: boolean;
}

// Actions
setFocusedSlot: (slot) => void;
selectLesson: (lesson) => void;
cancelSelection: () => void;
setLocked: (locked) => void;
````

### 2. useKeyboardNavigation Hook

Features:

- Listen for arrow keys when grid is focused
- ArrowUp: previous period (period - 1)
- ArrowDown: next period (period + 1)
- ArrowLeft: next day (RTL: left = forward)
- ArrowRight: previous day (RTL: right = backward)
- Wrap at boundaries or stop
- Update focusedSlot in store

Implementation:

- Use useEffect with keydown listener
- Only active when grid container is focused
- Respect isLocked state

### 3. useCellSelection Hook

Features:

- Enter/Space on focused cell → select lesson
- If already selected, Enter on different cell → initiate swap (Phase 7)
- Escape → cancel selection
- Track selection in store

### 4. useDragDrop Hook

Setup dnd-kit:

- DndContext provider at grid level
- Each cell is both draggable and droppable
- onDragStart → select lesson, set locked
- onDragEnd → initiate swap or cancel
- onDragCancel → cancel selection, unlock

### 5. DraggableCell Component

Wrap ScheduleCell with dnd-kit draggable:

- useDraggable hook
- Drag handle (entire cell or icon)
- Visual feedback during drag (opacity, scale)
- Disabled when isLocked and not the dragged item

### 6. DroppableCell Component

Wrap cell area with dnd-kit droppable:

- useDroppable hook
- isOver state for hover feedback
- Accept drops from same view scope only

### 7. FocusIndicator Component

Visual focus ring:

- Positioned absolutely over focused cell
- Animated border (subtle pulse or solid ring)
- High contrast for accessibility
- Hidden when not focused

### 8. Update ScheduleCell

Add props:

- isFocused: boolean
- isSelected: boolean
- isDragging: boolean
- isDropTarget: boolean

Apply visual states:

- Focused: ring-2 ring-primary
- Selected: ring-2 ring-primary bg-primary/10
- Dragging: opacity-50 scale-95
- Drop target: bg-primary/5

### 9. Grid Container Focus

- Grid container must be focusable (tabIndex={0})
- Auto-focus first cell on mount (optional)
- Trap focus within grid during selection

## Technical Constraints

- Keyboard navigation must work without mouse
- RTL: left arrow = next day, right arrow = previous day
- Performance: don't re-render entire grid on focus change
- Accessibility: focus visible, ARIA attributes

## Acceptance Criteria

- Arrow keys navigate focus correctly (RTL)
- Focus indicator visible and accessible
- Enter selects, Escape cancels
- Drag starts selection
- Lock prevents other interactions
- All states visually distinct

````

---

### Phase 7: Swap Validation Engine

**Duration:** 5-6 days
**Dependencies:** Phase 6
**Deliverables:** Constraint checker, valid targets computation, visual feedback, swap preview

#### Objectives

1. Build constraint checking engine
2. Compute valid swap targets on selection
3. Show green/yellow/red visual feedback
4. Implement swap preview (ghost state)
5. Create warning dialog for soft violations

#### Technical Requirements

**Constraint Checker:**
```typescript
function validateSwap(
  swap: SwapOperation,
  indexes: ScheduleIndexes,
  teachers: Map<string, Teacher>,
  rooms: Map<string, Room>
): SwapValidationResult {
  // Check all constraints for both lessons
  // Return { isValid, errors[], warnings[] }
}
````

**Valid Targets Computation:**

- On selection, compute ALL valid targets
- Cache results in state
- Use indexes for O(1) lookups
- Scope by view (class or teacher)

**Visual Feedback:**

- GREEN: All constraints pass → immediate swap
- YELLOW: Soft constraints violated → warning dialog
- RED: Hard constraints violated → blocked

#### Files to Create

```
features/schedule/
├── components/
│   ├── grid/
│   │   └── SwapIndicator.tsx       # Green/yellow/red overlay
│   ├── dialogs/
│   │   ├── SwapWarningDialog.tsx   # Soft violation confirmation
│   │   └── SwapBlockedDialog.tsx   # Hard violation explanation
│   └── preview/
│       └── SwapPreview.tsx         # Ghost state preview
├── utils/
│   └── constraintChecker.ts        # All constraint logic
└── hooks/
    ├── useSwapValidation.ts        # Validate single swap
    └── useValidSwapTargets.ts      # Compute all valid targets
```

#### Acceptance Criteria

- [ ] Constraint checker validates all constraint types
- [ ] Valid targets computed on selection
- [ ] Green/yellow/red indicators on cells
- [ ] Preview shows what will change
- [ ] Warning dialog for soft violations
- [ ] Blocked dialog explains why
- [ ] Performance: <100ms for 700 lessons

---

#### Kiro Spec Prompt: Phase 7

````
Create a Kiro spec for the Schedule Feature - Phase 7: Swap Validation Engine.

## Context
This is the core complexity of manual editing. When a user selects a lesson, we must compute which other lessons can be swapped with it, checking all constraints.

## Existing Code References
- Schedule indexes: features/schedule/utils/indexBuilder.ts
- Interaction state: features/schedule/stores/scheduleStore.ts
- Teacher availability: packages/api/schema.ts (Teacher.availability)
- Constraint definitions: packages/solver/solver_enhanced.py

## Requirements

### 1. Constraint Types (features/schedule/constants.ts)
```typescript
const CONSTRAINT_TYPES = {
  // Hard constraints (block swap)
  TEACHER_UNAVAILABLE: { severity: 'hard', code: 'teacher_unavailable' },
  TEACHER_CONFLICT: { severity: 'hard', code: 'teacher_conflict' },
  ROOM_CONFLICT: { severity: 'hard', code: 'room_conflict' },
  CLASS_CONFLICT: { severity: 'hard', code: 'class_conflict' },
  ROOM_TYPE_MISMATCH: { severity: 'hard', code: 'room_type_mismatch' },

  // Soft constraints (warning)
  TEACHER_PREFERENCE: { severity: 'soft', code: 'teacher_preference' },
  CONSECUTIVE_EXCEEDED: { severity: 'soft', code: 'consecutive_exceeded' },
  DIFFICULT_AFTERNOON: { severity: 'soft', code: 'difficult_afternoon' },
} as const;
````

### 2. Constraint Checker (features/schedule/utils/constraintChecker.ts)

```typescript
interface SwapOperation {
  lessonA: ScheduledLesson;
  lessonB: ScheduledLesson;
  slotA: { day: DayOfWeek; period: number };
  slotB: { day: DayOfWeek; period: number };
}

interface ConstraintViolation {
  type: string;
  severity: 'hard' | 'soft';
  message: string; // Persian message
  details: Record<string, any>;
}

interface SwapValidationResult {
  isValid: boolean;
  canProceedWithWarning: boolean;
  errors: ConstraintViolation[]; // Hard violations
  warnings: ConstraintViolation[]; // Soft violations
  swap: SwapOperation;
}

function validateSwap(
  swap: SwapOperation,
  indexes: ScheduleIndexes,
  teachers: Map<string, Teacher>,
  rooms: Map<string, Room>,
  subjects: Map<string, Subject>
): SwapValidationResult;
```

Individual check functions:

- checkTeacherAvailability(lesson, targetSlot, teacher): ConstraintViolation |
  null
- checkTeacherConflict(lesson, targetSlot, indexes, excludeLesson):
  ConstraintViolation | null
- checkRoomConflict(lesson, targetSlot, indexes, excludeLesson):
  ConstraintViolation | null
- checkRoomTypeMismatch(lesson, targetSlot, room, subject): ConstraintViolation
  | null
- checkTeacherPreference(lesson, targetSlot, teacher): ConstraintViolation |
  null
- checkConsecutivePeriods(lesson, targetSlot, indexes, teacher):
  ConstraintViolation | null

### 3. useValidSwapTargets Hook

```typescript
function useValidSwapTargets(
  selectedLesson: ScheduledLesson | null,
  viewScope: 'class' | 'teacher',
  scopeId: string
): Map<string, SwapValidationResult>;
```

Logic:

- If no selection, return empty map
- Get potential targets from indexes (byClass or byTeacher)
- Exclude selected lesson itself
- Validate each potential swap
- Return map: slotKey → validation result
- Memoize with useMemo

### 4. SwapIndicator Component

Overlay on each cell showing validation status:

- Props: status: 'valid' | 'warning' | 'blocked' | null
- Valid (green): bg-green-500/20, border-green-500
- Warning (yellow): bg-yellow-500/20, border-yellow-500
- Blocked (red): bg-red-500/20, border-red-500
- Null: no overlay

### 5. SwapPreview Component

Ghost preview of swap result:

- Show source lesson at target position (faded)
- Show target lesson at source position (faded)
- Animate transition
- Display alongside current state

### 6. SwapWarningDialog Component

For soft constraint violations:

- Title: "هشدار جابجایی" (Swap Warning)
- List all warnings with icons
- "ادامه" (Continue) and "لغو" (Cancel) buttons
- Checkbox: "Don't show again for this session" (optional)

### 7. SwapBlockedDialog Component

For hard constraint violations:

- Title: "جابجایی ممکن نیست" (Swap Not Possible)
- List all errors with explanations
- "متوجه شدم" (Understood) button
- Suggest alternatives if possible

### 8. Update ScheduleCell

Add prop: validationStatus from useValidSwapTargets Render SwapIndicator based
on status

## Technical Constraints

- Validation must complete in <100ms for 700 lessons
- Use indexes for O(1) lookups, not array scans
- Cache validation results during selection
- Messages must be in Persian via i18n
- Handle multi-teacher lessons (check ALL teachers)

## Acceptance Criteria

- All constraint types checked correctly
- Valid targets computed in <100ms
- Visual feedback matches validation
- Warning dialog shows for soft violations
- Blocked dialog explains hard violations
- Preview shows swap result accurately

````

---

### Phase 8: Undo/Redo & Persistence

**Duration:** 3-4 days
**Dependencies:** Phase 7
**Deliverables:** Swap execution, undo/redo stack, unsaved changes tracking, save flow

#### Objectives

1. Execute confirmed swaps
2. Implement undo/redo command stack
3. Track unsaved changes with badge
4. Page leave warning for unsaved changes
5. Save to database flow

#### Technical Requirements

**Command Stack:**
```typescript
interface SwapAction {
  id: string;
  timestamp: number;
  type: 'swap';
  before: { lessonA: ScheduledLesson; lessonB: ScheduledLesson };
  after: { lessonA: ScheduledLesson; lessonB: ScheduledLesson };
}

// Undo: restore 'before' state
// Redo: restore 'after' state
````

**Unsaved Changes:**

- Count = undoStack.length since last save
- Badge shows count next to Save button
- Warning on page leave if count > 0

#### Files to Create

```
features/schedule/
├── components/
│   ├── header/
│   │   ├── UndoRedoButtons.tsx     # Undo/Redo with shortcuts
│   │   ├── SaveButton.tsx          # Save with unsaved badge
│   │   └── UnsavedBadge.tsx        # Count indicator
│   └── dialogs/
│       └── UnsavedChangesDialog.tsx # Leave confirmation
├── hooks/
│   ├── useSwapExecution.ts         # Execute swap, update indexes
│   ├── useUndoRedo.ts              # Undo/redo logic
│   └── useUnsavedChanges.ts        # Track changes, warn on leave
└── stores/
    └── (extend scheduleStore)      # Add undoStack, redoStack
```

#### Acceptance Criteria

- [ ] Swap executes and updates grid
- [ ] Undo reverses last swap
- [ ] Redo re-applies undone swap
- [ ] Ctrl+Z/Ctrl+Y shortcuts work
- [ ] Unsaved badge shows count
- [ ] Page leave shows warning
- [ ] Save clears unsaved state
- [ ] Stack limit (50 actions)

---

#### Kiro Spec Prompt: Phase 8

````
Create a Kiro spec for the Schedule Feature - Phase 8: Undo/Redo & Persistence.

## Context
After swap validation (Phase 7), this phase implements the actual swap execution, undo/redo functionality, and persistence to the database.

## Existing Code References
- Schedule store: features/schedule/stores/scheduleStore.ts
- Index updater: features/schedule/utils/indexBuilder.ts
- Save mutation: features/schedule/hooks/useSaveSchedule.ts
- Timetable API: packages/api/src/routes/timetable.routes.ts

## Requirements

### 1. Extend Schedule Store
Add to scheduleStore.ts:
```typescript
interface EditState {
  originalLessons: ScheduledLesson[];  // Snapshot from last save
  undoStack: SwapAction[];
  redoStack: SwapAction[];
  lastSavedAt: Date | null;
}

interface SwapAction {
  id: string;
  timestamp: number;
  type: 'swap';
  before: {
    lessonA: ScheduledLesson;
    lessonB: ScheduledLesson;
  };
  after: {
    lessonA: ScheduledLesson;
    lessonB: ScheduledLesson;
  };
}

// Computed
get unsavedChangesCount(): number;
get hasUnsavedChanges(): boolean;

// Actions
executeSwap: (swap: SwapOperation) => void;
undo: () => void;
redo: () => void;
markAsSaved: () => void;
````

### 2. useSwapExecution Hook

```typescript
function useSwapExecution() {
  return {
    executeSwap: (validatedSwap: SwapValidationResult) => void;
    isExecuting: boolean;
  };
}
```

Logic:

1. Create SwapAction with before/after states
2. Update lessons array (swap positions)
3. Update indexes incrementally
4. Push to undoStack
5. Clear redoStack
6. Set interactionMode to 'idle'

### 3. useUndoRedo Hook

```typescript
function useUndoRedo() {
  return {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
  };
}
```

Undo logic:

1. Pop from undoStack
2. Restore 'before' state to lessons
3. Update indexes
4. Push to redoStack

Redo logic:

1. Pop from redoStack
2. Restore 'after' state to lessons
3. Update indexes
4. Push to undoStack

### 4. Keyboard Shortcuts

Register global shortcuts:

- Ctrl+Z: undo()
- Ctrl+Y: redo()
- Ctrl+Shift+Z: redo() (alternative)
- Ctrl+S: save()

Use useEffect with keydown listener. Only active when schedule page is focused.

### 5. UndoRedoButtons Component

- Undo button with icon, disabled if !canUndo
- Redo button with icon, disabled if !canRedo
- Tooltip showing action description
- Keyboard shortcut hint in tooltip

### 6. SaveButton Component

- Save icon button
- UnsavedBadge showing count
- Disabled if no unsaved changes
- Loading state during save
- Success toast on save

### 7. UnsavedBadge Component

- Small badge with number
- Position: top-right of Save button
- Hidden if count === 0
- Animate on increment

### 8. useUnsavedChanges Hook

```typescript
function useUnsavedChanges() {
  return {
    count: number;
    hasChanges: boolean;
    confirmLeave: () => Promise<boolean>;
  };
}
```

Features:

- Track unsavedChangesCount from store
- Register beforeunload handler
- Show UnsavedChangesDialog on navigation

### 9. UnsavedChangesDialog Component

Shown when:

- User tries to navigate away
- User tries to close window
- User tries to load different schedule

Content:

- "شما X تغییر ذخیره نشده دارید" (You have X unsaved changes)
- "ذخیره و خروج" (Save and Leave)
- "خروج بدون ذخیره" (Leave without Saving)
- "لغو" (Cancel)

### 10. Save Flow

On save:

1. Call useSaveSchedule mutation
2. On success: markAsSaved(), clear undoStack, show toast
3. On error: show error toast, keep state

### 11. Stack Limit

- Maximum 50 actions in undoStack
- When limit reached, remove oldest action
- redoStack cleared on new action

## Technical Constraints

- Undo/redo must be instant (<16ms)
- Indexes must stay in sync
- beforeunload must work in Electron
- Shortcuts must not conflict with browser/OS

## Acceptance Criteria

- Swap executes correctly
- Undo reverses swap
- Redo re-applies swap
- Shortcuts work (Ctrl+Z, Ctrl+Y)
- Badge shows correct count
- Leave warning appears
- Save clears unsaved state
- Stack respects 50 limit

````

---

## 4. Technical Specifications

### Solver Output Schema (Reference)

```typescript
// From packages/solver/models/output.py
interface ScheduledLesson {
  day: DayOfWeek;
  periodIndex: number;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherIds: string[];
  teacherNames?: string[];
  roomId?: string;
  roomName?: string;
  isFixed: boolean;
  periodsThisDay?: number;
}

interface SolutionMetadata {
  classes: ClassMetadata[];
  subjects: SubjectMetadata[];
  teachers: TeacherMetadata[];
  periodConfiguration: PeriodConfiguration;
}

interface SolutionStatistics {
  totalClasses: number;
  singleTeacherClasses: number;
  totalSubjects: number;
  totalTeachers: number;
  totalLessons: number;
  solveTimeSeconds?: number;
  strategy?: string;
}
````

### Grade Categories (Afghanistan)

| Category      | Grades | Persian Name      | Single Teacher |
| ------------- | ------ | ----------------- | -------------- |
| Alpha-Primary | 1-3    | ابتداییه دوره اول | Yes            |
| Beta-Primary  | 4-6    | ابتداییه دوره دوم | No             |
| Middle        | 7-9    | متوسطه            | No             |
| High          | 10-12  | لیسه              | No             |

### Days of Week

| Index | English   | Persian  |
| ----- | --------- | -------- |
| 0     | Saturday  | شنبه     |
| 1     | Sunday    | یکشنبه   |
| 2     | Monday    | دوشنبه   |
| 3     | Tuesday   | سه‌شنبه  |
| 4     | Wednesday | چهارشنبه |
| 5     | Thursday  | پنجشنبه  |

---

## 5. Risk Mitigation

| Risk                          | Impact | Mitigation                                                  |
| ----------------------------- | ------ | ----------------------------------------------------------- |
| Performance with 700+ lessons | High   | Pre-computed indexes, memoization, virtualization if needed |
| Complex constraint logic bugs | High   | Comprehensive unit tests, property-based testing            |
| RTL layout issues             | Medium | Test early with real Persian content, use logical CSS       |
| Export RTL issues             | Medium | Backend generation with proper font embedding               |
| State synchronization         | Medium | Single Zustand store, derived views only                    |
| Undo/redo edge cases          | Medium | Clear action boundaries, immutable updates                  |

---

## Appendix: File Structure Summary

```
packages/web/src/features/schedule/
├── components/
│   ├── grid/
│   │   ├── ScheduleGrid.tsx
│   │   ├── ScheduleHeader.tsx
│   │   ├── ScheduleRow.tsx
│   │   ├── ScheduleCell.tsx
│   │   ├── CellContent.tsx
│   │   ├── DraggableCell.tsx
│   │   ├── DroppableCell.tsx
│   │   ├── FocusIndicator.tsx
│   │   └── SwapIndicator.tsx
│   ├── views/
│   │   ├── ClassScheduleView.tsx
│   │   ├── TeacherScheduleView.tsx
│   │   └── ViewSwitcher.tsx
│   ├── navigation/
│   │   ├── CategoryAccordion.tsx
│   │   ├── ClassTabs.tsx
│   │   └── TeacherTabs.tsx
│   ├── dashboard/
│   │   ├── ScheduleDashboard.tsx
│   │   ├── StatsCards.tsx
│   │   ├── ScheduleList.tsx
│   │   ├── GenerateButton.tsx
│   │   └── GenerationProgress.tsx
│   ├── settings/
│   │   ├── DisplaySettingsDialog.tsx
│   │   ├── CellContentToggles.tsx
│   │   └── PresetButtons.tsx
│   ├── export/
│   │   ├── ExportDialog.tsx
│   │   └── ExportProgress.tsx
│   ├── preview/
│   │   └── SwapPreview.tsx
│   ├── header/
│   │   ├── UndoRedoButtons.tsx
│   │   ├── SaveButton.tsx
│   │   └── UnsavedBadge.tsx
│   └── dialogs/
│       ├── SwapWarningDialog.tsx
│       ├── SwapBlockedDialog.tsx
│       └── UnsavedChangesDialog.tsx
├── hooks/
│   ├── useSchedule.ts
│   ├── useSchedules.ts
│   ├── useSaveSchedule.ts
│   ├── useDeleteSchedule.ts
│   ├── useScheduleView.ts
│   ├── useDisplaySettings.ts
│   ├── useGenerateSchedule.ts
│   ├── useScheduleStats.ts
│   ├── useExportSchedule.ts
│   ├── useKeyboardNavigation.ts
│   ├── useCellSelection.ts
│   ├── useDragDrop.ts
│   ├── useSwapValidation.ts
│   ├── useValidSwapTargets.ts
│   ├── useSwapExecution.ts
│   ├── useUndoRedo.ts
│   └── useUnsavedChanges.ts
├── stores/
│   └── scheduleStore.ts
├── utils/
│   ├── indexBuilder.ts
│   ├── scheduleTransformer.ts
│   └── constraintChecker.ts
├── types.ts
├── constants.ts
└── index.ts
```

---

**Document Version:** 1.0 **Created:** December 2024 **Status:** Ready for
Implementation
