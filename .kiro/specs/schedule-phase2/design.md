# Design Document: Schedule Feature - Phase 2

## Overview

This design document outlines the Grid Rendering & View System for the Schedule
Feature in the Maktab school timetable application. Phase 2 builds on Phase 1's
data layer to create visual components for displaying schedules by class or
teacher.

The design follows the existing feature module pattern and integrates with the
Phase 1 Zustand store, indexes, and types.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Route Pages                                      │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │  /classes-schedule      │    │  /teachers-schedule     │            │
│  │  ClassScheduleView      │    │  TeacherScheduleView    │            │
│  └───────────┬─────────────┘    └───────────┬─────────────┘            │
│              │                              │                           │
│              └──────────┬───────────────────┘                           │
│                         │                                               │
│              ┌──────────▼──────────┐                                    │
│              │   useScheduleView   │ ◄── View state & filtered lessons  │
│              └──────────┬──────────┘                                    │
│                         │                                               │
│  ┌──────────────────────┼──────────────────────┐                       │
│  │                      │                      │                        │
│  ▼                      ▼                      ▼                        │
│ ┌────────────┐  ┌──────────────┐  ┌─────────────────┐                  │
│ │ Category   │  │ ScheduleGrid │  │  TeacherTabs    │                  │
│ │ Accordion  │  │              │  │  (scrollable)   │                  │
│ └────────────┘  └──────┬───────┘  └─────────────────┘                  │
│                        │                                                │
│              ┌─────────▼─────────┐                                      │
│              │   ScheduleCell    │ ◄── Memoized for performance        │
│              │   (React.memo)    │                                      │
│              └───────────────────┘                                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Phase 1 Data Layer                            │   │
│  │  useScheduleStore (lessons, indexes, metadata, displaySettings)  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
ClassScheduleView
├── CategoryAccordion (left sidebar)
│   └── ClassItem (per class, with metadata badges)
└── ScheduleGrid (main area)
    └── ScheduleCell[] (memoized)

TeacherScheduleView
├── TeacherTabs (top, horizontal scrollable)
│   └── TabTrigger (per teacher + "All" tab)
└── ScheduleGrid (main area)
    └── ScheduleCell[] (memoized)
```

## File Structure

```
packages/web/src/features/schedule/
├── components/
│   ├── grid/
│   │   ├── ScheduleGrid.tsx        # Main grid component
│   │   ├── ScheduleCell.tsx        # Individual cell (memoized)
│   │   └── index.ts
│   ├── navigation/
│   │   ├── CategoryAccordion.tsx   # Class category navigation
│   │   ├── TeacherTabs.tsx         # Teacher tab navigation
│   │   └── index.ts
│   ├── views/
│   │   ├── ClassScheduleView.tsx   # Class-based schedule view
│   │   ├── TeacherScheduleView.tsx # Teacher-based schedule view
│   │   ├── EmptyScheduleState.tsx  # Empty state component
│   │   └── index.ts
│   └── index.ts
├── hooks/
│   ├── useScheduleView.ts          # View state management
│   └── index.ts (updated)
└── index.ts (updated exports)
```

## Data Models

### New Types (add to types.ts)

```typescript
/**
 * View type for schedule display
 */
export type ScheduleViewType = 'class' | 'teacher';

/**
 * Validation status for cells (future editing support)
 */
export type CellValidationStatus = 'valid' | 'warning' | 'blocked' | null;

/**
 * Props for ScheduleGrid component
 * Requirements: 1.1-1.8
 */
export interface ScheduleGridProps {
  lessons: ScheduledLesson[];
  days: DayOfWeek[];
  periodsPerDay: number | Map<DayOfWeek, number>;
  displaySettings: DisplaySettings;
  onCellClick?: (
    day: DayOfWeek,
    period: number,
    lesson: ScheduledLesson | null
  ) => void;
  isReadOnly?: boolean;
  highlightTeacherId?: string;
}

/**
 * Props for ScheduleCell component
 * Requirements: 2.1-2.8
 */
export interface ScheduleCellProps {
  lesson: ScheduledLesson | null;
  displaySettings: DisplaySettings;
  isSelected?: boolean;
  isFocused?: boolean;
  isHighlighted?: boolean;
  validationStatus?: CellValidationStatus;
  onClick?: () => void;
  isReadOnly?: boolean;
}

/**
 * Category with classes for accordion
 * Requirements: 5.1-5.6
 */
export interface CategoryWithClasses {
  key: string;
  name: string;
  nameFa: string;
  classes: ClassMetadata[];
}

/**
 * Props for CategoryAccordion component
 */
