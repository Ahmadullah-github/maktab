# Requirements Document

## Introduction

This document specifies the requirements for Schedule Feature - Phase 8:
Undo/Redo & Persistence. After swap validation (Phase 7), this phase implements
the actual swap execution, undo/redo functionality, and persistence to the
database. This phase enables users to execute validated swaps, undo/redo their
changes, and save their modifications to the database with proper unsaved
changes tracking.

## Glossary

- **Swap_Action**: A recorded swap operation containing before and after states
  for undo/redo
- **Undo_Stack**: A LIFO stack storing executed swap actions for reversal
- **Redo_Stack**: A LIFO stack storing undone swap actions for re-application
- **Edit_State**: The state tracking original lessons, undo/redo stacks, and
  save status
- **Unsaved_Changes**: Modifications made since the last save operation
- **Original_Lessons**: A snapshot of lessons from the last save point
- **Stack_Limit**: Maximum number of actions stored in undo stack (50)
- **Swap_Execution**: The process of applying a validated swap to the schedule
- **Save_Operation**: Persisting current schedule state to the database

## Requirements

### Requirement 1: Edit State Extension

**User Story:** As a school administrator, I want the schedule store to track my
editing history, so that I can undo and redo my changes.

#### Acceptance Criteria

1. THE Schedule_Store SHALL maintain an originalLessons array containing a
   snapshot from the last save
2. THE Schedule_Store SHALL maintain an undoStack array of Swap_Actions
3. THE Schedule_Store SHALL maintain a redoStack array of Swap_Actions
4. THE Schedule_Store SHALL maintain a lastSavedAt timestamp or null if never
   saved
5. THE Schedule_Store SHALL provide an unsavedChangesCount computed property
   returning the undoStack length
6. THE Schedule_Store SHALL provide a hasUnsavedChanges computed property
   returning true when undoStack is not empty

### Requirement 2: Swap Action Structure

**User Story:** As a developer, I want a well-defined swap action structure, so
that undo/redo operations can accurately restore previous states.

#### Acceptance Criteria

1. THE Swap_Action SHALL contain a unique id string
2. THE Swap_Action SHALL contain a timestamp number
3. THE Swap_Action SHALL contain a type field set to 'swap'
4. THE Swap_Action SHALL contain a before object with lessonA and lessonB states
5. THE Swap_Action SHALL contain an after object with lessonA and lessonB states
6. WHEN lessonB is an empty slot THEN the Swap_Action SHALL store null for
   lessonB in before and after

### Requirement 3: Swap Execution

**User Story:** As a school administrator, I want to execute validated swaps, so
that I can modify my schedule.

#### Acceptance Criteria

1. WHEN executeSwap is called with a validated SwapOperation THEN the
   Schedule_Store SHALL create a Swap_Action with before and after states
2. WHEN executeSwap is called THEN the Schedule_Store SHALL update the lessons
   array by swapping the positions
3. WHEN executeSwap is called THEN the Schedule_Store SHALL update indexes
   incrementally
4. WHEN executeSwap is called THEN the Schedule_Store SHALL push the Swap_Action
   to undoStack
5. WHEN executeSwap is called THEN the Schedule_Store SHALL clear the redoStack
6. WHEN executeSwap is called THEN the Schedule_Store SHALL set interactionMode
   to 'idle'
7. WHEN executeSwap is called THEN the Schedule_Store SHALL clear the
   selectedLesson

### Requirement 4: Undo Operation

**User Story:** As a school administrator, I want to undo my last swap, so that
I can correct mistakes.

#### Acceptance Criteria

1. WHEN undo is called and undoStack is not empty THEN the Schedule_Store SHALL
   pop the last Swap_Action from undoStack
2. WHEN undo is called THEN the Schedule_Store SHALL restore the 'before' state
   to the lessons array
3. WHEN undo is called THEN the Schedule_Store SHALL update indexes to reflect
   the restored state
4. WHEN undo is called THEN the Schedule_Store SHALL push the popped action to
   redoStack
5. WHEN undo is called and undoStack is empty THEN the Schedule_Store SHALL do
   nothing

