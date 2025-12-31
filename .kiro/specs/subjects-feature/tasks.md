# Implementation Plan

- [-] 1. Set up feature module structure and types
  - [x] 1.1 Create feature directory structure
    - Create `packages/web/src/features/subjects/` directory
    - Create subdirectories: `components/`, `hooks/`, `utils/`
    - Create placeholder files: `api.ts`, `types.ts`, `index.ts`
    - _Requirements: 11.1_

  - [x] 1.2 Implement TypeScript types (types.ts)
    - Define `Subject`, `SubjectResponse`, `SubjectFormValues` interfaces
    - Define `SectionFilter`, `RoomType` type aliases
    - Define `SubjectFiltersState` interface
    - _Requirements: 1.2, 1.3_

  - [x] 1.3 Implement Zod schema (packages/web/src/schemas/subject.schema.ts)
    - Create `subjectSchema` with all field validations
    - Add Farsi error messages for validation failures
    - Export `SubjectFormData` type
    - _Requirements: 3.3, 4.4, 8.2_

  - [x] 1.4 Write property test for Zod schema validation
    - **Property 6: Zod Schema Validation**
    - **Validates: Requirements 3.3**

- [x] 2. Implement API layer and serialization utilities
  - [x] 2.1 Create serialization utilities (utils/serialization.ts)
    - Implement `deserializeSubject()` function to parse JSON string fields
    - Implement `serializeSubjectForApi()` function to stringify arrays
    - Implement `parseJsonArray()` and `parseJsonObject()` helpers
    - _Requirements: 1.3, 6.5_

  - [x] 2.2 Write property test for JSON serialization round-trip
    - **Property 1: JSON Serialization Round-Trip**
    - **Validates: Requirements 1.3, 6.5**

  - [x] 2.3 Create logger utility (utils/logger.ts)
    - Create feature-specific logger with namespace 'subjects'
    - Add `apiLogger` for API request/response logging
    - _Requirements: 11.1_

  - [x] 2.4 Implement API functions (api.ts)
    - Implement `subjectsApi.getAll()` with deserialization
    - Implement `subjectsApi.getById()` with deserialization
    - Implement `subjectsApi.create()` with serialization
    - Implement `subjectsApi.update()` with serialization
    - Implement `subjectsApi.delete()`
    - Implement `subjectsApi.insertCurriculum()` for bulk insert
    - Implement `subjectsApi.clearGradeSubjects()` for bulk delete
    - _Requirements: 1.1, 3.4, 4.3, 5.2, 9.3, 10.2_

- [x] 3. Implement TanStack Query hooks
  - [x] 3.1 Create useSubjects hooks (hooks/useSubjects.ts)
    - Implement `useSubjects()` query hook for listing
    - Implement `useSubject(id)` query hook for single subject
    - Implement `useCreateSubject()` mutation with cache invalidation
    - Implement `useUpdateSubject()` mutation with cache invalidation
    - Implement `useDeleteSubject()` mutation with cache invalidation
    - Add Farsi toast notifications for success/error
    - _Requirements: 1.1, 1.5, 3.4, 3.5, 3.6, 4.5, 4.6, 5.3, 5.4, 11.2_

  - [x] 3.2 Create curriculum hooks (hooks/useSubjects.ts)
    - Implement `useInsertCurriculum()` mutation
    - Implement `useClearGradeSubjects()` mutation
    - Add Farsi toast notifications for success/error
    - _Requirements: 9.3, 9.4, 9.5, 10.2, 10.3, 10.4_

  - [x] 3.3 Create filter hooks (hooks/useSubjectFilters.ts)
    - Implement `filterSubjectsBySection()` function
    - Implement `filterSubjectsBySearch()` function
    - Implement `applySubjectFilters()` combining both filters
    - Implement `useSubjectFilters()` hook with state management
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Write property tests for filter functions
    - **Property 2: Section Filter Correctness**
    - **Property 3: Search Filter Correctness**
    - **Property 4: Combined Filter Correctness**
    - **Property 5: Filter Count Invariant**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement UI components - DataGrid and Filters
  - [x] 5.1 Create SubjectFilters component (components/SubjectFilters.tsx)
    - Implement section filter tabs (همه/ابتدایی/متوسطه/لیسه)
    - Implement search input with debounce
    - Add "افزودن مضمون جدید" button
    - Add "درج نصاب تعلیمی" dropdown button
    - Display filtered/total count
    - _Requirements: 2.1, 2.2, 2.4, 4.1, 9.1_

  - [x] 5.2 Create SubjectDataGrid component (components/SubjectDataGrid.tsx)
    - Implement table with columns: name, code, section, grade, periodsPerWeek,
      requiredRoomType, isDifficult
    - Add section badge with color coding (amber/blue/purple)
    - Add isDifficult indicator icon
    - Implement row selection with click handler
    - Implement empty state with Farsi message
    - _Requirements: 1.2, 1.4, 7.3, 8.4_

  - [x] 5.3 Write property test for section translation
    - **Property 7: Section Translation Mapping**
    - **Validates: Requirements 8.4**

- [x] 6. Implement UI components - Form and Inspector
  - [x] 6.1 Create SubjectForm component (components/SubjectForm.tsx)
    - Implement form with React Hook Form + Zod resolver
    - Add all form fields with Farsi labels
    - Implement room type select dropdown
    - Implement required/desired features tag inputs
    - Implement isDifficult switch with hint text
    - Display validation errors in Farsi
    - _Requirements: 4.2, 4.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 8.1, 8.2_

  - [x] 6.2 Create SubjectFormDrawer component
        (components/SubjectFormDrawer.tsx)
    - Wrap SubjectForm in Sheet component (left side for RTL)
    - Handle open/close state
    - Connect to useCreateSubject mutation
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [x] 6.3 Create SubjectInspector component (components/SubjectInspector.tsx)
    - Implement tabbed interface (معلومات/نیازمندی‌ها/تنظیمات)
    - Implement info tab with basic fields
    - Implement requirements tab with room settings
    - Implement settings tab with isDifficult toggle
    - Add save and delete action buttons
    - Add delete confirmation dialog
    - Connect to useUpdateSubject and useDeleteSubject mutations
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4_

- [x] 7. Implement curriculum dialog and main page
  - [x] 7.1 Create CurriculumDialog component (components/CurriculumDialog.tsx)
    - Implement grade selection dropdown (1-12)
    - Implement insert curriculum mode with preview
    - Implement clear grade subjects mode with warning
    - Connect to useInsertCurriculum and useClearGradeSubjects mutations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 7.2 Create SubjectsPage component (components/SubjectsPage.tsx)
    - Compose all components: Filters, DataGrid, Inspector, FormDrawer,
      CurriculumDialog
    - Manage selected subject state
    - Manage drawer/dialog open states
    - Wire up all event handlers
    - _Requirements: 1.1, 8.1_

  - [x] 7.3 Create feature index exports (index.ts)
    - Export all types from types.ts
    - Export API client from api.ts
    - Export all components with their prop types
    - Export all hooks
    - Export utility functions
    - _Requirements: 11.1_

- [x] 8. Add i18n translations and update route
  - [x] 8.1 Add Farsi translations
        (packages/web/src/i18n/locales/fa/subjects.json)
    - Add page title and subtitle translations
    - Add column header translations
    - Add section filter translations
    - Add room type translations
    - Add form field label translations
    - Add inspector tab translations
    - Add success/error message translations
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.2 Update subjects route (packages/web/src/routes/subjects.tsx)
    - Import SubjectsPage from features/subjects
    - Replace placeholder with SubjectsPage component
    - _Requirements: 1.1_

- [x] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