export interface CategoryAccordionProps {
  categories: CategoryWithClasses[];
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
}

/**
 * Props for TeacherTabs component
 */
export interface TeacherTabsProps {
  teachers: TeacherMetadata[];
  selectedTeacherId: string | null;
  onSelectTeacher: (teacherId: string | null) => void;
  lessonCounts: Map<string, number>;
}

/**
 * Return type for useScheduleView hook
 * Requirements: 6.1-6.8
 */
export interface UseScheduleViewReturn {
  currentView: ScheduleViewType;
  currentViewId: string | null;
  filteredLessons: ScheduledLesson[];
  setView: (view: ScheduleViewType, id: string | null) => void;
  availableClasses: CategoryWithClasses[];
  availableTeachers: TeacherMetadata[];
  periodsPerDay: Map<DayOfWeek, number>;
  days: DayOfWeek[];
}
```

## Component Specifications

### ScheduleGrid Component

**File:** `components/grid/ScheduleGrid.tsx`

**Requirements:** 1.1-1.8, 8.1-8.2, 9.1, 9.5

```typescript
interface ScheduleGridProps {
  lessons: ScheduledLesson[];
  days: DayOfWeek[];
  periodsPerDay: number | Map<DayOfWeek, number>;
  displaySettings: DisplaySettings;
  onCellClick?: (
    day: DayOfWeek,
    period: number,
    lesson: ScheduledLesson | null
  ) => void;
  isReadOnly?: boolean;
  highlightTeacherId?: string;
}
```

**Implementation Notes:**

- Use CSS Grid with `display: grid` and `grid-template-columns`
- Sticky header: `position: sticky; top: 0; z-index: 10`
- Sticky day column: `position: sticky; inset-inline-start: 0; z-index: 5`
- RTL support via `dir="rtl"` and logical properties
- Dynamic columns based on max periods across all days
- Cell lookup via `byClassAndSlot` index for O(1) access

**CSS Grid Structure:**

```css
.schedule-grid {
  display: grid;
  grid-template-columns: auto repeat(var(--max-periods), minmax(0, 1fr));
  direction: rtl;
}
```

### ScheduleCell Component

**File:** `components/grid/ScheduleCell.tsx`

**Requirements:** 2.1-2.8, 9.2

```typescript
interface ScheduleCellProps {
  lesson: ScheduledLesson | null;
  displaySettings: DisplaySettings;
  isSelected?: boolean;
  isFocused?: boolean;
  isHighlighted?: boolean;
  validationStatus?: CellValidationStatus;
  onClick?: () => void;
  isReadOnly?: boolean;
}
```

**Implementation Notes:**

- Wrap with `React.memo` with custom comparison
- Subject name: `text-sm font-medium`
- Teacher name: `text-xs text-muted-foreground`
- Room name: `text-[10px] text-muted-foreground/70`
- Visual states via Tailwind variants

**Visual States:**

| State       | Tailwind Classes                                  |
| ----------- | ------------------------------------------------- |
| Normal      | `bg-card border`                                  |
| Hover       | `hover:bg-accent`                                 |
| Selected    | `ring-2 ring-primary bg-primary/5`                |
| Focused     | `ring-2 ring-ring`                                |
| Highlighted | `bg-primary/10`                                   |
| Warning     | `border-warning bg-warning/10`                    |
| Blocked     | `border-destructive bg-destructive/10 opacity-60` |
| Empty       | `bg-muted/30`                                     |

### ClassScheduleView Component

**File:** `components/views/ClassScheduleView.tsx`

**Requirements:** 3.1-3.7

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌────────────────────────────────┐ │
│ │  Category    │ │                                │ │
│ │  Accordion   │ │       ScheduleGrid             │ │
│ │              │ │       (selected class)         │ │
│ │  - Alpha     │ │                                │ │
│ │    - 1A      │ │                                │ │
│ │    - 1B      │ │                                │ │
│ │  - Beta      │ │                                │ │
│ │  - Middle    │ │                                │ │
│ │  - High      │ │                                │ │
│ └──────────────┘ └────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
     240px                    flex-1
```

### TeacherScheduleView Component

**File:** `components/views/TeacherScheduleView.tsx`

**Requirements:** 4.1-4.7

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │ [همه] [استاد ۱] [استاد ۲] [استاد ۳] ... ──────► │ │
│ │              TeacherTabs (scrollable)           │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                 │ │
│ │              ScheduleGrid                       │ │
│ │         (selected teacher or all)              │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### CategoryAccordion Component

**File:** `components/navigation/CategoryAccordion.tsx`

