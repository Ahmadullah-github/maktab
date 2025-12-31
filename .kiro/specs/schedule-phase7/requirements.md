# Requirements Document

## Introduction

This document specifies the requirements for Schedule Feature - Phase 7: Swap
Validation Engine. This phase implements the core complexity of manual schedule
editing by computing which lessons can be swapped with a selected lesson,
checking all hard and soft constraints. The validation engine provides real-time
feedback to users about valid swap targets, warnings for soft constraint
violations, and clear explanations for blocked swaps.

## Glossary

- **Swap_Operation**: An exchange of two lessons between their respective time
  slots
- **Constraint_Violation**: A rule that would be broken by a proposed swap
  operation
- **Hard_Constraint**: A constraint that absolutely blocks a swap (e.g., teacher
  unavailable, room conflict)
- **Soft_Constraint**: A constraint that generates a warning but allows the swap
  to proceed (e.g., teacher preference, consecutive periods exceeded)
- **Swap_Validation_Result**: The outcome of validating a swap, including
  validity status, errors, and warnings
- **Valid_Swap_Target**: A lesson or slot that can receive the selected lesson
  without hard constraint violations
- **Schedule_Indexes**: Pre-computed O(1) lookup structures for efficient
  constraint checking
- **Teacher_Availability**: Boolean array per day indicating which periods a
  teacher is available
- **Room_Type**: Classification of rooms (e.g., classroom, lab, gym) that must
  match subject requirements
- **Consecutive_Periods**: Multiple periods in a row taught by the same teacher
- **View_Scope**: The current view context (class view or teacher view) that
  determines swap boundaries

## Requirements

### Requirement 1: Constraint Type Definitions

**User Story:** As a developer, I want clearly defined constraint types with
severity levels, so that the validation engine can categorize violations
consistently.

#### Acceptance Criteria

1. THE Constraint_Types constant SHALL define TEACHER_UNAVAILABLE as a
   Hard_Constraint with code 'teacher_unavailable'
2. THE Constraint_Types constant SHALL define TEACHER_CONFLICT as a
   Hard_Constraint with code 'teacher_conflict'
3. THE Constraint_Types constant SHALL define ROOM_CONFLICT as a Hard_Constraint
   with code 'room_conflict'
4. THE Constraint_Types constant SHALL define CLASS_CONFLICT as a
   Hard_Constraint with code 'class_conflict'
5. THE Constraint_Types constant SHALL define ROOM_TYPE_MISMATCH as a
   Hard_Constraint with code 'room_type_mismatch'
6. THE Constraint_Types constant SHALL define TEACHER_PREFERENCE as a
   Soft_Constraint with code 'teacher_preference'
7. THE Constraint_Types constant SHALL define CONSECUTIVE_EXCEEDED as a
   Soft_Constraint with code 'consecutive_exceeded'
8. THE Constraint_Types constant SHALL define DIFFICULT_AFTERNOON as a
   Soft_Constraint with code 'difficult_afternoon'

### Requirement 2: Swap Operation Validation

**User Story:** As a school administrator, I want the system to validate swap
operations against all constraints, so that I can make informed decisions about
schedule changes.

#### Acceptance Criteria

1. WHEN validateSwap is called with a Swap_Operation THEN the Constraint_Checker
   SHALL check all Hard_Constraints first
2. WHEN validateSwap is called with a Swap_Operation THEN the Constraint_Checker
   SHALL check all Soft_Constraints after hard constraints
3. WHEN any Hard_Constraint is violated THEN the Swap_Validation_Result SHALL
   have isValid set to false
4. WHEN only Soft_Constraints are violated THEN the Swap_Validation_Result SHALL
   have isValid set to true and canProceedWithWarning set to true
5. WHEN no constraints are violated THEN the Swap_Validation_Result SHALL have
   isValid set to true and canProceedWithWarning set to false
6. THE Swap_Validation_Result SHALL include all Constraint_Violations in the
   errors array for Hard_Constraints
7. THE Swap_Validation_Result SHALL include all Constraint_Violations in the
   warnings array for Soft_Constraints

### Requirement 3: Teacher Availability Constraint

**User Story:** As a school administrator, I want the system to prevent swaps to
slots where a teacher is unavailable, so that I don't create invalid schedules.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a target slot THEN the Constraint_Checker SHALL
   verify the teacher's availability for that day and period
2. IF the teacher's availability array shows false for the target period THEN
   the Constraint_Checker SHALL return a TEACHER_UNAVAILABLE violation
3. THE TEACHER_UNAVAILABLE violation message SHALL be in Persian: "معلم در این
   زمان در دسترس نیست"
4. WHEN a lesson has multiple teachers THEN the Constraint_Checker SHALL check
   availability for ALL teachers

### Requirement 4: Teacher Conflict Constraint

