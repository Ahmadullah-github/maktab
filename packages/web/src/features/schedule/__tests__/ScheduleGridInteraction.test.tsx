/**
 * Integration tests for ScheduleGrid interactions
 *
 * Tests keyboard navigation flow, selection flow, and drag-drop flow
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 4.1, 4.2
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleGrid } from '../components/grid/ScheduleGrid';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek, type DisplaySettings, type ScheduledLesson } from '../types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | { [key: string]: unknown }) => {
      if (typeof defaultValue === 'object' && defaultValue !== null) {
        if (key === 'common.periodNumber' && 'number' in defaultValue) {
          return `Period ${defaultValue.number}`;
        }
        return key;
      }
      return defaultValue || key;
    },
  }),
}));

// Test data
const DEFAULT_DAYS: DayOfWeek[] = [
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
];

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

const createTestLesson = (
  day: DayOfWeek,
  periodIndex: number,
  classId: string = 'class-1'
): ScheduledLesson => ({
  day,
  periodIndex,
  classId,
  className: 'Class 10A',
  subjectId: `subject-${periodIndex}`,
  subjectName: `Subject ${periodIndex + 1}`,
  teacherIds: ['teacher-1'],
  teacherNames: ['Teacher 1'],
  roomId: 'room-1',
  roomName: 'Room 101',
  isFixed: false,
  periodsThisDay: 6,
});

// Create test lessons for a full day
const createTestLessons = (classId: string = 'class-1'): ScheduledLesson[] => {
  const lessons: ScheduledLesson[] = [];
  for (const day of DEFAULT_DAYS) {
    for (let period = 0; period < 6; period++) {
      lessons.push(createTestLesson(day, period, classId));
    }
  }
  return lessons;
};

describe('ScheduleGrid Integration Tests', () => {
  beforeEach(() => {
    // Reset the store before each test
    useScheduleStore.setState({
      focusedSlot: null,
      selectedLesson: null,
      isLocked: false,
      interactionMode: 'idle',
      indexes: {
        bySlot: new Map(),
        byTeacherAndSlot: new Map(),
        byRoomAndSlot: new Map(),
        byClassAndSlot: new Map(),
        byTeacher: new Map(),
        byClass: new Map(),
        byRoom: new Map(),
      },
    });
  });

  describe('Keyboard Navigation Flow', () => {
    /**
     * Test: Grid receives focus and sets initial focusedSlot
     * Requirements: 6.1, 6.2
     */
    it('should set initial focus to first cell when grid receives focus', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Focus the grid
      fireEvent.focus(grid);

      // Check that focusedSlot is set to first cell
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).not.toBeNull();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Saturday);
      expect(state.focusedSlot?.period).toBe(0);
    });

    /**
     * Test: Arrow key navigation updates focusedSlot
     * Requirements: 1.1, 1.2
     */
    it('should navigate down with ArrowDown key', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Focus the grid to set initial focus
      fireEvent.focus(grid);

      // Press ArrowDown
      fireEvent.keyDown(grid, { key: 'ArrowDown' });

      // Check that focusedSlot moved down
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Saturday);
      expect(state.focusedSlot?.period).toBe(1);
    });

    /**
     * Test: Arrow key navigation updates focusedSlot
     * Requirements: 1.1
     */
    it('should navigate up with ArrowUp key', () => {
      const lessons = createTestLessons();

      // Set initial focus to period 2
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 2 },
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Press ArrowUp
      fireEvent.keyDown(grid, { key: 'ArrowUp' });

      // Check that focusedSlot moved up
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Saturday);
      expect(state.focusedSlot?.period).toBe(1);
    });

    /**
     * Test: RTL navigation with ArrowLeft (forward = next day)
     * Requirements: 1.3
     */
    it('should navigate to next day with ArrowLeft (RTL)', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Focus the grid
      fireEvent.focus(grid);

      // Press ArrowLeft (RTL: forward = next day)
      fireEvent.keyDown(grid, { key: 'ArrowLeft' });

      // Check that focusedSlot moved to next day
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Sunday);
      expect(state.focusedSlot?.period).toBe(0);
    });

    /**
     * Test: RTL navigation with ArrowRight (backward = previous day)
     * Requirements: 1.4
     */
    it('should navigate to previous day with ArrowRight (RTL)', () => {
      const lessons = createTestLessons();

      // Set initial focus to Sunday
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Sunday, period: 0 },
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Press ArrowRight (RTL: backward = previous day)
      fireEvent.keyDown(grid, { key: 'ArrowRight' });

      // Check that focusedSlot moved to previous day
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Saturday);
      expect(state.focusedSlot?.period).toBe(0);
    });

    /**
     * Test: Navigation stops at boundaries
     * Requirements: 1.5
     */
    it('should stop at boundary when navigating up from period 0', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Focus the grid (sets to period 0)
      fireEvent.focus(grid);

      // Press ArrowUp (should stay at period 0)
      fireEvent.keyDown(grid, { key: 'ArrowUp' });

      // Check that focusedSlot stayed at period 0
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.period).toBe(0);
    });

    /**
     * Test: Navigation is disabled when locked
     * Requirements: 1.6
     */
    it('should ignore navigation when locked', () => {
      const lessons = createTestLessons();

      // Set locked state
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 0 },
        isLocked: true,
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Press ArrowDown (should be ignored)
      fireEvent.keyDown(grid, { key: 'ArrowDown' });

      // Check that focusedSlot didn't change
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.period).toBe(0);
    });
  });

  describe('Selection Flow', () => {
    /**
     * Test: Escape cancels selection
     * Requirements: 3.3
     */
    it('should cancel selection when Escape is pressed', () => {
      const lessons = createTestLessons();
      const testLesson = lessons[0];

      // Set a selected lesson
      useScheduleStore.setState({
        focusedSlot: { day: testLesson.day, period: testLesson.periodIndex },
        selectedLesson: testLesson,
        interactionMode: 'selecting',
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={false}
          viewScope="class"
          viewId="class-1"
        />
      );

      const grid = screen.getByRole('grid');

      // Press Escape
      fireEvent.keyDown(grid, { key: 'Escape' });

      // Check that selection was cancelled
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('shows the swap session bar and allows cancelling from the UI', () => {
      const lessons = createTestLessons();
      const testLesson = lessons[0];

      useScheduleStore.setState({
        selectedLesson: testLesson,
        interactionMode: 'selecting',
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={false}
          viewScope="class"
          viewId="class-1"
        />
      );

      expect(screen.getByText('حالت جابه‌جایی')).toBeInTheDocument();
      expect(screen.getAllByText('مبدا').length).toBeGreaterThan(0);
      expect(screen.getByText(testLesson.subjectName!)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'لغو' }));

      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });
  });

  describe('Grid Accessibility', () => {
    /**
     * Test: Grid has proper ARIA attributes
     */
    it('should have proper ARIA attributes', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label');
      expect(grid).toHaveAttribute('tabIndex', '0');
    });

    /**
     * Test: Grid is focusable
     * Requirements: 6.1
     */
    it('should be focusable with tabIndex', () => {
      const lessons = createTestLessons();

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('tabIndex', '0');

      // Should be able to focus
      grid.focus();
      expect(document.activeElement).toBe(grid);
    });
  });

  describe('Read-Only vs Editable Mode', () => {
    /**
     * Test: Read-only mode doesn't render drag-drop components
     */
    it('should render without DndContext in read-only mode', () => {
      const lessons = createTestLessons();

      const { container } = render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      // Should not have droppable cells in read-only mode
      const droppableCells = container.querySelectorAll('[data-droppable-id]');
      expect(droppableCells.length).toBe(0);
    });

    /**
     * Test: Editable mode renders drag-drop components
     */
    it('should render with DndContext in editable mode', () => {
      const lessons = createTestLessons();

      const { container } = render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={false}
          viewScope="class"
          viewId="class-1"
        />
      );

      // Should have droppable cells in editable mode
      const droppableCells = container.querySelectorAll('[data-droppable-id]');
      expect(droppableCells.length).toBeGreaterThan(0);
    });
  });

  describe('Focus Preservation', () => {
    /**
     * Test: Focus is preserved when already set
     * Requirements: 6.2
     */
    it('should not change focus when already focused', () => {
      const lessons = createTestLessons();

      // Set initial focus to a specific slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 3 },
      });

      render(
        <ScheduleGrid
          lessons={lessons}
          days={DEFAULT_DAYS}
          periodsPerDay={6}
          displaySettings={DEFAULT_DISPLAY_SETTINGS}
          isReadOnly={true}
        />
      );

      const grid = screen.getByRole('grid');

      // Focus the grid again
      fireEvent.focus(grid);

      // Check that focusedSlot didn't change
      const state = useScheduleStore.getState();
      expect(state.focusedSlot?.day).toBe(DayOfWeek.Monday);
      expect(state.focusedSlot?.period).toBe(3);
    });
  });
});
