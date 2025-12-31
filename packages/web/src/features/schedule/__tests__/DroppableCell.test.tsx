/**
 * Unit tests for DroppableCell component
 * Requirements: 5.1, 5.2
 */

import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DroppableCell, isValidDropSource } from '../components/grid/DroppableCell';
import type { DragData } from '../hooks/useDragDrop';
import { DayOfWeek, type ScheduledLesson } from '../types';

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

// Sample drag data
const sampleDragData: DragData = {
  type: 'lesson',
  lesson: sampleLesson,
  sourceSlot: { day: DayOfWeek.Monday, period: 2 },
  viewScope: 'class',
  viewId: 'c1',
};

/**
 * Helper to render DroppableCell within DndContext
 */
function renderDroppableCell(props: Partial<React.ComponentProps<typeof DroppableCell>> = {}) {
  const defaultProps = {
    id: 'Monday-3',
    day: DayOfWeek.Monday,
    period: 3,
    viewScope: 'class' as const,
    viewId: 'c1',
    children: <div data-testid="cell-content">Cell Content</div>,
  };

  return render(
    <DndContext>
      <DroppableCell {...defaultProps} {...props} />
    </DndContext>
  );
}

describe('DroppableCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('droppable setup', () => {
    it('renders children content', () => {
      renderDroppableCell();

      expect(screen.getByTestId('cell-content')).toBeInTheDocument();
      expect(screen.getByText('Cell Content')).toBeInTheDocument();
    });

    it('has data-droppable-id attribute', () => {
      renderDroppableCell({ id: 'Tuesday-4' });

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).toHaveAttribute('data-droppable-id', 'Tuesday-4');
    });

    it('renders with correct day and period in data', () => {
      renderDroppableCell({
        id: 'Wednesday-5',
        day: DayOfWeek.Wednesday,
        period: 5,
      });

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).toHaveAttribute('data-droppable-id', 'Wednesday-5');
    });

    it('has relative positioning class', () => {
      renderDroppableCell();

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).toHaveClass('relative');
    });
  });

  describe('isOver state', () => {
    it('has data-is-over attribute set to false when not hovered', () => {
      renderDroppableCell();

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).toHaveAttribute('data-is-over', 'false');
    });

    it('does not show drop feedback when not hovered', () => {
      renderDroppableCell();

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).not.toHaveClass('bg-primary/5');
      expect(droppable).not.toHaveClass('ring-2');
    });
  });

  describe('disabled state', () => {
    it('renders correctly when disabled', () => {
      renderDroppableCell({ disabled: true });

      expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    });

    it('does not show drop feedback when disabled', () => {
      renderDroppableCell({ disabled: true });

      const droppable = screen.getByTestId('cell-content').parentElement;
      expect(droppable).not.toHaveClass('bg-primary/5');
    });
  });

  describe('view scope validation', () => {
    it('renders with class view scope', () => {
      renderDroppableCell({
        viewScope: 'class',
        viewId: 'c1',
      });

      expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    });

    it('renders with teacher view scope', () => {
      renderDroppableCell({
        viewScope: 'teacher',
        viewId: 't1',
      });

      expect(screen.getByTestId('cell-content')).toBeInTheDocument();
    });
  });

  describe('props comparison (memo)', () => {
    it('renders correctly with all props', () => {
      renderDroppableCell({
        id: 'Thursday-1',
        day: DayOfWeek.Thursday,
        period: 1,
        disabled: false,
        viewScope: 'teacher',
        viewId: 't2',
        children: <span>Custom Content</span>,
      });

      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });
  });
});

describe('isValidDropSource', () => {
  it('returns false when dragData is undefined', () => {
    expect(isValidDropSource(undefined, 'class', 'c1')).toBe(false);
  });

  it('returns false when dragData type is not lesson', () => {
    const invalidData = { type: 'other' } as unknown as DragData;
    expect(isValidDropSource(invalidData, 'class', 'c1')).toBe(false);
  });

  it('returns true when viewScope and viewId match', () => {
    expect(isValidDropSource(sampleDragData, 'class', 'c1')).toBe(true);
  });

  it('returns false when viewScope does not match', () => {
    expect(isValidDropSource(sampleDragData, 'teacher', 'c1')).toBe(false);
  });

  it('returns false when viewId does not match', () => {
    expect(isValidDropSource(sampleDragData, 'class', 'c2')).toBe(false);
  });

  it('returns false when both viewScope and viewId do not match', () => {
    expect(isValidDropSource(sampleDragData, 'teacher', 't1')).toBe(false);
  });

  it('validates teacher view scope correctly', () => {
    const teacherDragData: DragData = {
      ...sampleDragData,
      viewScope: 'teacher',
      viewId: 't1',
    };
    expect(isValidDropSource(teacherDragData, 'teacher', 't1')).toBe(true);
    expect(isValidDropSource(teacherDragData, 'teacher', 't2')).toBe(false);
    expect(isValidDropSource(teacherDragData, 'class', 't1')).toBe(false);
  });
});
