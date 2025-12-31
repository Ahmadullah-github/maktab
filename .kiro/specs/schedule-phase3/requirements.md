# Requirements Document

## Introduction

This specification defines Phase 3 of the Schedule Feature for the Maktab school
timetable application: Dashboard & Schedule Management. Building on Phase 1's
data layer and Phase 2's grid rendering system, this phase creates the central
control interface for schedule generation, management, and analytics.

The Schedule Dashboard serves as the primary entry point for users to generate
new timetables via the Python solver, view generation history, manage saved
schedules (load, rename, delete), and monitor schedule statistics. This phase
integrates with the existing solver service API and timetable CRUD endpoints.

## Glossary

- **Schedule Dashboard**: The main control page for schedule generation and
  management, displaying statistics, saved schedules list, and generation
  controls
- **Generation**: The process of creating a new timetable by invoking the Python
  OR-Tools constraint solver via POST /api/generate
- **Strategy**: Solver execution mode affecting solve time and quality (fast:
  ~30s, balanced: ~120s, thorough: ~300s)
- **Saved Schedule**: A timetable persisted to the database via the Timetable
  entity, containing schedule data, metadata, and statistics
- **Statistics Cards**: Dashboard widgets displaying aggregate metrics (total
  schedules, classes, teachers, generation count)
- **Generation Progress**: Visual feedback during solver execution showing
  elapsed time and current phase
- **License Tracking**: Monitoring generation count against license limits for
  enforcement

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to view a dashboard with
schedule statistics, so that I can understand the current state of my timetables
at a glance.

#### Acceptance Criteria

1. THE ScheduleDashboard component SHALL display a header section with the page
   title in Persian and a Generate button
2. THE ScheduleDashboard component SHALL render a StatsCards row showing key
   metrics
3. THE StatsCards component SHALL display the total count of saved schedules
4. THE StatsCards component SHALL display the total number of classes from the
   latest schedule metadata
5. THE StatsCards component SHALL display the total number of teachers from the
   latest schedule metadata
6. THE StatsCards component SHALL display the timestamp of the last generated
   schedule
7. THE StatsCards component SHALL use the shadcn Card component with icon,
   value, and label for each metric
8. WHEN no schedules exist THEN the StatsCards SHALL display zero values with
   appropriate empty state styling

### Requirement 2

**User Story:** As a school administrator, I want to see a list of all saved
schedules, so that I can manage and access my timetable history.

#### Acceptance Criteria

1. THE ScheduleList component SHALL display a table with columns: Name, Created
   Date, Classes Count, and Actions
2. THE ScheduleList component SHALL sort schedules by creation date with newest
   first
3. THE ScheduleList component SHALL display an empty state message in Persian
   when no schedules exist
4. THE ScheduleList component SHALL support pagination when more than 10
   schedules exist
5. WHEN a schedule row's Load action is clicked THEN the ScheduleList SHALL
   navigate to the classes-schedule view with that schedule loaded
6. WHEN a schedule row's Delete action is clicked THEN the ScheduleList SHALL
   open a confirmation dialog
7. THE ScheduleList component SHALL display the schedule name with inline edit
   capability

### Requirement 3

**User Story:** As a school administrator, I want to generate a new schedule
with strategy selection, so that I can create timetables optimized for my needs.

#### Acceptance Criteria

1. WHEN the Generate button is clicked THEN the GenerateButton component SHALL
   open a confirmation dialog
2. THE GenerateButton dialog SHALL display a strategy selector with options:
   Fast (سریع), Balanced (متعادل), Thorough (کامل)
3. THE GenerateButton dialog SHALL display estimated time for each strategy:
   Fast (~30 seconds), Balanced (~2 minutes), Thorough (~5 minutes)
4. WHEN the user confirms generation THEN the GenerateButton SHALL trigger POST
   /api/generate with the selected strategy
5. WHEN generation starts THEN the GenerateButton SHALL display the
   GenerationProgress component
6. WHEN generation succeeds THEN the GenerateButton SHALL save the result to the
   database via POST /api/timetables
7. WHEN generation succeeds THEN the GenerateButton SHALL display a success
   toast notification in Persian
