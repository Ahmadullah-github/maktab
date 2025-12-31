# Design Document: Schedule Feature - Phase 4

## Overview

This design document outlines the Display Customization system for the Schedule
Feature in the Maktab school timetable application. Phase 4 builds on the
existing data layer (Phase 1), grid rendering (Phase 2), and dashboard (Phase 3)
to provide user-configurable display settings.

The design follows the existing feature module pattern and integrates with the
Phase 1 Zustand store's displaySettings state, extending it with additional
options and providing a UI for configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Schedule Views                                   │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │  ClassScheduleView      │    │  TeacherScheduleView    │            │
│  │  [⚙️ Settings Button]   │    │  [⚙️ Settings Button]   │            │
│  └───────────┬─────────────┘    └───────────┬─────────────┘            │
│              │                              │                           │
│              └──────────┬───────────────────┘                           │
│                         │ opens                                         │
│              ┌──────────▼──────────┐                                    │
│              │ DisplaySettingsDialog│                                   │
│              │  ├─ CellContentToggles                                   │
│              │  ├─ SizeSelector                                         │
│              │  ├─ ColorCodingSelector                                  │
│              │  └─ PresetButtons                                        │
│              └──────────┬──────────┘                                    │
│                         │ updates                                       │
│              ┌──────────▼──────────┐                                    │
│              │  useDisplaySettings │ ◄── Hook with localStorage         │
│              └──────────┬──────────┘                                    │
│                         │                                               │
│              ┌──────────▼──────────┐                                    │
│              │   scheduleStore     │ ◄── Zustand store                  │
│              │   (displaySettings) │                                    │
│              └──────────┬──────────┘                                    │
│                         │                                               │
│  ┌──────────────────────┼──────────────────────┐                       │
│  │                      │                      │                        │
│  ▼                      ▼                      ▼                        │
│ ┌────────────┐  ┌──────────────┐  ┌─────────────────┐                  │
│ │ScheduleGrid│  │ ScheduleCell │  │ colorUtils.ts   │                  │
│ │ (cellSize) │  │ (fontSize,   │  │ (color gen)     │                  │
│ │            │  │  visibility) │  │                 │                  │
│ └────────────┘  └──────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Load**: `useDisplaySettings` loads from localStorage on mount
2. **Sync**: Hook syncs with Zustand store's `displaySettings`
3. **Update**: User changes settings via dialog controls
4. **Persist**: Hook debounces and saves to localStorage
5. **Render**: Grid and cells re-render with new settings

## Components and Interfaces

### File Structure

```
packages/web/src/features/schedule/
├── components/
│   └── settings/
│       ├── DisplaySettingsDialog.tsx   # Main settings modal
│       ├── CellContentToggles.tsx      # Visibility toggles
│       ├── SizeSelector.tsx            # Cell/font size selectors
│       ├── ColorCodingSelector.tsx     # Color coding options
│       ├── PresetButtons.tsx           # Quick preset buttons
│       └── index.ts
├── hooks/
│   └── useDisplaySettings.ts           # Settings state + persistence
├── utils/
│   └── colorUtils.ts                   # Color generation utilities
└── __tests__/
    ├── DisplaySettingsDialog.test.ts
    ├── DisplaySettingsDialog.property.test.ts
    ├── useDisplaySettings.test.ts
    ├── useDisplaySettings.property.test.ts
    ├── colorUtils.test.ts
    └── colorUtils.property.test.ts
```

## Data Models

### Extended DisplaySettings Type (update types.ts)

```typescript
/**
 * Cell size options for schedule grid
 */
export type CellSize = 'compact' | 'normal' | 'large';

/**
 * Font size options for schedule cells
 */
export type FontSize = 'sm' | 'md' | 'lg';

/**
 * Color coding options for schedule cells
 */
export type ColorCodingMode = 'none' | 'subject' | 'teacher';

/**
 * Extended display settings for schedule rendering
 * Replaces the simpler DisplaySettings from Phase 1
 */
export interface DisplaySettings {
  // Cell content visibility
  showSubjectName: boolean; // Always true, not user-toggleable
  showTeacherName: boolean; // Default: true
  showRoomName: boolean; // Default: true

  // Styling
  cellSize: CellSize; // Default: 'normal'
  fontSize: FontSize; // Default: 'md'

  // Color coding
  colorBy: ColorCodingMode; // Default: 'none'
}

/**
 * Display preset configuration
 */
export interface DisplayPreset {
  key: string;
  labelFa: string;
  labelEn: string;
  settings: Partial<DisplaySettings>;
}

/**
 * Props for DisplaySettingsDialog component
 */
export interface DisplaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### Default Settings and Presets

```typescript
/**
 * Default display settings
 */
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

