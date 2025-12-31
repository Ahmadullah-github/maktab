# Implementation Plan

## Phase 1: Foundation

- [x] 1. Set up types and API layer
  - [x] 1.1 Create types.ts with Teacher, TeacherResponse, TeacherFormValues,
        UnavailableSlot, ClassAssignment, TeacherFiltersState, and
        TeacherStatusFilter interfaces
    - Match API entity structure from packages/api/src/entity/Teacher.ts
    - _Requirements: 9.1_
  - [x] 1.2 Create utils/serialization.ts with JSON parse/stringify helpers for
        array fields
    - Functions: parseJsonArray, parseJsonObject, stringifyArray,
      stringifyObject
    - Handle null/empty string cases gracefully
    - _Requirements: 4.6, 9.1_
  - [x] 1.3 Write property test for serialization round-trip
    - **Property 7: Unavailable slots serialization round-trip**
    - **Validates: Requirements 4.6**
  - [x] 1.4 Create utils/logger.ts with debug logging utilities
    - Follow pattern from classes feature
    - _Requirements: 9.1_
  - [x] 1.5 Create api.ts with CRUD functions and serialization
    - Functions: getAll, getById, create, update, delete
    - Deserialize JSON strings to arrays/objects on fetch
    - Serialize arrays/objects to JSON strings on save
    - _Requirements: 9.1, 9.2_

- [x] 2. Set up Zod schema and validation
  - [x] 2.1 Create packages/web/src/schemas/teacher.schema.ts
    - Define teacherFormSchema with all fields
    - Use i18n keys for validation messages
    - _Requirements: 2.1, 2.2, 2.3, 9.3_
  - [x] 2.2 Write property test for name validation
    - **Property 3: Teacher name validation rejects invalid inputs**
    - **Validates: Requirements 2.2, 2.3**

- [x] 3. Create TanStack Query hooks
  - [x] 3.1 Create hooks/useTeachers.ts
    - Implement useTeachers, useTeacher, useCreateTeacher, useUpdateTeacher,
      useDeleteTeacher
    - Add Farsi toast notifications for success/error
    - Proper cache invalidation on mutations
    - _Requirements: 2.4, 2.5, 2.6, 9.2_
  - [x] 3.2 Create hooks/useSchoolConfig.ts
    - Fetch SchoolConfig for dynamic constraint limits
    - Cache with TanStack Query
    - _Requirements: 4.1, 5.1, 5.2, 5.3_

- [x] 4. Create filter hook and utilities
  - [x] 4.1 Create hooks/useTeacherFilters.ts
    - Implement search filter by fullName
    - Implement status filter (all, fullTime, partTime)
    - Export applyTeacherFilters utility
    - _Requirements: 1.2, 1.3_
  - [x] 4.2 Write property tests for filter functions
    - **Property 1: Search filter returns matching teachers**
    - **Property 2: Status filter returns correct employment type**
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Core Components

- [x] 6. Create UI helper components
  - [x] 6.1 Create components/ui/StatusBadge.tsx
    - Display active/inactive status with appropriate colors
    - _Requirements: 1.1_
  - [x] 6.2 Create components/ui/HoursIndicator.tsx
    - Display filled hours / max hours with progress indicator
    - _Requirements: 1.1_

- [x] 7. Create TeacherDataGrid component
  - [x] 7.1 Create components/TeacherDataGrid.tsx
    - Columns: row number, full name, status badge, subject count, hours/week,
      actions
    - Row selection with callback
    - Delete button with AlertDialog confirmation
    - Empty state with Farsi message
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [x] 8. Create TeacherFilters component
  - [x] 8.1 Create components/TeacherFilters.tsx
    - Search input with debounce
    - Status filter buttons (all, full-time, part-time)
    - Display filtered/total count
    - _Requirements: 1.2, 1.3_

## Phase 3: AvailabilityMatrix Component

