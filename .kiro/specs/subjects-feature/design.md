# Design Document: Subjects Feature Module

## Overview

The Subjects Feature Module provides a complete CRUD interface for managing
curriculum subjects in the Maktab school timetable application. It follows the
established patterns from the Classes feature, implementing a DataGrid listing
with filtering, an Inspector panel for viewing/editing details, and a form
drawer for creating new subjects. The module also supports bulk curriculum
operations for inserting standard Ministry curriculum subjects and clearing
subjects by grade.

## Architecture

The feature follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SubjectsPage (Route Component)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SubjectFilters (Toolbar)                          │   │
│  │  [Section Tabs: همه|ابتدایی|متوسطه|لیسه] [🔍 Search] [+ Add] [📚 Curriculum] │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │                             │  │                             │   │   │
│  │  │    SubjectDataGrid          │  │    SubjectInspector         │   │   │
│  │  │    (Main Content)           │  │    (Left Panel - RTL)       │   │   │
│  │  │                             │  │                             │   │   │
│  │  │    - Columns: name, code,   │  │    Tabs:                    │   │   │
│  │  │      section, grade,        │  │    - معلومات (Info)         │   │   │
│  │  │      periodsPerWeek,        │  │    - نیازمندی‌ها (Requirements)│   │   │
│  │  │      requiredRoomType,      │  │    - تنظیمات (Settings)     │   │   │
│  │  │      isDifficult            │  │                             │   │   │
│  │  │                             │  │    Actions:                 │   │   │
│  │  │    - Row selection          │  │    - Save, Delete, Close    │   │   │
│  │  │    - Empty state            │  │                             │   │   │
│  │  │                             │  │                             │   │   │
│  │  └─────────────────────────────┘  └─────────────────────────────┘   │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SubjectFormDrawer (Sheet - Left side for RTL)                       │   │
│  │  - Create new subject form                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CurriculumDialog (Dialog for bulk operations)                       │   │
│  │  - Insert curriculum / Clear grade subjects                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Component  │────▶│  TanStack    │────▶│   API Layer  │────▶│   Backend    │
│   (React)    │     │   Query      │     │  (api.ts)    │     │   /api/      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
  UI State (Zustand)   Cache Management    Serialization/      SQLite DB
  - selectedSubject    - Query Keys        Deserialization     (TypeORM)
  - drawerOpen         - Invalidation      - JSON parsing
  - filters            - Optimistic        - Type conversion
                         Updates
```

## Components and Interfaces

### File Structure

```
packages/web/src/features/subjects/
├── components/
│   ├── SubjectsPage.tsx          # Main page container
│   ├── SubjectDataGrid.tsx       # Data table with columns
│   ├── SubjectInspector.tsx      # Right panel for details/edit
│   ├── SubjectForm.tsx           # Form for create/edit
│   ├── SubjectFormDrawer.tsx     # Drawer wrapper for form
│   ├── SubjectFilters.tsx        # Search and filter controls
│   └── CurriculumDialog.tsx      # Dialog for bulk curriculum operations
├── hooks/
│   ├── useSubjects.ts            # TanStack Query hooks
│   └── useSubjectFilters.ts      # Filter state management
├── utils/
│   ├── serialization.ts          # JSON serialization helpers
│   └── logger.ts                 # Feature-specific logging
├── api.ts                        # API functions
├── types.ts                      # TypeScript types
└── index.ts                      # Public exports
```

### Component Interfaces

```typescript
// SubjectsPage.tsx
export interface SubjectsPageProps {}

// SubjectDataGrid.tsx
export interface SubjectDataGridProps {
  subjects: Subject[];
  selectedId: number | null;
  onSelect: (subject: Subject | null) => void;
  isLoading?: boolean;
}

// SubjectInspector.tsx
export interface SubjectInspectorProps {
  subject: Subject;
  onClose: () => void;
  onSave: (data: Partial<SubjectFormValues>) => void;
  onDelete: () => void;
  isSaving?: boolean;
}