/**
 * Display presets for quick configuration
 */
export const DISPLAY_PRESETS: DisplayPreset[] = [
  {
    key: 'full-detail',
    labelFa: 'جزئیات کامل',
    labelEn: 'Full Detail',
    settings: {
      showTeacherName: true,
      showRoomName: true,
      cellSize: 'normal',
      fontSize: 'md',
    },
  },
  {
    key: 'compact',
    labelFa: 'فشرده',
    labelEn: 'Compact',
    settings: {
      showTeacherName: true,
      showRoomName: false,
      cellSize: 'compact',
      fontSize: 'sm',
    },
  },
  {
    key: 'print-friendly',
    labelFa: 'مناسب چاپ',
    labelEn: 'Print-Friendly',
    settings: {
      showTeacherName: true,
      showRoomName: true,
      cellSize: 'large',
      fontSize: 'lg',
    },
  },
];

/**
 * localStorage key for display settings
 */
export const DISPLAY_SETTINGS_STORAGE_KEY = 'maktab-schedule-display-settings';
```

### Size Mappings

```typescript
/**
 * Cell size to CSS class/dimension mapping
 */
export const CELL_SIZE_MAP: Record<
  CellSize,
  { minHeight: string; className: string }
> = {
  compact: { minHeight: '48px', className: 'cell-compact' },
  normal: { minHeight: '64px', className: 'cell-normal' },
  large: { minHeight: '80px', className: 'cell-large' },
};

/**
 * Font size to Tailwind class mapping
 */
export const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};
```

## Component Specifications

### DisplaySettingsDialog Component

**File:** `components/settings/DisplaySettingsDialog.tsx`

**Requirements:** 1.1, 1.2, 1.5, 2.1, 2.2, 2.5, 3.1, 4.1, 6.3, 6.4, 7.4

```typescript
interface DisplaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  تنظیمات نمایش                              [✕]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  محتوای سلول                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ نام استاد          [═══════○]               │   │
│  │ نام اتاق           [═══════○]               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  اندازه                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ اندازه سلول    [فشرده ▼]                    │   │
│  │ اندازه فونت    [متوسط ▼]                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  رنگ‌بندی                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ ○ بدون رنگ  ○ بر اساس درس  ○ بر اساس استاد │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  پیش‌تنظیمات                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ [جزئیات کامل] [فشرده] [مناسب چاپ]          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### CellContentToggles Component

**File:** `components/settings/CellContentToggles.tsx`

**Requirements:** 1.1, 1.2, 1.3, 1.4

```typescript
interface CellContentTogglesProps {
  showTeacherName: boolean;
  showRoomName: boolean;
  onShowTeacherNameChange: (value: boolean) => void;
  onShowRoomNameChange: (value: boolean) => void;
}
```

**Implementation Notes:**

- Uses shadcn Switch component
- Subject name toggle is NOT rendered (always visible)
- Labels in Persian with RTL layout

### SizeSelector Component

**File:** `components/settings/SizeSelector.tsx`

**Requirements:** 2.1, 2.2, 2.3, 2.4

```typescript
interface SizeSelectorProps {
  cellSize: CellSize;
  fontSize: FontSize;
  onCellSizeChange: (value: CellSize) => void;
  onFontSizeChange: (value: FontSize) => void;
}
```

**Implementation Notes:**

- Uses shadcn Select component
- Options displayed in Persian

### ColorCodingSelector Component

**File:** `components/settings/ColorCodingSelector.tsx`

**Requirements:** 3.1, 3.2, 3.3, 3.4

```typescript
interface ColorCodingSelectorProps {
  colorBy: ColorCodingMode;
  onColorByChange: (value: ColorCodingMode) => void;
}
```

**Implementation Notes:**

- Uses shadcn RadioGroup component
- Three options: none, subject, teacher

### PresetButtons Component

**File:** `components/settings/PresetButtons.tsx`

**Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5

```typescript
interface PresetButtonsProps {
  onApplyPreset: (preset: DisplayPreset) => void;
}
```

**Implementation Notes:**

- Uses shadcn Button component with outline variant
- Horizontal button group

### useDisplaySettings Hook

**File:** `hooks/useDisplaySettings.ts`

