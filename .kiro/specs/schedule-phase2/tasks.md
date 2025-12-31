# Implementation Tasks

## Task 1: Add Phase 2 Types to types.ts

**Requirements:** 1, 2, 5, 6

**Files:**

- `packages/web/src/features/schedule/types.ts`

**Acceptance Criteria:**

- [x] Add `ScheduleViewType` type ('class' | 'teacher')
- [x] Add `CellValidationStatus` type ('valid' | 'warning' | 'blocked' | null)
- [x] Add `ScheduleGridProps` interface
- [x] Add `ScheduleCellProps` interface
- [x] Add `CategoryWithClasses` interface
- [x] Add `CategoryAccordionProps` interface
- [x] Add `TeacherTabsProps` interface
- [x] Add `UseScheduleViewReturn` interface

---

## Task 2: Create ScheduleCell Component

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.2

**Files:**

- `packages/web/src/features/schedule/components/grid/ScheduleCell.tsx`
- `packages/web/src/features/schedule/components/grid/index.ts`

**Acceptance Criteria:**

- [x] Display subject name prominently when showSubjectName is true
- [x] Display teacher name in smaller font when showTeacherName is true
- [x] Display room name in smallest font when showRoomName is true
- [x] Render empty cell styling when lesson is null
- [x] Apply visual states: normal, selected, focused, hover, highlighted
- [x] Display warning indicator when validationStatus is 'warning'
- [x] Display blocked indicator when validationStatus is 'blocked'
- [x] Wrap component with React.memo with custom comparison function

---

## Task 3: Create ScheduleGrid Component

**Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.1, 8.2, 9.1, 9.5

**Files:**

- `packages/web/src/features/schedule/components/grid/ScheduleGrid.tsx`
- `packages/web/src/features/schedule/components/grid/index.ts` (update)

**Acceptance Criteria:**

- [x] Render CSS Grid layout with days as rows and periods as columns
- [x] Display sticky header row with period numbers
- [x] Display sticky first column with Persian day names
- [x] Support fixed periodsPerDay (number) for uniform columns
- [x] Support variable periodsPerDay (Map) for different periods per day
- [x] Apply cell sizing from displaySettings.cellSize
- [x] Invoke onCellClick with (day, period, lesson) on cell click
- [x] Disable click interactions when isReadOnly is true
- [x] Position days column on right in RTL mode
- [x] Flow periods right-to-left in RTL mode
- [x] Derive period counts from PeriodConfiguration or lesson data

---

## Task 4: Create CategoryAccordion Component

**Requirements:** 5.1, 5.2, 5.3, 5.4, 5.5, 5.6

**Files:**

- `packages/web/src/features/schedule/components/navigation/CategoryAccordion.tsx`
- `packages/web/src/features/schedule/components/navigation/index.ts`

**Acceptance Criteria:**

- [x] Render collapsible sections for each grade category
- [x] Display class count badge for each category header
- [x] Show all classes when category section is expanded
- [x] Visually indicate currently selected class
- [x] Display single-teacher mode indicator for applicable classes
- [x] Invoke onSelectClass callback when class is clicked

---

## Task 5: Create TeacherTabs Component

**Requirements:** 4.1, 4.3, 4.5, 4.6

**Files:**

- `packages/web/src/features/schedule/components/navigation/TeacherTabs.tsx`
- `packages/web/src/features/schedule/components/navigation/index.ts` (update)

**Acceptance Criteria:**

- [x] Render horizontal scrollable tabs container
- [x] Include "All" tab as first option
- [x] Display teacher name on each tab
- [x] Show period count badge on each teacher tab
- [x] Invoke onSelectTeacher callback when tab is clicked
- [x] Visually indicate selected tab

---

## Task 6: Create useScheduleView Hook

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.3, 9.4

**Files:**

- `packages/web/src/features/schedule/hooks/useScheduleView.ts`
- `packages/web/src/features/schedule/hooks/index.ts` (update)

