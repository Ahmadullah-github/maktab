# Design Document: School Settings & Period Structure Pages

## Overview

This design document describes the architecture and implementation approach for
splitting school configuration into two dedicated pages:

1. **School Settings Page** (`/settings/school`) - Basic school identity and
   operational configuration
2. **Period Structure Page** (`/settings/periods`) - Teaching period
   configuration with dynamic and category-based support

The implementation follows the established feature module pattern in the Maktab
codebase, leveraging existing UI components (Shadcn/ui), state management
(TanStack Query), and the SchoolConfig backend entity.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │  School Settings    │    │     Period Structure            │ │
│  │  /settings/school   │    │     /settings/periods           │ │
│  │                     │    │                                 │ │
│  │  - Days of Week     │    │  - Default Periods              │ │
│  │  - Start Time       │    │  - Period Duration              │ │
│  │  - Timezone         │    │  - Dynamic Periods Toggle       │ │
│  │  - Shift Config     │    │  - Category-Based Toggle        │ │
│  └──────────┬──────────┘    │  - Break Configuration          │ │
│             │               │  - Prayer Breaks                │ │
│             │               └──────────┬──────────────────────┘ │
│             │                          │                        │
│  ┌──────────▼──────────────────────────▼──────────────────────┐ │
│  │              Shared Hooks & API Layer                       │ │
│  │  useSchoolConfig() - TanStack Query hook                    │ │
│  │  useUpdateSchoolConfig() - Mutation hook                    │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────▼───────────────────────────────────┐
│                     Backend (Express API)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  GET/PUT /api/config/school-config                          │ │
│  │  SchoolConfigRepository                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │              SchoolConfig Entity (SQLite)                   │ │
│  │  - daysOfWeekJson, periodsPerDayMapJson                     │ │
│  │  - defaultPeriodsPerDay, breakPeriods                       │ │
│  │  - ramadanModeEnabled, ramadanBreakConfigJson               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### School Settings Feature (`packages/web/src/features/school-settings/`)

```
school-settings/
├── components/
│   ├── SchoolSettingsPage.tsx      # Main page component
│   ├── DaysOfWeekSelector.tsx      # Multi-select checkboxes for days
│   ├── StartTimeInput.tsx          # Time picker component
│   ├── TimezoneSelector.tsx        # Dropdown for timezone selection
│   ├── ShiftConfiguration.tsx      # Single/multi-shift toggle
│   └── UnsavedChangesAlert.tsx     # Navigation guard component
├── hooks/
│   ├── useSchoolSettings.ts        # TanStack Query hook for fetching
│   └── useUpdateSchoolSettings.ts  # Mutation hook for saving
├── schemas/
│   └── schoolSettings.schema.ts    # Zod validation schema
├── constants/
│   └── defaults.ts                 # Default values and options
├── api.ts                          # API functions
├── types.ts                        # TypeScript interfaces
└── index.ts                        # Public exports
```

#### Period Structure Feature (`packages/web/src/features/periods/`)

```
periods/
├── components/
│   ├── PeriodStructurePage.tsx     # Main page component
│   ├── DefaultPeriodsInput.tsx     # Number input for default periods
│   ├── PeriodDurationInput.tsx     # Duration in minutes input
│   ├── DynamicPeriodsConfig.tsx    # Day-by-day period configuration
│   ├── CategoryPeriodsMatrix.tsx   # Grade category × day matrix
│   ├── BreakConfiguration.tsx      # Break periods setup
│   ├── PrayerBreaksConfig.tsx      # Prayer break time slots
│   └── FeatureToggle.tsx           # Reusable toggle with tooltip
├── hooks/
│   ├── usePeriodStructure.ts       # TanStack Query hook for fetching
│   └── useUpdatePeriodStructure.ts # Mutation hook for saving
├── schemas/
│   └── periodStructure.schema.ts   # Zod validation schema
├── constants/
│   └── defaults.ts                 # Default values and limits
├── api.ts                          # API functions
├── types.ts                        # TypeScript interfaces
└── index.ts                        # Public exports
```

### Shared Components

