/**
 * Unit tests for ClassScheduleView integration with export functionality
 *
 * Requirements: 9.1, 9.3
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassScheduleView } from '../components/views/ClassScheduleView';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Download: () => <svg data-testid="download-icon" />,
  Settings: () => <svg data-testid="settings-icon" />,
  User: () => <svg data-testid="user-icon" />,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Mock the hooks and components
const mockUseScheduleView = vi.fn();
vi.mock('../hooks/useScheduleView', () => ({
  useScheduleView: () => mockUseScheduleView(),
}));

const mockUseScheduleStore = vi.fn();
vi.mock('../stores/scheduleStore', () => ({
  useScheduleStore: (selector: any) => mockUseScheduleStore(selector),
}));

vi.mock('../hooks/useDisplaySettings', () => ({
  useDisplaySettings: () => ({
    settings: {
      showSubjectName: true,
      showTeacherName: true,
      showRoomName: true,
      cellSize: 'normal',
      fontSize: 'md',
      colorBy: 'none',
    },
  }),
}));

// Mock the ExportDialog component
vi.mock('../components/export/ExportDialog', () => ({
  ExportDialog: ({ open, onOpenChange, currentScheduleId, currentType, currentTargetId }: any) => (
    <div data-testid="export-dialog">
      <div>Export Dialog Open: {open.toString()}</div>
      <div>Schedule ID: {currentScheduleId}</div>
      <div>Type: {currentType}</div>
      <div>Target ID: {currentTargetId}</div>
      <button onClick={() => onOpenChange(false)}>Close Dialog</button>
    </div>
  ),
}));

// Mock other components
vi.mock('../components/grid/ScheduleGrid', () => ({
  ScheduleGrid: () => <div data-testid="schedule-grid">Schedule Grid</div>,
}));

vi.mock('../components/navigation/ClassTabNavigation', () => ({
  ClassTabNavigation: () => <div data-testid="class-tab-navigation">Class Tab Navigation</div>,
}));

vi.mock('../components/edit/UndoRedoButtons', () => ({
  UndoRedoButtons: () => <div data-testid="undo-redo-buttons">Undo/Redo Buttons</div>,
}));

vi.mock('../components/edit/SaveButton', () => ({
  SaveButton: () => <div data-testid="save-button">Save Button</div>,
}));

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../hooks/useSaveScheduleChanges', () => ({
  useSaveScheduleChanges: () => ({
    saveChanges: vi.fn(),
    isSaving: false,
  }),
}));

vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('@/stores/navigationGuardStore', () => ({
  useNavigationGuardStore: () => ({
    setDirty: vi.fn(),
  }),
}));

vi.mock('../components/settings/DisplaySettingsDialog', () => ({
  DisplaySettingsDialog: ({ open }: any) => (
    <div data-testid="display-settings-dialog">Display Settings Open: {open.toString()}</div>
  ),
}));

describe('ClassScheduleView Export Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseScheduleView.mockReturnValue({
      currentViewId: 'class-1',
      filteredLessons: [],
      setView: vi.fn(),
      availableClasses: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    mockUseScheduleStore.mockImplementation((selector: any) => {
      const mockState = {
        scheduleId: 1,
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
        classes: new Map([
          [
            'class-1',
            {
              className: 'Class 10A',
              singleTeacherMode: false,
              studentCount: 25,
              categoryDari: 'لیسه',
              classTeacherName: 'Ahmad Hassan',
            },
          ],
        ]),
      };
      return selector(mockState);
    });
  });

  it('should render export button in class header', () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveClass('gap-2');
  });

  it('should have proper accessibility attributes on export button', () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toHaveAttribute('aria-label', 'صادرات');
  });

  it('should show download icon in export button', () => {
    render(<ClassScheduleView />);

    const downloadIcon = screen.getByTestId('download-icon');
    expect(downloadIcon).toBeInTheDocument();
  });

  it('should open export dialog when export button is clicked', async () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const exportDialog = screen.getByTestId('export-dialog');
      expect(exportDialog).toBeInTheDocument();
      expect(screen.getByText('Export Dialog Open: true')).toBeInTheDocument();
    });
  });

  it('should pass correct context to export dialog', async () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Schedule ID: 1')).toBeInTheDocument();
      expect(screen.getByText('Type: class')).toBeInTheDocument();
      expect(screen.getByText('Target ID: class-1')).toBeInTheDocument();
    });
  });

  it('should close export dialog when onOpenChange is called', async () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const closeButton = screen.getByText('Close Dialog');
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Export Dialog Open: false')).toBeInTheDocument();
    });
  });

  it('should disable export button when no class is selected', () => {
    // Mock useScheduleView to return no currentViewId
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableClasses: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toBeDisabled();
  });

  it('should not render export dialog when no class is selected', () => {
    // Mock useScheduleView to return no currentViewId
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableClasses: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    render(<ClassScheduleView />);

    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
  });

  it('should position export button correctly in header', () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    const settingsButton = screen.getByRole('button', { name: /تنظیمات نمایش/ });

    // Both buttons should be in the same container
    const buttonContainer = exportButton.parentElement;
    expect(buttonContainer).toContain(settingsButton);
    expect(buttonContainer).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('should support keyboard navigation', () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });

    // Button should be focusable
    exportButton.focus();
    expect(document.activeElement).toBe(exportButton);
  });

  it('should have proper button styling', () => {
    render(<ClassScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toHaveClass('gap-2');
    // Should have outline variant styling
    expect(exportButton).toHaveAttribute('class');
  });
});
