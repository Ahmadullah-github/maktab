# Requirements Document

## Introduction

The Classes Page is a comprehensive management interface for school class groups
(صنف‌ها) in the Maktab timetable application. This feature enables school
administrators to create, view, edit, and manage class groups following the
Afghan education system's four-tier grade classification (Alpha-Primary 1-3,
Beta-Primary 4-6, Middle 7-9, High 10-12). The page follows the Hybrid Manager
Pattern with a 3-column RTL layout, featuring a DataGrid for class listing, an
Inspector panel for detailed editing, and full i18n support with Persian/Dari as
the default language.

## Glossary

- **Class Group (صنف)**: A group of students in a specific grade and section
  (e.g., 7-A, 10-B)
- **Grade (پایه تحصیلی)**: Academic level from 1-12 in the Afghan education
  system
- **Section (بخش)**: Division within a grade (PRIMARY, MIDDLE, HIGH)
- **Section Index (شاخص بخش)**: Letter identifier for parallel classes (A, B, C,
  etc.)
- **Single-Teacher Mode (حالت تک‌معلم)**: Mode where one teacher teaches all
  subjects (for Alpha-Primary grades 1-3)
- **Class Teacher (معلم راهنما/استاد نگران)**: The supervisor teacher assigned
  to a class
- **Fixed Room (اتاق ثابت)**: A room permanently assigned to a class (Homeroom)
- **Subject Requirements (نیازمندی‌های درسی)**: JSON configuration of subjects
  and periods required for a class
- **DataGrid**: Airtable-style editable table component for displaying and
  editing class data
- **Inspector Panel**: Side panel for detailed class editing with tabbed
  interface
- **Grade Category**: Afghan classification - alphaPrimary (1-3), betaPrimary
  (4-6), middle (7-9), high (10-12)

## Requirements

### Requirement 1: Class List Display

**User Story:** As a school administrator, I want to view all classes in a
searchable, filterable DataGrid, so that I can quickly find and manage class
information.

#### Acceptance Criteria

1. WHEN the Classes Page loads THEN the System SHALL display a DataGrid
   containing all non-deleted class groups with columns for name, grade, section
   index, student count, class teacher, and fixed room
2. WHEN a user enters text in the search field THEN the System SHALL filter the
   displayed classes to show only those matching the search term in name,
   display name, or section index fields
3. WHEN a user selects a grade filter tab (e.g., "Grade 7", "All Classes") THEN
   the System SHALL display only classes matching the selected grade category
4. WHEN the DataGrid displays class data THEN the System SHALL show grade badges
   with appropriate colors based on grade category (alphaPrimary, betaPrimary,
   middle, high)
5. WHEN classes are loading THEN the System SHALL display a loading spinner with
   localized loading text

### Requirement 2: Class Creation

**User Story:** As a school administrator, I want to create new classes through
a drawer form, so that I can add class groups to the system with all required
information while maintaining context of the class list.

#### Acceptance Criteria

1. WHEN a user clicks the "Add Class" button THEN the System SHALL open a
   drawer/sheet panel from the left side (in RTL layout) occupying approximately
   30% of the screen width with a backdrop overlay blocking interaction with the
   main content
2. WHEN the class creation drawer opens THEN the System SHALL display a form
   with fields for class name, grade, section index, student count,
   single-teacher mode toggle, class teacher selector, and fixed room selector
3. WHEN a user submits a valid class creation form THEN the System SHALL create
   the class in the database, close the drawer, and add the new class to the
   DataGrid without page refresh
4. WHEN a user attempts to submit a class with an empty name THEN the System
   SHALL display a validation error and prevent submission
5. WHEN a user selects a grade between 1-3 THEN the System SHALL automatically
   enable the single-teacher mode option and display the class teacher selector
6. WHEN a user clicks outside the drawer or presses the close button THEN the
   System SHALL close the drawer and discard unsaved changes (with optional
   confirmation if changes exist)
7. WHEN a user saves a new class THEN the System SHALL log the creation action
   for debugging purposes

### Requirement 3: Class Editing via Inspector Panel

**User Story:** As a school administrator, I want to edit class details in a
side panel, so that I can modify class information without leaving the list
view.

#### Acceptance Criteria

1. WHEN a user selects a class row in the DataGrid THEN the System SHALL open
   the Inspector panel on the left side (RTL layout) displaying the class
   details
2. WHEN the Inspector panel opens THEN the System SHALL display tabs for "Basic
   Info", "Subject Requirements", and "Assignments"
3. WHEN a user modifies a field in the Inspector panel and saves THEN the System
   SHALL update the class in the database and reflect changes in the DataGrid
4. WHEN a user clicks the close button or deselects the row THEN the System
   SHALL close the Inspector panel
5. WHEN editing a class with single-teacher mode enabled THEN the System SHALL
   display the class teacher selector and hide individual subject-teacher
   assignments

### Requirement 4: Class Deletion

**User Story:** As a school administrator, I want to delete classes that are no
longer needed, so that I can keep the class list clean and accurate.

#### Acceptance Criteria

1. WHEN a user clicks the delete button for a class THEN the System SHALL
   display a confirmation dialog with localized warning text
2. WHEN a user confirms deletion THEN the System SHALL soft-delete the class
   (set isDeleted flag) and remove it from the DataGrid
3. WHEN a user cancels deletion THEN the System SHALL close the dialog and
   retain the class in the list
4. WHEN a class is deleted THEN the System SHALL log the deletion action for
   debugging purposes

