# Implementation Plan

- [x] 1. Set up feature structure and core types
  - [x] 1.1 Create feature directory structure and index exports
    - Create `src/features/classes/` directory structure with components/,
      hooks/, utils/, **tests**/ folders
    - Create `index.ts` with public exports
    - _Requirements: 10.1_
  - [x] 1.2 Define TypeScript interfaces and types
    - Create `types.ts` with ClassGroup, SubjectRequirement, ClassFormValues,
      GradeCategory interfaces
    - Ensure types match API entity structure
    - _Requirements: 10.1_
  - [x] 1.3 Create Zod validation schema for class form
    - Create `schemas/class.schema.ts` with classFormSchema and
      subjectRequirementSchema
    - Include localized validation messages using i18n keys
    - _Requirements: 2.4, 10.1_

- [x] 2. Implement utility functions
  - [x] 2.1 Create grade category utility functions
    - Implement `getGradeCategory(grade)` function
    - Implement `isGradeInCategory(grade, category)` function
    - Implement `shouldEnableSingleTeacherMode(grade)` function
    - Add GRADE_CATEGORY_COLORS constant
    - _Requirements: 5.3, 5.4, 2.5_
  - [x] 2.2 Write property test for grade category classification
    - **Property 4: Grade Category Classification**
    - **Validates: Requirements 5.3, 5.4**
  - [x] 2.3 Write property test for single-teacher mode auto-enable
    - **Property 3: Single-Teacher Mode Auto-Enable**
    - **Validates: Requirements 2.5, 5.4**
  - [x] 2.4 Create serialization utility functions
    - Implement `serializeSubjectRequirements(requirements)` function
    - Implement `deserializeSubjectRequirements(json)` function with error
      handling
    - _Requirements: 12.1, 12.2, 12.4_
  - [x] 2.5 Write property test for subject requirements round-trip
        serialization
    - **Property 5: Subject Requirements Round-Trip Serialization**
    - **Validates: Requirements 12.1, 12.2, 12.3**
  - [x] 2.6 Create debug logger utility
    - Implement logger with debug, info, warn, error levels
    - Include component lifecycle logging helpers
    - _Requirements: 10.2, 10.3_

- [-] 3. Implement API layer and hooks
  - [x] 3.1 Create API functions for classes CRUD
    - Implement `classesApi.getAll()`, `getById()`, `create()`, `update()`,
      `delete()`
    - Include serialization/deserialization of subjectRequirements
    - Add debug logging for all API calls
    - _Requirements: 11.1, 11.4_
  - [x] 3.2 Create TanStack Query hooks
    - Implement `useClasses()` hook for fetching all classes
    - Implement `useClass(id)` hook for fetching single class
    - Implement `useCreateClass()` mutation hook
    - Implement `useUpdateClass()` mutation hook
    - Implement `useDeleteClass()` mutation hook
    - Include cache invalidation on mutations
    - _Requirements: 11.2, 11.3_
  - [x] 3.3 Create filter state hook
    - Implement `useClassFilters()` hook with search and gradeCategory state
    - Include filter logic for classes list
    - _Requirements: 1.2, 1.3_
  - [x] 3.4 Write property test for search filtering
    - **Property 1: Search Filtering Correctness**
    - **Validates: Requirements 1.2**
  - [x] 3.5 Write property test for grade category filtering
    - **Property 2: Grade Category Filtering Correctness**
    - **Validates: Requirements 1.3, 5.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add i18n translations
  - [x] 5.1 Add Persian/Dari translations for classes namespace
    - Add all translation keys to `locales/fa.json` under classes namespace
    - Include page titles, form labels, validation messages, error messages
    - _Requirements: 9.1, 9.2_
  - [x] 5.2 Add English translations for classes namespace
    - Add all translation keys to `locales/en.json` under classes namespace
    - _Requirements: 9.1, 9.3_

- [x] 6. Implement UI components
  - [x] 6.1 Create GradeBadge component
    - Display grade number with category-colored badge
    - Support RTL layout
    - Add debug logging on mount
    - _Requirements: 1.4, 5.3_
  - [x] 6.2 Create SingleTeacherBadge component
    - Display visual indicator for single-teacher mode
    - Use localized tooltip text
    - _Requirements: 6.4_
  - [x] 6.3 Create RoomSelector component
    - Dropdown populated with available rooms from API
    - Show warning indicator for rooms assigned to other classes
    - Support placeholder for no room selected
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 6.4 Create ClassFilters component
    - Implement grade category tabs (All, Alpha-Primary, Beta-Primary, Middle,
      High)
    - Implement search input field
    - Use i18n for all labels
    - _Requirements: 5.1, 1.2_

