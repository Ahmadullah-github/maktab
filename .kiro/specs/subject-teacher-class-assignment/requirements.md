# Requirements Document

## Introduction

This document specifies the requirements for the Subject-Teacher-Class
Assignment System in the Maktab school timetable application. This system
enhances the existing Teachers, Subjects, and Classes features by providing
comprehensive assignment management capabilities. The system enables school
administrators to assign teachers to specific subjects within classes, track
workload distribution, detect conflicts, and ensure complete curriculum
coverage.

The assignment system integrates seamlessly with the existing solver
architecture, leveraging the current `Teacher.classAssignments` and
`ClassGroup.subjectRequirements` data structures while providing enhanced UI
components and validation logic.

## Glossary

- **Assignment**: A relationship linking a teacher to teach a specific subject
  in one or more classes
- **Teacher Workload**: The total number of periods per week assigned to a
  teacher across all subjects and classes
- **Subject Coverage**: The extent to which a subject's teaching requirements
  are fulfilled across all classes
- **Assignment Conflict**: A situation where assignments violate constraints
  (teacher overload, subject-teacher incompatibility, etc.)
- **Assignment Matrix**: A visual grid showing teacher-subject-class
  relationships and their status
- **Coverage Analysis**: A report showing which subjects lack adequate teacher
  assignments
- **Workload Calculator**: A component that computes and displays teacher period
  distribution
- **Assignment Status**: The state of a subject-class pairing (assigned,
  unassigned, conflict)
- **Teacher Compatibility**: Whether a teacher is qualified to teach a specific
  subject based on their primarySubjectIds and allowedSubjectIds
- **Period Calculation**: Computing total teaching periods based on subject
  requirements and class assignments

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to assign teachers to subjects
within specific classes through an enhanced teacher editing interface, so that I
can manage teaching assignments while viewing teacher details.

#### Acceptance Criteria

1. WHEN editing a teacher in the TeacherEditDrawer THEN the System SHALL display
   a new "تخصیص کلاس‌ها" (Assignments) tab alongside existing tabs
2. WHEN the assignments tab is selected THEN the System SHALL display a
   TeacherAssignmentMatrix showing all subjects the teacher can teach and all
   available classes
3. WHEN a teacher-subject-class combination is valid THEN the System SHALL
   display an "Assign" button or checkbox to create the assignment
4. WHEN a teacher-subject-class combination already exists THEN the System SHALL
   display a "Remove" button and show the current periods per week
5. WHEN an assignment would create a conflict THEN the System SHALL display a
   warning indicator and prevent the assignment
6. WHEN assignments are modified THEN the System SHALL update the teacher's
   classAssignments field and persist changes to the database

### Requirement 2

**User Story:** As a school administrator, I want to view and manage teacher
workload calculations in real-time, so that I can ensure balanced teaching loads
and avoid overloading teachers.

#### Acceptance Criteria

1. WHEN viewing a teacher's assignments tab THEN the System SHALL display a
   TeacherWorkloadCalculator showing current and maximum periods per week
2. WHEN assignments are added or removed THEN the System SHALL recalculate the
   total workload immediately
3. WHEN a teacher's workload approaches their maximum (within 5 periods) THEN
   the System SHALL display a warning indicator
4. WHEN a teacher's workload exceeds their maximum THEN the System SHALL display
   an error indicator and prevent additional assignments
5. WHEN workload is calculated THEN the System SHALL show a breakdown by subject
   and total periods across all classes
6. WHEN workload data is displayed THEN the System SHALL use visual indicators
   (progress bars, color coding) to show capacity utilization

### Requirement 3

**User Story:** As a school administrator, I want to assign teachers to subjects
when editing class requirements, so that I can complete subject-teacher
assignments from the class management interface.

#### Acceptance Criteria

1. WHEN editing a class in the ClassEditDrawer subjects tab THEN the System
   SHALL enhance the SubjectRequirementsEditor to include teacher assignment
   dropdowns
2. WHEN a subject is added to class requirements THEN the System SHALL display a
   teacher selector dropdown populated with compatible teachers
