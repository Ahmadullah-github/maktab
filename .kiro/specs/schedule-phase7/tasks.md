# Implementation Plan: Schedule Feature - Phase 7: Swap Validation Engine

## Overview

This implementation plan breaks down the Swap Validation Engine into discrete
coding tasks. The plan follows an incremental approach, building the constraint
checker utilities first, then the hook, and finally the UI components.

## Tasks

- [x] 1. Define constraint types and validation interfaces
  - Add SWAP_CONSTRAINT_TYPES constant to features/schedule/constants.ts
  - Add SwapOperation, ConstraintViolation, SwapValidationResult interfaces to
    features/schedule/types.ts
  - Add TeacherConstraintData, SubjectConstraintData, RoomConstraintData
    interfaces
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Implement hard constraint checkers
  - [x] 2.1 Create constraintChecker.ts with checkTeacherAvailability function
    - Check teacher availability array for target day/period
    - Handle multi-teacher lessons (check ALL teachers)
    - Return TEACHER_UNAVAILABLE violation with Persian message
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Write property test for teacher availability check
    - **Property 3: Teacher Availability Check**
    - **Validates: Requirements 3.2**

  - [x] 2.3 Implement checkTeacherConflict function
    - Use byTeacherAndSlot index for O(1) lookup
    - Exclude swap partner from conflict check
    - Return TEACHER_CONFLICT violation with class/subject details
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.4 Write property test for teacher conflict detection
    - **Property 4: Teacher Conflict Detection**
    - **Validates: Requirements 4.2**

  - [x] 2.5 Implement checkRoomConflict function
    - Use byRoomAndSlot index for O(1) lookup
    - Handle null roomId (skip check)
    - Return ROOM_CONFLICT violation with class details
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.6 Write property test for room conflict detection
    - **Property 5: Room Conflict Detection**
    - **Validates: Requirements 5.2**

  - [x] 2.7 Implement checkClassConflict function
    - Use byClassAndSlot index for O(1) lookup
    - Exclude swap partner from conflict check
    - Return CLASS_CONFLICT violation
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.8 Write property test for class conflict detection
    - **Property 7: Class Conflict Detection**
    - **Validates: Requirements 7.2**

  - [x] 2.9 Implement checkRoomTypeMismatch function
    - Check subject's requiredRoomType against target room type
    - Handle null requiredRoomType (no constraint)
    - Return ROOM_TYPE_MISMATCH violation with type details
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.10 Write property test for room type validation
    - **Property 6: Room Type Validation**
    - **Validates: Requirements 6.2**

- [x] 3. Checkpoint - Ensure hard constraint tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement soft constraint checkers
  - [x] 4.1 Implement checkTeacherPreference function
    - Check teacher's timePreference (Morning/Afternoon/None)
    - Morning preference + afternoon slot (period >= 4) = warning
    - Afternoon preference + morning slot (period < 4) = warning
    - Return TEACHER_PREFERENCE warning
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 Write property test for teacher preference violation
    - **Property 8: Teacher Preference Violation**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 4.3 Implement checkConsecutivePeriods function
    - Calculate resulting consecutive periods after swap
    - Compare against teacher's maxConsecutivePeriods
    - Return CONSECUTIVE_EXCEEDED warning with counts
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.4 Write property test for consecutive periods warning
    - **Property 9: Consecutive Periods Warning**
    - **Validates: Requirements 9.2**

  - [x] 4.5 Implement checkDifficultAfternoon function
    - Check subject's isDifficult flag
    - Check if target slot is afternoon (period >= 4)
    - Return DIFFICULT_AFTERNOON warning with subject name
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 4.6 Write property test for difficult afternoon warning
    - **Property 10: Difficult Subject Afternoon Warning**
    - **Validates: Requirements 10.1**

