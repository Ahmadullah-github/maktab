# Design Document: Teachers Feature Module

## Overview

The Teachers Feature Module provides comprehensive management capabilities for
teacher entities in the Maktab school timetable application. The module follows
the established patterns from the classes feature, implementing a three-column
layout with DataGrid, Inspector panel, and Wizard drawer components.

The architecture emphasizes:

- **Dynamic configuration**: All constraints and limits derived from
  SchoolConfig
- **RTL-first design**: Farsi language with right-to-left layout
- **Pattern consistency**: Following classes feature structure and conventions
- **Type safety**: Full TypeScript coverage with Zod validation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TeachersPage                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ TeacherFilters  │  │   TeacherDataGrid   │  │  TeacherInspector   │  │
│  │ - Search        │  │   - Row selection   │  │  - Tabs (4)         │  │
│  │ - Status filter │  │   - Delete action   │  │  - Form fields      │  │
│  └─────────────────┘  │   - Empty state     │  │  - Save/Close       │  │
│                       └─────────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                      TeacherFormDrawer (Wizard)                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Basic Info → Step 2: Subjects → Step 3: Availability →   │   │
│  │ Step 4: Constraints                                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Component  │────▶│ TanStack     │────▶│   API        │
│   (React)    │     │ Query Hooks  │     │   Layer      │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ▼                    ▼
       │             ┌──────────────┐     ┌──────────────┐
       │             │   Cache      │     │   Backend    │
       │             │   (Query)    │     │   /api/      │
       │             └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│ SchoolConfig │ (for dynamic constraints)
│ Query Hook   │
└──────────────┘
```

## Components and Interfaces

### File Structure

```
packages/web/src/features/teachers/
├── api.ts                      # API functions with serialization
├── types.ts                    # TypeScript interfaces
├── index.ts                    # Public exports
├── components/
│   ├── TeachersPage.tsx        # Main page container
│   ├── TeacherDataGrid.tsx     # Table with selection/actions
│   ├── TeacherInspector.tsx    # Side panel with tabs
│   ├── TeacherForm.tsx         # Reusable form fields
│   ├── TeacherFormDrawer.tsx   # Wizard drawer
│   ├── TeacherFilters.tsx      # Search and filter controls
│   ├── AvailabilityMatrix.tsx  # Day/period grid
│   ├── SubjectManager.tsx      # Drag-drop subject zones
│   └── ui/
│       ├── StatusBadge.tsx     # Active/inactive indicator
│       └── HoursIndicator.tsx  # Hours filled/max display
├── hooks/
│   ├── useTeachers.ts          # CRUD query hooks
│   ├── useTeacherFilters.ts    # Filter state management
│   └── useSchoolConfig.ts      # SchoolConfig data hook
└── utils/
    ├── serialization.ts        # JSON parse/stringify helpers
    └── logger.ts               # Debug logging utilities
```

### Component Interfaces

```typescript
// TeachersPage
interface TeachersPageProps {
  initialSelectedId?: number;
}

// TeacherDataGrid
interface TeacherDataGridProps {
  teachers: Teacher[];
  selectedTeacherId: number | null;
  onSelectTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (teacher: Teacher) => void;
  isDeleting: boolean;
}

// TeacherInspector
interface TeacherInspectorProps {
  teacher: Teacher;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<TeacherFormValues>) => Promise<void>;
  isUpdating: boolean;
  schoolConfig: SchoolConfig;
}

// TeacherFilters
interface TeacherFiltersProps {
  search: string;
  statusFilter: TeacherStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  totalCount: number;
  filteredCount: number;
}

// AvailabilityMatrix
interface AvailabilityMatrixProps {
  value: UnavailableSlot[];
  onChange: (slots: UnavailableSlot[]) => void;
  disabled?: boolean;
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number> | null;
  defaultPeriodsPerDay: number;
}

