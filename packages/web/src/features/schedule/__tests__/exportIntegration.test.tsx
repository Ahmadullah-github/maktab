/**
 * Integration tests for complete export flow
 *
 * Tests end-to-end export process including:
 * - PDF and Excel export
 * - Batch export with multiple schedules
 * - Error scenarios and recovery
 *
 * Requirements: 2.1, 3.1, 3.2, 10.3, 10.4
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../components/export/ExportDialog';
import { ExportErrorBoundary } from '../components/export/ExportErrorBoundary';
import { ExportProgress } from '../components/export/ExportProgress';
import type { DisplaySettings } from '../types';

// Mock the useDisplaySettings hook
const mockDisplaySettings: DisplaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

vi.mock('../hooks/useDisplaySettings', () => ({
  useDisplaySettings: () => ({
    settings: mockDisplaySettings,
  }),
}));

const mockExportHookState = {
  exportSchedule: vi.fn(),
  isExporting: false,
  progress: null as {
    current: number;
    total: number;
    status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
    message: string;
  } | null,
  error: null as string | null,
  cancelExport: vi.fn(),
};

vi.mock('../hooks/useExportSchedule', () => ({
  useExportSchedule: () => mockExportHookState,
}));

describe('Export Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportHookState.exportSchedule.mockResolvedValue(undefined);
    mockExportHookState.cancelExport.mockResolvedValue(undefined);
    mockExportHookState.isExporting = false;
    mockExportHookState.progress = null;
    mockExportHookState.error = null;
  });

  describe('End-to-end PDF Export', () => {
    it('should complete PDF export flow successfully', async () => {
      const onOpenChange = vi.fn();

      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      // Verify dialog is open with PDF selected by default
      expect(screen.getByText('صادرات برنامه')).toBeInTheDocument();
      const pdfRadio = screen.getByRole('radio', { name: /PDF/ });
      expect(pdfRadio).toBeChecked();

      // Submit the form
      const exportButton = screen.getByText('صادرات');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockExportHookState.exportSchedule).toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should allow changing export format to Excel', async () => {
      const onOpenChange = vi.fn();

      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      // Change format to Excel
      const excelOption = screen.getByLabelText(/Excel/);
      fireEvent.click(excelOption);

      const excelRadio = screen.getByRole('radio', { name: /Excel/ });
      expect(excelRadio).toBeChecked();

      // Submit the form
      const exportButton = screen.getByText('صادرات');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockExportHookState.exportSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'excel',
          })
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Batch Export with Multiple Schedules', () => {
    it('should show progress for batch export', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 5,
        total: 10,
        status: 'generating' as const,
        message: 'Processing batch...',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      // Verify progress display
      expect(screen.getByText('50%')).toBeInTheDocument();
      // Progress bar should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle batch export completion', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 10,
        total: 10,
        status: 'complete' as const,
        message: 'Batch export complete',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      // Cancel button should not be visible when complete
      expect(screen.queryByRole('button', { name: /انصراف|cancel/i })).not.toBeInTheDocument();
    });

    it('should allow cancellation during batch export', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 3,
        total: 10,
        status: 'generating' as const,
        message: 'Processing...',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      // Find cancel button by role
      const cancelButton = screen.getByRole('button');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should export all classes scope', async () => {
      const onOpenChange = vi.fn();

      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      // Select all classes scope
      const allClassesOption = screen.getByLabelText(/همه کلاس‌ها/);
      fireEvent.click(allClassesOption);

      const allClassesRadio = screen.getByRole('radio', { name: /همه کلاس‌ها/ });
      expect(allClassesRadio).toBeChecked();

      // Submit
      const exportButton = screen.getByText('صادرات');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockExportHookState.exportSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: 'all-classes',
            includeAnalysis: true,
          })
        );
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should export all teachers scope', async () => {
      const onOpenChange = vi.fn();

      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          currentScheduleId={1}
          currentType="teacher"
          currentTargetId="teacher-1"
        />
      );

      // Select all teachers scope
      const allTeachersOption = screen.getByLabelText(/همه اساتید/);
      fireEvent.click(allTeachersOption);

      const allTeachersRadio = screen.getByRole('radio', { name: /همه اساتید/ });
      expect(allTeachersRadio).toBeChecked();

      // Submit
      const exportButton = screen.getByText('صادرات');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockExportHookState.exportSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: 'all-teachers',
            targetType: 'teacher',
            includeAnalysis: true,
          })
        );
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should display error state in progress component', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 5,
        total: 10,
        status: 'error' as const,
        message: 'Export failed',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      // Error state should show close button
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle close action on error', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 5,
        total: 10,
        status: 'error' as const,
        message: 'Export failed',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should show preparing state', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 0,
        total: 10,
        status: 'preparing' as const,
        message: 'Preparing export...',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      // Should have a cancel button during preparing
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show finalizing state', () => {
      const onCancel = vi.fn();
      const progress = {
        current: 10,
        total: 10,
        status: 'finalizing' as const,
        message: 'Finalizing...',
      };

      render(<ExportProgress progress={progress} onCancel={onCancel} />);

      // Should have a cancel button during finalizing
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('ExportErrorBoundary Integration', () => {
    // Component that throws an error
    const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test export error');
      }
      return <div>Export content</div>;
    };

    it('should render children when no error', () => {
      render(
        <ExportErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ExportErrorBoundary>
      );

      expect(screen.getByText('Export content')).toBeInTheDocument();
    });

    it('should catch and display error', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      // Should show error UI with buttons
      expect(screen.getByRole('button')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should allow reset after error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onReset = vi.fn();

      render(
        <ExportErrorBoundary onReset={onReset}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      // Click reset button (the close button)
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[buttons.length - 1]); // Close button is last

      expect(onReset).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should show retry button when onRetry is provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onRetry = vi.fn();

      render(
        <ExportErrorBoundary onRetry={onRetry}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      // Should show multiple buttons (retry and close)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      // Click the first button (retry)
      fireEvent.click(buttons[0]);
      expect(onRetry).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should render custom fallback when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary fallback={<div>Custom error fallback</div>}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Display Settings Integration', () => {
    it('should include display settings in export', async () => {
      const onOpenChange = vi.fn();

      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      // Verify display settings section exists
      expect(screen.getByText('تنظیمات نمایش')).toBeInTheDocument();

      // Toggle teacher name off
      const teacherNameCheckbox = screen.getByLabelText(/نام اساتید/);
      fireEvent.click(teacherNameCheckbox);

      // Submit
      const exportButton = screen.getByText('صادرات');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should toggle room name setting', () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      const roomNameCheckbox = screen.getByLabelText(/نام اتاق‌ها/);
      expect(roomNameCheckbox).toBeChecked();

      fireEvent.click(roomNameCheckbox);
      expect(roomNameCheckbox).not.toBeChecked();
    });

    it('should toggle color coding setting', () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      const colorCodingCheckbox = screen.getByLabelText(/رنگ‌بندی/);
      // Initially off based on mock settings
      expect(colorCodingCheckbox).not.toBeChecked();

      fireEvent.click(colorCodingCheckbox);
      expect(colorCodingCheckbox).toBeChecked();
    });
  });

  describe('Language Selection', () => {
    it('should default to Persian language', () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      const persianRadio = screen.getByRole('radio', { name: /فارسی/ });
      expect(persianRadio).toBeChecked();
    });

    it('should allow switching to English', () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          currentScheduleId={1}
          currentType="class"
          currentTargetId="class-1"
        />
      );

      const englishOption = screen.getByLabelText(/انگلیسی/);
      fireEvent.click(englishOption);

      const englishRadio = screen.getByRole('radio', { name: /انگلیسی/ });
      expect(englishRadio).toBeChecked();
    });
  });
});
