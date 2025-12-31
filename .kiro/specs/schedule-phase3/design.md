# Design Document

## Overview

Phase 3 implements the Schedule Dashboard, the central control interface for
schedule generation and management in the Maktab application. This phase builds
on Phase 1's data layer (types, store, hooks) and Phase 2's grid rendering to
provide:

1. **Dashboard View** - Statistics cards, saved schedules list, generation
   controls
2. **Generation Flow** - Strategy selection, solver API integration, progress
   tracking
3. **Schedule Management** - Load, rename, delete operations with confirmation
   dialogs
4. **Statistics Computation** - Hooks for aggregating metrics from schedule data

The dashboard integrates with the existing `/api/generate` endpoint
(SolverService) and `/api/timetables` CRUD endpoints.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Schedule Dashboard Page                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Header + GenerateButton                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        StatsCards Row                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │  │ Total    │ │ Classes  │ │ Teachers │ │ Last     │           │   │
│  │  │ Schedules│ │ Count    │ │ Count    │ │ Generated│           │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      ScheduleList Table                          │   │
│  │  Name          │ Created    │ Classes │ Actions                 │   │
│  │  ─────────────────────────────────────────────────              │   │
│  │  Schedule v1   │ 2024-12-20 │ 24      │ [Load] [Delete]         │   │
│  │  Schedule v2   │ 2024-12-21 │ 24      │ [Load] [Delete]         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  useSchedules   │────▶│ useScheduleStats│────▶│   StatsCards    │
│  (TanStack)     │     │    (derived)    │     │   (display)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ScheduleList   │────▶│ useDeleteSchedule│────▶│ DeleteDialog    │
│   (table)       │     │   (mutation)    │     │  (confirm)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ GenerateButton  │────▶│useGenerateSchedule────▶│ POST /generate  │
│   (trigger)     │     │   (mutation)    │     │   (solver)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ useSaveSchedule │
                        │  (on success)   │
                        └─────────────────┘
```

## Components and Interfaces

### ScheduleDashboard Component

Main container component for the dashboard page.

```typescript
interface ScheduleDashboardProps {
  // No props - uses hooks internally
}

// Internal state
interface DashboardState {
  isGenerating: boolean;
  generationError: Error | null;
  deleteDialogOpen: boolean;
  scheduleToDelete: Timetable | null;
}
```

### StatsCards Component

Displays aggregate statistics in a row of cards.

```typescript
interface StatsCardsProps {
  totalSchedules: number;
  totalClasses: number;
  totalTeachers: number;
  lastGeneratedAt: Date | null;
  isLoading: boolean;
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  isLoading?: boolean;
}
```

### ScheduleList Component

Table displaying saved schedules with actions.

```typescript
interface ScheduleListProps {
  schedules: Timetable[];
  isLoading: boolean;
  onLoad: (schedule: Timetable) => void;
  onDelete: (schedule: Timetable) => void;
  onRename: (id: number, newName: string) => void;
}

interface ScheduleListItemProps {
  schedule: Timetable;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}
```

### GenerateButton Component

Button with dialog for strategy selection and generation trigger.

```typescript
interface GenerateButtonProps {
  onGenerateComplete?: (schedule: SolverResult) => void;
  disabled?: boolean;
}

type SolverStrategy = 'fast' | 'balanced' | 'thorough';