**Requirements:** 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2

```typescript
interface UseDisplaySettingsReturn {
  settings: DisplaySettings;
  updateSettings: (updates: Partial<DisplaySettings>) => void;
  applyPreset: (preset: DisplayPreset) => void;
  resetToDefaults: () => void;
}

export function useDisplaySettings(): UseDisplaySettingsReturn {
  // Implementation syncs with Zustand store and localStorage
}
```

**Implementation Notes:**

- Loads from localStorage on mount
- Debounces localStorage writes (300ms)
- Syncs with scheduleStore.displaySettings
- Uses `useDebouncedCallback` from `use-debounce` package

### Color Utilities

**File:** `utils/colorUtils.ts`

**Requirements:** 3.2, 3.3, 3.5

```typescript
/**
 * Generate a consistent color for an entity ID
 * Uses hash-based color generation for consistency
 */
export function generateEntityColor(entityId: string): string;

/**
 * Check if a color has sufficient contrast with white text
 * Returns true if contrast ratio >= 4.5:1
 */
export function hasGoodContrast(backgroundColor: string): boolean;

/**
 * Get the appropriate text color (black or white) for a background
 */
export function getContrastTextColor(backgroundColor: string): string;
```

**Color Generation Algorithm:**

1. Hash the entity ID to a number
2. Map to HSL color space with:
   - Hue: 0-360 based on hash
   - Saturation: 65-75% for vibrancy
   - Lightness: 75-85% for good contrast with dark text
3. Convert to hex color

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

### Property 1: Cell Content Visibility

_For any_ ScheduledLesson with non-null teacherNames and roomName, when
showTeacherName is false, the rendered ScheduleCell output SHALL NOT contain any
teacher name strings, and when showRoomName is false, the rendered output SHALL
NOT contain the room name string.

**Validates: Requirements 1.3, 1.4**

### Property 2: Dialog Controls Reflect Settings

_For any_ DisplaySettings state, when the DisplaySettingsDialog is rendered, all
toggle switches, selectors, and radio buttons SHALL display values matching the
current settings state.

**Validates: Requirements 1.5, 2.5, 4.5**

### Property 3: Cell Size Styling Application

_For any_ CellSize value (compact, normal, large), when applied to the
ScheduleGrid, all cells SHALL have the corresponding CSS class and minimum
height from CELL_SIZE_MAP.

**Validates: Requirements 2.3**

### Property 4: Font Size Styling Application

_For any_ FontSize value (sm, md, lg), when applied to ScheduleCell components,
the text content SHALL have the corresponding Tailwind class from FONT_SIZE_MAP.

**Validates: Requirements 2.4**

### Property 5: Color Generation Consistency (Idempotence)

_For any_ entity ID string and ColorCodingMode, calling generateEntityColor with
the same ID SHALL always return the same color value.

**Validates: Requirements 3.2, 3.3**

### Property 6: Color Contrast Accessibility

_For any_ color generated by generateEntityColor, the color SHALL have
sufficient contrast (lightness between 70-90% in HSL) to ensure text readability
with dark text.

**Validates: Requirements 3.5**

### Property 7: Settings Persistence Round-Trip

_For any_ valid DisplaySettings object, saving to localStorage via
useDisplaySettings and then loading on a fresh mount SHALL produce an equivalent
DisplaySettings object.

**Validates: Requirements 5.1, 5.2**

### Property 8: Reactive State Updates

_For any_ settings change via updateSettings, components consuming the
useDisplaySettings hook SHALL receive the updated values and trigger a re-render
within the same React update cycle.

**Validates: Requirements 6.1, 6.2**

## Error Handling

### localStorage Errors

| Error Condition          | Handling                                    |
| ------------------------ | ------------------------------------------- |
| localStorage unavailable | Use in-memory state only, log warning       |
| Corrupted JSON           | Reset to DEFAULT_DISPLAY_SETTINGS, log warn |
| Storage quota exceeded   | Continue with current state, log error      |

### Invalid Settings

| Error Condition        | Handling                            |
| ---------------------- | ----------------------------------- |
| Unknown cellSize value | Fall back to 'normal'               |
| Unknown fontSize value | Fall back to 'md'                   |
| Unknown colorBy value  | Fall back to 'none'                 |
| Missing settings keys  | Merge with DEFAULT_DISPLAY_SETTINGS |

## Testing Strategy

### Dual Testing Approach

This feature uses both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties that hold across all
  valid inputs

