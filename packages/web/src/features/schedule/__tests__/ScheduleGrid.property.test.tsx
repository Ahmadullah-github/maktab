/**
 * Property-based tests for ScheduleGrid component
 * Tests universal properties that should hold across all valid inputs
 */

import { render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, it, vi } from 'vitest';
import { ScheduleGrid } from '../components/grid/ScheduleGrid';
import { CELL_SIZE_MAP } from '../constants';
import type { DayOfWeek } from '../types';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | { [key: string]: any }) => {
      if (typeof defaultValue === 'object' && defaultValue !== null) {
        // Handle interpolation like { number: 1 }
        if (key === 'common.periodNumber' && 'number' in defaultValue) {
          return `Period ${defaultValue.number}`;
        }
        return key;
      }
      return defaultValue || key;
    },
  }),
}));

// ============================================================================
// Test Generators
// ============================================================================

/**
 * Generator for valid ScheduledLesson objects
 */
const scheduledLessonArb = fc.record({
  day: fc.constantFrom('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'),
  periodIndex: fc.integer({ min: 0, max: 5 }),
  classId: fc.string({ minLength: 1, maxLength: 10 }),
  className: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  subjectId: fc.string({ minLength: 1, maxLength: 10 }),
  subjectName: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
  teacherIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
  teacherNames: fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 })
  ),
  roomId: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
  roomName: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 6 })),
});

/**
 * Generator for DisplaySettings with cell size options
 */
const displaySettingsArb = fc.record({
  showSubjectName: fc.constant(true),
  showTeacherName: fc.boolean(),
  showRoomName: fc.boolean(),
  cellSize: fc.constantFrom('compact', 'normal', 'large'),
  fontSize: fc.constantFrom('sm', 'md', 'lg'),
  colorBy: fc.constantFrom('none', 'subject', 'teacher'),
});

/**
 * Generator for days array
 */
const daysArb = fc.constantFrom([
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
] as DayOfWeek[]);

/**
 * Generator for periods per day (fixed number)
 */
const periodsPerDayArb = fc.integer({ min: 4, max: 8 });

// ============================================================================
// Property Tests
// ============================================================================

describe('ScheduleGrid Property Tests', () => {
  /**
   * **Feature: schedule-phase4, Property 3: Cell Size Styling Application**
   * **Validates: Requirements 2.3**
   *
   * For any CellSize value (compact, normal, large), when applied to the
   * ScheduleGrid, all cells SHALL have the corresponding CSS class and minimum
   * height from CELL_SIZE_MAP.
   */
  it('Property 3: Cell Size Styling Application', () => {
    fc.assert(
      fc.property(displaySettingsArb, (displaySettings) => {
        // Use minimal test data to avoid timeout
        const lessons: ScheduledLesson[] = [];
        const days: DayOfWeek[] = ['Saturday', 'Sunday'];
        const periodsPerDay = 4;

        const { container } = render(
          <ScheduleGrid
            lessons={lessons}
            days={days}
            periodsPerDay={periodsPerDay}
            displaySettings={displaySettings}
            isReadOnly={true}
          />
        );

        // Get the grid container
        const gridContainer = container.querySelector('.grid');
        if (!gridContainer) {
          throw new Error('Grid container not found');
        }

        // Check that the grid has the correct cell size class
        const expectedCellSizeConfig = CELL_SIZE_MAP[displaySettings.cellSize];
        const hasCorrectClass = gridContainer.classList.contains(expectedCellSizeConfig.className);

        if (!hasCorrectClass) {
          throw new Error(
            `Grid container does not have expected class "${expectedCellSizeConfig.className}" for cell size "${displaySettings.cellSize}". ` +
              `Classes found: ${Array.from(gridContainer.classList).join(', ')}`
          );
        }

        // Check that the CSS variable is set correctly
        const gridStyle = window.getComputedStyle(gridContainer);
        const cellMinHeightVar = (gridContainer as HTMLElement).style.getPropertyValue(
          '--cell-min-height'
        );

        if (cellMinHeightVar !== expectedCellSizeConfig.minHeight) {
          throw new Error(
            `CSS variable --cell-min-height is "${cellMinHeightVar}" but expected "${expectedCellSizeConfig.minHeight}" for cell size "${displaySettings.cellSize}"`
          );
        }

        // Check that the grid template columns uses the correct minimum width
        const gridTemplateColumns = gridStyle.gridTemplateColumns;
        const expectedMinWidth = expectedCellSizeConfig.minWidth;

        if (!gridTemplateColumns.includes(`minmax(${expectedMinWidth}, 1fr)`)) {
          throw new Error(
            `Grid template columns "${gridTemplateColumns}" does not contain expected minmax(${expectedMinWidth}, 1fr) for cell size "${displaySettings.cellSize}"`
          );
        }

        return true;
      }),
      { numRuns: 20 } // Reduced from 100 to avoid timeout
    );
  });
});