// SubjectForm.tsx
export interface SubjectFormProps {
  defaultValues?: Partial<SubjectFormValues>;
  onSubmit: (data: SubjectFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// SubjectFormDrawer.tsx
export interface SubjectFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// SubjectFilters.tsx
export interface SubjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  section: SectionFilter;
  onSectionChange: (value: SectionFilter) => void;
  onAddClick: () => void;
  onCurriculumClick: () => void;
  totalCount: number;
  filteredCount: number;
}

// CurriculumDialog.tsx
export interface CurriculumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'insert' | 'clear';
}
```

### Hook Interfaces

```typescript
// useSubjects.ts
export function useSubjects(): UseQueryResult<Subject[], Error>;
export function useSubject(id: number | null): UseQueryResult<Subject, Error>;
export function useCreateSubject(): UseMutationResult<
  Subject,
  Error,
  SubjectFormValues
>;
export function useUpdateSubject(): UseMutationResult<
  Subject,
  Error,
  { id: number; data: Partial<SubjectFormValues> }
>;
export function useDeleteSubject(): UseMutationResult<void, Error, number>;
export function useInsertCurriculum(): UseMutationResult<
  { count: number },
  Error,
  number
>;
export function useClearGradeSubjects(): UseMutationResult<void, Error, number>;

// useSubjectFilters.ts
export function useSubjectFilters(subjects: Subject[]): {
  filters: SubjectFiltersState;
  search: string;
  section: SectionFilter;
  setSearch: (value: string) => void;
  setSection: (value: SectionFilter) => void;
  resetFilters: () => void;
  filteredSubjects: Subject[];
  hasActiveFilters: boolean;
  totalCount: number;
  filteredCount: number;
};
```

## Data Models

### TypeScript Types (types.ts)

```typescript
/**
 * Section filter type for educational levels
 */
export type SectionFilter = 'all' | 'PRIMARY' | 'MIDDLE' | 'HIGH';

/**
 * Room type options for subject requirements
 */
export type RoomType = 'classroom' | 'lab' | 'gym' | 'library' | '';

/**
 * Subject entity matching the API response structure
 */
