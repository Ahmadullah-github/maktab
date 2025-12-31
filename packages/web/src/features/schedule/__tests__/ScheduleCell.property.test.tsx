/**
 * Property-based tests for ScheduleCell component
 * Tests universal properties that should hold across all valid inputs
 */

import { render } from '@testing-library/react';
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { ScheduleCell } from '../components/grid/ScheduleCell';
import type { ScheduledLesson } from '../types';
import { DayOfWeek } from '../types';

// ============================================================================
// Test Generators
// ============================================================================

/**
 * Generator for non-empty, non-whitespace strings
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

/**
 * Generator for valid ScheduledLesson objects
 */
const scheduledLessonArb = fc.record({
  day: fc.constantFrom(...Object.values(DayOfWeek)),
  periodIndex: fc.integer({ min: 0, max: 10 }),
  classId: fc.string({ minLength: 1, maxLength: 10 }),
  className: fc.option(nonEmptyStringArb),
  subjectId: fc.string({ minLength: 1, maxLength: 10 }),
  subjectName: fc.option(nonEmptyStringArb),
  teacherIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
  teacherNames: fc.option(fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 3 })),
  roomId: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
  roomName: fc.option(nonEmptyStringArb),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 10 })),
});

/**
 * Generator for DisplaySettings with visibility toggles
 */
const displaySettingsArb = fc.record({
  showSubjectName: fc.constant(true), // Always true
  showTeacherName: fc.boolean(),
  showRoomName: fc.boolean(),
  cellSize: fc.constantFrom('compact', 'normal', 'large'),
  fontSize: fc.constantFrom('sm', 'md', 'lg'),
  colorBy: fc.constantFrom('none', 'subject', 'teacher'),
});

/**
 * Generator for visual state combinations
 */
