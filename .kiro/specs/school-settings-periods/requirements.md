# Requirements Document

## Introduction

This document specifies the requirements for splitting the school configuration
into two separate pages in the Maktab timetable application:

1. **School Settings Page** (`/settings/school`) - Basic school identity and
   operational configuration
2. **Period Structure Page** (`/settings/periods`) - Teaching period
   configuration with dynamic and category-based support

The split improves UX by separating infrequently changed school identity
settings from the more complex and frequently adjusted period structure
configuration. Both pages integrate with the existing `SchoolConfig` entity and
follow established frontend patterns.

## Glossary

- **SchoolConfig**: The backend entity storing all school-wide configuration
  settings including days, periods, breaks, and Ramadan mode
- **Dynamic Periods**: Feature allowing different number of periods for
  different days of the week (e.g., Friday has fewer periods)
- **Category-Based Periods**: Feature allowing different period counts for
  different grade categories (Alpha-Primary, Beta-Primary, Middle, High)
- **Grade Category**: Afghan education system classification - Alpha-Primary
  (grades 1-3), Beta-Primary (grades 4-6), Middle (grades 7-9), High (grades
  10-12)
- **Break Period**: A non-teaching interval configured after specific periods
  with defined duration
- **Prayer Break**: Special break periods for religious observance (e.g., during
  Ramadan)
- **Shift**: School operating time - morning or afternoon session
- **Period Duration**: Length of a single teaching period in minutes
- **i18n**: Internationalization system for multi-language support
- **RTL**: Right-to-left text direction used for Farsi/Dari language

## Requirements

### Requirement 1

**User Story:** As a school administrator, I want to configure basic school
operational settings on a dedicated page, so that I can manage school identity
and schedule foundation separately from complex period configurations.

#### Acceptance Criteria

1. WHEN a user navigates to `/settings/school` THEN the System SHALL display the
   School Settings page with a card-based layout
2. WHEN the School Settings page loads THEN the System SHALL fetch existing
   configuration from `GET /api/config/school-config` endpoint
3. WHEN a user selects days of operation THEN the System SHALL display
   checkboxes for all seven days with Afghan week defaults (Saturday-Thursday
   selected)
4. WHEN a user sets school start time THEN the System SHALL provide a time
   picker with default value of 07:30
5. WHEN a user selects timezone THEN the System SHALL display a dropdown with
   Asia/Kabul as the default selection
6. WHEN a user configures shift settings THEN the System SHALL provide toggle
   options for single-shift or multi-shift (morning/afternoon) operation

### Requirement 2

**User Story:** As a school administrator, I want to configure period structure
on a dedicated page, so that I can manage teaching periods, breaks, and advanced
scheduling options in one focused interface.

#### Acceptance Criteria

1. WHEN a user navigates to `/settings/periods` THEN the System SHALL display
   the Period Structure page with organized sections
2. WHEN the Period Structure page loads THEN the System SHALL fetch existing
   configuration from `GET /api/config/school-config` endpoint
3. WHEN a user sets default periods per day THEN the System SHALL provide a
   number input with range 1-12 and default value of 7
4. WHEN a user sets period duration THEN the System SHALL provide a number input
   in minutes with default value of 45
5. WHEN a user configures break periods THEN the System SHALL allow specifying
   breaks after specific periods with duration in minutes
6. WHEN a user enables prayer breaks THEN the System SHALL provide configurable
   time slots for religious observance

### Requirement 3

**User Story:** As a school administrator, I want to enable dynamic periods per
day, so that I can configure different period counts for different days of the
week (e.g., shorter Fridays).

#### Acceptance Criteria

1. WHEN a user enables the dynamic periods toggle THEN the System SHALL display
   a day-by-day period count configuration interface
2. WHEN dynamic periods is enabled THEN the System SHALL show each active school
   day with an individual period count input
3. WHEN a user sets periods for a specific day THEN the System SHALL validate
   the value is within the 1-12 range
4. WHEN dynamic periods is disabled THEN the System SHALL use the default
   periods per day value for all days
5. WHEN saving dynamic periods configuration THEN the System SHALL store the
   data in `periodsPerDayMapJson` field as a JSON object

### Requirement 4

**User Story:** As a school administrator, I want to enable category-based
periods, so that different grade levels can have different period counts
appropriate to their age group.

#### Acceptance Criteria

1. WHEN a user enables the category-based periods toggle THEN the System SHALL
   display a grade category matrix configuration interface
2. WHEN category-based periods is enabled THEN the System SHALL show a matrix
   with grade categories (Alpha-Primary, Beta-Primary, Middle, High) as rows and
   active days as columns
3. WHEN a user sets periods for a category-day combination THEN the System SHALL
   validate the value is within the 1-12 range
4. WHEN category-based periods is disabled THEN the System SHALL use either
   dynamic periods or default periods for all categories
5. WHEN both dynamic and category-based periods are enabled THEN the System
   SHALL prioritize category-based configuration over dynamic periods

### Requirement 5

**User Story:** As a school administrator, I want all configuration values to be
persisted and retrieved from the backend, so that settings are preserved across
sessions and synchronized with the solver.

