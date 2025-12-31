# Requirements Document

## Introduction

This specification defines the core infrastructure and data layer for the
Schedule Feature in the Maktab school timetable application. Phase 1 establishes
the foundational TypeScript types, Zustand store, index builder utilities,
schedule transformer, and TanStack Query hooks required to load, normalize, and
efficiently query schedule data. This phase focuses on the data layer without UI
components, enabling subsequent phases to build upon a solid, performant
foundation.

## Glossary

- **Schedule**: A complete timetable solution containing scheduled lessons,
  metadata about entities, and solution statistics
- **ScheduledLesson**: A single lesson assignment specifying day, period, class,
  subject, teacher(s), and room
- **ScheduleIndexes**: Pre-computed lookup maps enabling O(1) access to lessons
  by various keys (slot, teacher+slot, room+slot, class+slot)
- **Slot**: A unique time position identified by day and period index (e.g.,
  "Monday-2")
- **Solver**: The Python OR-Tools constraint solver that generates timetable
  solutions
- **SolutionMetadata**: Descriptive information about classes, subjects,
  teachers, and period configuration in a solution
- **SolutionStatistics**: Quantitative metrics about the generated solution
  (lesson counts, solve time, quality score)
- **DisplaySettings**: User preferences for how schedule cells render
  (visibility of names, cell sizing)

## Requirements

### Requirement 1

**User Story:** As a developer, I want TypeScript interfaces that accurately
represent solver output, so that I can work with schedule data in a type-safe
manner.

#### Acceptance Criteria

1. THE Schedule_Types module SHALL define a ScheduledLesson interface with
   fields: day (DayOfWeek enum), periodIndex (number), classId (string),
   className (string | null), subjectId (string), subjectName (string | null),
   teacherIds (string[]), teacherNames (string[] | null), roomId (string |
   null), roomName (string | null), isFixed (boolean), and periodsThisDay
   (number | null)
2. THE Schedule_Types module SHALL define a SolutionMetadata interface
   containing arrays of ClassMetadata, SubjectMetadata, TeacherMetadata, and a
   PeriodConfiguration object
3. THE Schedule_Types module SHALL define a SolutionStatistics interface with
   fields: totalClasses, singleTeacherClasses, multiTeacherClasses,
   totalSubjects, customSubjects, standardSubjects, totalTeachers, totalRooms,
   categoryCounts, customSubjectsByCategory, totalLessons, periodsPerWeek,
   solveTimeSeconds, strategy, numConstraintsApplied, and qualityScore
4. THE Schedule_Types module SHALL define a ScheduleIndexes interface with Map
   types for bySlot, byTeacherAndSlot, byRoomAndSlot, byClassAndSlot, byTeacher,
   byClass, and byRoom lookups
5. THE Schedule_Types module SHALL define a DisplaySettings interface with
   boolean fields showSubjectName, showTeacherName, showRoomName, and numeric
   fields cellSize and fontSize
6. THE Schedule_Types module SHALL define a DayOfWeek enum matching the solver's
   day values: Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday

### Requirement 2

**User Story:** As a developer, I want a Zustand store that manages schedule
state, so that components can access and update schedule data reactively.

#### Acceptance Criteria

1. THE Schedule_Store SHALL maintain state fields: scheduleId (number | null),
   scheduleName (string), lessons (ScheduledLesson[]), indexes
   (ScheduleIndexes), metadata (SolutionMetadata | null), statistics
   (SolutionStatistics | null), teachers (Map<string, TeacherMetadata>), rooms
   (Map<string, RoomMetadata>), classes (Map<string, ClassMetadata>), subjects
   (Map<string, SubjectMetadata>), displaySettings (DisplaySettings), isLoading
   (boolean), and error (string | null)
2. WHEN loadSchedule action is called with a schedule ID THEN the Schedule_Store
   SHALL set isLoading to true, fetch the schedule data, normalize it using the
   transformer, build indexes, populate entity maps, and set isLoading to false
3. WHEN clearSchedule action is called THEN the Schedule_Store SHALL reset all
   state fields to their initial values
4. WHEN updateIndexes action is called THEN the Schedule_Store SHALL rebuild all
   index maps from the current lessons array