const visualStatesArb = fc.record({
  isFocused: fc.boolean(),
  isSelected: fc.boolean(),
  isDragging: fc.boolean(),
  isDropTarget: fc.boolean(),
  isHighlighted: fc.boolean(),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('ScheduleCell Property Tests', () => {
  /**
   * **Feature: schedule-phase4, Property 1: Cell Content Visibility**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any ScheduledLesson with non-null teacherNames and roomName, when
   * showTeacherName is false, the rendered ScheduleCell output SHALL NOT contain any
   * teacher name strings, and when showRoomName is false, the rendered output SHALL
   * NOT contain the room name string.
   */
  it('Property 1: Cell Content Visibility', () => {
    fc.assert(
      fc.property(scheduledLessonArb, displaySettingsArb, (lesson, displaySettings) => {
        // Ensure lesson has non-null teacher names and room name for testing
        const testLesson: ScheduledLesson = {
          ...lesson,
          teacherNames: lesson.teacherNames || ['Test Teacher'],
          roomName: lesson.roomName || 'Test Room',
        };

        const { container } = render(
          <ScheduleCell lesson={testLesson} displaySettings={displaySettings} isReadOnly={true} />
        );

        const cellContent = container.textContent || '';

        // Test teacher name visibility
        if (!displaySettings.showTeacherName && testLesson.teacherNames) {
          for (const teacherName of testLesson.teacherNames) {
            if (teacherName && teacherName.trim()) {
              // Teacher name should not appear in the rendered content
              // But we need to be careful about substrings - check if the teacher name
              // appears as a distinct element, not just as part of another field
              const teacherNameTrimmed = teacherName.trim();

              // If room name is shown and contains the teacher name, that's acceptable
              // We only care if the teacher name appears independently
              const isTeacherNameInRoomName =
                displaySettings.showRoomName &&
                testLesson.roomName &&
                testLesson.roomName.includes(teacherNameTrimmed);

              const teacherNameInContent = cellContent.includes(teacherNameTrimmed);

              if (teacherNameInContent && !isTeacherNameInRoomName) {
                throw new Error(
                  `Teacher name "${teacherName}" found in cell content when showTeacherName is false. ` +
                    `Cell content: "${cellContent}"`
                );
              }
            }
          }
        }

        // Test room name visibility
        if (!displaySettings.showRoomName && testLesson.roomName) {
          const roomNameTrimmed = testLesson.roomName.trim();
          if (roomNameTrimmed) {
            const roomNameInContent = cellContent.includes(roomNameTrimmed);
            if (roomNameInContent) {
              throw new Error(
                `Room name "${testLesson.roomName}" found in cell content when showRoomName is false. ` +
                  `Cell content: "${cellContent}"`
              );
            }
          }
        }

        // Subject name should always be visible (when showSubjectName is true, which it always is)
        if (displaySettings.showSubjectName && testLesson.subjectName) {
          const subjectNameInContent = cellContent.includes(testLesson.subjectName);
          if (!subjectNameInContent) {
            throw new Error(
              `Subject name "${testLesson.subjectName}" not found in cell content when showSubjectName is true. ` +
                `Cell content: "${cellContent}"`
            );
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase6, Property 9: Visual State Composition**
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
   *
   * For any combination of cell states (isFocused, isSelected, isDragging, isDropTarget),
   * the cell should have all corresponding CSS classes applied without conflicts.
   * Visual states should be combinable (e.g., focused and selected simultaneously).
   */
  it('Property 9: Visual State Composition', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        displaySettingsArb,
        visualStatesArb,
        (lesson, displaySettings, visualStates) => {
          const { container } = render(
            <ScheduleCell
              lesson={lesson}
              displaySettings={displaySettings}
              isReadOnly={false}
              isFocused={visualStates.isFocused}
              isSelected={visualStates.isSelected}
              isDragging={visualStates.isDragging}
              isDropTarget={visualStates.isDropTarget}
              isHighlighted={visualStates.isHighlighted}
            />
          );

          const cell = container.firstChild as HTMLElement;
          const className = cell.className;

          // Verify focused state applies ring-2 ring-ring
          // Note: When both focused and selected, focused ring-ring takes precedence over selected ring-primary
          if (visualStates.isFocused) {
            if (!className.includes('ring-2') || !className.includes('ring-ring')) {
              throw new Error(
                `Focused cell should have ring-2 and ring-ring classes. Got: "${className}"`
              );
            }
          }

          // Verify selected state applies ring-2 ring-primary (only when not focused)
          // Note: bg-primary/10 may be overridden by bg-primary/5 when isDropTarget is also true
          // Note: ring-primary may be overridden by ring-ring when isFocused is also true
          if (visualStates.isSelected) {
            if (!className.includes('ring-2')) {
              throw new Error(`Selected cell should have ring-2 class. Got: "${className}"`);
            }
            // Only check for ring-primary when isFocused is false (focused takes precedence)
            if (!visualStates.isFocused && !className.includes('ring-primary')) {
              throw new Error(
                `Selected (non-focused) cell should have ring-primary class. Got: "${className}"`
              );
            }
            // Only check for bg-primary/10 when isDropTarget is false
            if (!visualStates.isDropTarget && !className.includes('bg-primary/10')) {
              throw new Error(`Selected cell should have bg-primary/10 class. Got: "${className}"`);
            }
          }

          // Verify dragging state applies opacity-50 and scale-95
          if (visualStates.isDragging) {
            if (!className.includes('opacity-50')) {
              throw new Error(`Dragging cell should have opacity-50 class. Got: "${className}"`);
            }
            if (!className.includes('scale-95')) {
              throw new Error(`Dragging cell should have scale-95 class. Got: "${className}"`);
            }
          }

          // Verify drop target state applies bg-primary/5
          if (visualStates.isDropTarget) {
            if (!className.includes('bg-primary/5')) {
              throw new Error(
                `Drop target cell should have bg-primary/5 class. Got: "${className}"`
              );
            }
          }

          // Verify highlighted state applies border-accent (only when not selected)
          // Note: bg-accent/40 may be overridden by other background classes like bg-primary/5
          if (visualStates.isHighlighted && !visualStates.isSelected) {
            if (!className.includes('border-accent')) {
              throw new Error(
                `Highlighted (non-selected) cell should have border-accent class. Got: "${className}"`
              );
            }
          }

          // Verify states are combinable - multiple states can be active simultaneously
          // The cell should render without errors and have all applicable classes
          if (visualStates.isFocused && visualStates.isDragging) {
            // Both focused and dragging should be applied
            if (!className.includes('ring-ring') || !className.includes('opacity-50')) {
              throw new Error(
                `Cell with both focused and dragging states should have both ring-ring and opacity-50. Got: "${className}"`
              );
            }
          }

          if (visualStates.isSelected && visualStates.isDropTarget) {
            // Both selected and drop target should be applied
            // Note: ring-primary may be overridden by ring-ring when isFocused is also true
            const hasRingClass = visualStates.isFocused
              ? className.includes('ring-ring')
              : className.includes('ring-primary');
            if (!hasRingClass || !className.includes('bg-primary/5')) {
              throw new Error(
                `Cell with both selected and drop target states should have appropriate ring class and bg-primary/5. Got: "${className}"`
              );
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
