# Requirements Document

## Introduction

This document specifies the requirements for the Teachers Feature Module in the
Maktab school timetable application. The module provides comprehensive CRUD
operations for managing teachers, including an availability matrix for
scheduling, subject specialization management, and time constraints. The feature
follows the established patterns from the classes feature module and integrates
with the existing Afghan education system configuration.

## Glossary

- **Teacher**: An educator entity in the system with associated subjects,
  availability, and scheduling constraints
- **Primary Subjects**: Core subjects that represent a teacher's main
  specialization/expertise
- **Allowed Subjects**: Additional subjects a teacher is permitted to teach
  beyond their primary specialization
- **Availability Matrix**: A two-dimensional grid representing teacher presence
  across days and periods
- **Unavailable Slot**: A specific day-period combination when a teacher cannot
  be scheduled
- **SchoolConfig**: System-wide configuration containing days of week and
  periods per day settings
- **Inspector Panel**: A side panel displaying detailed information and edit
  capabilities for a selected entity
- **DataGrid**: A tabular component displaying entity records with selection and
  action capabilities
- **Wizard**: A multi-step form guiding users through entity creation

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to view a list of all teachers
in a data grid, so that I can quickly browse and manage the teaching staff.

#### Acceptance Criteria

1. WHEN the teachers page loads THEN the System SHALL display a DataGrid with
   columns for row number, full name, status, subject count, and hours per week
2. WHEN a user types in the search field THEN the System SHALL filter the
   teacher list by matching against the full name field
3. WHEN a user selects a status filter (all, full-time, part-time) THEN the
   System SHALL display only teachers matching the selected employment type
4. WHEN a user clicks on a teacher row THEN the System SHALL open the Inspector
   panel displaying that teacher's details
5. WHEN a user clicks the delete button on a row THEN the System SHALL display a
   confirmation dialog before performing the deletion
6. WHEN the teacher list is empty THEN the System SHALL display an empty state
   message with an option to add the first teacher

### Requirement 2

**User Story:** As a school administrator, I want to create and edit teacher
profiles with basic information, so that I can maintain accurate staff records.

#### Acceptance Criteria

1. WHEN a user submits the teacher form with a valid full name THEN the System
   SHALL create or update the teacher record
2. WHEN a user submits the teacher form with an empty or whitespace-only name
   THEN the System SHALL display a validation error and prevent submission
3. WHEN a user submits the teacher form with a name exceeding the maximum
   allowed length THEN the System SHALL display a validation error and prevent
   submission
4. WHEN a teacher is successfully created THEN the System SHALL display a
   success toast notification in Farsi
5. WHEN a teacher is successfully updated THEN the System SHALL display a
   success toast notification in Farsi
6. WHEN a teacher creation or update fails THEN the System SHALL display an
   error toast notification in Farsi with the error details

### Requirement 3

**User Story:** As a school administrator, I want to manage teacher subject
assignments with drag-and-drop, so that I can easily configure which subjects
each teacher can teach.

#### Acceptance Criteria

1. WHEN the subject manager component loads THEN the System SHALL display three
   zones: available subjects, primary subjects, and allowed subjects
2. WHEN a user drags a subject from available to primary zone THEN the System
   SHALL add that subject to the teacher's primary subject list
3. WHEN a user drags a subject from available to allowed zone THEN the System
   SHALL add that subject to the teacher's allowed subject list
4. WHEN a user drags a subject between primary and allowed zones THEN the System
   SHALL move the subject to the target zone
5. WHEN a user enables "restrict to primary subjects" THEN the System SHALL mark
   the teacher as only able to teach primary subjects
6. WHEN a user removes a subject from a zone THEN the System SHALL return that
   subject to the available subjects list

### Requirement 4

**User Story:** As a school administrator, I want to configure teacher
availability using a visual matrix, so that I can specify when teachers are
unavailable for scheduling.

#### Acceptance Criteria

1. WHEN the availability matrix loads THEN the System SHALL display a grid with
   days as columns and periods as rows based on SchoolConfig settings
2. WHEN a user clicks on a cell in the availability matrix THEN the System SHALL
   toggle that cell between available and unavailable states