**Requirements:** 5.1-5.6

**Features:**

- Uses Radix Accordion primitive (collapsible)
- Category header shows Persian name + class count badge
- Class items show: name, student count, single-teacher badge
- Selected class has visual indicator (bg-primary/10)

### useScheduleView Hook

**File:** `hooks/useScheduleView.ts`

**Requirements:** 6.1-6.8, 9.3-9.4

```typescript
export function useScheduleView(): UseScheduleViewReturn {
  const [currentView, setCurrentView] = useState<ScheduleViewType>('class');
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);

  // Get data from Phase 1 store
  const { lessons, indexes, classes, teachers, metadata } = useScheduleStore();

  // Memoized filtered lessons
  const filteredLessons = useMemo(() => {
    if (!currentViewId) return [];

    if (currentView === 'class') {
      return indexes.byClass.get(currentViewId) ?? [];
    } else {
      return indexes.byTeacher.get(currentViewId) ?? [];
    }
  }, [currentView, currentViewId, indexes]);

  // Group classes by category
  const availableClasses = useMemo(() => {
    return groupClassesByCategory(Array.from(classes.values()));
  }, [classes]);

  // ... rest of implementation
}
```

## i18n Keys

Add to `locales/fa/translation.json`:

```json
{
  "schedule": {
    "grid": {
      "period": "زنگ",
      "emptyCell": "خالی",
      "noSchedule": "جدول زمانی بارگذاری نشده است"
    },
    "views": {
      "classView": "نمای صنف‌ها",
      "teacherView": "نمای استادان",
      "allTeachers": "همه",
      "selectClass": "یک صنف انتخاب کنید",
      "selectTeacher": "یک استاد انتخاب کنید"
    },
    "metadata": {
      "students": "شاگرد",
      "periods": "زنگ",
      "singleTeacher": "استاد واحد"
    },
    "categories": {
      "alphaPrimary": "ابتدایی الف",
      "betaPrimary": "ابتدایی ب",
      "middle": "متوسطه",
      "high": "ثانوی"
    }
  }
}
```

## RTL Layout Strategy

**Requirements:** 8.1-8.4

1. **Grid Direction:** Set `dir="rtl"` on grid container
2. **Day Column:** Use `inset-inline-start: 0` for sticky positioning (appears
   on right in RTL)
3. **Period Flow:** Periods naturally flow right-to-left with RTL direction
4. **Spacing:** Use logical properties exclusively:
   - `ms-*` (margin-inline-start) instead of `ml-*`
   - `me-*` (margin-inline-end) instead of `mr-*`
   - `ps-*` (padding-inline-start) instead of `pl-*`
   - `pe-*` (padding-inline-end) instead of `pr-*`

## Performance Optimizations

**Requirements:** 9.1-9.4

1. **Cell Memoization:**

   ```typescript
   export const ScheduleCell = React.memo(ScheduleCellInner, (prev, next) => {
     return (
       prev.lesson?.subjectId === next.lesson?.subjectId &&
       prev.isSelected === next.isSelected &&
       prev.isHighlighted === next.isHighlighted &&
       prev.displaySettings === next.displaySettings
     );
   });
   ```

2. **Index-Based Lookups:** Use `byClassAndSlot` index for O(1) cell data access

3. **Memoized Filtering:** `useMemo` for `filteredLessons` in hook

4. **CSS Grid:** Better performance than flexbox for large grids

## Testing Strategy

### Unit Tests

1. **ScheduleGrid:** Renders correct number of rows/columns
2. **ScheduleCell:** Displays lesson info based on settings
3. **CategoryAccordion:** Groups classes correctly
4. **useScheduleView:** Returns filtered lessons from indexes

### Integration Tests

1. **ClassScheduleView:** Selecting class updates grid
2. **TeacherScheduleView:** Tab switching updates grid
3. **RTL Layout:** Day column on right, periods flow RTL

## Implementation Tasks

```markdown
- [ ] Task 1: Add new types to types.ts
- [ ] Task 2: Create ScheduleCell component with memoization
- [ ] Task 3: Create ScheduleGrid component with CSS Grid
- [ ] Task 4: Create CategoryAccordion component
- [ ] Task 5: Create TeacherTabs component
- [ ] Task 6: Create useScheduleView hook
- [ ] Task 7: Create ClassScheduleView component
- [ ] Task 8: Create TeacherScheduleView component
- [ ] Task 9: Create EmptyScheduleState component
- [ ] Task 10: Update route pages
- [ ] Task 11: Add i18n translations
- [ ] Task 12: Update feature exports
```