### Requirement 5: Grade Category Management

**User Story:** As a school administrator, I want to filter and categorize
classes by Afghan grade categories, so that I can manage classes according to
the education system structure.

#### Acceptance Criteria

1. WHEN the page loads THEN the System SHALL display filter tabs for "All
   Classes", "Alpha-Primary (1-3)", "Beta-Primary (4-6)", "Middle (7-9)", and
   "High (10-12)"
2. WHEN a user selects a grade category tab THEN the System SHALL filter the
   DataGrid to show only classes in that category
3. WHEN displaying grade information THEN the System SHALL show both the numeric
   grade and the localized category name
4. WHEN a class grade is set to 1-3 THEN the System SHALL categorize it as
   Alpha-Primary and apply single-teacher mode rules

### Requirement 6: Single-Teacher Mode Configuration

**User Story:** As a school administrator, I want to configure single-teacher
mode for primary classes, so that one teacher can be assigned to teach all
subjects for grades 1-3.

#### Acceptance Criteria

1. WHEN single-teacher mode is enabled for a class THEN the System SHALL display
   a class teacher selector dropdown populated with available teachers
2. WHEN a class teacher is selected in single-teacher mode THEN the System SHALL
   store the classTeacherId and associate all subjects with that teacher
3. WHEN single-teacher mode is disabled THEN the System SHALL clear the
   classTeacherId and allow individual subject-teacher assignments
4. WHEN displaying a class with single-teacher mode THEN the System SHALL show a
   visual indicator (badge/icon) in the DataGrid

### Requirement 7: Room Assignment

**User Story:** As a school administrator, I want to assign a fixed room
(homeroom) to classes, so that the timetable solver knows which room to use for
that class.

#### Acceptance Criteria

1. WHEN editing a class THEN the System SHALL display a room selector dropdown
   populated with available rooms from the database
2. WHEN a room is selected THEN the System SHALL store the fixedRoomId and
   display the room name in the DataGrid
3. WHEN no room is assigned THEN the System SHALL display a placeholder text
   indicating no fixed room
4. WHEN a room is already assigned to another class THEN the System SHALL still
   allow selection but display a warning indicator

### Requirement 8: Subject Requirements Configuration

**User Story:** As a school administrator, I want to configure subject
requirements for each class, so that the timetable solver knows which subjects
and how many periods are needed.

#### Acceptance Criteria

1. WHEN viewing the Subject Requirements tab in the Inspector THEN the System
   SHALL display a list of subjects with period count inputs
2. WHEN a user adds a subject requirement THEN the System SHALL add it to the
   subjectRequirements JSON and update the display
3. WHEN a user modifies period count for a subject THEN the System SHALL
   validate the count is within allowed range and update the configuration
4. WHEN a user removes a subject requirement THEN the System SHALL remove it
   from the configuration and update the display

### Requirement 9: Internationalization Support

**User Story:** As a user, I want all text in the Classes Page to be displayed
in my selected language (Persian/Dari or English), so that I can use the
application in my preferred language.

#### Acceptance Criteria

1. WHEN the page renders THEN the System SHALL display all labels, buttons, and
   messages using i18n translation keys from the classes namespace
2. WHEN the language is set to Persian/Dari THEN the System SHALL display all
   text in Persian with RTL layout
3. WHEN the language is set to English THEN the System SHALL display all text in
   English with LTR-aware styling
4. WHEN displaying numbers THEN the System SHALL support both Persian numerals
   (۰-۹) and Latin numerals (0-9) based on locale

### Requirement 10: Component-Based Architecture

**User Story:** As a developer, I want the Classes Page to be built with
reusable, well-structured components, so that the code is maintainable and
testable.

#### Acceptance Criteria

1. WHEN implementing the Classes Page THEN the System SHALL create separate
   components for ClassesPage, ClassDataGrid, ClassInspector, ClassForm, and
   ClassFilters
2. WHEN components render THEN the System SHALL output debug log messages for
   component lifecycle events (mount, update, unmount)
3. WHEN API calls are made THEN the System SHALL log request and response
   information for debugging
4. WHEN errors occur THEN the System SHALL log error details and display
   user-friendly localized error messages

### Requirement 11: Data Persistence and API Integration

**User Story:** As a school administrator, I want all class changes to be saved
to the database, so that my data persists across sessions.

#### Acceptance Criteria

1. WHEN a class is created, updated, or deleted THEN the System SHALL send the
   appropriate API request to /api/classes endpoint
2. WHEN the API returns a success response THEN the System SHALL update the
   local cache and UI state via TanStack Query
3. WHEN the API returns an error THEN the System SHALL display a localized error
   message and log the error details
4. WHEN the page loads THEN the System SHALL fetch classes from GET /api/classes
   and populate the DataGrid

### Requirement 12: Class Data Serialization

**User Story:** As a developer, I want class data to be properly serialized and
deserialized, so that complex fields like subjectRequirements are handled
correctly.

#### Acceptance Criteria

1. WHEN saving a class with subjectRequirements THEN the System SHALL serialize
   the array to a JSON string before sending to the API
2. WHEN loading a class with subjectRequirements THEN the System SHALL parse the
   JSON string back to an array for UI display
3. WHEN serializing then deserializing subjectRequirements THEN the System SHALL
   produce an equivalent data structure (round-trip consistency)
4. WHEN the subjectRequirements JSON is malformed THEN the System SHALL handle
   the error gracefully and log a warning
