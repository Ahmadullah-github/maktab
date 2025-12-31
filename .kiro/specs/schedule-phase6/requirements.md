# Requirements Document

## Introduction

This document specifies the requirements for Schedule Feature - Phase 6: Manual
Editing Foundation. This phase establishes the interaction foundation for manual
schedule editing, enabling users to navigate the schedule grid with keyboard and
mouse, select cells, and prepare for swap operations. The implementation
leverages the existing dnd-kit library already available in the project.

## Glossary

- **Schedule_Grid**: The visual grid component displaying the timetable with
  days as columns and periods as rows
- **Focused_Slot**: The currently keyboard-focused cell position identified by
  day and period
- **Selected_Lesson**: A lesson that has been explicitly selected by the user
  for potential editing operations
- **Interaction_Mode**: The current state of user interaction: idle, selecting,
  previewing, or executing
- **Drag_Operation**: A mouse-based interaction where a lesson is picked up and
  moved to another slot
- **Drop_Target**: A cell that can receive a dragged lesson
- **RTL_Navigation**: Right-to-left navigation where left arrow moves forward
  (next day) and right arrow moves backward (previous day)
- **Lock_State**: A boolean flag preventing concurrent interactions during drag
  or swap operations

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to navigate the schedule grid
using keyboard arrow keys, so that I can efficiently move between cells without
using a mouse.

#### Acceptance Criteria

1. WHEN the user presses ArrowUp while the grid is focused THEN the
   Schedule_Grid SHALL move focus to the previous period (period - 1) in the
   same day
2. WHEN the user presses ArrowDown while the grid is focused THEN the
   Schedule_Grid SHALL move focus to the next period (period + 1) in the same
   day
3. WHEN the user presses ArrowLeft while the grid is focused THEN the
   Schedule_Grid SHALL move focus to the next day (RTL_Navigation: left =
   forward)
4. WHEN the user presses ArrowRight while the grid is focused THEN the
   Schedule_Grid SHALL move focus to the previous day (RTL_Navigation: right =
   backward)
5. WHEN the user navigates to a boundary (first/last period or day) THEN the
   Schedule_Grid SHALL stop at the boundary without wrapping
6. WHILE the Lock_State is true THEN the Schedule_Grid SHALL ignore keyboard
   navigation inputs

### Requirement 2

**User Story:** As a school administrator, I want to see a clear visual
indicator of which cell is currently focused, so that I can track my position in
the grid.

#### Acceptance Criteria

1. WHEN a cell receives keyboard focus THEN the Schedule_Grid SHALL display a
   visible focus ring around the Focused_Slot
2. WHEN focus moves to a different cell THEN the Schedule_Grid SHALL remove the
   focus indicator from the previous cell and display it on the new cell
3. WHEN the grid loses focus THEN the Schedule_Grid SHALL hide the focus
   indicator
4. THE focus indicator SHALL have sufficient contrast (minimum 3:1 ratio) for
   accessibility compliance

### Requirement 3

**User Story:** As a school administrator, I want to select a lesson using
keyboard or mouse, so that I can prepare it for editing operations.

#### Acceptance Criteria

1. WHEN the user presses Enter or Space on a Focused_Slot containing a lesson
   THEN the Schedule_Grid SHALL mark that lesson as Selected_Lesson
2. WHEN the user clicks on a cell containing a lesson THEN the Schedule_Grid
   SHALL mark that lesson as Selected_Lesson
3. WHEN the user presses Escape THEN the Schedule_Grid SHALL clear the
   Selected_Lesson and return to idle Interaction_Mode
4. WHEN a lesson is selected THEN the Schedule_Grid SHALL display a distinct
   visual state (ring and background highlight) on the selected cell
5. WHEN the user selects a different lesson THEN the Schedule_Grid SHALL replace
   the previous Selected_Lesson with the new selection

### Requirement 4

**User Story:** As a school administrator, I want to drag lessons between cells
using the mouse, so that I can quickly rearrange the schedule.

#### Acceptance Criteria

1. WHEN the user starts dragging a lesson cell THEN the Schedule_Grid SHALL set
   the Interaction_Mode to 'selecting' and mark the lesson as Selected_Lesson
2. WHEN a drag operation starts THEN the Schedule_Grid SHALL set Lock_State to
   true to prevent concurrent interactions
3. WHILE dragging THEN the Schedule_Grid SHALL display the dragged cell with
   reduced opacity and scale
4. WHEN the user drags over a valid drop target THEN the Schedule_Grid SHALL
   highlight the Drop_Target cell
5. WHEN the user releases the drag THEN the Schedule_Grid SHALL set Lock_State
   to false
6. WHEN the user cancels the drag (Escape or invalid drop) THEN the
   Schedule_Grid SHALL clear the selection and return to idle Interaction_Mode

### Requirement 5

**User Story:** As a school administrator, I want cells to accept dropped
lessons, so that I can complete drag-and-drop rearrangements.

#### Acceptance Criteria

1. WHEN a cell is a valid Drop_Target THEN the Schedule_Grid SHALL accept drops
   from lessons within the same view scope
2. WHEN a dragged lesson hovers over a Drop_Target THEN the Schedule_Grid SHALL
   display visual feedback (background highlight)
3. WHEN a drop is completed on a valid target THEN the Schedule_Grid SHALL
   initiate a swap operation (to be implemented in Phase 7)
4. WHEN a drop is attempted on an invalid target THEN the Schedule_Grid SHALL
   cancel the operation and return to idle state

### Requirement 6

**User Story:** As a school administrator, I want the schedule grid to be
focusable, so that I can use keyboard navigation without clicking first.

#### Acceptance Criteria

1. THE Schedule_Grid container SHALL be focusable (tabIndex={0})
2. WHEN the grid container receives focus THEN the Schedule_Grid SHALL set the
   Focused_Slot to the first cell if no slot was previously focused
3. WHILE a selection or drag operation is in progress THEN the Schedule_Grid
   SHALL trap focus within the grid

### Requirement 7

**User Story:** As a school administrator, I want all interaction states to be
visually distinct, so that I can understand the current state of the grid.

#### Acceptance Criteria

1. WHEN a cell is focused THEN the Schedule_Grid SHALL display a ring-2
   ring-ring style
2. WHEN a cell is selected THEN the Schedule_Grid SHALL display a ring-2
   ring-primary with bg-primary/10 background
3. WHEN a cell is being dragged THEN the Schedule_Grid SHALL display opacity-50
   and scale-95 transform
4. WHEN a cell is a drop target THEN the Schedule_Grid SHALL display
   bg-primary/5 background
5. THE visual states SHALL be combinable (e.g., focused and selected
   simultaneously)

### Requirement 8

**User Story:** As a school administrator, I want the interaction state to be
managed centrally, so that all components stay synchronized.

#### Acceptance Criteria

1. THE Schedule_Store SHALL maintain Interaction_Mode state with values: 'idle',
   'selecting', 'previewing', 'executing'
2. THE Schedule_Store SHALL maintain Focused_Slot state as { day: DayOfWeek;
   period: number } or null
3. THE Schedule_Store SHALL maintain Selected_Lesson state as ScheduledLesson or
   null
4. THE Schedule_Store SHALL maintain Lock_State as a boolean
5. THE Schedule_Store SHALL provide actions: setFocusedSlot, selectLesson,
   cancelSelection, setLocked