### Requirement 5: Redo Operation

**User Story:** As a school administrator, I want to redo an undone swap, so
that I can re-apply changes I previously undid.

#### Acceptance Criteria

1. WHEN redo is called and redoStack is not empty THEN the Schedule_Store SHALL
   pop the last Swap_Action from redoStack
2. WHEN redo is called THEN the Schedule_Store SHALL restore the 'after' state
   to the lessons array
3. WHEN redo is called THEN the Schedule_Store SHALL update indexes to reflect
   the restored state
4. WHEN redo is called THEN the Schedule_Store SHALL push the popped action to
   undoStack
5. WHEN redo is called and redoStack is empty THEN the Schedule_Store SHALL do
   nothing

### Requirement 6: Stack Limit Enforcement

**User Story:** As a system, I want to limit the undo stack size, so that memory
usage remains bounded.

#### Acceptance Criteria

1. THE undoStack SHALL have a maximum capacity of 50 Swap_Actions
2. WHEN a new Swap_Action is pushed and undoStack has 50 items THEN the
   Schedule_Store SHALL remove the oldest action
3. THE redoStack SHALL be cleared when a new swap is executed

### Requirement 7: useSwapExecution Hook

**User Story:** As a developer, I want a hook to execute swaps, so that
components can trigger swap execution consistently.

#### Acceptance Criteria

1. THE useSwapExecution hook SHALL return an executeSwap function accepting a
   validated SwapValidationResult
2. THE useSwapExecution hook SHALL return an isExecuting boolean state
3. WHEN executeSwap is called THEN the hook SHALL set isExecuting to true during
   execution
4. WHEN executeSwap completes THEN the hook SHALL set isExecuting to false

### Requirement 8: useUndoRedo Hook

**User Story:** As a developer, I want a hook to manage undo/redo operations, so
that components can easily integrate undo/redo functionality.

#### Acceptance Criteria

1. THE useUndoRedo hook SHALL return an undo function
2. THE useUndoRedo hook SHALL return a redo function
3. THE useUndoRedo hook SHALL return a canUndo boolean (true when undoStack is
   not empty)
4. THE useUndoRedo hook SHALL return a canRedo boolean (true when redoStack is
   not empty)
5. THE useUndoRedo hook SHALL return an undoCount number (undoStack length)
6. THE useUndoRedo hook SHALL return a redoCount number (redoStack length)

### Requirement 9: Keyboard Shortcuts

**User Story:** As a school administrator, I want to use keyboard shortcuts for
undo/redo/save, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN Ctrl+Z is pressed THEN the system SHALL call undo()
2. WHEN Ctrl+Y is pressed THEN the system SHALL call redo()
3. WHEN Ctrl+Shift+Z is pressed THEN the system SHALL call redo() as an
   alternative
4. WHEN Ctrl+S is pressed THEN the system SHALL call save()
5. THE keyboard shortcuts SHALL only be active when the schedule page is focused
6. THE keyboard shortcuts SHALL not conflict with browser or OS shortcuts

### Requirement 10: UndoRedoButtons Component

**User Story:** As a school administrator, I want visible undo/redo buttons, so
that I can easily access these functions.

#### Acceptance Criteria

1. THE UndoRedoButtons component SHALL display an undo button with an
   appropriate icon
2. THE UndoRedoButtons component SHALL display a redo button with an appropriate
   icon
3. WHEN canUndo is false THEN the undo button SHALL be disabled
4. WHEN canRedo is false THEN the redo button SHALL be disabled
5. THE buttons SHALL display tooltips showing the action description
6. THE tooltips SHALL include keyboard shortcut hints

### Requirement 11: SaveButton Component

**User Story:** As a school administrator, I want a save button with unsaved
changes indicator, so that I know when I need to save.

#### Acceptance Criteria

1. THE SaveButton component SHALL display a save icon button
2. THE SaveButton component SHALL display an UnsavedBadge showing the unsaved
   changes count