```typescript
// packages/web/src/components/ui/feature-toggle.tsx
interface FeatureToggleProps {
  label: string;
  description?: string;
  tooltip?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}
```

### API Interfaces

```typescript
// Shared types for both features
interface SchoolConfigResponse {
  id: number;
  schoolId: number | null;
  schoolName: string | null;

  // School Settings fields
  daysOfWeek: string[];
  daysPerWeek: number;
  // Note: startTime and timezone to be added to SchoolConfig entity

  // Period Structure fields
  defaultPeriodsPerDay: number;
  periodsPerDay: number;
  periodsPerDayMap: Record<string, number> | null;
  breakPeriods: BreakPeriodConfig[];

  // Ramadan/Prayer breaks
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;
  ramadanBreakConfig: BreakPeriodConfig[] | null;

  createdAt: string;
  updatedAt: string;
}

interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

// School Settings specific
interface SchoolSettingsFormData {
  daysOfWeek: string[];
  startTime: string; // HH:mm format
  timezone: string;
  shiftMode: 'single' | 'multi';
  shifts?: {
    morning: { start: string; end: string };
    afternoon: { start: string; end: string };
  };
}

// Period Structure specific
interface PeriodStructureFormData {
  defaultPeriodsPerDay: number;
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: Record<string, number>;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: Record<string, Record<string, number>>;
  breaks: BreakPeriodConfig[];
  prayerBreaksEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[];
}

interface PrayerBreakConfig {
  name: string;
  time: string; // HH:mm format
  duration: number; // minutes
}
```

## Data Models

### SchoolConfig Entity Extensions

The existing `SchoolConfig` entity needs the following additions:

```typescript
// New fields to add to packages/api/src/entity/SchoolConfig.ts

@Column({ type: "text", default: "07:30" })
schoolStartTime: string = "07:30";

@Column({ type: "text", default: "Asia/Kabul" })
timezone: string = "Asia/Kabul";

@Column({ type: "text", default: "single" })
shiftMode: string = "single";  // 'single' | 'multi'

@Column({ type: "text", nullable: true })
shiftsConfigJson: string | null = null;  // JSON for shift times

@Column({ type: "integer", default: 45 })
periodDuration: number = 45;  // minutes

@Column({ type: "boolean", default: false })
dynamicPeriodsEnabled: boolean = false;

@Column({ type: "boolean", default: false })
categoryPeriodsEnabled: boolean = false;

@Column({ type: "text", nullable: true })
categoryPeriodsMapJson: string | null = null;  // JSON for category-based periods

@Column({ type: "text", nullable: true })
prayerBreaksJson: string | null = null;  // JSON for prayer break configs
```

### Zod Validation Schemas

```typescript
// packages/web/src/features/school-settings/schemas/schoolSettings.schema.ts
import { z } from 'zod';
import { VALID_DAYS, VALID_TIMEZONES } from '../constants/defaults';

export const schoolSettingsSchema = z.object({
  daysOfWeek: z.array(z.string()).min(1, 'حداقل یک روز باید انتخاب شود'),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'فرمت زمان نامعتبر است'),
  timezone: z.string().min(1, 'منطقه زمانی الزامی است'),
  shiftMode: z.enum(['single', 'multi']),
  shifts: z
    .object({
      morning: z.object({
        start: z.string(),
        end: z.string(),
      }),
      afternoon: z.object({
        start: z.string(),
        end: z.string(),
      }),
    })
    .optional(),
});

// packages/web/src/features/periods/schemas/periodStructure.schema.ts
import { z } from 'zod';
import { PERIOD_LIMITS } from '../constants/defaults';

export const periodStructureSchema = z.object({
  defaultPeriodsPerDay: z
    .number()
    .min(PERIOD_LIMITS.MIN, `حداقل ${PERIOD_LIMITS.MIN} ساعت`)
    .max(PERIOD_LIMITS.MAX, `حداکثر ${PERIOD_LIMITS.MAX} ساعت`),
  periodDuration: z
    .number()
    .min(15, 'حداقل ۱۵ دقیقه')
    .max(120, 'حداکثر ۱۲۰ دقیقه'),
  dynamicPeriodsEnabled: z.boolean(),
  periodsPerDayMap: z.record(z.string(), z.number().min(1).max(12)),
  categoryPeriodsEnabled: z.boolean(),
  categoryPeriodsMap: z.record(
    z.string(),
    z.record(z.string(), z.number().min(1).max(12))
  ),
  breaks: z.array(
    z.object({
      afterPeriod: z.number().min(1),
      duration: z.number().min(5).max(60),
    })
  ),
  prayerBreaksEnabled: z.boolean(),
  prayerBreaks: z.array(
    z.object({
      name: z.string().min(1),
      time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      duration: z.number().min(5).max(60),
    })
  ),
});
```