interface StrategyOption {
  value: SolverStrategy;
  labelFa: string;
  labelEn: string;
  estimatedTime: string;
  estimatedTimeFa: string;
}
```

### GenerationProgress Component

Progress indicator during generation.

```typescript
interface GenerationProgressProps {
  isGenerating: boolean;
  elapsedTime: number;
  strategy: SolverStrategy;
  error?: GenerationError | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

interface GenerationError {
  type: 'SOLVER_BUSY' | 'SOLVER_TIMEOUT' | 'SOLVER_ERROR' | 'UNKNOWN';
  message: string;
  messageFa: string;
}
```

### DeleteConfirmationDialog Component

Confirmation dialog for schedule deletion.

```typescript
interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleName: string;
  onConfirm: () => void;
  isDeleting: boolean;
}
```

## Data Models

### Timetable Entity (existing)

```typescript
interface Timetable {
  id: number;
  schoolId: number | null;
  academicYearId: number | null;
  termId: number | null;
  name: string;
  description: string;
  data: string; // JSON string containing schedule, metadata, statistics
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Parsed Timetable Data

```typescript
interface TimetableData {
  schedule: ScheduledLesson[];
  metadata: SolutionMetadata;
  statistics: SolutionStatistics;
}
```

### Generation Input

```typescript
interface GenerateInput {
  strategy: SolverStrategy;
  config: {
    schoolId?: number;
    daysOfWeek?: DayOfWeek[];
    periodsPerDayMap?: Record<DayOfWeek, number>;
    // ... other config from SchoolConfig
  };
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassGroup[];
  rooms: Room[];
}
```

### Solver Response (from existing SolverService)

```typescript
interface SolverResponse {
  status: 'success' | 'partial' | 'failed';
  data: {
    schedule: ScheduledLesson[];
    metadata: SolutionMetadata;
    statistics: SolutionStatistics;
  } | null;
  errors: SolverErrorDetail[];
  warnings: SolverErrorDetail[];
  quality_score: QualityScore | null;
  metadata: SolverResponseMetadata;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

### Property 1: Stats Cards Display Correct Schedule Count

_For any_ list of schedules, the StatsCards component SHALL display a
totalSchedules value equal to the length of the schedules array.

**Validates: Requirements 1.3**

### Property 2: Stats Cards Display Correct Class Count from Metadata

_For any_ schedule with metadata containing totalClasses, the StatsCards
component SHALL display that exact value as the classes count.

**Validates: Requirements 1.4**

### Property 3: Stats Cards Display Correct Teacher Count from Metadata

_For any_ schedule with metadata containing totalTeachers, the StatsCards
component SHALL display that exact value as the teachers count.

**Validates: Requirements 1.5**

### Property 4: Stats Cards Display Latest Timestamp

_For any_ non-empty list of schedules with varying createdAt timestamps, the
StatsCards component SHALL display the maximum (most recent) createdAt value.

**Validates: Requirements 1.6**

### Property 5: Schedule List Sorted by Date Descending

_For any_ list of schedules, the ScheduleList component SHALL render them in
descending order by createdAt (newest first).

**Validates: Requirements 2.2**

### Property 6: Pagination Shown When Schedules Exceed Threshold

_For any_ list of schedules with length greater than 10, the ScheduleList
component SHALL display pagination controls.

**Validates: Requirements 2.4**

### Property 7: Generate Mutation Called with Selected Strategy

_For any_ strategy selection (fast, balanced, thorough), when generation is
confirmed, the useGenerateSchedule hook SHALL call the API with that exact
strategy value.

**Validates: Requirements 3.4**

### Property 8: Generate Button Disabled During Generation

_For any_ state where isGenerating is true, the GenerateButton component SHALL
render in a disabled state.

**Validates: Requirements 3.9**

### Property 9: Elapsed Time Calculation Accuracy

_For any_ generation start time, the useGenerateSchedule hook SHALL return an
elapsedTime value equal to the difference between current time and start time in
seconds.

**Validates: Requirements 4.1, 6.3**

### Property 10: Strategy Name Displayed in Progress

_For any_ strategy value passed to GenerationProgress, the component SHALL
display the corresponding strategy name in the UI.

**Validates: Requirements 4.4**

### Property 11: Delete Dialog Shows Schedule Name

_For any_ schedule name passed to DeleteConfirmationDialog, that name SHALL
appear in the dialog content.

**Validates: Requirements 5.2**

### Property 12: Delete Mutation Called with Correct ID

_For any_ schedule ID, when deletion is confirmed, the useDeleteSchedule hook
SHALL call DELETE /api/timetables/:id with that exact ID.

**Validates: Requirements 5.4**

### Property 13: useScheduleStats Returns Correct Total Count

_For any_ schedules query result, the useScheduleStats hook SHALL return a
totalSchedules value equal to the array length.

**Validates: Requirements 7.1**

### Property 14: useScheduleStats Returns Latest Timestamp

_For any_ non-empty schedules list, the useScheduleStats hook SHALL return the
maximum createdAt as lastGeneratedAt.

**Validates: Requirements 7.5**

### Property 15: isGenerating Reflects Mutation State

_For any_ mutation state (pending, success, error), the useGenerateSchedule
hook's isGenerating value SHALL be true if and only if the mutation is pending.

**Validates: Requirements 6.2**

## Error Handling

### Solver Errors

| Error Code     | HTTP Status | User Message (Persian)                          | Action                             |
| -------------- | ----------- | ----------------------------------------------- | ---------------------------------- |
| SOLVER_BUSY    | 503         | در حال حاضر یک تولید جدول زمانی در حال اجرا است | Show busy message, disable retry   |
| SOLVER_TIMEOUT | 504         | تولید جدول زمانی زمان‌بر شد                     | Show timeout message, enable retry |
| SOLVER_ERROR   | 500         | خطا در تولید جدول زمانی                         | Show error details, enable retry   |

### API Errors

| Operation       | Error Handling                           |
| --------------- | ---------------------------------------- |
| Fetch schedules | Show error state with retry button       |
| Delete schedule | Show error toast, keep dialog open       |
| Save schedule   | Show error toast, keep generation result |
| Generate        | Show error in GenerationProgress         |

### Toast Notifications

```typescript
// Success messages
const TOAST_MESSAGES = {
  generateSuccess: 'جدول زمانی با موفقیت تولید شد',
  deleteSuccess: 'جدول زمانی با موفقیت حذف شد',
  saveSuccess: 'جدول زمانی ذخیره شد',
  renameSuccess: 'نام جدول زمانی تغییر کرد',
};

// Error messages
const ERROR_MESSAGES = {
  generateFailed: 'خطا در تولید جدول زمانی',
  deleteFailed: 'خطا در حذف جدول زمانی',
  saveFailed: 'خطا در ذخیره جدول زمانی',
  fetchFailed: 'خطا در دریافت لیست جدول‌های زمانی',
};
```

## Testing Strategy

### Dual Testing Approach

This phase uses both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties that should hold across
  all inputs

### Property-Based Testing Library

Use `fast-check` for property-based testing in TypeScript/React.

### Test Configuration

- Minimum 100 iterations per property test
- Each property test tagged with:
  `**Feature: schedule-phase3, Property {number}: {property_text}**`

### Unit Test Coverage

1. **Component rendering**: StatsCards, ScheduleList, GenerateButton render
   correctly
2. **Empty states**: Components handle empty data gracefully
3. **Loading states**: Components show loading indicators
4. **Error states**: Components display error messages
5. **User interactions**: Click handlers trigger correct actions

### Property Test Coverage

1. **Stats calculation**: Counts and timestamps computed correctly
2. **List ordering**: Schedules sorted correctly
3. **Pagination logic**: Pagination shown/hidden based on count
4. **Mutation parameters**: API called with correct values
5. **State synchronization**: UI state reflects hook state

### Test File Structure

```
features/schedule/
├── __tests__/
│   ├── components/
│   │   ├── StatsCards.test.tsx
│   │   ├── ScheduleList.test.tsx
│   │   ├── GenerateButton.test.tsx
│   │   └── DeleteConfirmationDialog.test.tsx
│   ├── hooks/
│   │   ├── useGenerateSchedule.test.ts
│   │   └── useScheduleStats.test.ts
│   └── property/
│       ├── statsCards.property.test.ts
│       ├── scheduleList.property.test.ts
│       └── hooks.property.test.ts
```
