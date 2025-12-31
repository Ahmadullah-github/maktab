# Requirements Document

## Introduction

This specification defines Phase 2 of the Schedule Feature for the Maktab school
timetable application: Grid Rendering & View System. Building on Phase 1's data
layer (Zustand store, indexes, types, and transformers), this phase creates the
visual grid components for displaying schedules. The application is RTL-first
(Persian/Dari) and runs as an Electron desktop app.

Phase 2 delivers the core UI components for viewing schedules by class or by
teacher, with a CSS Grid-based layout optimized for performance with 700+ cells.

## Glossary

- **ScheduleGrid**: The main grid component that renders a days × periods matrix
  of schedule cells
- **ScheduleCell**: An individual cell in the grid displaying lesson information
  (subject, teacher, room)
- **ClassScheduleView**: A view layout showing schedules organized by class,
  with classes grouped by grade category
- **TeacherScheduleView**: A view layout showing schedules organized by teacher,
  with horizontal tabs for teacher selection
- **CategoryAccordion**: A collapsible navigation component grouping classes by
  Afghanistan's four-tier grade classification
- **DisplaySettings**: User preferences controlling what information appears in
  cells (subject name, teacher name, room name)
- **ValidationStatus**: Visual indicator for cell state (valid, warning,
  blocked) used in future editing features
- **Slot**: A unique time position identified by day and period index
- **RTL Layout**: Right-to-left layout where days column appears on the right
  and periods flow right-to-left

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to view a schedule as a grid
of days and periods, so that I can see the complete weekly timetable at a
glance.

#### Acceptance Criteria

1. THE ScheduleGrid component SHALL render a CSS Grid layout with days as rows
   and periods as columns
2. THE ScheduleGrid component SHALL display a sticky header row showing period
   numbers (1, 2, 3, etc.)
3. THE ScheduleGrid component SHALL display a sticky first column showing day
   names in Persian
4. WHEN periodsPerDay is a number THEN the ScheduleGrid SHALL render that many
   period columns for all days
5. WHEN periodsPerDay is a Map<DayOfWeek, number> THEN the ScheduleGrid SHALL
   render variable period columns per day
6. THE ScheduleGrid component SHALL support responsive cell sizing based on
   displaySettings.cellSize
7. WHEN onCellClick callback is provided THEN the ScheduleGrid SHALL invoke it
   with (day, period, lesson) parameters on cell click
8. WHEN isReadOnly is true THEN the ScheduleGrid SHALL disable cell click
   interactions

### Requirement 2

**User Story:** As a school administrator, I want schedule cells to display
lesson information clearly, so that I can quickly identify what is scheduled in
each time slot.

#### Acceptance Criteria

1. THE ScheduleCell component SHALL display the subject name prominently when
   displaySettings.showSubjectName is true
2. THE ScheduleCell component SHALL display the teacher name in smaller font
   when displaySettings.showTeacherName is true
3. THE ScheduleCell component SHALL display the room name in smallest font when
   displaySettings.showRoomName is true
4. WHEN lesson is null THEN the ScheduleCell SHALL render an empty cell with
   appropriate styling
5. THE ScheduleCell component SHALL apply visual states for normal, selected,
   focused, and hover interactions
6. WHEN validationStatus is 'warning' THEN the ScheduleCell SHALL display a
   warning visual indicator
7. WHEN validationStatus is 'blocked' THEN the ScheduleCell SHALL display a
   blocked visual indicator
8. THE ScheduleCell component SHALL be memoized using React.memo for performance
   optimization

### Requirement 3

**User Story:** As a school administrator, I want to view schedules organized by
class with classes grouped by grade category, so that I can navigate to any
class schedule efficiently.

#### Acceptance Criteria

1. THE ClassScheduleView component SHALL render a left sidebar containing the
   CategoryAccordion
2. THE ClassScheduleView component SHALL render the ScheduleGrid in the main
   area for the selected class
3. THE ClassScheduleView component SHALL group classes into four categories:
   Alpha-Primary (grades 1-3), Beta-Primary (grades 4-6), Middle (grades 7-9),
   and High (grades 10-12)
4. WHEN a class is clicked in the CategoryAccordion THEN the ClassScheduleView
   SHALL display that class's schedule in the grid
5. THE ClassScheduleView component SHALL display class metadata including
   student count
6. THE ClassScheduleView component SHALL display a single-teacher badge for
   Alpha-Primary classes in single-teacher mode
7. THE ClassScheduleView component SHALL use Persian category names from
   GRADE_CATEGORIES constants