**Acceptance Criteria:**

- [x] Return currentView ('class' | 'teacher')
- [x] Return currentViewId (classId or teacherId)
- [x] Return filteredLessons filtered for current view
- [x] Return setView function to change view and entity
- [x] Return availableClasses grouped by category
- [x] Return availableTeachers array
- [x] Derive filteredLessons from byClass or byTeacher index
- [x] Memoize filtered results with useMemo
- [x] Return periodsPerDay and days from metadata

---

## Task 7: Create ClassScheduleView Component

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

**Files:**

- `packages/web/src/features/schedule/components/views/ClassScheduleView.tsx`
- `packages/web/src/features/schedule/components/views/index.ts`

**Acceptance Criteria:**

- [x] Render left sidebar with CategoryAccordion
- [x] Render ScheduleGrid in main area for selected class
- [x] Group classes into 4 categories (Alpha-Primary, Beta-Primary, Middle,
      High)
- [x] Update grid when class is clicked in accordion
- [x] Display class metadata (student count)
- [x] Display single-teacher badge for Alpha-Primary classes
- [x] Use Persian category names from GRADE_CATEGORIES

---

## Task 8: Create TeacherScheduleView Component

**Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

**Files:**

- `packages/web/src/features/schedule/components/views/TeacherScheduleView.tsx`
- `packages/web/src/features/schedule/components/views/index.ts` (update)

**Acceptance Criteria:**

- [x] Render horizontal scrollable TeacherTabs at top
- [x] Render ScheduleGrid in main area for selected teacher
- [x] Include "All" tab showing combined read-only view
- [x] Update grid when teacher tab is clicked
- [x] Display teacher metadata (subject badges)
- [x] Display teacher's total period count
- [x] Highlight cells where selected teacher is assigned

---

## Task 9: Create EmptyScheduleState Component

**Requirements:** 7.3

**Files:**

- `packages/web/src/features/schedule/components/views/EmptyScheduleState.tsx`
- `packages/web/src/features/schedule/components/views/index.ts` (update)

**Acceptance Criteria:**

- [x] Display appropriate empty state message in Persian
- [x] Show icon indicating no schedule loaded
- [x] Provide guidance on how to load a schedule

---

## Task 10: Update Route Pages

**Requirements:** 7.1, 7.2, 7.3, 7.4

**Files:**

- `packages/web/src/routes/classes-schedule.tsx`
- `packages/web/src/routes/teachers-schedule.tsx`

**Acceptance Criteria:**

- [x] /classes-schedule renders ClassScheduleView component
- [x] /teachers-schedule renders TeacherScheduleView component
- [x] Display EmptyScheduleState when no schedule is loaded
- [x] Preserve selected schedule when switching between views

---

## Task 11: Add i18n Translations

**Requirements:** 8.4

**Files:**

- `packages/web/src/i18n/locales/fa/translation.json`
- `packages/web/src/i18n/locales/en/translation.json`

**Acceptance Criteria:**

- [x] Add schedule.grid keys (period, emptyCell, noSchedule)
- [x] Add schedule.views keys (classView, teacherView, allTeachers, etc.)
- [x] Add schedule.metadata keys (students, periods, singleTeacher)
- [x] Add schedule.categories keys (alphaPrimary, betaPrimary, middle, high)

---

## Task 12: Update Feature Exports

**Requirements:** All

**Files:**

- `packages/web/src/features/schedule/components/index.ts`
- `packages/web/src/features/schedule/index.ts`

**Acceptance Criteria:**

- [x] Export all grid components (ScheduleGrid, ScheduleCell)
- [x] Export all navigation components (CategoryAccordion, TeacherTabs)
- [x] Export all view components (ClassScheduleView, TeacherScheduleView,
      EmptyScheduleState)
- [x] Export useScheduleView hook
- [x] Export new types

Implement this task, and then update the task list.

- DO IT IN AGENT MODE(VIDE), NOT SPEC