### Property-Based Testing Framework

- **Library**: fast-check (already used in the codebase)
- **Minimum iterations**: 100 per property test
- **Test file location**: `features/schedule/__tests__/*.property.test.ts`
- **Tag format**:
  `**Feature: schedule-phase4, Property {number}: {property_text}**`

### Test Categories

#### Unit Tests

1. **DisplaySettingsDialog**
   - Renders all sections (toggles, selectors, presets)
   - Opens and closes correctly
   - Subject toggle is not rendered

2. **CellContentToggles**
   - Toggle changes call correct callbacks
   - Displays current values

3. **SizeSelector**
   - All options available in dropdowns
   - Selection changes call callbacks

4. **ColorCodingSelector**
   - All radio options rendered
   - Selection changes call callback

5. **PresetButtons**
   - All preset buttons rendered
   - Click applies correct settings

6. **useDisplaySettings**
   - Loads from localStorage on mount
   - Falls back to defaults when empty
   - Debounces writes

7. **colorUtils**
   - Same ID produces same color
   - Generated colors are valid hex
   - Contrast check works correctly

#### Property-Based Tests

Each property test MUST:

1. Be tagged with format:
   `**Feature: schedule-phase4, Property {number}: {property_text}**`
2. Reference the requirements it validates
3. Run minimum 100 iterations
4. Use smart generators for DisplaySettings and entity IDs

### Test Generators

```typescript
// Generator for CellSize
const cellSizeArb = fc.constantFrom('compact', 'normal', 'large');

// Generator for FontSize
const fontSizeArb = fc.constantFrom('sm', 'md', 'lg');

// Generator for ColorCodingMode
const colorCodingModeArb = fc.constantFrom('none', 'subject', 'teacher');

// Generator for valid DisplaySettings
const displaySettingsArb = fc.record({
  showSubjectName: fc.constant(true), // Always true
  showTeacherName: fc.boolean(),
  showRoomName: fc.boolean(),
  cellSize: cellSizeArb,
  fontSize: fontSizeArb,
  colorBy: colorCodingModeArb,
});

// Generator for entity IDs (non-empty strings)
const entityIdArb = fc.string({ minLength: 1, maxLength: 50 });
```

## i18n Keys

Add to `locales/fa/translation.json`:

```json
{
  "schedule": {
    "settings": {
      "title": "تنظیمات نمایش",
      "cellContent": "محتوای سلول",
      "showTeacherName": "نام استاد",
      "showRoomName": "نام اتاق",
      "sizing": "اندازه",
      "cellSize": "اندازه سلول",
      "fontSize": "اندازه فونت",
      "colorCoding": "رنگ‌بندی",
      "colorByNone": "بدون رنگ",
      "colorBySubject": "بر اساس درس",
      "colorByTeacher": "بر اساس استاد",
      "presets": "پیش‌تنظیمات",
      "presetFullDetail": "جزئیات کامل",
      "presetCompact": "فشرده",
      "presetPrintFriendly": "مناسب چاپ",
      "cellSizeCompact": "فشرده",
      "cellSizeNormal": "معمولی",
      "cellSizeLarge": "بزرگ",
      "fontSizeSmall": "کوچک",
      "fontSizeMedium": "متوسط",
      "fontSizeLarge": "بزرگ"
    }
  }
}
```

## Implementation Notes

### Integration with Existing Store

The Phase 1 scheduleStore already has a `displaySettings` field. This phase:

1. Extends the `DisplaySettings` interface with new fields
2. Updates `DEFAULT_DISPLAY_SETTINGS` in constants.ts
3. Adds `setDisplaySettings` action to store (if not present)
4. Creates `useDisplaySettings` hook that wraps store access + localStorage

### CSS Variables for Dynamic Sizing

```css
/* In globals.css or component styles */
.schedule-grid {
  --cell-min-height: 64px; /* Updated by cellSize setting */
}

.cell-compact {
  --cell-min-height: 48px;
}
.cell-normal {
  --cell-min-height: 64px;
}
.cell-large {
  --cell-min-height: 80px;
}
```

### Debounce Implementation

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSave = useDebouncedCallback((settings: DisplaySettings) => {
  localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}, 300);
```

### Settings Button Placement

Add to ClassScheduleView and TeacherScheduleView headers:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setSettingsOpen(true)}
  aria-label={t('schedule.settings.title')}
>
  <Settings className="h-4 w-4" />
</Button>
```
