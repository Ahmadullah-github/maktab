# Implementation Plan

- [x] 1. Set up feature module structure and types
  - [x] 1.1 Create types.ts with Room, RoomResponse, RoomFormValues, and filter
        types
    - Define Room interface with parsed JSON fields (features as string[],
      unavailable as UnavailableSlot[])
    - Define RoomResponse interface matching API response (JSON strings)
    - Define RoomFormValues for form handling
    - Define RoomTypeFilter and RoomFiltersState types
    - _Requirements: 1.1, 3.2, 7.2_

  - [x] 1.2 Create serialization utilities in utils/serialization.ts
    - Implement deserializeRoom function to parse JSON fields from API response
    - Implement serializeRoomForApi function to stringify arrays for API
    - Implement parseJsonArray and parseJsonObject helpers with error handling
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 1.3 Write property test for serialization round-trip
    - **Property 4: Room serialization round-trip**
    - **Validates: Requirements 7.2, 9.1, 9.2**

  - [x] 1.4 Create logger utilities in utils/logger.ts
    - Set up feature-specific logger following subjects pattern
    - Add apiLogger, componentLogger exports
    - _Requirements: 1.1_

- [x] 2. Implement API layer and data hooks
  - [x] 2.1 Create api.ts with roomsApi client
    - Implement getAll() to fetch all rooms with deserialization
    - Implement getById(id) for single room fetch
    - Implement create(data) with serialization
    - Implement update(id, data) with serialization
    - Implement delete(id) for soft delete
    - _Requirements: 1.1, 4.2, 5.2, 6.2_

  - [x] 2.2 Create useRooms.ts hook with TanStack Query
    - Implement useRooms() query hook for fetching all rooms
    - Implement useRoom(id) query hook for single room
    - Implement useCreateRoom() mutation with cache invalidation and Farsi toast
    - Implement useUpdateRoom() mutation with cache invalidation and Farsi toast
    - Implement useDeleteRoom() mutation with cache invalidation and Farsi toast
    - _Requirements: 1.1, 4.2, 5.2, 6.2_

  - [x] 2.3 Create useRoomFilters.ts hook for filter state
    - Implement filter state management (search, typeFilter)
    - Implement filterRoomsBySearch function (case-insensitive partial match)
    - Implement filterRoomsByType function
    - Implement applyRoomFilters combining both filters
    - Export filteredRooms, totalCount, filteredCount
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.4 Write property tests for filter functions
    - **Property 1: Search filter returns matching rooms**
    - **Validates: Requirements 2.1**

  - [x] 2.5 Write property test for type filter
    - **Property 2: Type filter returns matching rooms**
    - **Validates: Requirements 2.2**

  - [x] 2.6 Write property test for filter count accuracy
    - **Property 3: Filter count accuracy**
    - **Validates: Requirements 2.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement UI components
  - [x] 4.1 Create RoomForm.tsx component
    - Build form with react-hook-form and Zod validation
    - Add name input (required, min 1 char)
    - Add capacity input (required, min 1)
    - Add type select dropdown (classroom, lab, gym, library)
    - Add features TagInput component for multi-select
    - Add submit/cancel buttons with loading state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1_

  - [x] 4.2 Create RoomFormDrawer.tsx wrapper component
    - Wrap RoomForm in Sheet/Drawer component
    - Handle open/close state
    - Connect to useCreateRoom mutation
    - Close drawer on successful creation
    - _Requirements: 4.1, 4.2_

  - [x] 4.3 Create RoomFilters.tsx component
    - Add search input with debounce
    - Add room type dropdown filter
    - Add "Add Room" button
    - Display filtered count vs total count
    - _Requirements: 2.1, 2.2, 2.3, 4.1_

  - [x] 4.4 Create RoomDataGrid.tsx component
    - Render table with columns: name, type, capacity, features count
    - Implement row selection with highlight
    - Handle empty state with guidance message
    - Support loading state
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.5 Write property test for DataGrid rendering
    - **Property 8: DataGrid displays all rooms**
    - **Validates: Requirements 1.1**

  - [x] 4.6 Create RoomInspector.tsx component
    - Build tabbed interface (Info, Features, Availability, Settings)
    - Info tab: name, type, capacity fields with inline editing
    - Features tab: TagInput for features array with badges display
    - Availability tab: unavailable slots editor (day/period grid)
    - Settings tab: delete button with confirmation dialog
    - Connect to useUpdateRoom and useDeleteRoom mutations
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.2, 7.3, 8.1,
      8.2, 8.3_

  - [x] 4.7 Write property test for Inspector completeness
    - **Property 6: Inspector displays all properties**
    - **Validates: Requirements 3.2**

  - [x] 4.8 Write property test for features rendering
    - **Property 5: Features rendering completeness**
    - **Validates: Requirements 7.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate components into RoomsPage
  - [x] 6.1 Create RoomsPage.tsx container component
    - Compose RoomFilters, RoomDataGrid, RoomInspector, RoomFormDrawer
    - Manage selected room state
    - Connect filter state to DataGrid
    - Handle loading and error states
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 6.2 Update index.ts with public exports
    - Export all types, components, hooks, and utilities
    - _Requirements: 1.1_

  - [x] 6.3 Update rooms route to use RoomsPage
    - Replace PlaceholderPage with RoomsPage component
    - _Requirements: 1.1_

  - [x] 6.4 Write property test for delete removes from list
    - **Property 7: Delete removes room from list**
    - **Validates: Requirements 6.2**

- [x] 7. Add i18n translations
  - [x] 7.1 Add Farsi translations for rooms feature
    - Add rooms.pageTitle, rooms.pageSubtitle
    - Add rooms.form.\* labels and placeholders
    - Add rooms.columns.\* for DataGrid headers
    - Add rooms.errors.\* for error messages
    - Add rooms.deleteConfirm.\* for delete dialog
    - Add rooms.emptyState for empty state message
    - Add rooms.tabs.\* for inspector tabs
    - _Requirements: 1.4, 4.3, 4.4, 4.5, 5.3, 6.1_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
