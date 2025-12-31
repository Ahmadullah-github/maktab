/**
 * Unit tests for ScheduleCell visual states
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * Tests each visual state individually and combined states
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleCell } from '../components/grid/ScheduleCell';
import { DayOfWeek, type DisplaySettings, type ScheduledLesson } from '../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-icon" />,
  Ban: () => <svg data-testid="ban-icon" />,
}));

// Default display settings for testing
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
 * Helper to render ScheduleCell with default props
 */
function renderScheduleCell(props: Partial<React.ComponentProps<typeof ScheduleCell>> = {}) {
  const defaultProps = {
    lesson: sampleLesson,
    displaySettings: defaultDisplaySettings,
    isReadOnly: true,
  };

  return render(<ScheduleCell {...defaultProps} {...props} />);
}

describe('ScheduleCell Visual States', () => {
  describe('Individual Visual States', () => {
    /**
     * Requirement 7.1: WHEN a cell is focused THEN the Schedule_Grid SHALL display
     * a ring-2 ring-ring style
     */
    describe('Focused State (Requirement 7.1)', () => {
      it('applies ring-2 and ring-ring classes when isFocused is true', () => {
        renderScheduleCell({ isFocused: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('ring-2');
        expect(cell).toHaveClass('ring-ring');
      });

      it('applies ring-offset-2 for proper spacing', () => {
        renderScheduleCell({ isFocused: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('ring-offset-2');
      });

      it('does not apply focus ring when isFocused is false', () => {
        renderScheduleCell({ isFocused: false });

        const cell = screen.getByRole('gridcell');
        expect(cell).not.toHaveClass('ring-ring');
      });
    });

    /**
     * Requirement 7.2: WHEN a cell is selected THEN the Schedule_Grid SHALL display
     * a ring-2 ring-primary with bg-primary/10 background
     */
    describe('Selected State (Requirement 7.2)', () => {
      it('applies ring-2 and ring-primary classes when isSelected is true', () => {
        renderScheduleCell({ isSelected: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('ring-2');
        expect(cell).toHaveClass('ring-primary');
      });

      it('applies bg-primary/10 background when isSelected is true', () => {
        renderScheduleCell({ isSelected: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('bg-primary/10');
      });

      it('sets aria-selected to true when isSelected is true', () => {
        renderScheduleCell({ isSelected: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveAttribute('aria-selected', 'true');
      });

      it('does not apply selection styles when isSelected is false', () => {
        renderScheduleCell({ isSelected: false });

        const cell = screen.getByRole('gridcell');
        expect(cell).not.toHaveClass('ring-primary');
        expect(cell).not.toHaveClass('bg-primary/10');
      });
    });

    /**
     * Requirement 7.3: WHEN a cell is being dragged THEN the Schedule_Grid SHALL
     * display opacity-50 and scale-95 transform
     */
    describe('Dragging State (Requirement 7.3)', () => {
      it('applies opacity-50 when isDragging is true', () => {
        renderScheduleCell({ isDragging: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('opacity-50');
      });

      it('applies scale-95 when isDragging is true', () => {
        renderScheduleCell({ isDragging: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('scale-95');
      });

      it('does not apply dragging styles when isDragging is false', () => {
        renderScheduleCell({ isDragging: false });

        const cell = screen.getByRole('gridcell');
        expect(cell).not.toHaveClass('opacity-50');
        expect(cell).not.toHaveClass('scale-95');
      });
    });

    /**
     * Requirement 7.4: WHEN a cell is a drop target THEN the Schedule_Grid SHALL
     * display bg-primary/5 background
     */
    describe('Drop Target State (Requirement 7.4)', () => {
      it('applies bg-primary/5 when isDropTarget is true', () => {
        renderScheduleCell({ isDropTarget: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('bg-primary/5');
      });

      it('does not apply drop target styles when isDropTarget is false', () => {
        renderScheduleCell({ isDropTarget: false });

        const cell = screen.getByRole('gridcell');
        expect(cell).not.toHaveClass('bg-primary/5');
      });
    });

    /**
     * Additional: Highlighted state
     */
    describe('Highlighted State', () => {
      it('applies bg-accent/40 and border-accent when isHighlighted is true', () => {
        renderScheduleCell({ isHighlighted: true });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('bg-accent/40');
        expect(cell).toHaveClass('border-accent');
      });

      it('does not apply highlighted styles when isHighlighted is false', () => {
        renderScheduleCell({ isHighlighted: false });

        const cell = screen.getByRole('gridcell');
        expect(cell).not.toHaveClass('bg-accent/40');
        expect(cell).not.toHaveClass('border-accent');
      });
    });

    /**
     * Validation states
     */
    describe('Validation States', () => {
      it('applies warning styles when validationStatus is warning', () => {
        renderScheduleCell({ validationStatus: 'warning' });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('border-yellow-500');
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
      });

      it('applies blocked styles when validationStatus is blocked', () => {
        renderScheduleCell({ validationStatus: 'blocked' });

        const cell = screen.getByRole('gridcell');
        expect(cell).toHaveClass('border-destructive');
        expect(screen.getByTestId('ban-icon')).toBeInTheDocument();
      });
    });
  });

  /**
   * Requirement 7.5: THE visual states SHALL be combinable
   * (e.g., focused and selected simultaneously)
   */
  describe('Combined Visual States (Requirement 7.5)', () => {
    it('combines focused and selected states', () => {
      renderScheduleCell({ isFocused: true, isSelected: true });

      const cell = screen.getByRole('gridcell');
      // Both states should apply ring-2
      expect(cell).toHaveClass('ring-2');
      // Focused state takes precedence for ring color
      expect(cell).toHaveClass('ring-ring');
      // Selected state background should still apply
      expect(cell).toHaveClass('bg-primary/10');
    });

    it('combines focused and dragging states', () => {
      renderScheduleCell({ isFocused: true, isDragging: true });

      const cell = screen.getByRole('gridcell');
      // Focus ring should be present
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Dragging styles should also be present
      expect(cell).toHaveClass('opacity-50');
      expect(cell).toHaveClass('scale-95');
    });

    it('combines selected and drop target states', () => {
      renderScheduleCell({ isSelected: true, isDropTarget: true });

      const cell = screen.getByRole('gridcell');
      // Selection ring should be present
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-primary');
      // Drop target background should be present
      expect(cell).toHaveClass('bg-primary/5');
    });

    it('combines dragging and drop target states', () => {
      renderScheduleCell({ isDragging: true, isDropTarget: true });

      const cell = screen.getByRole('gridcell');
      // Dragging styles
      expect(cell).toHaveClass('opacity-50');
      expect(cell).toHaveClass('scale-95');
      // Drop target background
      expect(cell).toHaveClass('bg-primary/5');
    });

    it('combines focused, selected, and dragging states', () => {
      renderScheduleCell({ isFocused: true, isSelected: true, isDragging: true });

      const cell = screen.getByRole('gridcell');
      // Focus ring (takes precedence)
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Selected background
      expect(cell).toHaveClass('bg-primary/10');
      // Dragging styles
      expect(cell).toHaveClass('opacity-50');
      expect(cell).toHaveClass('scale-95');
    });

    it('combines all visual states simultaneously', () => {
      renderScheduleCell({
        isFocused: true,
        isSelected: true,
        isDragging: true,
        isDropTarget: true,
      });

      const cell = screen.getByRole('gridcell');
      // Focus ring
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Dragging styles
      expect(cell).toHaveClass('opacity-50');
      expect(cell).toHaveClass('scale-95');
      // Drop target background (overrides selected background)
      expect(cell).toHaveClass('bg-primary/5');
    });

    it('combines highlighted with other states (when not selected)', () => {
      renderScheduleCell({ isHighlighted: true, isFocused: true });

      const cell = screen.getByRole('gridcell');
      // Focus ring
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Highlighted styles
      expect(cell).toHaveClass('bg-accent/40');
      expect(cell).toHaveClass('border-accent');
    });

    it('highlighted styles are suppressed when selected', () => {
      renderScheduleCell({ isHighlighted: true, isSelected: true });

      const cell = screen.getByRole('gridcell');
      // Selected styles take precedence
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-primary');
      expect(cell).toHaveClass('bg-primary/10');
      // Highlighted border-accent should not be applied when selected
      expect(cell).not.toHaveClass('border-accent');
    });

    it('combines validation status with other states', () => {
      renderScheduleCell({
        isFocused: true,
        isSelected: true,
        validationStatus: 'warning',
      });

      const cell = screen.getByRole('gridcell');
      // Focus ring
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Warning styles
      expect(cell).toHaveClass('border-yellow-500');
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });
  });

  describe('Empty Cell States', () => {
    it('applies muted background for empty cells', () => {
      renderScheduleCell({ lesson: null });

      const cell = screen.getByRole('gridcell');
      expect(cell).toHaveClass('bg-muted/30');
    });

    it('can apply visual states to empty cells', () => {
      renderScheduleCell({ lesson: null, isFocused: true, isDropTarget: true });

      const cell = screen.getByRole('gridcell');
      // Focus ring
      expect(cell).toHaveClass('ring-2');
      expect(cell).toHaveClass('ring-ring');
      // Drop target
      expect(cell).toHaveClass('bg-primary/5');
    });
  });
});