8. WHEN generation fails THEN the GenerateButton SHALL display an error toast
   notification with the error message in Persian
9. THE GenerateButton SHALL be disabled while generation is in progress

### Requirement 4

**User Story:** As a school administrator, I want to see progress during
schedule generation, so that I know the system is working and can estimate
completion time.

#### Acceptance Criteria

1. THE GenerationProgress component SHALL display elapsed time since generation
   started
2. THE GenerationProgress component SHALL display a progress indicator (spinner
   or progress bar)
3. THE GenerationProgress component SHALL display the current phase text (e.g.,
   "در حال تولید جدول زمانی...")
4. THE GenerationProgress component SHALL display the selected strategy name
5. WHEN the solver returns a SOLVER_BUSY error THEN the GenerationProgress SHALL
   display a message indicating another generation is in progress
6. WHEN the solver returns a SOLVER_TIMEOUT error THEN the GenerationProgress
   SHALL display a timeout message with retry option

### Requirement 5

**User Story:** As a school administrator, I want to delete schedules with
confirmation, so that I can remove unwanted timetables safely.

#### Acceptance Criteria

1. THE DeleteConfirmationDialog SHALL display a confirmation message in Persian
   asking "آیا مطمئن هستید؟"
2. THE DeleteConfirmationDialog SHALL display the name of the schedule being
   deleted
3. THE DeleteConfirmationDialog SHALL provide Confirm (تأیید) and Cancel (لغو)
   buttons
4. WHEN the user confirms deletion THEN the DeleteConfirmationDialog SHALL call
   DELETE /api/timetables/:id
5. WHEN deletion succeeds THEN the DeleteConfirmationDialog SHALL display a
   success toast and refresh the schedule list
6. WHEN deletion fails THEN the DeleteConfirmationDialog SHALL display an error
   toast with the error message

### Requirement 6

**User Story:** As a developer, I want a useGenerateSchedule hook that manages
the generation process, so that components can trigger and monitor schedule
generation.

#### Acceptance Criteria

1. THE useGenerateSchedule hook SHALL provide a generate function that accepts a
   strategy parameter
2. THE useGenerateSchedule hook SHALL return isGenerating boolean indicating
   generation in progress
3. THE useGenerateSchedule hook SHALL return elapsedTime number tracking seconds
   since generation started
4. THE useGenerateSchedule hook SHALL return error state containing any
   generation error
5. WHEN generation succeeds THEN the useGenerateSchedule hook SHALL invalidate
   the ['schedules'] query cache
6. THE useGenerateSchedule hook SHALL collect all required input data (teachers,
   subjects, classes, rooms, config) before calling the API
7. WHEN the API returns SOLVER_BUSY (503) THEN the useGenerateSchedule hook
   SHALL set a specific busy error state

### Requirement 7

**User Story:** As a developer, I want a useScheduleStats hook that computes
dashboard statistics, so that the StatsCards component can display accurate
metrics.

#### Acceptance Criteria

1. THE useScheduleStats hook SHALL return totalSchedules count from the
   schedules query
2. THE useScheduleStats hook SHALL return totalClasses count from the latest
   schedule metadata
3. THE useScheduleStats hook SHALL return totalTeachers count from the latest
   schedule metadata
4. THE useScheduleStats hook SHALL return totalLessons count from the latest
   schedule statistics
5. THE useScheduleStats hook SHALL return lastGeneratedAt timestamp from the
   most recent schedule
6. THE useScheduleStats hook SHALL return isLoading boolean while data is being
   fetched
7. WHEN no schedules exist THEN the useScheduleStats hook SHALL return zero for
   all counts and null for lastGeneratedAt

### Requirement 8

**User Story:** As a school administrator, I want the schedule dashboard route
to display the dashboard component, so that I can access it from the sidebar
navigation.

#### Acceptance Criteria

1. THE /schedule-dashboard route SHALL render the ScheduleDashboard component
2. THE ScheduleDashboard component SHALL load the schedules list on mount
3. WHEN the page loads THEN the ScheduleDashboard SHALL display a loading state
   while fetching data
4. WHEN data fetch fails THEN the ScheduleDashboard SHALL display an error state
   with retry option
