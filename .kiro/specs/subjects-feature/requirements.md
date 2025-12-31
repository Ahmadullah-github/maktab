# Requirements Document

## Introduction

This document specifies the requirements for the Subjects Feature Module in the
Maktab school timetable application. The feature enables school administrators
to manage curriculum subjects that will be assigned to teachers and scheduled in
the timetable. The module follows the established patterns from the Classes
feature, providing a DataGrid listing, Inspector panel for details/editing, and
form drawer for creating new subjects.

## Glossary

- **Subject**: A curriculum subject (e.g., Mathematics, Physics) that can be
  taught by teachers and scheduled in the timetable
- **Section**: Educational level classification - PRIMARY (grades 1-6), MIDDLE
  (grades 7-9), HIGH (grades 10-12)
- **DataGrid**: An Airtable-style table component for displaying and managing
  entity lists
- **Inspector**: A side panel that displays detailed information and editing
  capabilities for a selected entity
- **Room Type**: Classification of rooms required for teaching a subject
  (classroom, lab, gym, library)
- **Required Features**: Room features that must be present for teaching a
  subject
- **Desired Features**: Room features that are preferred but not mandatory for
  teaching a subject
- **Difficult Subject**: A subject marked as requiring scheduling in optimal
  time slots (typically morning periods)

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to view all subjects in a
DataGrid, so that I can see and manage the curriculum at a glance.

#### Acceptance Criteria

1. WHEN the user navigates to the /subjects route THEN the SubjectsPage SHALL
   render with a DataGrid displaying all non-deleted subjects from the API
2. WHEN subjects are loaded THEN the DataGrid SHALL display columns for name,
   code, section, grade, periodsPerWeek, requiredRoomType, and isDifficult
3. WHEN the API returns subjects with JSON string fields (requiredFeatures,
   desiredFeatures) THEN the system SHALL parse these fields into arrays for
   display
4. WHEN the subjects list is empty THEN the DataGrid SHALL display an
   appropriate empty state message in Farsi
5. WHEN the API request fails THEN the system SHALL display an error toast
   notification in Farsi

### Requirement 2

**User Story:** As a school administrator, I want to filter subjects by section
and search by name/code, so that I can quickly find specific subjects.

#### Acceptance Criteria

1. WHEN the user clicks a section filter tab (همه/ابتدایی/متوسطه/لیسه) THEN the
   DataGrid SHALL display only subjects matching that section
2. WHEN the user types in the search input THEN the DataGrid SHALL filter
   subjects by matching name or code (case-insensitive)
3. WHEN both section filter and search are active THEN the system SHALL apply
   both filters simultaneously
4. WHEN filters are applied THEN the system SHALL display the count of filtered
   results versus total results

### Requirement 3

**User Story:** As a school administrator, I want to view and edit subject
details in an Inspector panel, so that I can manage subject information without
leaving the list view.

#### Acceptance Criteria

1. WHEN the user clicks a row in the DataGrid THEN the Inspector panel SHALL
   open on the left side (RTL layout) displaying the selected subject's details
2. WHEN the Inspector opens THEN the system SHALL display three tabs: معلومات
   (info), نیازمندی‌ها (requirements), تنظیمات (settings)
3. WHEN the user edits fields in the Inspector THEN the system SHALL validate
   input using Zod schema before submission
4. WHEN the user saves changes THEN the system SHALL call the PUT
   /api/subjects/:id endpoint and invalidate the query cache
5. WHEN the update succeeds THEN the system SHALL display a success toast
   notification in Farsi
6. WHEN the update fails THEN the system SHALL display an error toast
   notification in Farsi
7. WHEN the user clicks the close button or clicks outside THEN the Inspector
   SHALL close and deselect the row

### Requirement 4

**User Story:** As a school administrator, I want to create new subjects using a
form drawer, so that I can add subjects to the curriculum.

#### Acceptance Criteria

1. WHEN the user clicks the "افزودن مضمون جدید" button THEN a form drawer SHALL
   open from the left side
2. WHEN the form drawer opens THEN the system SHALL display all subject fields
   with appropriate input types and Farsi labels
3. WHEN the user submits the form with valid data THEN the system SHALL call the
   POST /api/subjects endpoint
4. WHEN the user submits the form with invalid data THEN the system SHALL
   display validation errors in Farsi next to the relevant fields
5. WHEN subject creation succeeds THEN the system SHALL close the drawer,
   invalidate the query cache, and display a success toast
6. WHEN subject creation fails THEN the system SHALL display an error toast
   notification in Farsi
7. WHEN the user clicks cancel or outside the drawer THEN the drawer SHALL close
   without saving

### Requirement 5

**User Story:** As a school administrator, I want to delete subjects, so that I
can remove outdated or incorrect subjects from the curriculum.