3. WHEN a teacher is selected for a subject THEN the System SHALL validate the
   assignment against teacher workload and subject compatibility
4. WHEN an assignment creates a conflict THEN the System SHALL display an inline
   warning and allow the administrator to proceed or cancel
5. WHEN assignments are saved THEN the System SHALL update both the class's
   subjectRequirements and the teacher's classAssignments
6. WHEN viewing class subject requirements THEN the System SHALL display
   assignment status indicators (assigned, unassigned, conflict)

### Requirement 4

**User Story:** As a school administrator, I want to view subject coverage
analysis when editing subjects, so that I can identify which subjects need
additional teacher assignments.

#### Acceptance Criteria

1. WHEN editing a subject in the SubjectEditDrawer THEN the System SHALL display
   a new "پوشش تدریس" (Coverage) section
2. WHEN the coverage section loads THEN the System SHALL show all classes
   requiring this subject and their assignment status
3. WHEN displaying coverage information THEN the System SHALL show which
   teachers are qualified to teach the subject
4. WHEN a class lacks a teacher for the subject THEN the System SHALL display an
   "Unassigned" status with a quick-assign button
5. WHEN multiple teachers teach the same subject THEN the System SHALL show the
   distribution across classes
6. WHEN coverage is incomplete THEN the System SHALL display recommendations for
   teacher assignments

### Requirement 5

**User Story:** As a school administrator, I want the system to validate
assignment compatibility automatically, so that I can avoid assigning teachers
to subjects they cannot teach.

#### Acceptance Criteria

1. WHEN attempting to assign a teacher to a subject THEN the System SHALL check
   if the subject is in the teacher's primarySubjectIds or allowedSubjectIds
2. WHEN a teacher has restrictToPrimarySubjects enabled THEN the System SHALL
   only allow assignments to subjects in primarySubjectIds
3. WHEN a teacher has restrictToPrimarySubjects disabled THEN the System SHALL
   allow assignments to subjects in both primarySubjectIds and allowedSubjectIds
4. WHEN an incompatible assignment is attempted THEN the System SHALL display an
   error message and prevent the assignment
5. WHEN displaying teacher options for a subject THEN the System SHALL filter
   the dropdown to show only compatible teachers
6. WHEN compatibility changes (teacher subjects modified) THEN the System SHALL
   re-validate existing assignments and flag conflicts

### Requirement 6

**User Story:** As a school administrator, I want to detect and resolve
assignment conflicts automatically, so that I can maintain valid teaching
assignments across the system.

#### Acceptance Criteria

1. WHEN any assignment is created or modified THEN the System SHALL run conflict
   detection across all affected teachers and classes
2. WHEN a teacher's total workload exceeds their maxPeriodsPerWeek THEN the
   System SHALL flag this as a workload conflict
3. WHEN a teacher is assigned to teach during their unavailable periods THEN the
   System SHALL flag this as an availability conflict
4. WHEN a subject requires more periods than assigned teachers can provide THEN
   the System SHALL flag this as a coverage conflict
5. WHEN conflicts are detected THEN the System SHALL display them in a conflicts
   panel with suggested resolutions
6. WHEN conflicts are resolved THEN the System SHALL update the conflict status
   and remove warnings

### Requirement 7

**User Story:** As a school administrator, I want assignment changes to
integrate seamlessly with the existing solver, so that timetable generation uses
the current assignment data.

#### Acceptance Criteria

1. WHEN assignments are saved THEN the System SHALL update the
   Teacher.classAssignments JSON field in the format expected by the solver
2. WHEN class subject requirements are modified THEN the System SHALL update the
   ClassGroup.subjectRequirements JSON field with teacher assignments
3. WHEN the solver runs THEN the System SHALL use the current assignment data to
   generate valid timetables
4. WHEN assignment data is serialized THEN the System SHALL maintain
   compatibility with existing solver input format
5. WHEN assignment data is deserialized THEN the System SHALL correctly parse
   JSON fields into UI-compatible objects