### Constants (No Hardcoding)

```typescript
// packages/web/src/features/school-settings/constants/defaults.ts
export const AFGHAN_WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
] as const;

export const ALL_WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const DEFAULT_START_TIME = '07:30';
export const DEFAULT_TIMEZONE = 'Asia/Kabul';

export const VALID_TIMEZONES = [
  { value: 'Asia/Kabul', label: 'کابل (UTC+4:30)' },
  { value: 'Asia/Tehran', label: 'تهران (UTC+3:30)' },
  { value: 'Asia/Dubai', label: 'دبی (UTC+4)' },
] as const;

// packages/web/src/features/periods/constants/defaults.ts
export const PERIOD_LIMITS = {
  MIN: 1,
  MAX: 12,
  DEFAULT: 7,
} as const;

export const DURATION_LIMITS = {
  MIN: 15,
  MAX: 120,
  DEFAULT: 45,
} as const;

export const GRADE_CATEGORIES = [
  { key: 'Alpha-Primary', grades: [1, 2, 3] },
  { key: 'Beta-Primary', grades: [4, 5, 6] },
  { key: 'Middle', grades: [7, 8, 9] },
  { key: 'High', grades: [10, 11, 12] },
] as const;
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

Based on the acceptance criteria analysis, the following correctness properties
must be verified:

### Property 1: Period Range Validation

_For any_ period count input (default periods, dynamic periods per day, or
category-based periods), the system SHALL reject values outside the range 1-12
and display a validation error.

**Validates: Requirements 3.3, 4.3**

### Property 2: Dynamic Periods Day Coverage

_For any_ set of active school days when dynamic periods is enabled, the system
SHALL display exactly one period count input for each active day, with no
missing or duplicate day inputs.

**Validates: Requirements 3.2**

### Property 3: Dynamic Periods Disabled Fallback

_For any_ configuration where dynamic periods is disabled, the effective period
count for all days SHALL equal the default periods per day value.

**Validates: Requirements 3.4**

### Property 4: Category Matrix Structure

_For any_ set of active school days when category-based periods is enabled, the
system SHALL display a matrix with exactly 4 rows (one per grade category) and N
columns (one per active day), where N equals the number of active days.

**Validates: Requirements 4.2**

### Property 5: Category Periods Disabled Fallback

_For any_ configuration where category-based periods is disabled, the effective
period count for all categories SHALL fall back to either dynamic periods (if
enabled) or default periods.

**Validates: Requirements 4.4**

### Property 6: Category Priority Over Dynamic

_For any_ configuration where both dynamic and category-based periods are
enabled, the effective period count for a category-day combination SHALL use the
category-based value, not the dynamic periods value.

**Validates: Requirements 4.5**

### Property 7: Unsaved Changes Detection

_For any_ form field modification (text input, checkbox, toggle, or select), the
system SHALL set the unsaved changes indicator to true and enable the save
button.

**Validates: Requirements 6.1**

### Property 8: Translation Coverage

_For any_ displayed text (day names, grade categories, validation messages,
labels), the system SHALL retrieve the text from the i18n translation file, not
from hardcoded strings.

**Validates: Requirements 7.4, 7.5, 7.6**

### Property 9: Form Population from API

_For any_ field in the configuration form, when the API returns a saved value
for that field, the form SHALL display that exact value (accounting for type
conversion where necessary).

**Validates: Requirements 11.4**

## Error Handling

### Frontend Error Handling

| Error Type        | Handling Strategy              | User Feedback                 |
| ----------------- | ------------------------------ | ----------------------------- |
| API fetch failure | Retry with exponential backoff | Error state with retry button |
| Validation error  | Prevent submission             | Inline error message in Farsi |
| Save failure      | Keep form state                | Error toast with details      |
| Network timeout   | Show timeout message           | Toast with retry option       |
| Unexpected error  | Error boundary catch           | Generic error message         |

### Backend Error Handling

| Error Type    | HTTP Status | Response Format                      |
| ------------- | ----------- | ------------------------------------ |
| Invalid input | 400         | `{ error: string, details: object }` |
| Not found     | 404         | `{ error: string }`                  |
| Server error  | 500         | `{ error: string }`                  |

### Error Messages (Farsi)

```typescript
// packages/web/src/i18n/locales/fa.json additions
{
  "schoolSettings": {
    "errors": {
      "fetchFailed": "خطا در دریافت تنظیمات مکتب",
      "saveFailed": "خطا در ذخیره تنظیمات",
      "invalidTime": "فرمت زمان نامعتبر است",
      "noDaysSelected": "حداقل یک روز باید انتخاب شود"
    }
  },
  "periodStructure": {
    "errors": {
      "fetchFailed": "خطا در دریافت ساختار ساعات",
      "saveFailed": "خطا در ذخیره تنظیمات",
      "invalidPeriodCount": "تعداد ساعات باید بین ۱ تا ۱۲ باشد",
      "invalidDuration": "مدت زمان باید بین ۱۵ تا ۱۲۰ دقیقه باشد"
    }
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure
comprehensive coverage:

- **Unit tests** verify specific examples, edge cases, and integration points
- **Property-based tests** verify universal properties that should hold across
  all inputs

### Property-Based Testing Framework

**Framework:** [fast-check](https://github.com/dubzzz/fast-check) - TypeScript
property-based testing library

**Configuration:** Each property test runs a minimum of 100 iterations.

### Property-Based Tests

Each correctness property will be implemented as a property-based test:

1. **Property 1 (Period Range Validation):** Generate random integers, verify
   values outside 1-12 are rejected
2. **Property 2 (Dynamic Periods Day Coverage):** Generate random day
   selections, verify input count matches
3. **Property 3 (Dynamic Periods Disabled Fallback):** Generate random configs
   with disabled toggle, verify all days use default
4. **Property 4 (Category Matrix Structure):** Generate random day selections,
   verify matrix dimensions
5. **Property 5 (Category Periods Disabled Fallback):** Generate random configs,
   verify fallback chain
6. **Property 6 (Category Priority Over Dynamic):** Generate configs with both
   enabled, verify category takes precedence
7. **Property 7 (Unsaved Changes Detection):** Generate random field
   modifications, verify indicator state
8. **Property 8 (Translation Coverage):** Generate random display scenarios,
   verify no hardcoded strings
9. **Property 9 (Form Population from API):** Generate random API responses,
   verify form values match

### Unit Tests

Unit tests cover:

- Component rendering with default props
- API hook behavior (loading, success, error states)
- Form validation edge cases
- Navigation guard behavior
- Toast notification triggers

### Test File Structure

```
packages/web/src/features/school-settings/
├── __tests__/
│   ├── SchoolSettingsPage.test.tsx      # Component unit tests
│   ├── schoolSettings.schema.test.ts    # Schema validation tests
│   └── schoolSettings.property.test.ts  # Property-based tests

packages/web/src/features/periods/
├── __tests__/
│   ├── PeriodStructurePage.test.tsx     # Component unit tests
│   ├── periodStructure.schema.test.ts   # Schema validation tests
│   └── periodStructure.property.test.ts # Property-based tests
```

### Test Annotation Format

All property-based tests must be annotated with the following format:

```typescript
/**
 * **Feature: school-settings-periods, Property 1: Period Range Validation**
 * **Validates: Requirements 3.3, 4.3**
 */
test.prop([fc.integer()], (value) => {
  // Test implementation
});
```
