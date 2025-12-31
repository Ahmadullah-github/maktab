/**
 * Types for the Schedule feature module
 * Maps to solver output structures from packages/solver
 */

/**
 * Day of week enum matching solver output
 * Afghan week starts on Saturday
 */
export enum DayOfWeek {
  Saturday = 'Saturday',
  Sunday = 'Sunday',
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
}

/**
 * A single scheduled lesson in the timetable
 * Maps directly to solver's ScheduledLesson model
 */
export interface ScheduledLesson {
  day: DayOfWeek;
  periodIndex: number;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherIds: string[];
  teacherNames: string[] | null;
  roomId: string | null;
  roomName: string | null;
  isFixed: boolean;
  periodsThisDay: number | null;
}

/**
 * Metadata about a class in the solution
 */
export interface ClassMetadata {
  classId: string;
  className: string;
  gradeLevel: number | null;
  category: string | null;
  categoryDari: string | null;
  studentCount: number;
  singleTeacherMode: boolean;
  classTeacherId: string | null;
  classTeacherName: string | null;
  classTeacherSubjects: string[] | null;
}

/**
 * Metadata about a subject in the solution
 */
export interface SubjectMetadata {
  subjectId: string;
  subjectName: string;
  isCustom: boolean;
  customCategory: string | null;
  customCategoryDari: string | null;
}

/**
 * Metadata about a teacher in the solution
 */
export interface TeacherMetadata {
  teacherId: string;
  teacherName: string;
  primarySubjects: string[];
  maxPeriodsPerWeek: number;
  classTeacherOf: string[];
}

/**
 * Metadata about a room (derived from lessons)
 */
export interface RoomMetadata {
  roomId: string;
  roomName: string;
}

/**
 * Period configuration from solver
 */
export interface PeriodConfiguration {
  periodsPerDayMap: Record<string, number>;
  totalPeriodsPerWeek: number;
  daysOfWeek: string[];
  hasVariablePeriods: boolean;
}

/**
 * Complete solution metadata
 */
export interface SolutionMetadata {
  classes: ClassMetadata[];
  subjects: SubjectMetadata[];
  teachers: TeacherMetadata[];
  periodConfiguration: PeriodConfiguration | null;
}

/**
 * Solution statistics from solver
 */
export interface SolutionStatistics {
  totalClasses: number;
  singleTeacherClasses: number;
  multiTeacherClasses: number;
  totalSubjects: number;
  customSubjects: number;
  standardSubjects: number;
  totalTeachers: number;
  totalRooms: number;
  categoryCounts: Record<string, number>;
  customSubjectsByCategory: Record<string, number>;
  totalLessons: number;
  periodsPerWeek: number;
  solveTimeSeconds: number | null;
  strategy: string | null;
  numConstraintsApplied: number | null;
  qualityScore: number | null;
}

/**
 * Pre-computed indexes for O(1) lookups
 */
export interface ScheduleIndexes {
  /** Lessons by slot key: "${day}-${periodIndex}" */
  bySlot: Map<string, ScheduledLesson[]>;
  /** Lessons by teacher+slot: "${teacherId}-${day}-${periodIndex}" */
  byTeacherAndSlot: Map<string, ScheduledLesson>;
  /** Lessons by room+slot: "${roomId}-${day}-${periodIndex}" */
  byRoomAndSlot: Map<string, ScheduledLesson>;
  /** Lessons by class+slot: "${classId}-${day}-${periodIndex}" */
  byClassAndSlot: Map<string, ScheduledLesson>;
  /** All lessons for a teacher: teacherId -> lessons[] */
  byTeacher: Map<string, ScheduledLesson[]>;
  /** All lessons for a class: classId -> lessons[] */
  byClass: Map<string, ScheduledLesson[]>;
  /** All lessons for a room: roomId -> lessons[] */
  byRoom: Map<string, ScheduledLesson[]>;
}

// ============================================================================
// Phase 4: Display Customization Types
// ============================================================================

/**
 * Cell size options for schedule grid
 */
export type CellSize = 'compact' | 'normal' | 'large';

/**
 * Font size options for schedule cells
 */
export type FontSize = 'sm' | 'md' | 'lg';

/**
 * Color coding options for schedule cells
 */
export type ColorCodingMode = 'none' | 'subject' | 'teacher';

/**
 * Display settings for schedule rendering
 * Extended in Phase 4 with typed size options and color coding
 */