- [x] 7. Implement ClassForm component
  - [x] 7.1 Create ClassForm with react-hook-form and Zod
    - Include fields: name, grade, sectionIndex, studentCount, fixedRoomId,
      singleTeacherMode, classTeacherId
    - Integrate Zod validation with localized error messages
    - Auto-enable single-teacher mode for grades 1-3
    - _Requirements: 2.2, 2.4, 2.5_
  - [x] 7.2 Create SubjectRequirementsEditor component
    - Display list of subject requirements with period count inputs
    - Support add/remove subject functionality
    - Validate period counts within allowed range
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Implement ClassFormDrawer component
  - [x] 8.1 Create drawer/sheet component for class creation
    - Open from left side (RTL layout) with ~30% width
    - Include backdrop overlay blocking main content
    - Integrate ClassForm component
    - Handle close on backdrop click or close button
    - _Requirements: 2.1, 2.6_
  - [x] 8.2 Connect drawer to create mutation
    - Call useCreateClass on form submit
    - Close drawer and show success toast on success
    - Display localized error message on failure
    - _Requirements: 2.3, 2.7, 11.2, 11.3_

- [x] 9. Implement ClassInspector component
  - [x] 9.1 Create inspector panel structure
    - Side panel on left (RTL layout)
    - Tabbed interface: Basic Info, Subject Requirements, Assignments
    - Close button and deselect handling
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 9.2 Implement Basic Info tab
    - Display and edit class basic information
    - Show/hide class teacher selector based on single-teacher mode
    - _Requirements: 3.3, 3.5_
  - [x] 9.3 Implement Subject Requirements tab
    - Integrate SubjectRequirementsEditor component
    - Save changes on modification
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.4 Connect inspector to update mutation
    - Call useUpdateClass on save
    - Reflect changes in DataGrid
    - Display localized error/success messages
    - _Requirements: 3.3, 11.2, 11.3_

- [x] 10. Implement ClassDataGrid component
  - [x] 10.1 Create DataGrid wrapper for classes
    - Configure columns: name, grade (with badge), sectionIndex, studentCount,
      classTeacher, fixedRoom
    - Support row selection to open inspector
    - Include delete action button per row
    - _Requirements: 1.1, 1.4_
  - [x] 10.2 Integrate filtering with DataGrid
    - Apply search filter from useClassFilters
    - Apply grade category filter
    - _Requirements: 1.2, 1.3_
  - [x] 10.3 Implement delete confirmation dialog
    - Show localized confirmation message
    - Call useDeleteClass on confirm
    - Close dialog on cancel
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 11. Implement ClassesPage container
  - [x] 11.1 Create main page component
    - Compose ClassFilters, ClassDataGrid, ClassInspector, ClassFormDrawer
    - Manage selected class state
    - Handle loading and error states
    - _Requirements: 1.1, 1.5, 10.1_
  - [x] 11.2 Wire up all component interactions
    - Open drawer on "Add Class" button click
    - Open inspector on row selection
    - Close inspector on deselect or close button
    - _Requirements: 2.1, 3.1, 3.4_
  - [x] 11.3 Add page header with actions
    - Display page title and subtitle (localized)
    - Add "Add Class" button
    - _Requirements: 9.1_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Write integration and additional property tests
  - [ ] 13.1 Write property test for class creation
    - **Property 6: Class Creation Adds to List**
    - **Validates: Requirements 2.3**
  - [ ] 13.2 Write property test for class update
    - **Property 7: Class Update Persists Changes**
    - **Validates: Requirements 3.3**
  - [ ] 13.3 Write property test for class deletion
    - **Property 8: Class Deletion Removes from List**
    - **Validates: Requirements 4.2**
  - [ ] 13.4 Write property test for API error handling
    - **Property 10: API Error Handling**
    - **Validates: Requirements 10.4, 11.3**
  - [ ] 13.5 Write unit tests for ClassForm validation
    - Test empty name validation
    - Test grade range validation
    - Test single-teacher mode toggle behavior
    - _Requirements: 2.4_

- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