export interface Subject {
  id: number;
  schoolId: number | null;
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';
  requiredRoomType: RoomType;
  requiredFeatures: string[]; // Parsed from JSON
  desiredFeatures: string[]; // Parsed from JSON
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: Record<string, unknown>; // Parsed from JSON
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw API response for Subject (with JSON strings)
 */
export interface SubjectResponse {
  id: number;
  schoolId: number | null;
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: string;
  requiredRoomType: string;
  requiredFeatures: string; // JSON string
  desiredFeatures: string; // JSON string
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form values for creating/editing a subject
 */
export interface SubjectFormValues {
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';
  requiredRoomType: RoomType;
  requiredFeatures: string[];
  desiredFeatures: string[];
  isDifficult: boolean;
  minRoomCapacity: number;
}

/**
 * Filter state for the subjects list
 */
export interface SubjectFiltersState {
  search: string;
  section: SectionFilter;
}
```

### Zod Schema (packages/web/src/schemas/subject.schema.ts)

```typescript
import { z } from 'zod';

export const subjectSchema = z.object({
  name: z.string().min(1, 'نام مضمون الزامی است'),
  code: z
    .string()
    .min(1, 'کود مضمون الزامی است')
    .max(10, 'کود نباید بیشتر از ۱۰ حرف باشد'),
  grade: z.number().min(1).max(12).nullable(),
  periodsPerWeek: z
    .number()
    .min(1, 'حداقل ۱ ساعت')
    .max(10, 'حداکثر ۱۰ ساعت')
    .nullable(),
  section: z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']),
  requiredRoomType: z.enum(['classroom', 'lab', 'gym', 'library', '']),
  requiredFeatures: z.array(z.string()).default([]),
  desiredFeatures: z.array(z.string()).default([]),
  isDifficult: z.boolean().default(false),
  minRoomCapacity: z.number().min(0, 'ظرفیت نمی‌تواند منفی باشد').default(0),
});

export type SubjectFormData = z.infer<typeof subjectSchema>;
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following correctness properties have been
identified:

### Property 1: JSON Serialization Round-Trip

_For any_ valid array of feature strings, serializing to JSON and then
deserializing should produce an equivalent array.

This property ensures data integrity when features are saved to and loaded from
the API.

**Validates: Requirements 1.3, 6.5**

### Property 2: Section Filter Correctness

_For any_ list of subjects and any section filter value (PRIMARY, MIDDLE, HIGH),
all subjects in the filtered result should have a section matching the filter
value. When filter is 'all', all subjects should be returned.

**Validates: Requirements 2.1**

### Property 3: Search Filter Correctness

_For any_ list of subjects and any non-empty search term, all subjects in the
filtered result should contain the search term (case-insensitive) in either
their name or code field.

**Validates: Requirements 2.2**

### Property 4: Combined Filter Correctness

_For any_ list of subjects, section filter, and search term, the filtered result
should satisfy both filter conditions simultaneously. The result should be the
intersection of applying each filter independently.

**Validates: Requirements 2.3**

### Property 5: Filter Count Invariant

_For any_ list of subjects and any filter state, the filtered count should
always be less than or equal to the total count.

**Validates: Requirements 2.4**

### Property 6: Zod Schema Validation

_For any_ input object, the Zod schema should correctly identify whether it is
valid or invalid according to the defined constraints (required fields, string
lengths, number ranges).

**Validates: Requirements 3.3**

### Property 7: Section Translation Mapping

_For any_ section value (PRIMARY, MIDDLE, HIGH), the translation function should
consistently return the corresponding Farsi label (ابتدایی, متوسطه, لیسه).

**Validates: Requirements 8.4**

## Error Handling

### API Error Handling

```typescript
// Error types from API
interface ApiError {
  message: string;
  statusCode: number;
  details?: unknown;
}

// Error handling in hooks
onError: (error: Error) => {
  logger.error('Operation failed', { error: error.message });
  toast.error(getErrorMessage(error), {
    description: error.message,
  });
};

// Error message mapping (Farsi)
const errorMessages = {
  fetchFailed: 'خطا در دریافت لیست مضامین',
  createFailed: 'خطا در ایجاد مضمون',
  updateFailed: 'خطا در به‌روزرسانی مضمون',
  deleteFailed: 'خطا در حذف مضمون',
  curriculumInsertFailed: 'خطا در درج نصاب تعلیمی',
  curriculumClearFailed: 'خطا در پاک کردن مضامین',
};
```

### Validation Error Handling

```typescript
// Zod validation errors are displayed inline with form fields
// React Hook Form handles error state management
const form = useForm<SubjectFormData>({
  resolver: zodResolver(subjectSchema),
});

// Error display in form
{form.formState.errors.name && (
  <p className="text-sm text-destructive">
    {form.formState.errors.name.message}
  </p>
)}
```

### Empty State Handling

```typescript
// Empty state component for DataGrid
if (subjects.length === 0) {
  return (
    <EmptyState
      icon={BookOpen}
      title="هیچ مضمونی یافت نشد"
      description="برای شروع، یک مضمون جدید اضافه کنید یا نصاب تعلیمی را درج کنید"
      action={{
        label: "افزودن مضمون",
        onClick: onAddClick,
      }}
    />
  );
}
```

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure
comprehensive coverage:

1. **Unit Tests**: Verify specific examples, edge cases, and integration points
2. **Property-Based Tests**: Verify universal properties that should hold across
   all inputs

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript property-based testing library)
- **Minimum Iterations**: 100 per property test
- **Test Location**: `packages/web/src/features/subjects/__tests__/`

### Unit Test Coverage

| Component/Function       | Test Focus                         |
| ------------------------ | ---------------------------------- |
| `deserializeSubject`     | JSON parsing, null handling        |
| `serializeSubjectForApi` | Array to JSON string conversion    |
| `filterBySection`        | Section filter logic               |
| `filterBySearch`         | Search matching logic              |
| `SubjectForm`            | Form validation, submission        |
| `SubjectInspector`       | Tab rendering, save/delete actions |
| `SubjectDataGrid`        | Column rendering, row selection    |

### Property-Based Test Coverage

| Property               | Test File                        | Generator Strategy                        |
| ---------------------- | -------------------------------- | ----------------------------------------- |
| JSON Round-Trip        | `serialization.property.test.ts` | Generate random string arrays             |
| Section Filter         | `filters.property.test.ts`       | Generate random subjects with sections    |
| Search Filter          | `filters.property.test.ts`       | Generate random subjects and search terms |
| Combined Filters       | `filters.property.test.ts`       | Generate random filter combinations       |
| Filter Count Invariant | `filters.property.test.ts`       | Generate random subjects and filters      |
| Zod Validation         | `schema.property.test.ts`        | Generate valid/invalid form data          |
| Section Translation    | `translation.property.test.ts`   | Generate section values                   |

### Test Annotation Format

All property-based tests must be annotated with the following format:

```typescript
/**
 * **Feature: subjects-feature, Property 1: JSON Serialization Round-Trip**
 * **Validates: Requirements 1.3, 6.5**
 */
```