export interface DisplaySettings {
  // Cell content visibility
  showSubjectName: boolean; // Always true, not user-toggleable
  showTeacherName: boolean; // Default: true
  showRoomName: boolean; // Default: true

  // Styling
  cellSize: CellSize; // Default: 'normal'
  fontSize: FontSize; // Default: 'md'

  // Color coding
  colorBy: ColorCodingMode; // Default: 'none'
}

/**
 * Display preset configuration
 */
export interface DisplayPreset {
  key: string;
  labelFa: string;
  labelEn: string;
  settings: Partial<DisplaySettings>;
}

/**
 * Props for DisplaySettingsDialog component
 */
export interface DisplaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Complete schedule state
 */
export interface ScheduleState {
  scheduleId: number | null;
  scheduleName: string;
  lessons: ScheduledLesson[];
  indexes: ScheduleIndexes;
  metadata: SolutionMetadata | null;
  statistics: SolutionStatistics | null;
  teachers: Map<string, TeacherMetadata>;
  rooms: Map<string, RoomMetadata>;
  classes: Map<string, ClassMetadata>;
  subjects: Map<string, SubjectMetadata>;
  displaySettings: DisplaySettings;
  isLoading: boolean;
  error: string | null;

  // Phase 6: Interaction state
  interactionMode: InteractionMode;
  focusedSlot: FocusedSlot | null;
  selectedLesson: ScheduledLesson | null;
  isLocked: boolean;

  // Phase 8: Edit state for undo/redo and persistence
  /** Snapshot of lessons from last save point */
  originalLessons: ScheduledLesson[];
  /** Stack of actions that can be undone (LIFO) */
  undoStack: SwapAction[];
  /** Stack of actions that can be redone (LIFO) */
  redoStack: SwapAction[];
  /** Timestamp of last save, null if never saved */
  lastSavedAt: Date | null;
}

/**
 * API response structure for timetable
 */
export interface TimetableApiResponse {
  id: number;
  name: string;
  description: string;
  data: string; // JSON string containing SolverOutput
  schoolId: number | null;
  academicYearId: number | null;
  termId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalized schedule data after transformation
 */
export interface NormalizedSchedule {
  lessons: ScheduledLesson[];
  metadata: SolutionMetadata | null;
  statistics: SolutionStatistics | null;
}

// ============================================================================
// Phase 6: Manual Editing Foundation Types
// ============================================================================

/**
 * Interaction mode for the schedule grid
 * - idle: No active interaction
 * - selecting: User has selected a lesson
 * - previewing: Showing preview of potential swap (Phase 7)
 * - executing: Swap operation in progress (Phase 7)
 */
export type InteractionMode = 'idle' | 'selecting' | 'previewing' | 'executing';

/**
 * Focused slot position in the schedule grid
 * Identified by day and period index
 */
export interface FocusedSlot {
  day: DayOfWeek;
  period: number;
}

/**
 * Interaction state for manual editing
 * Managed centrally in the schedule store
 */
export interface InteractionState {
  /** Current interaction mode */
  interactionMode: InteractionMode;
  /** Currently focused slot (keyboard navigation) */
  focusedSlot: FocusedSlot | null;
  /** Currently selected lesson for editing */
  selectedLesson: ScheduledLesson | null;
  /** Lock flag to prevent concurrent interactions */
  isLocked: boolean;
}

// ============================================================================
// Phase 2: Grid Rendering & View System Types
// ============================================================================

/**
 * View type for schedule display
 */
export type ScheduleViewType = 'class' | 'teacher';

/**
 * Validation status for cells (future editing support)
 */
export type CellValidationStatus = 'valid' | 'warning' | 'blocked' | null;

/**
 * Props for ScheduleGrid component
 */
export interface ScheduleGridProps {
  lessons: ScheduledLesson[];
  days: DayOfWeek[];
  periodsPerDay: number | Map<DayOfWeek, number>;
  displaySettings: DisplaySettings;
  onCellClick?: (day: DayOfWeek, period: number, lesson: ScheduledLesson | null) => void;
  isReadOnly?: boolean;
  highlightTeacherId?: string;
  /** View scope for drag-drop validation (class or teacher view) */
  viewScope?: 'class' | 'teacher';
  /** View ID for drag-drop validation (classId or teacherId) */
  viewId?: string;
}

/**
 * Props for ScheduleCell component
 */
export interface ScheduleCellProps {
  lesson: ScheduledLesson | null;
  displaySettings: DisplaySettings;
  isSelected?: boolean;
  isFocused?: boolean;
  isHighlighted?: boolean;
  validationStatus?: CellValidationStatus;
  onClick?: () => void;
  isReadOnly?: boolean;

