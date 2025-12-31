/**
 * Unit tests for FocusIndicator component
 * Requirements: 2.1, 2.2, 2.3
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { FocusIndicator } from '../components/grid/FocusIndicator';
import { DayOfWeek, type FocusedSlot } from '../types';

/**
 * Helper to create a mock cell element with positioning
 */
function createMockCellElement(
  top: number,
  left: number,
  width: number,
  height: number
): HTMLElement {
  const element = document.createElement('div');

  // Mock getBoundingClientRect
  element.getBoundingClientRect = () => ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });

  // Mock offset properties
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(element, 'offsetLeft', { value: left, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(element, 'offsetParent', { value: null, configurable: true });

  return element;
}

/**
 * Helper to create cell ID
 */
function createCellId(day: DayOfWeek, period: number): string {
  return `${day}-${period}`;
}

describe('FocusIndicator', () => {
  let cellRefs: Map<string, HTMLElement>;

  beforeEach(() => {
    cellRefs = new Map();
    // Create mock cell elements for a 6x6 grid
    const days = [
      DayOfWeek.Saturday,
      DayOfWeek.Sunday,
      DayOfWeek.Monday,
      DayOfWeek.Tuesday,
      DayOfWeek.Wednesday,
      DayOfWeek.Thursday,
    ];

    days.forEach((day, dayIndex) => {
      for (let period = 0; period < 6; period++) {
        const cellId = createCellId(day, period);
        const top = period * 60;
        const left = dayIndex * 100;
        cellRefs.set(cellId, createMockCellElement(top, left, 100, 60));
      }
    });
  });

  describe('visibility based on focusedSlot', () => {
    it('renders nothing when focusedSlot is null', () => {
      render(<FocusIndicator slot={null} cellRefs={cellRefs} />);

      expect(screen.queryByTestId('focus-indicator')).not.toBeInTheDocument();
    });

    it('renders focus indicator when focusedSlot is set', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 2 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      expect(screen.getByTestId('focus-indicator')).toBeInTheDocument();
    });

    it('renders nothing when cell ref is not found', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Friday, period: 0 }; // Friday not in cellRefs

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      expect(screen.queryByTestId('focus-indicator')).not.toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('positions indicator at the correct cell location', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 2 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');

      // Monday is index 2 (Saturday=0, Sunday=1, Monday=2)
      // Period 2 means top = 2 * 60 = 120
      // Monday means left = 2 * 100 = 200
      expect(indicator).toHaveStyle({
        top: '120px',
        left: '200px',
        width: '100px',
        height: '60px',
      });
    });

    it('updates position when slot changes', () => {
      const slot1: FocusedSlot = { day: DayOfWeek.Saturday, period: 0 };
      const slot2: FocusedSlot = { day: DayOfWeek.Thursday, period: 5 };

      const { rerender } = render(<FocusIndicator slot={slot1} cellRefs={cellRefs} />);

      let indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveStyle({
        top: '0px',
        left: '0px',
      });

      rerender(<FocusIndicator slot={slot2} cellRefs={cellRefs} />);

      indicator = screen.getByTestId('focus-indicator');
      // Thursday is index 5, period 5 means top = 5 * 60 = 300, left = 5 * 100 = 500
      expect(indicator).toHaveStyle({
        top: '300px',
        left: '500px',
      });
    });

    it('sets data attributes for focused day and period', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Tuesday, period: 3 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveAttribute('data-focused-day', DayOfWeek.Tuesday);
      expect(indicator).toHaveAttribute('data-focused-period', '3');
    });
  });

  describe('accessibility', () => {
    it('has role="presentation" for screen readers', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveAttribute('role', 'presentation');
    });

    it('has aria-hidden="true" to hide from assistive technology', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('styling', () => {
    it('has pointer-events-none to not interfere with interactions', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveClass('pointer-events-none');
    });

    it('has focus ring classes for visibility', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveClass('ring-2', 'ring-ring');
    });

    it('has animation class for visual feedback', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveClass('animate-pulse');
    });

    it('has absolute positioning', () => {
      const slot: FocusedSlot = { day: DayOfWeek.Monday, period: 0 };

      render(<FocusIndicator slot={slot} cellRefs={cellRefs} />);

      const indicator = screen.getByTestId('focus-indicator');
      expect(indicator).toHaveClass('absolute');
    });
  });
});