3. WHEN hasUnsavedChanges is false THEN the SaveButton SHALL be disabled
4. WHEN save is in progress THEN the SaveButton SHALL show a loading state
5. WHEN save succeeds THEN the system SHALL show a success toast
6. WHEN save fails THEN the system SHALL show an error toast

### Requirement 12: UnsavedBadge Component

**User Story:** As a school administrator, I want to see how many unsaved
changes I have, so that I can decide when to save.

#### Acceptance Criteria

1. THE UnsavedBadge SHALL display a small badge with the unsaved changes count
2. THE UnsavedBadge SHALL be positioned at the top-right of the SaveButton
3. WHEN count is 0 THEN the UnsavedBadge SHALL be hidden
4. THE UnsavedBadge SHALL animate when the count increments

### Requirement 13: useUnsavedChanges Hook

**User Story:** As a developer, I want a hook to track unsaved changes and
handle navigation warnings, so that users don't accidentally lose their work.

#### Acceptance Criteria

1. THE useUnsavedChanges hook SHALL return a count number (unsavedChangesCount)
2. THE useUnsavedChanges hook SHALL return a hasChanges boolean
3. THE useUnsavedChanges hook SHALL return a confirmLeave function returning a
   Promise<boolean>
4. THE hook SHALL register a beforeunload handler when hasChanges is true
5. THE hook SHALL show UnsavedChangesDialog on navigation attempts when
   hasChanges is true

### Requirement 14: UnsavedChangesDialog Component

**User Story:** As a school administrator, I want to be warned before losing
unsaved changes, so that I don't accidentally discard my work.

#### Acceptance Criteria

1. THE UnsavedChangesDialog SHALL display when the user tries to navigate away
   with unsaved changes
2. THE UnsavedChangesDialog SHALL display when the user tries to close the
   window with unsaved changes
3. THE UnsavedChangesDialog SHALL display when the user tries to load a
   different schedule with unsaved changes
4. THE dialog message SHALL be in Persian: "شما X تغییر ذخیره نشده دارید" (You
   have X unsaved changes)
5. THE dialog SHALL have a "ذخیره و خروج" (Save and Leave) button
6. THE dialog SHALL have a "خروج بدون ذخیره" (Leave without Saving) button
7. THE dialog SHALL have a "لغو" (Cancel) button
8. WHEN "ذخیره و خروج" is clicked THEN the system SHALL save and then proceed
   with navigation
9. WHEN "خروج بدون ذخیره" is clicked THEN the system SHALL proceed without
   saving
10. WHEN "لغو" is clicked THEN the system SHALL cancel the navigation

### Requirement 15: Save Flow

**User Story:** As a school administrator, I want my changes to be saved to the
database, so that they persist across sessions.

#### Acceptance Criteria

1. WHEN save is triggered THEN the system SHALL call the timetable update API
   with current lessons
2. WHEN save succeeds THEN the Schedule_Store SHALL call markAsSaved()
3. WHEN markAsSaved is called THEN the Schedule_Store SHALL update
   originalLessons to current lessons
4. WHEN markAsSaved is called THEN the Schedule_Store SHALL clear the undoStack
5. WHEN markAsSaved is called THEN the Schedule_Store SHALL update lastSavedAt
   to current timestamp
6. WHEN save fails THEN the system SHALL keep the current state unchanged
7. WHEN save succeeds THEN the system SHALL show a success toast in Persian:
   "تغییرات ذخیره شد" (Changes saved)

### Requirement 16: Performance Requirements

**User Story:** As a school administrator, I want undo/redo operations to be
instant, so that I can work without delays.

#### Acceptance Criteria

1. THE undo operation SHALL complete in less than 16ms
2. THE redo operation SHALL complete in less than 16ms
3. THE swap execution SHALL complete in less than 16ms
4. THE indexes SHALL remain synchronized after all operations

### Requirement 17: Electron Compatibility

**User Story:** As a desktop application user, I want the unsaved changes
warning to work in Electron, so that I'm protected from data loss.

#### Acceptance Criteria

1. THE beforeunload handler SHALL work correctly in Electron environment
2. THE keyboard shortcuts SHALL work correctly in Electron environment
3. THE save operation SHALL work correctly in Electron environment