#### Acceptance Criteria

1. WHEN the user clicks the delete action in the Inspector THEN the system SHALL
   display a confirmation dialog in Farsi
2. WHEN the user confirms deletion THEN the system SHALL call the DELETE
   /api/subjects/:id endpoint (soft delete)
3. WHEN deletion succeeds THEN the system SHALL close the Inspector, invalidate
   the query cache, and display a success toast
4. WHEN deletion fails THEN the system SHALL display an error toast notification
   in Farsi

### Requirement 6

**User Story:** As a school administrator, I want to specify room requirements
for subjects, so that the timetable generator can assign appropriate rooms.

#### Acceptance Criteria

1. WHEN editing a subject THEN the user SHALL be able to select a required room
   type from: بدون محدودیت, صنف عادی, لابراتوار, سالون ورزش, کتابخانه
2. WHEN editing a subject THEN the user SHALL be able to add/remove required
   features as tags
3. WHEN editing a subject THEN the user SHALL be able to add/remove desired
   features as tags
4. WHEN editing a subject THEN the user SHALL be able to set a minimum room
   capacity
5. WHEN saving room requirements THEN the system SHALL serialize feature arrays
   to JSON strings for the API

### Requirement 7

**User Story:** As a school administrator, I want to mark subjects as difficult,
so that the timetable generator can schedule them in optimal time slots.

#### Acceptance Criteria

1. WHEN editing a subject THEN the user SHALL be able to toggle the isDifficult
   flag using a switch control
2. WHEN isDifficult is enabled THEN the system SHALL display a hint explaining
   that difficult subjects are scheduled in morning periods
3. WHEN viewing the DataGrid THEN difficult subjects SHALL be visually indicated
   with an icon or badge

### Requirement 8

**User Story:** As a school administrator, I want all text displayed in Farsi,
so that I can use the application in my native language.

#### Acceptance Criteria

1. WHEN the SubjectsPage renders THEN all labels, buttons, and messages SHALL be
   displayed in Farsi using i18n
2. WHEN validation errors occur THEN error messages SHALL be displayed in Farsi
3. WHEN toast notifications appear THEN success and error messages SHALL be in
   Farsi
4. WHEN the DataGrid displays section values THEN the system SHALL translate
   PRIMARY/MIDDLE/HIGH to ابتدایی/متوسطه/لیسه

### Requirement 9

**User Story:** As a school administrator, I want to bulk insert curriculum
subjects for a specific grade, so that I can quickly set up the standard
Ministry curriculum without adding subjects one by one.

#### Acceptance Criteria

1. WHEN the user clicks the "درج نصاب تعلیمی" (Insert Curriculum) button THEN a
   dialog SHALL open allowing grade selection
2. WHEN the user selects a grade (1-12) THEN the system SHALL display a preview
   of the standard curriculum subjects for that grade
3. WHEN the user confirms the insertion THEN the system SHALL call the POST
   /api/subjects/grade/:grade/insert-curriculum endpoint
4. WHEN curriculum insertion succeeds THEN the system SHALL invalidate the query
   cache and display a success toast showing the number of subjects added
5. WHEN curriculum insertion fails THEN the system SHALL display an error toast
   notification in Farsi
6. WHEN subjects already exist for the selected grade THEN the system SHALL
   display a warning and allow the user to proceed or cancel

### Requirement 10

**User Story:** As a school administrator, I want to clear all subjects for a
specific grade, so that I can reset the curriculum and start fresh.

#### Acceptance Criteria

1. WHEN the user clicks the "پاک کردن مضامین پایه" (Clear Grade Subjects) action
   THEN a dialog SHALL open allowing grade selection
2. WHEN the user selects a grade and confirms THEN the system SHALL call the
   DELETE /api/subjects/grade/:grade endpoint
3. WHEN the clear operation succeeds THEN the system SHALL invalidate the query
   cache and display a success toast
4. WHEN the clear operation fails THEN the system SHALL display an error toast
   notification in Farsi
5. WHEN confirming the clear action THEN the system SHALL display a warning
   about the destructive nature of the operation

### Requirement 11

**User Story:** As a developer, I want the Subjects feature to follow
established patterns, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. WHEN implementing the feature THEN the file structure SHALL match the Classes
   feature pattern (components/, hooks/, api.ts, types.ts, index.ts)
2. WHEN implementing API calls THEN the system SHALL use TanStack Query with
   proper query keys and cache invalidation
3. WHEN implementing forms THEN the system SHALL use React Hook Form with Zod
   validation
4. WHEN implementing UI THEN the system SHALL use shadcn/ui components (Table,
   Input, Select, Switch, Tabs, Sheet)
5. WHEN implementing layout THEN the system SHALL follow RTL conventions with
   logical CSS properties
