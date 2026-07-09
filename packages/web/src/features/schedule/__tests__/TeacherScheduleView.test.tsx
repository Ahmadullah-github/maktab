/**
 * Unit tests for TeacherScheduleView integration with export functionality
 *
 * Requirements: 9.2, 9.3
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherScheduleView } from '../components/views/TeacherScheduleView';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CalendarX2: () => <svg data-testid="calendar-x2-icon" />,
  Download: () => <svg data-testid="download-icon" />,
  Settings: () => <svg data-testid="settings-icon" />,
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
vi.mock('../stores/scheduleStore', async () => {
  const actual = await vi.importActual<typeof import('../stores/scheduleStore')>(
    '../stores/scheduleStore'
  );

  return {
    ...actual,
    useScheduleStore: (selector: any) => mockUseScheduleStore(selector),
    getUnsavedChangesCount: () => 0,
    getHasUnsavedChanges: () => false,
  };
});

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
const mockScheduleGrid = vi.fn(() => <div data-testid="schedule-grid">Schedule Grid</div>);
vi.mock('../components/grid/ScheduleGrid', () => ({
  ScheduleGrid: (props: any) => mockScheduleGrid(props),
}));

vi.mock('../components/navigation/TeacherTabs', () => ({
  TeacherTabs: () => <div data-testid="teacher-tabs">Teacher Tabs</div>,
}));

vi.mock('../components/settings/DisplaySettingsDialog', () => ({
  DisplaySettingsDialog: ({ open }: any) => (
    <div data-testid="display-settings-dialog">Display Settings Open: {open.toString()}</div>
  ),
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

vi.mock('../hooks/useUndoRedo', () => ({
  useUndoRedo: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock('../hooks/useSwapConstraintContext', () => ({
  useSwapConstraintContext: vi.fn(),
}));

vi.mock('@/stores/navigationGuardStore', () => ({
  useNavigationGuardStore: (selector?: any) => {
    const state = {
      setDirty: vi.fn(),
    };

    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../components/views/EmptyScheduleState', () => ({
  EmptyScheduleState: () => <div data-testid="empty-schedule-state">Empty Schedule State</div>,
}));

describe('TeacherScheduleView Export Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseScheduleView.mockReturnValue({
      currentViewId: 'teacher-1',
      filteredLessons: [],
      setView: vi.fn(),
      availableTeachers: [],
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
        teachers: new Map([
          [
            'teacher-1',
            {
              teacherName: 'Ahmad Hassan',
              primarySubjects: ['Mathematics', 'Physics'],
              classTeacherOf: ['Class 10A'],
            },
          ],
        ]),
        indexes: {
          byTeacher: new Map([['teacher-1', []]]),
        },
        lessons: [],
        initializeEditState: vi.fn(),
      };
      return selector(mockState);
    });
  });

  it('should render the schedule grid in teacher scope', () => {
    render(<TeacherScheduleView />);

    expect(mockScheduleGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        viewScope: 'teacher',
        viewId: 'teacher-1',
        highlightTeacherId: 'teacher-1',
      })
    );
  });

  it('should render a stacked teacher overview when "All" view is selected', () => {
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableTeachers: [
        {
          teacherId: 'teacher-1',
          teacherName: 'Ahmad Hassan',
          primarySubjects: ['Mathematics', 'Physics'],
          maxPeriodsPerWeek: 24,
          classTeacherOf: ['Class 10A'],
        },
        {
          teacherId: 'teacher-2',
          teacherName: 'Jawad',
          primarySubjects: ['Chemistry'],
          maxPeriodsPerWeek: 18,
          classTeacherOf: [],
        },
      ],
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
        teachers: new Map([
          [
            'teacher-1',
            {
              teacherName: 'Ahmad Hassan',
              primarySubjects: ['Mathematics', 'Physics'],
              classTeacherOf: ['Class 10A'],
            },
          ],
          [
            'teacher-2',
            {
              teacherName: 'Jawad',
              primarySubjects: ['Chemistry'],
              classTeacherOf: [],
            },
          ],
        ]),
        indexes: {
          byTeacher: new Map([
            ['teacher-1', [{ id: 'lesson-1' } as any]],
            ['teacher-2', [{ id: 'lesson-2' } as any]],
          ]),
        },
        lessons: [],
        initializeEditState: vi.fn(),
      };
      return selector(mockState);
    });

    render(<TeacherScheduleView />);

    expect(mockScheduleGrid).toHaveBeenCalledTimes(2);
    expect(mockScheduleGrid).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        viewScope: 'teacher',
        viewId: 'teacher-1',
      })
    );
    expect(mockScheduleGrid).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        viewScope: 'teacher',
        viewId: 'teacher-2',
      })
    );
  });

  it('should render export button when teacher is selected', () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveClass('gap-2');
  });

  it('should have proper accessibility attributes on export button', () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toHaveAttribute('aria-label', 'صادرات');
  });

  it('should show download icon in export button', () => {
    render(<TeacherScheduleView />);

    const downloadIcon = screen.getByTestId('download-icon');
    expect(downloadIcon).toBeInTheDocument();
  });

  it('should open export dialog when export button is clicked', async () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      const exportDialog = screen.getByTestId('export-dialog');
      expect(exportDialog).toBeInTheDocument();
      expect(screen.getByText('Export Dialog Open: true')).toBeInTheDocument();
    });
  });

  it('should pass correct context to export dialog', async () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Schedule ID: 1')).toBeInTheDocument();
      expect(screen.getByText('Type: teacher')).toBeInTheDocument();
      expect(screen.getByText('Target ID: teacher-1')).toBeInTheDocument();
    });
  });

  it('should close export dialog when onOpenChange is called', async () => {
    render(<TeacherScheduleView />);

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

  it('should not render export button when "All" view is selected', () => {
    // Mock useScheduleView to return null currentViewId (All view)
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableTeachers: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    render(<TeacherScheduleView />);

    const exportButton = screen.queryByRole('button', { name: /صادرات/ });
    expect(exportButton).not.toBeInTheDocument();
  });

  it('should not render export dialog when "All" view is selected', () => {
    // Mock useScheduleView to return null currentViewId (All view)
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableTeachers: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    render(<TeacherScheduleView />);

    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
  });

  it('should position export button correctly in header', () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    const settingsButton = screen.getByRole('button', { name: /تنظیمات نمایش/ });

    // Both buttons should be in the same container
    const buttonContainer = exportButton.parentElement;
    expect(buttonContainer).toContain(settingsButton);
    expect(buttonContainer).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('should support keyboard navigation', () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });

    // Button should be focusable
    exportButton.focus();
    expect(document.activeElement).toBe(exportButton);
  });

  it('should have proper button styling', () => {
    render(<TeacherScheduleView />);

    const exportButton = screen.getByRole('button', { name: /صادرات/ });
    expect(exportButton).toHaveClass('gap-2');
    // Should have outline variant styling
    expect(exportButton).toHaveAttribute('class');
  });

  it('should show teacher metadata when teacher is selected', () => {
    render(<TeacherScheduleView />);

    expect(screen.getByText('Ahmad Hassan')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('Physics')).toBeInTheDocument();
  });

  it('should show "All Teachers" header when no specific teacher is selected', () => {
    // Mock useScheduleView to return null currentViewId (All view)
    mockUseScheduleView.mockReturnValue({
      currentViewId: null,
      filteredLessons: [],
      setView: vi.fn(),
      availableTeachers: [],
      periodsPerDay: [6, 6, 6, 6, 6],
      days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
    });

    render(<TeacherScheduleView />);

    expect(screen.getByText('همه معلمان')).toBeInTheDocument();
    expect(screen.getByText('فهرست کامل برنامه هر معلم به صورت عمودی و قابل اسکرول')).toBeInTheDocument();
  });

  it('should handle empty schedule state', () => {
    // Mock useScheduleStore to return no scheduleId
    mockUseScheduleStore.mockImplementation((selector: any) => {
      const mockState = {
        scheduleId: null,
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
        teachers: new Map(),
        indexes: { byTeacher: new Map() },
        lessons: [],
      };
      return selector(mockState);
    });

    render(<TeacherScheduleView />);

    // Should show empty state instead of export functionality
    expect(screen.queryByRole('button', { name: /صادرات/ })).not.toBeInTheDocument();
  });
});