// SubjectManager
interface SubjectManagerProps {
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimary: boolean;
  onPrimaryChange: (ids: number[]) => void;
  onAllowedChange: (ids: number[]) => void;
  onRestrictChange: (value: boolean) => void;
  availableSubjects: Subject[];
}
```

## Data Models

### Teacher Entity (Frontend)

```typescript
interface Teacher {
  id: number;
  schoolId: number | null;
  fullName: string;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  availability: boolean[][];
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
  preferredRoomIds: number[];
  preferredColleagues: number[];
  classAssignments: ClassAssignment[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UnavailableSlot {
  day: number;
  period: number;
}

interface ClassAssignment {
  subjectId: number;
  classIds: number[];
}
```

### Teacher API Response (Raw)

```typescript
interface TeacherResponse {
  id: number;
  schoolId: number | null;
  fullName: string;
  primarySubjectIds: string; // JSON string
  allowedSubjectIds: string; // JSON string
  restrictToPrimarySubjects: boolean;
  availability: string; // JSON string
  unavailable: string; // JSON string
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: string;
  preferredRoomIds: string; // JSON string
  preferredColleagues: string; // JSON string
  classAssignments: string; // JSON string
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Form Values

```typescript
interface TeacherFormValues {
  fullName: string;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
}
```

### Filter State

```typescript
type TeacherStatusFilter = 'all' | 'fullTime' | 'partTime';

interface TeacherFiltersState {
  search: string;
  statusFilter: TeacherStatusFilter;
}
```

### SchoolConfig (for dynamic constraints)

```typescript
interface SchoolConfig {
  daysPerWeek: number;
  periodsPerDay: number;
  defaultPeriodsPerDay: number;
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number> | null;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

Based on the acceptance criteria analysis, the following correctness properties
must be verified through property-based testing:

### Property 1: Search filter returns matching teachers

_For any_ teacher list and _any_ non-empty search term, all teachers returned by
the search filter SHALL have their fullName field containing the search term
(case-insensitive).

**Validates: Requirements 1.2**

### Property 2: Status filter returns correct employment type

_For any_ teacher list and _any_ status filter value (fullTime, partTime), all
teachers returned by the filter SHALL match the selected employment type based
on their maxPeriodsPerWeek relative to SchoolConfig limits.

**Validates: Requirements 1.3**

### Property 3: Teacher name validation rejects invalid inputs

_For any_ string that is empty or composed entirely of whitespace characters,
the validation schema SHALL reject it. _For any_ string exceeding the maximum
allowed length, the validation schema SHALL reject it.

**Validates: Requirements 2.2, 2.3**

### Property 4: Subject zone state consistency

_For any_ set of subjects and _any_ sequence of drag-drop operations between
zones (available, primary, allowed), each subject SHALL exist in exactly one
zone at any time. Moving a subject to a new zone SHALL remove it from its
previous zone and add it to the target zone.

**Validates: Requirements 3.2, 3.3, 3.4, 3.6**

### Property 5: Availability matrix toggle is idempotent pair

_For any_ availability matrix state and _any_ valid cell (day, period), toggling
the cell twice SHALL return the matrix to its original state.

**Validates: Requirements 4.2**

### Property 6: Availability matrix dimensions match SchoolConfig

_For any_ SchoolConfig with variable periodsPerDayMap, the availability matrix
SHALL have exactly the number of period rows specified for each day column. Days
without explicit mapping SHALL use defaultPeriodsPerDay.

**Validates: Requirements 4.1, 4.5**

### Property 7: Unavailable slots serialization round-trip

_For any_ array of UnavailableSlot objects, serializing to JSON string and
deserializing back SHALL produce an equivalent array.

**Validates: Requirements 4.6**

### Property 8: Constraint validation against dynamic limits

_For any_ SchoolConfig and _any_ constraint values:

- maxPeriodsPerWeek SHALL be valid only if between 1 and (daysPerWeek ×
  defaultPeriodsPerDay)
- maxPeriodsPerDay SHALL be valid only if between 1 and the maximum periods from
  SchoolConfig
- maxConsecutivePeriods SHALL be valid only if 1 or 2

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 9: Default constraints derived from SchoolConfig

_For any_ SchoolConfig, a newly created teacher SHALL have default constraint
values that are within the valid ranges calculated from that SchoolConfig.

**Validates: Requirements 5.5**

### Property 10: Tab switching preserves form state

_For any_ form state across all tabs and _any_ sequence of tab switches, the
form values SHALL remain unchanged after returning to the original tab.

**Validates: Requirements 6.3**

### Property 11: Wizard step validation and progression

_For any_ wizard step with valid data, clicking "Next" SHALL advance to the next
step. _For any_ wizard step with invalid data, clicking "Next" SHALL remain on
the current step and display validation errors.

**Validates: Requirements 7.3**

### Property 12: Wizard data preservation across navigation

_For any_ data entered in wizard steps and _any_ sequence of back/next
navigation, the final saved teacher record SHALL contain all data from all
steps.

**Validates: Requirements 7.4, 7.5**

## Error Handling

### API Errors

| Error Type       | Handling Strategy                                    |
| ---------------- | ---------------------------------------------------- |
| Network Error    | Display Farsi error toast, allow retry               |
| Validation Error | Display field-level errors from Zod schema           |
| Not Found (404)  | Display "teacher not found" message, clear selection |
| Server Error     | Display generic error toast with details             |

### Form Validation Errors

```typescript
const validationMessages = {
  'teachers.validation.nameRequired': 'نام معلم الزامی است',
  'teachers.validation.nameTooLong': 'نام نباید بیشتر از حد مجاز باشد',
  'teachers.validation.invalidConstraint': 'مقدار محدودیت نامعتبر است',
};
```

### State Recovery

- Form state preserved in React Hook Form during tab switches
- Unsaved changes warning before closing Inspector
- Wizard progress preserved during back navigation
- Query cache invalidation on successful mutations

## Testing Strategy

### Dual Testing Approach

The teachers feature requires both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property-based tests**: Verify universal properties across all valid inputs

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript/TypeScript PBT library)
- **Minimum iterations**: 100 per property test
- **Test file location**: `packages/web/src/features/teachers/__tests__/`

### Property Test Annotations

Each property-based test MUST include a comment referencing the design document:

```typescript
/**
 * Feature: teachers-feature, Property 1: Search filter returns matching teachers
 * Validates: Requirements 1.2
 */
```

### Test Categories

#### Unit Tests

- Serialization/deserialization utilities
- Filter functions with specific inputs
- Zod schema validation edge cases
- Component rendering with mock data

#### Property-Based Tests

- Filter functions (Properties 1, 2)
- Validation schemas (Properties 3, 8)
- Subject zone management (Property 4)
- Availability matrix operations (Properties 5, 6, 7)
- Constraint defaults (Property 9)
- Form state preservation (Property 10)
- Wizard navigation (Properties 11, 12)

### Test File Structure

```
packages/web/src/features/teachers/
├── __tests__/
│   ├── api.test.ts              # API serialization tests
│   ├── filters.test.ts          # Filter function unit tests
│   ├── filters.property.test.ts # Filter property tests
│   ├── validation.property.test.ts # Validation property tests
│   ├── subjectManager.property.test.ts # Subject zone property tests
│   ├── availabilityMatrix.property.test.ts # Matrix property tests
│   └── wizard.property.test.ts  # Wizard navigation property tests
```

### Generators for Property Tests

```typescript
// Teacher generator
const teacherArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  fullName: fc.string({ minLength: 1, maxLength: 255 }),
  primarySubjectIds: fc.array(fc.integer({ min: 1 })),
  allowedSubjectIds: fc.array(fc.integer({ min: 1 })),
  maxPeriodsPerWeek: fc.integer({ min: 1, max: 42 }),
  maxPeriodsPerDay: fc.integer({ min: 1, max: 10 }),
  maxConsecutivePeriods: fc.constantFrom(1, 2),
});

// SchoolConfig generator
const schoolConfigArbitrary = fc.record({
  daysPerWeek: fc.integer({ min: 5, max: 7 }),
  defaultPeriodsPerDay: fc.integer({ min: 4, max: 10 }),
  daysOfWeek: fc.array(fc.string(), { minLength: 5, maxLength: 7 }),
});

// UnavailableSlot generator
const unavailableSlotArbitrary = fc.record({
  day: fc.integer({ min: 0, max: 6 }),
  period: fc.integer({ min: 0, max: 9 }),
});
```