5. THE Schedule_Store SHALL use immer middleware for immutable state updates
6. WHEN loadSchedule encounters an error THEN the Schedule_Store SHALL set the
   error field with the error message and set isLoading to false

### Requirement 3

**User Story:** As a developer, I want an index builder utility that creates
efficient lookup structures, so that schedule queries perform in O(1) time.

#### Acceptance Criteria

1. THE Index_Builder SHALL export a buildIndexes function that accepts a
   ScheduledLesson array and returns a ScheduleIndexes object
2. THE Index_Builder SHALL create slot keys using the format
   "${day}-${periodIndex}" for bySlot index
3. THE Index_Builder SHALL create entity-slot keys using the format
   "${entityId}-${day}-${periodIndex}" for byTeacherAndSlot, byRoomAndSlot, and
   byClassAndSlot indexes
4. WHEN a lesson has multiple teacherIds THEN the Index_Builder SHALL add the
   lesson to byTeacherAndSlot for each teacher ID
5. THE Index_Builder SHALL populate byTeacher, byClass, and byRoom indexes with
   arrays of lessons grouped by entity ID
6. WHEN buildIndexes receives an empty lessons array THEN the Index_Builder
   SHALL return ScheduleIndexes with empty Maps

### Requirement 4

**User Story:** As a developer, I want a schedule transformer that normalizes
API responses, so that the store receives consistently structured data.

#### Acceptance Criteria

1. THE Schedule_Transformer SHALL export a normalizeSchedule function that
   accepts an API timetable response and returns an object with lessons,
   metadata, and statistics
2. THE Schedule_Transformer SHALL parse the JSON data field from the timetable
   entity into structured objects
3. WHEN the API response contains a schedule array THEN the Schedule_Transformer
   SHALL map each item to a ScheduledLesson with all required fields
4. WHEN the API response contains metadata THEN the Schedule_Transformer SHALL
   extract and structure ClassMetadata, SubjectMetadata, TeacherMetadata, and
   PeriodConfiguration
5. WHEN the API response contains statistics THEN the Schedule_Transformer SHALL
   map all statistical fields to the SolutionStatistics interface
6. WHEN the API response data field is malformed JSON THEN the
   Schedule_Transformer SHALL throw an error with a descriptive message

### Requirement 5

**User Story:** As a developer, I want TanStack Query hooks for schedule
operations, so that I can fetch and mutate schedule data with proper caching.

#### Acceptance Criteria

1. THE useSchedule hook SHALL accept a schedule ID parameter and return query
   result with transformed schedule data, isLoading, and error states
2. THE useSchedules hook SHALL fetch all schedules and return a paginated list
   for dashboard display
3. THE useSaveSchedule hook SHALL provide a mutation function that saves
   schedule changes and invalidates the schedules query cache on success
4. THE useDeleteSchedule hook SHALL provide a mutation function that deletes a
   schedule and invalidates the schedules query cache on success
5. THE Schedule_Hooks SHALL use query keys ['schedule', id] for single schedule
   queries and ['schedules'] for list queries
6. WHEN a mutation succeeds THEN the Schedule_Hooks SHALL display a Farsi
   success toast notification
7. WHEN a mutation fails THEN the Schedule_Hooks SHALL display a Farsi error
   toast notification with the error message

### Requirement 6

**User Story:** As a developer, I want constants for days, grades, and
constraints, so that I can reference standardized values throughout the schedule
feature.

#### Acceptance Criteria

1. THE Schedule_Constants SHALL export a DAYS_OF_WEEK array containing objects
   with value (DayOfWeek enum), labelFa (Persian name), and labelEn (English
   name) for Saturday through Friday
2. THE Schedule_Constants SHALL export a GRADE_CATEGORIES object with keys:
   ALPHA_PRIMARY, BETA_PRIMARY, MIDDLE, HIGH, each containing gradeRange array,
   labelFa, and labelEn
3. THE Schedule_Constants SHALL export a CONSTRAINT_TYPES enum containing all
   constraint type identifiers used by the solver
4. THE Schedule_Constants SHALL export DEFAULT_DISPLAY_SETTINGS with
   showSubjectName: true, showTeacherName: true, showRoomName: false, cellSize:
   80, fontSize: 12