3. WHEN a cell is in available state THEN the System SHALL display it with a
   green background color
4. WHEN a cell is in unavailable state THEN the System SHALL display it with a
   red background color
5. WHEN the SchoolConfig has variable periods per day THEN the System SHALL
   render the correct number of period rows for each day column
6. WHEN the availability matrix is saved THEN the System SHALL store unavailable
   slots as an array of day-period objects

### Requirement 5

**User Story:** As a school administrator, I want to set scheduling constraints
for teachers, so that the timetable generator respects their workload limits.

#### Acceptance Criteria

1. WHEN a user sets maximum periods per week THEN the System SHALL validate the
   value against the calculated maximum from SchoolConfig (daysPerWeek ×
   defaultPeriodsPerDay)
2. WHEN a user sets maximum periods per day THEN the System SHALL validate the
   value against the maximum periods per day from SchoolConfig
3. WHEN a user sets maximum consecutive periods THEN the System SHALL validate
   the value against solver constraint limits (1 or 2 based on solver
   configuration)
4. WHEN constraint values are outside dynamically calculated valid ranges THEN
   the System SHALL display validation errors and prevent submission
5. WHEN a teacher record is created THEN the System SHALL apply default
   constraint values derived from SchoolConfig settings

### Requirement 6

**User Story:** As a school administrator, I want to view and edit teacher
details in an inspector panel, so that I can manage all aspects of a teacher's
profile in one place.

#### Acceptance Criteria

1. WHEN a teacher is selected THEN the System SHALL open an Inspector panel on
   the left side (RTL layout)
2. WHEN the Inspector panel opens THEN the System SHALL display tabs for: Basic
   Info, Subjects, Availability, and Constraints
3. WHEN a user switches between tabs THEN the System SHALL display the
   corresponding content without losing unsaved changes
4. WHEN a user clicks the save button THEN the System SHALL persist all changes
   across all tabs
5. WHEN a user clicks the close button THEN the System SHALL close the Inspector
   panel and deselect the teacher

### Requirement 7

**User Story:** As a school administrator, I want to add new teachers through a
guided wizard, so that I can ensure all required information is captured step by
step.

#### Acceptance Criteria

1. WHEN a user clicks "Add New Teacher" THEN the System SHALL open a wizard
   drawer with four steps
2. WHEN the wizard opens THEN the System SHALL display Step 1: Personal
   Information
3. WHEN a user completes a step and clicks "Next" THEN the System SHALL validate
   the current step and advance to the next step
4. WHEN a user clicks "Back" THEN the System SHALL return to the previous step
   while preserving entered data
5. WHEN a user completes all steps and clicks "Save" THEN the System SHALL
   create the teacher record with all entered data
6. WHEN the wizard displays progress THEN the System SHALL show a visual
   indicator of the current step and total steps

### Requirement 8

**User Story:** As a school administrator, I want all teacher management UI to
be in Farsi with RTL layout, so that the interface matches our language and
reading direction.

#### Acceptance Criteria

1. WHEN the teachers page renders THEN the System SHALL display all text labels
   from the i18n Farsi translation file
2. WHEN the teachers page renders THEN the System SHALL apply right-to-left text
   direction
3. WHEN displaying numbers THEN the System SHALL use standard Arabic numerals
   (0-9) for data values
4. WHEN displaying validation messages THEN the System SHALL show messages in
   Farsi from the translation file
5. WHEN displaying toast notifications THEN the System SHALL show success and
   error messages in Farsi

### Requirement 9

**User Story:** As a developer, I want the teachers feature to follow
established codebase patterns, so that the code is maintainable and consistent.

#### Acceptance Criteria

1. WHEN implementing the teachers feature THEN the System SHALL follow the file
   structure pattern from the classes feature
2. WHEN implementing API calls THEN the System SHALL use TanStack Query hooks
   with proper cache invalidation
3. WHEN implementing forms THEN the System SHALL use React Hook Form with Zod
   schema validation
4. WHEN implementing UI components THEN the System SHALL use Shadcn/ui
   components from the existing component library
5. WHEN implementing state management THEN the System SHALL use local component
   state for UI and TanStack Query for server state