- [x] 9. Implement AvailabilityMatrix
  - [x] 9.1 Create components/AvailabilityMatrix.tsx
    - Grid with days as columns (RTL: right to left)
    - Periods as rows based on SchoolConfig
    - Support variable periods per day from periodsPerDayMap
    - Click to toggle cell state
    - Visual states: available (green), unavailable (red)
    - Legend component for color explanation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 9.2 Write property tests for AvailabilityMatrix
    - **Property 5: Availability matrix toggle is idempotent pair**
    - **Property 6: Availability matrix dimensions match SchoolConfig**
    - **Validates: Requirements 4.1, 4.2, 4.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: SubjectManager Component

- [x] 11. Implement SubjectManager with drag-drop
  - [x] 11.1 Create components/SubjectManager.tsx
    - Three zones: available subjects, primary subjects, allowed subjects
    - Use @dnd-kit for drag-drop functionality
    - Search filter for available subjects
    - Switch for "restrict to primary subjects"
    - Remove button (X) on assigned subjects
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 11.2 Write property test for subject zone consistency
    - **Property 4: Subject zone state consistency**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.6**

## Phase 5: Inspector and Form Components

- [x] 12. Create TeacherForm component
  - [x] 12.1 Create components/TeacherForm.tsx
    - Fields: fullName (required)
    - Constraint fields: maxPeriodsPerWeek, maxPeriodsPerDay,
      maxConsecutivePeriods
    - Dynamic validation limits from SchoolConfig
    - React Hook Form + Zod integration
    - _Requirements: 2.1, 5.1, 5.2, 5.3, 5.4, 5.5, 9.3_
  - [x] 12.2 Write property test for constraint validation
    - **Property 8: Constraint validation against dynamic limits**
    - **Property 9: Default constraints derived from SchoolConfig**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

- [x] 13. Create TeacherInspector component
  - [x] 13.1 Create components/TeacherInspector.tsx
    - Sheet component (side="left" for RTL)
    - Tabs: Basic Info, Subjects, Availability, Constraints
    - Tab 1: TeacherForm basic fields
    - Tab 2: SubjectManager
    - Tab 3: AvailabilityMatrix
    - Tab 4: Constraint fields
    - Save and Close buttons
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 13.2 Write property test for tab state preservation
    - **Property 10: Tab switching preserves form state**
    - **Validates: Requirements 6.3**

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Wizard Component

- [x] 15. Create TeacherFormDrawer (Wizard)
  - [x] 15.1 Create components/TeacherFormDrawer.tsx
    - Drawer component with 4 steps
    - Step 1: Personal Information (fullName)
    - Step 2: Subjects (SubjectManager)
    - Step 3: Availability (AvailabilityMatrix)
    - Step 4: Constraints
    - Progress indicator showing current/total steps
    - Back/Next navigation buttons
    - Validation on each step before advancing
    - Final save creates teacher with all data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 15.2 Write property tests for wizard navigation
    - **Property 11: Wizard step validation and progression**
    - **Property 12: Wizard data preservation across navigation**
    - **Validates: Requirements 7.3, 7.4, 7.5**

## Phase 7: Main Page and Integration

- [x] 16. Create TeachersPage container
  - [x] 16.1 Create components/TeachersPage.tsx
    - Three-column layout (Filters | DataGrid | Inspector)
    - State management for selectedTeacherId
    - "Add New Teacher" button opens FormDrawer
    - Loading and error states
    - Integration of all child components
    - _Requirements: 1.1, 6.1, 7.1_

- [x] 17. Update feature exports and routing
  - [x] 17.1 Update index.ts with all exports
    - Export types, API, components, hooks, utils
    - _Requirements: 9.1_
  - [x] 17.2 Verify route integration in TanStack Router
    - Ensure /teachers route renders TeachersPage
    - _Requirements: 9.1_

- [x] 18. Verify i18n translations
  - [x] 18.1 Verify all translation keys exist in fa.json
    - Check teachers namespace has all required keys
    - Add any missing validation message keys
    - _Requirements: 8.1, 8.4_

- [x] 19. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
