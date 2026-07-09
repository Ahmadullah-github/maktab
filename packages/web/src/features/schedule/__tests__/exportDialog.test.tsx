/**
 * Unit tests for Export Dialog Components
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportDialog } from '../components/export/ExportDialog';
import { ExportProgress } from '../components/export/ExportProgress';
import { FormatSelector } from '../components/export/FormatSelector';
import { LanguageSelector } from '../components/export/LanguageSelector';
import { ScopeSelector } from '../components/export/ScopeSelector';
import { SettingsToggles } from '../components/export/SettingsToggles';
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
  progress: null,
  error: null as string | null,
  cancelExport: vi.fn(),
};

vi.mock('../hooks/useExportSchedule', () => ({
  useExportSchedule: () => mockExportHookState,
}));

describe('ExportDialog Component', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentScheduleId: 1,
    currentType: 'class' as const,
    currentTargetId: 'class-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExportHookState.exportSchedule.mockResolvedValue(undefined);
    mockExportHookState.cancelExport.mockResolvedValue(undefined);
    mockExportHookState.isExporting = false;
    mockExportHookState.progress = null;
    mockExportHookState.error = null;
  });

  it('should render export dialog with all sections', () => {
    render(<ExportDialog {...defaultProps} />);

    expect(screen.getByText('صادرات برنامه')).toBeInTheDocument();
    expect(screen.getByText('فرمت فایل')).toBeInTheDocument();
    expect(screen.getByText('محدوده صادرات')).toBeInTheDocument();
    expect(screen.getByText('زبان')).toBeInTheDocument();
    expect(screen.getByText('تنظیمات نمایش')).toBeInTheDocument();
    expect(screen.getByText('صادرات')).toBeInTheDocument();
    expect(screen.getByText('لغو')).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    const onOpenChange = vi.fn();
    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const exportButton = screen.getByText('صادرات');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockExportHookState.exportSchedule).toHaveBeenCalledWith({
        scheduleId: 1,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: 'class-1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
        includeAnalysis: false,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should handle dialog close', () => {
    const onOpenChange = vi.fn();
    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByText('لغو');
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should have RTL direction', () => {
    render(<ExportDialog {...defaultProps} />);

    const dialogContent = screen.getByRole('dialog');
    expect(dialogContent).toHaveAttribute('dir', 'rtl');
  });

  it('should switch to batch progress view after starting a batch export', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByLabelText(/همه کلاس‌ها/));
    fireEvent.click(screen.getByText('صادرات'));

    await waitFor(() => {
      expect(mockExportHookState.exportSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'all-classes',
        })
      );
    });

    mockExportHookState.isExporting = true;
    mockExportHookState.progress = {
      current: 2,
      total: 5,
      status: 'generating',
      message: 'Generating 2 of 5...',
    };

    rerender(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('FormatSelector Component', () => {
  it('should render PDF and Excel options', () => {
    const onChange = vi.fn();
    render(<FormatSelector value="pdf" onChange={onChange} />);

    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Excel')).toBeInTheDocument();
  });

  it('should handle format change', () => {
    const onChange = vi.fn();
    render(<FormatSelector value="pdf" onChange={onChange} />);

    const excelOption = screen.getByLabelText(/Excel/);
    fireEvent.click(excelOption);

    expect(onChange).toHaveBeenCalledWith('excel');
  });

  it('should show correct selected value', () => {
    const onChange = vi.fn();
    render(<FormatSelector value="excel" onChange={onChange} />);

    const excelRadio = screen.getByRole('radio', { name: /Excel/ });
    expect(excelRadio).toBeChecked();
  });
});

describe('ScopeSelector Component', () => {
  it('should render all scope options', () => {
    const onChange = vi.fn();
    render(<ScopeSelector value="current" onChange={onChange} currentType="class" />);

    expect(screen.getByText('کلاس/استاد فعلی')).toBeInTheDocument();
    expect(screen.getByText('همه کلاس‌ها')).toBeInTheDocument();
    expect(screen.getByText('همه اساتید')).toBeInTheDocument();
  });

  it('should keep the current scope label available for both view types', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ScopeSelector value="current" onChange={onChange} currentType="class" />
    );
    expect(screen.getByText('کلاس/استاد فعلی')).toBeInTheDocument();

    rerender(<ScopeSelector value="current" onChange={onChange} currentType="teacher" />);
    expect(screen.getByText('کلاس/استاد فعلی')).toBeInTheDocument();
  });

  it('should handle scope change', () => {
    const onChange = vi.fn();
    render(<ScopeSelector value="current" onChange={onChange} currentType="class" />);

    const allClassesOption = screen.getByLabelText(/همه کلاس‌ها/);
    fireEvent.click(allClassesOption);

    expect(onChange).toHaveBeenCalledWith('all-classes');
  });
});

describe('LanguageSelector Component', () => {
  it('should render Persian and English options', () => {
    const onChange = vi.fn();
    render(<LanguageSelector value="fa" onChange={onChange} />);

    expect(screen.getByText('فارسی')).toBeInTheDocument();
    expect(screen.getByText('انگلیسی')).toBeInTheDocument();
  });

  it('should handle language change', () => {
    const onChange = vi.fn();
    render(<LanguageSelector value="fa" onChange={onChange} />);

    const englishOption = screen.getByLabelText(/انگلیسی/);
    fireEvent.click(englishOption);

    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('should show correct selected value', () => {
    const onChange = vi.fn();
    render(<LanguageSelector value="en" onChange={onChange} />);

    const englishRadio = screen.getByRole('radio', { name: /انگلیسی/ });
    expect(englishRadio).toBeChecked();
  });
});

describe('SettingsToggles Component', () => {
  const defaultDisplaySettings: DisplaySettings = {
    showSubjectName: true,
    showTeacherName: true,
    showRoomName: true,
    cellSize: 'normal',
    fontSize: 'md',
    colorBy: 'none',
  };

  it('should render all toggle options', () => {
    const onChange = vi.fn();
    render(<SettingsToggles displaySettings={defaultDisplaySettings} onChange={onChange} />);

    expect(screen.getByText('نام اساتید')).toBeInTheDocument();
    expect(screen.getByText('نام اتاق‌ها')).toBeInTheDocument();
    expect(screen.getByText('رنگ‌بندی')).toBeInTheDocument();
    expect(screen.getByText('نام درس (همیشه نمایش داده می‌شود)')).toBeInTheDocument();
  });

  it('should handle teacher name toggle', () => {
    const onChange = vi.fn();
    render(<SettingsToggles displaySettings={defaultDisplaySettings} onChange={onChange} />);

    const teacherNameCheckbox = screen.getByLabelText(/نام اساتید/);
    fireEvent.click(teacherNameCheckbox);

    expect(onChange).toHaveBeenCalledWith({ showTeacherName: false });
  });

  it('should handle room name toggle', () => {
    const onChange = vi.fn();
    render(<SettingsToggles displaySettings={defaultDisplaySettings} onChange={onChange} />);

    const roomNameCheckbox = screen.getByLabelText(/نام اتاق‌ها/);
    fireEvent.click(roomNameCheckbox);

    expect(onChange).toHaveBeenCalledWith({ showRoomName: false });
  });

  it('should handle color coding toggle', () => {
    const onChange = vi.fn();
    render(<SettingsToggles displaySettings={defaultDisplaySettings} onChange={onChange} />);

    const colorCodingCheckbox = screen.getByLabelText(/رنگ‌بندی/);
    fireEvent.click(colorCodingCheckbox);

    expect(onChange).toHaveBeenCalledWith({ colorBy: 'subject' });
  });

  it('should show subject name as always enabled', () => {
    const onChange = vi.fn();
    render(<SettingsToggles displaySettings={defaultDisplaySettings} onChange={onChange} />);

    const subjectNameCheckbox = screen.getByLabelText(/نام درس همیشه نمایش داده می‌شود/);
    expect(subjectNameCheckbox).toBeChecked();
    expect(subjectNameCheckbox).toBeDisabled();
  });

  it('should reflect current display settings state', () => {
    const onChange = vi.fn();
    const settingsWithTogglesOff: DisplaySettings = {
      ...defaultDisplaySettings,
      showTeacherName: false,
      showRoomName: false,
      colorBy: 'none',
    };

    render(<SettingsToggles displaySettings={settingsWithTogglesOff} onChange={onChange} />);

    const teacherNameCheckbox = screen.getByLabelText(/نام اساتید/);
    const roomNameCheckbox = screen.getByLabelText(/نام اتاق‌ها/);
    const colorCodingCheckbox = screen.getByLabelText(/رنگ‌بندی/);

    expect(teacherNameCheckbox).not.toBeChecked();
    expect(roomNameCheckbox).not.toBeChecked();
    expect(colorCodingCheckbox).not.toBeChecked();
  });
});

describe('ExportProgress Component', () => {
  it('should render progress with generating status', () => {
    const onCancel = vi.fn();
    const progress = {
      current: 3,
      total: 10,
      status: 'generating' as const,
      message: 'Processing...',
    };

    render(<ExportProgress progress={progress} onCancel={onCancel} />);

    expect(screen.getByText('در حال تولید {{current}} از {{total}}...')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('انصراف')).toBeInTheDocument();
  });

  it('should render progress with complete status', () => {
    const onCancel = vi.fn();
    const progress = {
      current: 10,
      total: 10,
      status: 'complete' as const,
      message: 'Done',
    };

    render(<ExportProgress progress={progress} onCancel={onCancel} />);

    expect(screen.getByText('تکمیل شد')).toBeInTheDocument();
    expect(screen.queryByText('انصراف')).not.toBeInTheDocument();
  });

  it('should render progress with error status', () => {
    const onCancel = vi.fn();
    const progress = {
      current: 5,
      total: 10,
      status: 'error' as const,
      message: 'Export failed',
    };

    render(<ExportProgress progress={progress} onCancel={onCancel} />);

    expect(screen.getByText('خطا در صادرات')).toBeInTheDocument();
    expect(screen.getByText('بستن')).toBeInTheDocument();
    expect(screen.queryByText('انصراف')).not.toBeInTheDocument();
  });

  it('should handle cancel button click', () => {
    const onCancel = vi.fn();
    const progress = {
      current: 3,
      total: 10,
      status: 'generating' as const,
      message: 'Processing...',
    };

    render(<ExportProgress progress={progress} onCancel={onCancel} />);

    const cancelButton = screen.getByText('انصراف');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should have RTL direction', () => {
    const onCancel = vi.fn();
    const progress = {
      current: 3,
      total: 10,
      status: 'generating' as const,
      message: 'Processing...',
    };

    render(<ExportProgress progress={progress} onCancel={onCancel} />);

    const progressContainer = screen.getByText('انصراف').closest('div[dir="rtl"]');
    expect(progressContainer).toHaveAttribute('dir', 'rtl');
  });

  it('should show different status messages', () => {
    const onCancel = vi.fn();

    const statuses = [
      { status: 'preparing' as const, expectedText: 'آماده‌سازی...' },
      { status: 'finalizing' as const, expectedText: 'نهایی‌سازی...' },
      { status: 'complete' as const, expectedText: 'تکمیل شد' },
      { status: 'error' as const, expectedText: 'خطا در صادرات' },
    ];

    statuses.forEach(({ status, expectedText }) => {
      const progress = {
        current: 5,
        total: 10,
        status,
        message: 'Test message',
      };

      const { rerender } = render(<ExportProgress progress={progress} onCancel={onCancel} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();

      // Clean up for next iteration
      rerender(<div />);
    });
  });
});