#### Acceptance Criteria

1. WHEN a user clicks the save button on School Settings page THEN the System
   SHALL send a PUT request to `/api/config/school-config` with updated values
2. WHEN a user clicks the save button on Period Structure page THEN the System
   SHALL send a PUT request to `/api/config/school-config` with updated values
3. WHEN the save operation succeeds THEN the System SHALL display a success
   toast notification in Farsi
4. WHEN the save operation fails THEN the System SHALL display an error toast
   notification in Farsi with error details
5. WHEN configuration is saved THEN the System SHALL invalidate relevant
   TanStack Query caches to ensure data consistency
6. WHEN the page loads with no existing configuration THEN the System SHALL
   create a default configuration with Afghan school defaults

### Requirement 6

**User Story:** As a school administrator, I want visual feedback for unsaved
changes, so that I don't accidentally lose my configuration modifications.

#### Acceptance Criteria

1. WHEN a user modifies any form field THEN the System SHALL enable the save
   button and display an unsaved changes indicator
2. WHEN a user attempts to navigate away with unsaved changes THEN the System
   SHALL display a confirmation dialog
3. WHEN a user confirms navigation with unsaved changes THEN the System SHALL
   discard changes and navigate
4. WHEN a user cancels navigation THEN the System SHALL keep the user on the
   current page with changes preserved
5. WHEN the save operation completes successfully THEN the System SHALL clear
   the unsaved changes indicator

### Requirement 7

**User Story:** As a school administrator, I want the configuration pages to
display in Farsi with RTL layout, so that the interface matches our language and
reading direction.

#### Acceptance Criteria

1. WHEN the School Settings page renders THEN the System SHALL display all
   labels and text from the i18n Farsi translation file
2. WHEN the Period Structure page renders THEN the System SHALL display all
   labels and text from the i18n Farsi translation file
3. WHEN either page renders THEN the System SHALL apply right-to-left text
   direction throughout
4. WHEN displaying day names THEN the System SHALL use translated day names from
   the `days` translation namespace
5. WHEN displaying grade categories THEN the System SHALL use translated
   category names from the translation file
6. WHEN displaying validation messages THEN the System SHALL show messages in
   Farsi from the translation file

### Requirement 8

**User Story:** As a developer, I want all configuration options to be
data-driven without hardcoded values, so that the system remains flexible and
maintainable.

#### Acceptance Criteria

1. WHEN rendering day options THEN the System SHALL retrieve day names from i18n
   translations, not hardcoded strings
2. WHEN rendering grade category options THEN the System SHALL retrieve category
   names from a constants file or API, not hardcoded arrays
3. WHEN applying default values THEN the System SHALL use configurable constants
   defined in a central location
4. WHEN validating period ranges THEN the System SHALL use configurable min/max
   constants, not magic numbers
5. WHEN rendering timezone options THEN the System SHALL use a data-driven list
   with appropriate defaults for the target region

### Requirement 9

**User Story:** As a developer, I want the configuration pages to follow
established codebase patterns, so that the code is maintainable and consistent
with existing features.

#### Acceptance Criteria

1. WHEN implementing the School Settings feature THEN the System SHALL follow
   the file structure pattern from existing features (components/, hooks/,
   api.ts, types.ts)
2. WHEN implementing API calls THEN the System SHALL use TanStack Query hooks
   with proper cache invalidation
3. WHEN implementing forms THEN the System SHALL use React Hook Form with Zod
   schema validation
4. WHEN implementing UI components THEN the System SHALL use Shadcn/ui
   components from the existing component library
5. WHEN implementing state management THEN the System SHALL use local component
   state for UI and TanStack Query for server state

### Requirement 10

**User Story:** As a school administrator, I want helpful tooltips and guidance
for complex options, so that I understand the impact of advanced configurations
like dynamic and category-based periods.

#### Acceptance Criteria

1. WHEN hovering over the dynamic periods toggle THEN the System SHALL display a
   tooltip explaining the feature purpose
2. WHEN hovering over the category-based periods toggle THEN the System SHALL
   display a tooltip explaining the feature purpose
3. WHEN a user enables an advanced feature THEN the System SHALL display inline
   help text explaining how to configure it
4. WHEN displaying the break configuration section THEN the System SHALL show
   example values and guidance text
5. WHEN a validation error occurs THEN the System SHALL display clear,
   actionable error messages in Farsi

### Requirement 11

**User Story:** As a school administrator, I want the configuration pages to
have proper loading and error states, so that I have clear feedback during data
operations.

#### Acceptance Criteria

1. WHEN the page is fetching configuration data THEN the System SHALL display
   skeleton loading UI
2. WHEN the save operation is in progress THEN the System SHALL disable the save
   button and show a loading indicator
3. WHEN the API request fails THEN the System SHALL display an error state with
   retry option
4. WHEN the configuration data is successfully loaded THEN the System SHALL
   populate all form fields with existing values
5. WHEN the page encounters an unexpected error THEN the System SHALL display a
   user-friendly error message in Farsi