**User Story:** As a school administrator, I want the system to prevent swaps
that would double-book a teacher, so that teachers aren't scheduled for two
classes simultaneously.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a target slot THEN the Constraint_Checker SHALL
   check if any teacher is already teaching another class at that slot
2. IF a teacher is already scheduled at the target slot (excluding the swap
   partner) THEN the Constraint_Checker SHALL return a TEACHER_CONFLICT
   violation
3. THE TEACHER_CONFLICT violation message SHALL be in Persian: "معلم در این زمان
   کلاس دیگری دارد"
4. THE violation details SHALL include the conflicting class name and subject

### Requirement 5: Room Conflict Constraint

**User Story:** As a school administrator, I want the system to prevent swaps
that would double-book a room, so that two classes aren't scheduled in the same
room simultaneously.

#### Acceptance Criteria

1. WHEN a lesson with a room assignment is swapped to a target slot THEN the
   Constraint_Checker SHALL check if the room is already occupied
2. IF the room is already scheduled at the target slot (excluding the swap
   partner) THEN the Constraint_Checker SHALL return a ROOM_CONFLICT violation
3. THE ROOM_CONFLICT violation message SHALL be in Persian: "اتاق در این زمان
   اشغال است"
4. THE violation details SHALL include the conflicting class name

### Requirement 6: Room Type Mismatch Constraint

**User Story:** As a school administrator, I want the system to prevent swaps
where the room type doesn't match subject requirements, so that lab classes stay
in labs.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a slot with a different room THEN the
   Constraint_Checker SHALL verify the room type matches the subject's required
   room type
2. IF the subject requires a specific room type and the target room doesn't
   match THEN the Constraint_Checker SHALL return a ROOM_TYPE_MISMATCH violation
3. THE ROOM_TYPE_MISMATCH violation message SHALL be in Persian: "نوع اتاق با
   نیاز درس مطابقت ندارد"
4. THE violation details SHALL include the required room type and actual room
   type

### Requirement 7: Class Conflict Constraint

**User Story:** As a school administrator, I want the system to prevent swaps
that would give a class two lessons at the same time, so that students aren't
double-booked.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a target slot THEN the Constraint_Checker SHALL
   check if the class already has a lesson at that slot
2. IF the class already has a lesson at the target slot (excluding the swap
   partner) THEN the Constraint_Checker SHALL return a CLASS_CONFLICT violation
3. THE CLASS_CONFLICT violation message SHALL be in Persian: "کلاس در این زمان
   درس دیگری دارد"

### Requirement 8: Teacher Preference Soft Constraint

**User Story:** As a school administrator, I want to be warned when a swap
conflicts with teacher time preferences, so that I can consider teacher
satisfaction.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a target slot THEN the Constraint_Checker SHALL
   check the teacher's time preference (Morning/Afternoon/None)
2. IF the teacher prefers Morning and the target slot is in the afternoon
   (period >= 4) THEN the Constraint_Checker SHALL return a TEACHER_PREFERENCE
   warning
3. IF the teacher prefers Afternoon and the target slot is in the morning
   (period < 4) THEN the Constraint_Checker SHALL return a TEACHER_PREFERENCE
   warning
4. THE TEACHER_PREFERENCE warning message SHALL be in Persian: "این زمان با
   ترجیح معلم مطابقت ندارد"

### Requirement 9: Consecutive Periods Soft Constraint

**User Story:** As a school administrator, I want to be warned when a swap would
exceed a teacher's maximum consecutive periods, so that I can avoid teacher
fatigue.

#### Acceptance Criteria

1. WHEN a lesson is swapped to a target slot THEN the Constraint_Checker SHALL
   calculate the resulting consecutive periods for the teacher
2. IF the swap would result in more consecutive periods than the teacher's
   maxConsecutivePeriods THEN the Constraint_Checker SHALL return a
   CONSECUTIVE_EXCEEDED warning
3. THE CONSECUTIVE_EXCEEDED warning message SHALL be in Persian: "تعداد ساعات
   متوالی معلم بیش از حد مجاز می‌شود"
4. THE warning details SHALL include the current consecutive count and the
   maximum allowed

### Requirement 10: Difficult Subject Afternoon Soft Constraint

**User Story:** As a school administrator, I want to be warned when moving a
difficult subject to the afternoon, so that I can maintain optimal learning
conditions.

#### Acceptance Criteria

1. WHEN a difficult subject lesson is swapped to an afternoon slot (period >= 4)
   THEN the Constraint_Checker SHALL return a DIFFICULT_AFTERNOON warning
2. THE DIFFICULT_AFTERNOON warning message SHALL be in Persian: "درس سخت در
   بعدازظهر توصیه نمی‌شود"
3. THE warning details SHALL include the subject name

### Requirement 11: Valid Swap Targets Hook

**User Story:** As a school administrator, I want to see which cells are valid
swap targets when I select a lesson, so that I can quickly identify my options.