  // Phase 6: Drag-drop visual states
  /** Whether this cell is currently being dragged */
  isDragging?: boolean;
  /** Whether this cell is a valid drop target being hovered over */
  isDropTarget?: boolean;

  // Phase 7: Swap validation
  /** Callback when user attempts to swap to this cell */
  onSwapAttempt?: (targetSlot: { day: DayOfWeek; period: number }) => void;
  /** Day of this cell (for swap attempt callback) */
  day?: DayOfWeek;
  /** Period index of this cell (for swap attempt callback) */
  period?: number;
}

/**
 * Category with classes for accordion navigation
 */
export interface CategoryWithClasses {
  key: string;
  name: string;
  nameFa: string;
  classes: ClassMetadata[];
}

/**
 * Props for CategoryAccordion component
 */
export interface CategoryAccordionProps {
  categories: CategoryWithClasses[];
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
}

/**
 * Props for TeacherTabs component
 */
export interface TeacherTabsProps {
  teachers: TeacherMetadata[];
  selectedTeacherId: string | null;
  onSelectTeacher: (teacherId: string | null) => void;
  lessonCounts: Map<string, number>;
}

/**
 * Return type for useScheduleView hook
 */
export interface UseScheduleViewReturn {
  currentView: ScheduleViewType;
  currentViewId: string | null;
  filteredLessons: ScheduledLesson[];
  setView: (view: ScheduleViewType, id: string | null) => void;
  availableClasses: CategoryWithClasses[];
  availableTeachers: TeacherMetadata[];
  periodsPerDay: Map<DayOfWeek, number>;
  days: DayOfWeek[];
}

// ============================================================================
// Phase 3: Dashboard & Schedule Management Types
// ============================================================================

/**
 * Solver strategy type
 * Affects solve time and quality
 */
export type SolverStrategy = 'fast' | 'balanced' | 'thorough';

/**
 * Strategy option for UI display
 */
export interface StrategyOption {
  value: SolverStrategy;
  labelFa: string;
  labelEn: string;
  estimatedTime: string;
  estimatedTimeFa: string;
}

/**
 * Strategy options constant
 */
export const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: 'fast',
    labelFa: 'سریع',
    labelEn: 'Fast',
    estimatedTime: '~30 seconds',
    estimatedTimeFa: 'حدود ۳۰ ثانیه',
  },
  {
    value: 'balanced',
    labelFa: 'متعادل',
    labelEn: 'Balanced',
    estimatedTime: '~2 minutes',
    estimatedTimeFa: 'حدود ۲ دقیقه',
  },
  {
    value: 'thorough',
    labelFa: 'کامل',
    labelEn: 'Thorough',
    estimatedTime: '~5 minutes',
    estimatedTimeFa: 'حدود ۵ دقیقه',
  },
];

/**
 * Generation error types
 */
export type GenerationErrorType = 'SOLVER_BUSY' | 'SOLVER_TIMEOUT' | 'SOLVER_ERROR' | 'UNKNOWN';

/**
 * Generation error interface
 */
export interface GenerationError {
  type: GenerationErrorType;
  message: string;
  messageFa: string;
}

/**
 * Toast message constants in Persian
 */
export const TOAST_MESSAGES = {
  generateSuccess: 'جدول زمانی با موفقیت تولید شد',
  deleteSuccess: 'جدول زمانی با موفقیت حذف شد',
  saveSuccess: 'جدول زمانی ذخیره شد',
  renameSuccess: 'نام جدول زمانی تغییر کرد',
} as const;

/**
 * Error message constants in Persian
 */
export const ERROR_MESSAGES = {
  generateFailed: 'خطا در تولید جدول زمانی',
  deleteFailed: 'خطا در حذف جدول زمانی',
  saveFailed: 'خطا در ذخیره جدول زمانی',
  fetchFailed: 'خطا در دریافت لیست جدول‌های زمانی',
  solverBusy: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
  solverTimeout: 'تولید جدول زمانی زمان‌بر شد',
  solverError: 'خطا در تولید جدول زمانی',
} as const;

// ============================================================================
// Phase 7: Swap Validation Engine Types
// ============================================================================

import type { ConstraintSeverity, SwapConstraintType } from './constants';

/**
 * Represents a swap operation between two lessons
 */