- [x] 5. Implement main validateSwap function
  - [x] 5.1 Create validateSwap function that orchestrates all checks
    - Run all hard constraint checks first
    - Run all soft constraint checks
    - Aggregate results into SwapValidationResult
    - Set isValid and canProceedWithWarning flags correctly
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.2 Write property test for validation result correctness
    - **Property 1: Validation Result Correctness**
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 5.3 Write property test for violation categorization
    - **Property 2: Violation Categorization**
    - **Validates: Requirements 2.6, 2.7**

  - [x] 5.4 Write property test for multi-teacher validation
    - **Property 16: Multi-Teacher Validation**
    - **Validates: Requirements 3.4, 18.1, 18.2, 18.3**

- [x] 6. Checkpoint - Ensure all constraint checker tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement useValidSwapTargets hook
  - [x] 7.1 Create useValidSwapTargets hook
    - Accept selectedLesson and viewScope options
    - Return empty map when no lesson selected
    - Compute validation for all potential targets in view scope
    - Exclude selected lesson's own slot
    - Use useMemo for memoization
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.2 Add getValidationStatus helper function
    - Convert SwapValidationResult to CellValidationStatus
    - Return 'valid', 'warning', 'blocked', or null
    - _Requirements: 16.3_

  - [x] 7.3 Write property test for valid targets computation
    - **Property 11: Valid Targets Computation**
    - **Validates: Requirements 11.1, 11.3, 11.4**

- [x] 8. Implement SwapIndicator component
  - [x] 8.1 Create SwapIndicator component
    - Accept status prop: 'valid' | 'warning' | 'blocked' | null
    - Render green overlay for 'valid' (bg-green-500/20, border-green-500)
    - Render yellow overlay for 'warning' (bg-yellow-500/20, border-yellow-500)
    - Render red overlay for 'blocked' (bg-red-500/20, border-red-500)
    - Return null for null status
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 8.2 Write property test for SwapIndicator visual state
    - **Property 12: SwapIndicator Visual State**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [x] 9. Implement SwapPreview component
  - [x] 9.1 Create SwapPreview component
    - Show source lesson at target position with opacity-50
    - Show target lesson at source position with opacity-50
    - Use CSS transitions for smooth animation
    - Display alongside current state (not replace)
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 10. Implement swap dialogs
  - [x] 10.1 Create SwapWarningDialog component
    - Title: "هشدار جابجایی"
    - List all warnings with AlertTriangle icons
    - "ادامه" (Continue) and "لغو" (Cancel) buttons
    - Call onConfirm or onCancel based on user action
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 10.2 Write property test for warning dialog display
    - **Property 13: Warning Dialog Display**
    - **Validates: Requirements 14.1, 14.3**

  - [x] 10.3 Create SwapBlockedDialog component
    - Title: "جابجایی ممکن نیست"
    - List all errors with XCircle icons
    - "متوجه شدم" (Understood) button
    - Show alternative slots if provided
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 10.4 Write property test for blocked dialog display
    - **Property 14: Blocked Dialog Display**
    - **Validates: Requirements 15.1, 15.3**

- [x] 11. Integrate with ScheduleCell
  - [x] 11.1 Update ScheduleCell to accept validationStatus prop
    - Add validationStatus to ScheduleCellProps
    - Render SwapIndicator based on validationStatus
    - Add onSwapAttempt callback prop
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 11.2 Write property test for ScheduleCell indicator rendering
    - **Property 15: ScheduleCell Indicator Rendering**
    - **Validates: Requirements 16.2**

- [x] 12. Integrate with ScheduleGrid
  - [x] 12.1 Update ScheduleGrid to use useValidSwapTargets
    - Call hook with selectedLesson from store
    - Pass validationStatus to each ScheduleCell
    - Handle swap attempts with dialog display
    - _Requirements: 11.1, 16.1_

  - [x] 12.2 Add hover state for SwapPreview
    - Track hovered cell when lesson is selected
    - Show SwapPreview on hover over valid/warning targets
    - _Requirements: 13.1, 13.2_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify validation completes in <100ms for 700 lessons
  - _Requirements: 17.1, 17.2_

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Performance requirement: validation must complete in <100ms for 700 lessons
