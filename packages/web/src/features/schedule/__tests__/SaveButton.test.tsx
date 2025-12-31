/**
 * Unit tests for SaveButton component
 *
 * Tests:
 * - Disabled state
 * - Loading state
 * - Badge display
 *
 * Requirements: 11.3, 11.4, 11.5, 11.6
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import { SaveButton } from '../components/edit/SaveButton';

// Wrapper component with TooltipProvider
function TestWrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe('SaveButton', () => {
  afterEach(() => {
    cleanup();
  });

  describe('disabled state', () => {
    it('is disabled when hasChanges is false (Requirement: 11.3)', () => {
      const onSave = vi.fn();
      render(<SaveButton count={0} hasChanges={false} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      expect(button).toBeDisabled();
    });

    it('is enabled when hasChanges is true (Requirement: 11.3)', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      expect(button).not.toBeDisabled();
    });

    it('is disabled when isSaving is true (Requirement: 11.4)', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={true} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      expect(button).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when isSaving is true (Requirement: 11.4)', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={true} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      // Check for the animate-spin class on the loader
      const button = screen.getByRole('button', { name: /ذخیره/i });
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows save icon when not saving', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('badge display', () => {
    it('shows badge when count is greater than 0', () => {
      const onSave = vi.fn();
      render(<SaveButton count={5} hasChanges={true} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not show badge when count is 0', () => {
      const onSave = vi.fn();
      render(<SaveButton count={0} hasChanges={false} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('click handler', () => {
    it('calls onSave when clicked', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      fireEvent.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('does not call onSave when disabled', () => {
      const onSave = vi.fn();
      render(<SaveButton count={0} hasChanges={false} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره/i });
      fireEvent.click(button);

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      const onSave = vi.fn();
      render(<SaveButton count={3} hasChanges={true} isSaving={false} onSave={onSave} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole('button', { name: /ذخیره.*Ctrl\+S/i });
      expect(button).toBeInTheDocument();
    });
  });
});
