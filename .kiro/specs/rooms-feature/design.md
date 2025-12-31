# Design Document: Rooms Feature

## Overview

The Rooms Feature provides a comprehensive room management interface for the
Maktab school timetable application. This feature enables school administrators
to manage physical spaces (classrooms, labs, gyms, libraries) with their
associated properties including capacity, type, features, and availability
schedules.

The implementation follows the established patterns from the Subjects feature,
providing:

- A DataGrid for listing and selecting rooms
- An Inspector panel for viewing and editing room details
- A Form Drawer for creating new rooms
- Search and filter capabilities
- Proper serialization/deserialization for complex JSON fields

## Architecture

The Rooms Feature follows the feature module pattern established in the
codebase:

```
packages/web/src/features/rooms/
├── components/
│   ├── RoomsPage.tsx          # Main container component
│   ├── RoomDataGrid.tsx       # DataGrid for room listing
│   ├── RoomInspector.tsx      # Side panel for viewing/editing
│   ├── RoomForm.tsx           # Reusable form component
│   ├── RoomFormDrawer.tsx     # Drawer wrapper for create form
│   └── RoomFilters.tsx        # Search and filter controls
├── hooks/
│   ├── useRooms.ts            # TanStack Query hooks for CRUD
│   └── useRoomFilters.ts      # Filter state management
├── utils/
│   ├── serialization.ts       # JSON serialization helpers
│   └── logger.ts              # Feature-specific logging
├── api.ts                     # API client functions
├── types.ts                   # TypeScript type definitions
└── index.ts                   # Public exports
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        RoomsPage                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  RoomFilters    │  │  RoomDataGrid   │  │ RoomInspector  │  │
│  │  - search       │  │  - room list    │  │ - view/edit    │  │
│  │  - type filter  │  │  - selection    │  │ - delete       │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │    useRooms hooks     │                    │
│                    │  useRoomFilters hook  │                    │
│                    └───────────┬───────────┘                    │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      roomsApi           │
                    │  (serialization layer)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   /api/rooms endpoint   │
                    │   (existing backend)    │
                    └─────────────────────────┘
```

## Components and Interfaces

### RoomsPage (Container Component)

The main container that orchestrates all room management functionality.

```typescript
interface RoomsPageProps {
  initialSelectedId?: number;
}
```

Responsibilities:

- Fetches room data via `useRooms` hook
- Manages selected room state
- Coordinates filter state with `useRoomFilters`
- Handles CRUD operations via mutation hooks
- Renders child components (Filters, DataGrid, Inspector, FormDrawer)

### RoomDataGrid

Displays rooms in a tabular format with selection support.

```typescript
interface RoomDataGridProps {
  rooms: Room[];
  selectedId: number | null;
  onSelect: (room: Room | null) => void;
  isLoading: boolean;
}
```

Columns:

- Name (primary identifier)
- Type (classroom, lab, gym, library)
- Capacity (number of students)
- Features (count badge)

### RoomInspector

Side panel for viewing and editing room details.

```typescript
interface RoomInspectorProps {
  room: Room | null;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<RoomFormValues>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
}
```

Tabs:

- Info: Name, type, capacity
- Features: Multi-select tag input for room features
- Availability: Unavailable time slots editor
- Settings: Delete action

### RoomForm

Reusable form component for create/edit operations.

```typescript
interface RoomFormProps {
  initialValues?: Partial<RoomFormValues>;
  onSubmit: (values: RoomFormValues) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
}
```

### RoomFilters

Search and filter controls.

```typescript
interface RoomFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: RoomTypeFilter;
  onTypeFilterChange: (value: RoomTypeFilter) => void;
  onAddClick: () => void;
  totalCount: number;
  filteredCount: number;
}
```

## Data Models

### Room (Frontend Type)

```typescript
interface Room {
  id: number;
  schoolId: number | null;
  name: string;
  capacity: number;
  type: RoomType;
  features: string[]; // Parsed from JSON
  unavailable: UnavailableSlot[]; // Parsed from JSON
  meta: Record<string, unknown>; // Parsed from JSON
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type RoomType = 'classroom' | 'lab' | 'gym' | 'library' | '';

interface UnavailableSlot {
  day: number; // 0-6 (Sunday-Saturday)
  period: number; // Period index
}
```

### RoomResponse (API Response)

```typescript
interface RoomResponse {
  id: number;
  schoolId: number | null;
  name: string;
  capacity: number;
  type: string;
  features: string; // JSON string
  unavailable: string; // JSON string
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### RoomFormValues

```typescript
interface RoomFormValues {
  name: string;
  capacity: number;
  type: RoomType;
  features: string[];
  unavailable: UnavailableSlot[];
}
```

### Filter Types

```typescript
type RoomTypeFilter = 'all' | RoomType;

