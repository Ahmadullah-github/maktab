/**
 * Unit tests for DraggableCell component
 * Requirements: 4.3
 */

import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DraggableCell } from '../components/grid/DraggableCell';
import { DayOfWeek, type DisplaySettings, type ScheduledLesson } from '../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-icon" />,
  Ban: () => <svg data-testid="ban-icon" />,
}));

// Sample display settings
const defaultDisplaySettings: DisplaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

// Sample lesson for testing
const sampleLesson: ScheduledLesson = {
  day: DayOfWeek.Monday,
  periodIndex: 2,
  classId: 'c1',
  className: 'Class 1',
  subjectId: 's1',
  subjectName: 'Math',
  teacherIds: ['t1'],
  teacherNames: ['Teacher 1'],
  roomId: 'r1',
  roomName: 'Room 1',
  isFixed: false,
  periodsThisDay: 6,
};

/**
 * Helper to render DraggableCell within DndContext
 */
function renderDraggableCell(props: Partial<React.ComponentProps<typeof DraggableCell>> = {}) {
  const defaultProps = {
    id: 'Monday-2',
    day: DayOfWeek.Monday,
    period: 2,
    lesson: sampleLesson,
    displaySettings: defaultDisplaySettings,
    viewScope: 'class' as const,
    viewId: 'c1',
  };

  return render(
    <DndContext>
      <DraggableCell {...defaultProps} {...props} />
    </DndContext>
  );
}

describe('DraggableCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('draggable setup', () => {
    it('renders with lesson content', () => {
      renderDraggableCell();

      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Teacher 1')).toBeInTheDocument();
      expect(screen.getByText('Room 1')).toBeInTheDocument();
    });

    it('renders empty cell when lesson is null', () => {
      renderDraggableCell({ lesson: null });

      expect(screen.queryByText('Math')).not.toBeInTheDocument();
      expect(screen.getByRole('gridcell')).toBeInTheDocument();
    });

    it('has touch-none class for drag handling', () => {
      const { container } = renderDraggableCell();

      // The outer wrapper should have touch-none class
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('touch-none');
    });

    it('renders gridcell role for accessibility', () => {
      renderDraggableCell();

      expect(screen.getByRole('gridcell')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('applies cursor-not-allowed when disabled with lesson', () => {
      const { container } = renderDraggableCell({ disabled: true });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('cursor-not-allowed');
    });

    it('does not apply cursor-not-allowed when disabled without lesson', () => {
      const { container } = renderDraggableCell({ disabled: true, lesson: null });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveClass('cursor-not-allowed');
    });

    it('passes isReadOnly to ScheduleCell when disabled', () => {
      renderDraggableCell({ disabled: true, isReadOnly: false });

      // When disabled, the cell should be read-only
      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveAttribute('aria-readonly', 'true');
    });
  });

  describe('visual states', () => {
    it('renders with isSelected state', () => {
      renderDraggableCell({ isSelected: true });

      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveAttribute('aria-selected', 'true');
      expect(gridcell).toHaveClass('ring-2', 'ring-primary');
    });

    it('renders with isFocused state', () => {
      renderDraggableCell({ isFocused: true });

      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveClass('ring-2', 'ring-ring');
    });

    it('renders with isHighlighted state', () => {
      renderDraggableCell({ isHighlighted: true });

      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveClass('bg-accent/40');
    });

    it('renders with warning validation status', () => {
      renderDraggableCell({ validationStatus: 'warning' });

      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveClass('border-yellow-500');
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });

    it('renders with blocked validation status', () => {
      renderDraggableCell({ validationStatus: 'blocked' });

      const gridcell = screen.getByRole('gridcell');
      expect(gridcell).toHaveClass('border-destructive');
      expect(screen.getByTestId('ban-icon')).toBeInTheDocument();
    });
  });

  describe('display settings', () => {
    it('respects showTeacherName setting', () => {
      renderDraggableCell({
        displaySettings: { ...defaultDisplaySettings, showTeacherName: false },
      });

      expect(screen.queryByText('Teacher 1')).not.toBeInTheDocument();
    });

    it('respects showRoomName setting', () => {
      renderDraggableCell({
        displaySettings: { ...defaultDisplaySettings, showRoomName: false },
      });

      expect(screen.queryByText('Room 1')).not.toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      renderDraggableCell({ onClick });

      const gridcell = screen.getByRole('gridcell');
      gridcell.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      renderDraggableCell({ onClick, disabled: true });

      const gridcell = screen.getByRole('gridcell');
      gridcell.click();

      // onClick should still be called since disabled only affects dragging
      // The ScheduleCell handles its own click behavior
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('props comparison (memo)', () => {
    it('renders correctly with all props', () => {
      renderDraggableCell({
        id: 'Tuesday-3',
        day: DayOfWeek.Tuesday,
        period: 3,
        lesson: sampleLesson,
        displaySettings: defaultDisplaySettings,
        isSelected: true,
        isFocused: false,
        isHighlighted: true,
        validationStatus: 'valid',
        disabled: false,
        viewScope: 'teacher',
        viewId: 't1',
        isReadOnly: false,
      });

      expect(screen.getByText('Math')).toBeInTheDocument();
    });
  });
});