6. WHEN solver feedback indicates assignment issues THEN the System SHALL
   display these as assignment conflicts

### Requirement 8

**User Story:** As a school administrator, I want assignment operations to
provide immediate feedback, so that I can understand the impact of my changes in
real-time.

#### Acceptance Criteria

1. WHEN an assignment is created THEN the System SHALL display a success toast
   notification in Farsi
2. WHEN an assignment is removed THEN the System SHALL display a confirmation
   dialog and success notification
3. WHEN an assignment fails due to conflicts THEN the System SHALL display a
   detailed error message explaining the conflict
4. WHEN workload changes THEN the System SHALL update workload indicators
   immediately without requiring a page refresh
5. WHEN assignment status changes THEN the System SHALL update all related UI
   components (matrices, dropdowns, indicators) in real-time
6. WHEN bulk operations are performed THEN the System SHALL show progress
   indicators and summary results

### Requirement 9

**User Story:** As a school administrator, I want assignment data to persist
reliably, so that my teaching assignments are maintained across sessions and
system restarts.

#### Acceptance Criteria

1. WHEN assignments are saved THEN the System SHALL persist changes to the
   database immediately
2. WHEN the page is refreshed THEN the System SHALL load and display the current
   assignment state correctly
3. WHEN assignment data is corrupted or invalid THEN the System SHALL handle
   errors gracefully and provide recovery options
4. WHEN concurrent users modify assignments THEN the System SHALL handle
   conflicts and provide appropriate warnings
5. WHEN assignment operations fail THEN the System SHALL maintain data
   consistency and rollback partial changes
6. WHEN the system restarts THEN the System SHALL preserve all assignment data
   and restore the previous state

### Requirement 10

**User Story:** As a school administrator, I want assignment interfaces to
follow the existing UI patterns, so that the new functionality feels integrated
and familiar.

#### Acceptance Criteria

1. WHEN assignment components render THEN the System SHALL use the same design
   system (Shadcn/ui) as existing features
2. WHEN assignment forms are displayed THEN the System SHALL follow the same
   validation patterns using React Hook Form and Zod
3. WHEN assignment data is loaded THEN the System SHALL use TanStack Query with
   the same caching and invalidation patterns
4. WHEN assignment errors occur THEN the System SHALL display toast
   notifications using the same Sonner patterns
5. WHEN assignment interfaces are displayed THEN the System SHALL support RTL
   layout and Farsi localization
6. WHEN assignment components are structured THEN the System SHALL follow the
   same file organization patterns as existing features

### Requirement 11

**User Story:** As a school administrator, I want assignment operations to be
performant, so that I can manage large numbers of assignments without delays.

#### Acceptance Criteria

1. WHEN loading assignment data THEN the System SHALL display results within 2
   seconds for schools with up to 100 teachers and 50 classes
2. WHEN calculating workloads THEN the System SHALL update displays within 500ms
   of assignment changes
3. WHEN validating assignments THEN the System SHALL provide feedback within 1
   second of user actions
4. WHEN displaying assignment matrices THEN the System SHALL render efficiently
   using virtualization for large datasets
5. WHEN performing bulk operations THEN the System SHALL process assignments in
   batches and show progress
6. WHEN caching assignment data THEN the System SHALL minimize API calls and use
   optimistic updates where appropriate

### Requirement 12

**User Story:** As a developer, I want assignment functionality to be thoroughly
tested, so that the system maintains reliability as it evolves.

#### Acceptance Criteria

1. WHEN assignment logic is implemented THEN the System SHALL include
   comprehensive unit tests for all assignment functions
2. WHEN assignment components are created THEN the System SHALL include
   component tests for user interactions
3. WHEN assignment APIs are developed THEN the System SHALL include integration
   tests for data persistence
4. WHEN assignment validation is implemented THEN the System SHALL include
   property-based tests for conflict detection
5. WHEN assignment serialization is coded THEN the System SHALL include
   round-trip tests for data integrity
6. WHEN assignment performance is optimized THEN the System SHALL include
   performance tests for large datasets