#### Acceptance Criteria

1. WHEN a lesson is selected THEN the useValidSwapTargets hook SHALL compute
   validation results for all potential target slots
2. THE hook SHALL return a Map with slot keys mapped to Swap_Validation_Results
3. WHEN no lesson is selected THEN the hook SHALL return an empty Map
4. THE hook SHALL exclude the selected lesson's own slot from potential targets
5. THE hook SHALL use Schedule_Indexes for O(1) lookups during validation
6. THE validation computation SHALL complete in less than 100ms for schedules
   with up to 700 lessons

### Requirement 12: Swap Indicator Visual Feedback

**User Story:** As a school administrator, I want to see visual indicators on
cells showing whether they are valid swap targets, so that I can quickly
understand my options.

#### Acceptance Criteria

1. WHEN a cell is a valid swap target THEN the SwapIndicator SHALL display a
   green overlay (bg-green-500/20, border-green-500)
2. WHEN a cell has soft constraint warnings THEN the SwapIndicator SHALL display
   a yellow overlay (bg-yellow-500/20, border-yellow-500)
3. WHEN a cell is blocked by hard constraints THEN the SwapIndicator SHALL
   display a red overlay (bg-red-500/20, border-red-500)
4. WHEN no lesson is selected THEN the SwapIndicator SHALL not display any
   overlay

### Requirement 13: Swap Preview Display

**User Story:** As a school administrator, I want to see a preview of what the
schedule would look like after a swap, so that I can verify the change before
committing.

#### Acceptance Criteria

1. WHEN hovering over a valid swap target THEN the SwapPreview SHALL show the
   source lesson at the target position with reduced opacity
2. WHEN hovering over a valid swap target THEN the SwapPreview SHALL show the
   target lesson at the source position with reduced opacity
3. THE SwapPreview SHALL animate the transition smoothly
4. THE SwapPreview SHALL display alongside the current state, not replace it

### Requirement 14: Swap Warning Dialog

**User Story:** As a school administrator, I want to see a warning dialog when
attempting a swap with soft constraint violations, so that I can make an
informed decision.

#### Acceptance Criteria

1. WHEN a swap is attempted with soft constraint violations THEN the
   SwapWarningDialog SHALL display
2. THE SwapWarningDialog title SHALL be "هشدار جابجایی" (Swap Warning)
3. THE SwapWarningDialog SHALL list all warnings with appropriate icons
4. THE SwapWarningDialog SHALL have "ادامه" (Continue) and "لغو" (Cancel)
   buttons
5. WHEN the user clicks "ادامه" THEN the swap SHALL proceed
6. WHEN the user clicks "لغو" THEN the swap SHALL be cancelled

### Requirement 15: Swap Blocked Dialog

**User Story:** As a school administrator, I want to see a clear explanation
when a swap is blocked, so that I understand why it's not possible.

#### Acceptance Criteria

1. WHEN a swap is attempted with hard constraint violations THEN the
   SwapBlockedDialog SHALL display
2. THE SwapBlockedDialog title SHALL be "جابجایی ممکن نیست" (Swap Not Possible)
3. THE SwapBlockedDialog SHALL list all errors with explanations
4. THE SwapBlockedDialog SHALL have a "متوجه شدم" (Understood) button
5. WHEN possible THEN the SwapBlockedDialog SHALL suggest alternative slots

### Requirement 16: ScheduleCell Integration

**User Story:** As a school administrator, I want the schedule cells to reflect
validation status, so that I can see valid targets at a glance.

#### Acceptance Criteria

1. THE ScheduleCell component SHALL accept a validationStatus prop from
   useValidSwapTargets
2. THE ScheduleCell SHALL render the SwapIndicator component based on
   validationStatus
3. THE validationStatus SHALL be one of: 'valid', 'warning', 'blocked', or null

### Requirement 17: Performance Requirements

**User Story:** As a school administrator, I want the validation to be fast, so
that I don't experience lag when selecting lessons.

#### Acceptance Criteria

1. THE validation engine SHALL complete all constraint checks for a single swap
   in less than 1ms
2. THE useValidSwapTargets hook SHALL compute all valid targets in less than
   100ms for 700 lessons
3. THE validation engine SHALL use Schedule_Indexes for O(1) lookups instead of
   array scans
4. THE validation results SHALL be memoized during the selection session

### Requirement 18: Multi-Teacher Support

**User Story:** As a school administrator, I want the validation to handle
lessons with multiple teachers, so that team-taught classes are properly
validated.

#### Acceptance Criteria

1. WHEN validating a lesson with multiple teachers THEN the Constraint_Checker
   SHALL check availability for ALL teachers
2. WHEN validating a lesson with multiple teachers THEN the Constraint_Checker
   SHALL check conflicts for ALL teachers
3. IF ANY teacher has a constraint violation THEN the swap SHALL be blocked or
   warned accordingly
