# Implementation Plan: Schedule Feature - Phase 8: Undo/Redo & Persistence

## Overview

This implementation plan breaks down the Phase 8 features into discrete coding
tasks. The implementation follows an incremental approach, starting with core
types and store extensions, then hooks, then UI components, and finally
integration.

## Tasks

- [x] 1. Define Edit State Types and Constants
  - Add SwapAction interface to types.ts
  - Add EditState interface to types.ts
  - Add UNDO_STACK_LIMIT constant (50)
  - Export new types from index.ts
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Extend Schedule Store with Edit State
  - [x] 2.1 Add edit state properties to ScheduleState interface
    - Add originalLessons, undoStack, redoStack, lastSavedAt
    - Update initialScheduleState with empty edit state
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implement computed selectors for edit state
    - Add getUnsavedChangesCount selector
    - Add getHasUnsavedChanges selector
    - Add getCanUndo selector
    - Add getCanRedo selector
    - _Requirements: 1.5, 1.6_

  - [x] 2.3 Implement executeSwap action
    - Create SwapAction with unique id and timestamp
    - Update lessons array by swapping positions
    - Update indexes incrementally
    - Push to undoStack (with limit enforcement)
    - Clear redoStack
    - Set interactionMode to 'idle' and clear selectedLesson
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2_

  - [x] 2.4 Implement undo action
    - Pop from undoStack if not empty
    - Restore 'before' state to lessons
    - Update indexes
    - Push to redoStack
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.5 Implement redo action
    - Pop from redoStack if not empty
    - Restore 'after' state to lessons
    - Update indexes
    - Push to undoStack
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.6 Implement markAsSaved action
    - Update originalLessons to current lessons
    - Clear undoStack
    - Set lastSavedAt to current timestamp
    - _Requirements: 15.3, 15.4, 15.5_

  - [x] 2.7 Implement initializeEditState action
    - Set originalLessons to current lessons
    - Clear undoStack and redoStack
    - _Requirements: 1.1_

- [x] 2.8 Write property tests for edit state
  - **Property 1: Undo/Redo Round Trip**
  - **Property 2: Swap Execution State Consistency**
  - **Property 3: Stack Limit Enforcement**
  - **Property 4: Computed Properties Correctness**
  - **Property 5: Index Synchronization**
  - **Property 6: markAsSaved State Reset**
  - **Validates: Requirements 1.5, 1.6, 3.1-3.7, 4.1-4.5, 5.1-5.5, 6.1, 6.2,
    15.3-15.5**

- [x] 3. Checkpoint - Ensure store tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement useSwapExecution Hook
  - [x] 4.1 Create useSwapExecution hook
    - Return executeSwap function accepting SwapValidationResult
    - Return isExecuting boolean state
    - Handle execution state transitions
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Write unit tests for useSwapExecution
    - Test executeSwap calls store action
    - Test isExecuting state transitions
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5. Implement useUndoRedo Hook
  - [x] 5.1 Create useUndoRedo hook
    - Return undo and redo functions
    - Return canUndo and canRedo booleans
    - Return undoCount and redoCount numbers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Write unit tests for useUndoRedo
    - Test undo/redo function calls
    - Test computed values match store state
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 6. Implement useUnsavedChanges Hook
  - [x] 6.1 Create useUnsavedChanges hook
    - Return count and hasChanges from store
    - Return confirmLeave function with Promise<boolean>
    - Return save function and isSaving state
    - Register beforeunload handler when hasChanges
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 6.2 Write unit tests for useUnsavedChanges
    - Test count and hasChanges values
    - Test beforeunload registration
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 7. Implement useKeyboardShortcuts Hook
  - [x] 7.1 Create useKeyboardShortcuts hook
    - Register Ctrl+Z for undo
    - Register Ctrl+Y for redo
    - Register Ctrl+Shift+Z for redo (alternative)
    - Register Ctrl+S for save
    - Only active when enabled option is true
    - Prevent default browser behavior
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 7.2 Write unit tests for useKeyboardShortcuts
    - Test keyboard event handling
    - Test enabled/disabled state
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Checkpoint - Ensure hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement UnsavedBadge Component
  - [x] 9.1 Create UnsavedBadge component
    - Display small badge with count
    - Position at top-right (absolute positioning)
    - Hide when count is 0
    - Add animation on count change
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 9.2 Write property test for UnsavedBadge
    - **Property 8: Badge Visibility**
    - **Validates: Requirements 12.1, 12.3**

- [x] 10. Implement UndoRedoButtons Component
  - [x] 10.1 Create UndoRedoButtons component
    - Render undo button with Undo2 icon
    - Render redo button with Redo2 icon
    - Disable buttons based on canUndo/canRedo
    - Add tooltips with action descriptions
    - Include keyboard shortcut hints in tooltips
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 10.2 Write property test for UndoRedoButtons
    - **Property 7: Button Disabled States**
    - **Validates: Requirements 10.3, 10.4**

- [x] 11. Implement SaveButton Component
  - [x] 11.1 Create SaveButton component
    - Render save icon button
    - Include UnsavedBadge
    - Disable when no unsaved changes
    - Show loading state during save
    - Show success/error toasts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 11.2 Write unit tests for SaveButton
    - Test disabled state
    - Test loading state
    - Test toast display
    - _Requirements: 11.3, 11.4, 11.5, 11.6_

- [x] 12. Implement UnsavedChangesDialog Component
  - [x] 12.1 Create UnsavedChangesDialog component
    - Display Persian message with count
    - Add "ذخیره و خروج" (Save and Leave) button
    - Add "خروج بدون ذخیره" (Leave without Saving) button
    - Add "لغو" (Cancel) button
    - Handle button click callbacks
    - Show loading state during save
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9,
      14.10_

  - [x] 12.2 Write property test for UnsavedChangesDialog
    - **Property 9: Dialog Message Count**
    - **Validates: Requirements 14.4**

- [x] 13. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Integrate Components into Schedule Page
  - [x] 14.1 Add edit toolbar to schedule page
    - Add UndoRedoButtons to toolbar
    - Add SaveButton to toolbar
    - Wire up useKeyboardShortcuts
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1_

  - [x] 14.2 Integrate UnsavedChangesDialog
    - Show dialog on navigation attempts
    - Show dialog on schedule change attempts
    - Handle save and leave flow
    - _Requirements: 14.1, 14.2, 14.3, 14.8, 14.9, 14.10_

  - [x] 14.3 Connect swap execution to validation
    - Update ScheduleCell to call executeSwap on valid target click
    - Handle warning dialog confirmation flow
    - _Requirements: 3.1, 3.2_

  - [x] 14.4 Initialize edit state on schedule load
    - Call initializeEditState after loadSchedule
    - _Requirements: 1.1_

- [x] 15. Implement Save API Integration
  - [x] 15.1 Create useSaveSchedule mutation hook
    - Call PUT /timetables/:id with current lessons
    - Call markAsSaved on success
    - Show success toast in Persian
    - Show error toast on failure
    - _Requirements: 15.1, 15.2, 15.6, 15.7_

  - [x] 15.2 Write integration tests for save flow
    - Test successful save
    - Test failed save
    - _Requirements: 15.1, 15.2, 15.6, 15.7_

- [x] 16. Export hooks and components
  - Update features/schedule/hooks/index.ts
  - Update features/schedule/components/index.ts
  - _Requirements: All_

- [x] 17. Final Checkpoint - Ensure all tests pass
  - All 102 Phase 8 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with React 18 and Zustand
- UI components use Shadcn/ui primitives
- Persian (Farsi) is used for all user-facing strings