interface RoomFiltersState {
  search: string;
  typeFilter: RoomTypeFilter;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following correctness properties have been
identified:

### Property 1: Search filter returns matching rooms

_For any_ list of rooms and any search string, all rooms in the filtered result
should have names that contain the search string (case-insensitive partial
match). **Validates: Requirements 2.1**

### Property 2: Type filter returns matching rooms

_For any_ list of rooms and any type filter value (other than 'all'), all rooms
in the filtered result should have a type matching the filter value.
**Validates: Requirements 2.2**

### Property 3: Filter count accuracy

_For any_ list of rooms and any combination of filters, the displayed filtered
count should equal the actual length of the filtered rooms array. **Validates:
Requirements 2.3**

### Property 4: Room serialization round-trip

_For any_ valid Room object, serializing it for the API and then deserializing
the response should produce an equivalent Room object (features array,
unavailable slots, and meta preserved). **Validates: Requirements 7.2, 9.1,
9.2**

### Property 5: Features rendering completeness

_For any_ room with a features array, the rendered output should contain a
visual element (badge/tag) for each feature in the array. **Validates:
Requirements 7.3**

### Property 6: Inspector displays all properties

_For any_ selected room, the Inspector panel should display all required
properties: name, type, capacity, features list, and unavailable slots.
**Validates: Requirements 3.2**

### Property 7: Delete removes room from list

_For any_ room that is deleted, the room should no longer appear in the DataGrid
after the deletion operation completes. **Validates: Requirements 6.2**

### Property 8: DataGrid displays all rooms

_For any_ list of non-deleted rooms returned from the API, the DataGrid should
render a row for each room. **Validates: Requirements 1.1**

## Error Handling

### Validation Errors

| Error Type       | Trigger                  | User Message (Farsi)       |
| ---------------- | ------------------------ | -------------------------- |
| Empty Name       | Name field is empty      | نام اتاق الزامی است        |
| Invalid Capacity | Capacity < 1             | ظرفیت باید حداقل ۱ باشد    |
| Duplicate Name   | Room name already exists | اتاقی با این نام وجود دارد |

### API Errors

| Error Type    | HTTP Status | User Message (Farsi)  |
| ------------- | ----------- | --------------------- |
| Fetch Failed  | 500         | خطا در دریافت اتاق‌ها |
| Create Failed | 400/500     | خطا در ایجاد اتاق     |
| Update Failed | 400/404/500 | خطا در بروزرسانی اتاق |
| Delete Failed | 404/500     | خطا در حذف اتاق       |

### Serialization Errors

- Malformed JSON in features field: Default to empty array `[]`
- Malformed JSON in unavailable field: Default to empty array `[]`
- Malformed JSON in meta field: Default to empty object `{}`

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests:

1. **Unit Tests**: Verify specific examples, edge cases, and error conditions
2. **Property-Based Tests**: Verify universal properties that should hold across
   all inputs

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript property-based testing library)
- **Minimum Iterations**: 100 per property test
- **Test Location**: `packages/web/src/features/rooms/__tests__/`

### Unit Test Coverage

| Component      | Test Focus                                           |
| -------------- | ---------------------------------------------------- |
| RoomForm       | Form validation, submission, field rendering         |
| RoomDataGrid   | Row rendering, selection, empty state                |
| RoomInspector  | Tab navigation, form submission, delete confirmation |
| RoomFilters    | Search input, type dropdown, count display           |
| useRooms       | Query/mutation hooks, cache invalidation             |
| useRoomFilters | Filter state management, filtering logic             |
| serialization  | JSON parse/stringify, error handling                 |

### Property-Based Test Coverage

| Property   | Test File                      | Description                 |
| ---------- | ------------------------------ | --------------------------- |
| Property 1 | filters.property.test.ts       | Search filter correctness   |
| Property 2 | filters.property.test.ts       | Type filter correctness     |
| Property 3 | filters.property.test.ts       | Count accuracy              |
| Property 4 | serialization.property.test.ts | Round-trip serialization    |
| Property 5 | rendering.property.test.ts     | Features badge rendering    |
| Property 6 | rendering.property.test.ts     | Inspector completeness      |
| Property 7 | crud.property.test.ts          | Delete removes from list    |
| Property 8 | crud.property.test.ts          | DataGrid displays all rooms |

### Test Annotation Format

Each property-based test must be annotated with:

```typescript
/**
 * **Feature: rooms-feature, Property 1: Search filter returns matching rooms**
 * **Validates: Requirements 2.1**
 */
```
