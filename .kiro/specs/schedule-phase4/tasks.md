# Implementation Plan

- [x] 1. Update types and constants
  - [x] 1.1 Extend DisplaySettings interface in types.ts
    - Add CellSize, FontSize, ColorCodingMode type aliases
    - Update DisplaySettings interface with new fields (cellSize, fontSize,
      colorBy)
    - Add DisplayPreset interface and DisplaySettingsDialogProps
    - _Requirements: 1.1, 2.1, 3.1_
  - [x] 1.2 Add display settings constants
    - Update DEFAULT_DISPLAY_SETTINGS with new fields
    - Add DISPLAY_PRESETS array with Full Detail, Compact, Print-Friendly
    - Add CELL_SIZE_MAP and FONT_SIZE_MAP mappings
    - Add DISPLAY_SETTINGS_STORAGE_KEY constant
    - _Requirements: 4.2, 4.3, 4.4, 5.5_

- [x] 2. Implement color utilities
  - [x] 2.1 Create colorUtils.ts with color generation functions
    - Implement generateEntityColor with hash-based HSL generation
    - Implement hasGoodContrast for accessibility checking
    - Implement getContrastTextColor for text color selection
    - _Requirements: 3.2, 3.3, 3.5_
  - [x] 2.2 Write property test for color generation consistency
    - **Property 5: Color Generation Consistency (Idempotence)**
    - **Validates: Requirements 3.2, 3.3**
  - [x] 2.3 Write property test for color contrast accessibility
    - **Property 6: Color Contrast Accessibility**
    - **Validates: Requirements 3.5**

- [x] 3. Implement useDisplaySettings hook
  - [x] 3.1 Create useDisplaySettings hook with localStorage persistence
    - Load settings from localStorage on mount
    - Sync with scheduleStore.displaySettings
    - Implement debounced localStorage writes (300ms)
    - Provide updateSettings, applyPreset, resetToDefaults functions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_
  - [x] 3.2 Write property test for settings persistence round-trip
    - **Property 7: Settings Persistence Round-Trip**
    - **Validates: Requirements 5.1, 5.2**
  - [x] 3.3 Write property test for reactive state updates
    - **Property 8: Reactive State Updates**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement settings dialog components
  - [x] 5.1 Create CellContentToggles component
    - Render Switch components for teacher name and room name visibility
    - Do NOT render toggle for subject name (always visible)
    - Use Persian labels with RTL layout
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Create SizeSelector component
    - Render Select for cell size (compact, normal, large)
    - Render Select for font size (sm, md, lg)
    - Display options in Persian
    - _Requirements: 2.1, 2.2_
  - [x] 5.3 Create ColorCodingSelector component
    - Render RadioGroup with options: none, subject, teacher
    - Display labels in Persian
    - _Requirements: 3.1_
  - [x] 5.4 Create PresetButtons component
    - Render Button for each preset (Full Detail, Compact, Print-Friendly)
    - Call onApplyPreset callback when clicked
    - _Requirements: 4.1_
  - [x] 5.5 Create DisplaySettingsDialog component
    - Compose all settings components in Dialog modal
    - Use shadcn Dialog component
    - Organize sections with labels in Persian
    - _Requirements: 7.4_
  - [x] 5.6 Write property test for dialog controls reflecting settings
    - **Property 2: Dialog Controls Reflect Settings**
    - **Validates: Requirements 1.5, 2.5, 4.5**

- [x] 6. Update ScheduleCell component
  - [x] 6.1 Apply visibility settings to cell content
    - Conditionally render teacher name based on showTeacherName
    - Conditionally render room name based on showRoomName
    - Subject name always rendered
    - _Requirements: 1.3, 1.4_
  - [x] 6.2 Apply font size classes to cell content
    - Use FONT_SIZE_MAP to apply correct Tailwind classes
    - _Requirements: 2.4_
  - [x] 6.3 Apply color coding to cell background
    - Use generateEntityColor when colorBy is 'subject' or 'teacher'
    - Use default background when colorBy is 'none'
    - _Requirements: 3.2, 3.3, 3.4_
  - [ ] 6.4 Write property test for cell content visibility
    - **Property 1: Cell Content Visibility**
    - **Validates: Requirements 1.3, 1.4**
  - [x] 6.5 Write property test for font size styling
    - **Property 4: Font Size Styling Application**
    - **Validates: Requirements 2.4**

- [x] 7. Update ScheduleGrid component
  - [x] 7.1 Apply cell size settings to grid
    - Use CELL_SIZE_MAP to set CSS variables/classes
    - Apply to all cells in the grid
    - _Requirements: 2.3_
  - [x] 7.2 Write property test for cell size styling
    - **Property 3: Cell Size Styling Application**
    - **Validates: Requirements 2.3**

- [x] 8. Integrate settings into schedule views
  - [x] 8.1 Add settings button to ClassScheduleView
    - Add gear icon button in header area
    - Open DisplaySettingsDialog on click
    - Include accessibility label
    - _Requirements: 7.1, 7.3_
  - [x] 8.2 Add settings button to TeacherScheduleView
    - Add gear icon button in header area
    - Open DisplaySettingsDialog on click
    - Include accessibility label
    - _Requirements: 7.2, 7.3_

- [x] 9. Add i18n translations
  - [x] 9.1 Add Persian translations for settings UI
    - Add all keys under schedule.settings namespace
    - Include labels for toggles, selectors, presets
    - _Requirements: All UI requirements_

- [x] 10. Update feature exports
  - [x] 10.1 Export new components and hooks from index files
    - Update components/settings/index.ts
    - Update hooks/index.ts
    - Update main feature index.ts
    - _Requirements: All_

- [-] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