export interface SwapOperation {
  /** The lesson being moved */
  lessonA: ScheduledLesson;
  /** The lesson at the target slot (null for empty slot) */
  lessonB: ScheduledLesson | null;
  /** Source slot position */
  slotA: { day: DayOfWeek; period: number };
  /** Target slot position */
  slotB: { day: DayOfWeek; period: number };
}

/**
 * A single constraint violation
 */
export interface ConstraintViolation {
  /** Constraint type from SWAP_CONSTRAINT_TYPES */
  type: SwapConstraintType;
  /** Severity: 'hard' blocks swap, 'soft' shows warning */
  severity: ConstraintSeverity;
  /** Persian message for display */
  message: string;
  /** Additional context for the violation */
  details: {
    // For TEACHER_CONFLICT
    conflictingClassName?: string;
    conflictingSubjectName?: string;

    // For ROOM_CONFLICT
    conflictingClassNameRoom?: string;

    // For ROOM_TYPE_MISMATCH
    requiredRoomType?: string;
    actualRoomType?: string;

    // For CONSECUTIVE_EXCEEDED
    currentConsecutive?: number;
    maxAllowed?: number;

    // For DIFFICULT_AFTERNOON
    subjectName?: string;

    // For TEACHER_PREFERENCE
    teacherPreference?: string;
    targetTimeOfDay?: string;

    // Generic additional info
    [key: string]: unknown;
  };
}

/**
 * Result of validating a swap operation
 */
export interface SwapValidationResult {
  /** True if no hard constraints violated */
  isValid: boolean;
  /** True if valid but has soft constraint warnings */
  canProceedWithWarning: boolean;
  /** Hard constraint violations (block swap) */
  errors: ConstraintViolation[];
  /** Soft constraint violations (show warning) */
  warnings: ConstraintViolation[];
  /** The swap operation being validated */
  swap: SwapOperation;
}

/**
 * Teacher data needed for constraint checking
 */
export interface TeacherConstraintData {
  /** Teacher ID */
  id: string;
  /** Availability per day: day -> array of booleans for each period */
  availability: Record<DayOfWeek, boolean[]>;
  /** Teacher's time preference */
  timePreference?: 'Morning' | 'Afternoon' | 'None';
  /** Maximum consecutive periods allowed */
  maxConsecutivePeriods?: number;
}

/**
 * Subject data needed for constraint checking
 */
export interface SubjectConstraintData {
  /** Subject ID */
  id: string;
  /** Required room type (null means no constraint) */
  requiredRoomType?: string | null;
  /** Whether this is a difficult subject */
  isDifficult?: boolean;
}

/**
 * Room data needed for constraint checking
 */
export interface RoomConstraintData {
  /** Room ID */
  id: string;
  /** Room type (e.g., 'classroom', 'lab', 'gym') */
  type: string;
}

// ============================================================================
// Phase 8: Undo/Redo & Persistence Types
// ============================================================================

/**
 * Maximum number of actions stored in undo stack
 * Limits memory usage while providing sufficient undo history
 */
export const UNDO_STACK_LIMIT = 50;

/**
 * Represents a recorded swap action for undo/redo
 * Contains before and after states to enable reversible operations
 */
export interface SwapAction {
  /** Unique identifier for this action (UUID) */
  id: string;
  /** Timestamp when action was executed (Unix timestamp in milliseconds) */
  timestamp: number;
  /** Action type - always 'swap' for now, extensible for future action types */
  type: 'swap';
  /** State before the swap */
  before: {
    /** First lesson in swap (always exists) */
    lessonA: ScheduledLesson;
    /** Second lesson in swap (null for empty slot) */
    lessonB: ScheduledLesson | null;
  };
  /** State after the swap */
  after: {
    /** First lesson after swap (at lessonB's original position) */
    lessonA: ScheduledLesson;
    /** Second lesson after swap (at lessonA's original position, null if was empty) */
    lessonB: ScheduledLesson | null;
  };
}

/**
 * Edit state for tracking changes and enabling undo/redo
 * Maintains history of modifications since last save
 */
export interface EditState {
  /** Snapshot of lessons from last save point */
  originalLessons: ScheduledLesson[];
  /** Stack of actions that can be undone (LIFO) */
  undoStack: SwapAction[];
  /** Stack of actions that can be redone (LIFO) */
  redoStack: SwapAction[];
  /** Timestamp of last save, null if never saved */
  lastSavedAt: Date | null;
}