### Requirement 4

**User Story:** As a school administrator, I want to view schedules organized by
teacher with tabs for each teacher, so that I can see any teacher's weekly
schedule.

#### Acceptance Criteria

1. THE TeacherScheduleView component SHALL render horizontal scrollable tabs at
   the top for teacher selection
2. THE TeacherScheduleView component SHALL render the ScheduleGrid in the main
   area for the selected teacher
3. THE TeacherScheduleView component SHALL include an "All" tab that shows a
   combined read-only view
4. WHEN a teacher tab is clicked THEN the TeacherScheduleView SHALL display that
   teacher's schedule in the grid
5. THE TeacherScheduleView component SHALL display teacher metadata including
   subject badges
6. THE TeacherScheduleView component SHALL display the teacher's total period
   count
7. THE TeacherScheduleView component SHALL highlight cells where the selected
   teacher is assigned

### Requirement 5

**User Story:** As a school administrator, I want a collapsible accordion to
navigate classes by category, so that I can quickly find classes within each
grade level.

#### Acceptance Criteria

1. THE CategoryAccordion component SHALL render collapsible sections for each
   grade category
2. THE CategoryAccordion component SHALL display a class count badge for each
   category
3. WHEN a category section is expanded THEN the CategoryAccordion SHALL display
   all classes in that category
4. THE CategoryAccordion component SHALL visually indicate the currently
   selected class
5. THE CategoryAccordion component SHALL display a single-teacher mode indicator
   for applicable classes
6. THE CategoryAccordion component SHALL invoke onSelectClass callback when a
   class is clicked

### Requirement 6

**User Story:** As a developer, I want a useScheduleView hook that manages view
state and filters lessons, so that view components can access filtered data
efficiently.

#### Acceptance Criteria

1. THE useScheduleView hook SHALL return currentView ('class' | 'teacher')
   indicating the active view type
2. THE useScheduleView hook SHALL return currentViewId (string) containing the
   selected classId or teacherId
3. THE useScheduleView hook SHALL return filteredLessons (ScheduledLesson[])
   filtered for the current view
4. THE useScheduleView hook SHALL return setView function to change view type
   and selected entity
5. THE useScheduleView hook SHALL return availableClasses (ClassMetadata[])
   grouped by category
6. THE useScheduleView hook SHALL return availableTeachers (TeacherMetadata[])
7. THE useScheduleView hook SHALL derive filteredLessons from store indexes
   (byClass or byTeacher) based on view type
8. THE useScheduleView hook SHALL memoize filtered results to prevent
   unnecessary recalculations

### Requirement 7

**User Story:** As a school administrator, I want the schedule routes to display
the appropriate view components, so that I can access schedules from the sidebar
navigation.

#### Acceptance Criteria

1. THE /classes-schedule route SHALL render the ClassScheduleView component
2. THE /teachers-schedule route SHALL render the TeacherScheduleView component
3. WHEN no schedule is loaded THEN the route pages SHALL display an appropriate
   empty state message
4. THE route pages SHALL preserve the selected schedule when switching between
   class and teacher views

### Requirement 8

**User Story:** As a school administrator using a Persian interface, I want the
schedule grid to display correctly in RTL layout, so that the interface matches
my reading direction.

#### Acceptance Criteria

1. THE ScheduleGrid component SHALL position the days column on the right side
   in RTL mode
2. THE ScheduleGrid component SHALL flow period columns from right to left
3. THE schedule components SHALL use Tailwind CSS logical properties (ms-, me-,
   ps-, pe-) for spacing
4. THE schedule components SHALL display all text labels in Persian via i18n

### Requirement 9

**User Story:** As a school administrator, I want the schedule grid to render
quickly even with many cells, so that I can view large schedules without lag.

#### Acceptance Criteria

1. THE ScheduleGrid component SHALL render a full grid dynamically based on the
   periodsPerDay configuration from the solver output or period configuration,
   supporting variable cell counts per class category (e.g., Alpha-Primary ~24
   lessons/week, High classes more)
2. THE ScheduleCell component SHALL be memoized to prevent unnecessary
   re-renders
3. THE useScheduleView hook SHALL use memoization to prevent recalculating
   filtered lessons on every render
4. WHEN switching views THEN the grid SHALL update instantly without re-fetching
   data from the API
5. THE ScheduleGrid component SHALL derive period counts from
   PeriodConfiguration.periodsPerDayMap when available, falling back to lesson
   data periodsThisDay field
