/**
 * Zustand store for Schedule feature state management
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { DEFAULT_DISPLAY_SETTINGS } from '../constants';
import type {
  ClassMetadata,
  DisplaySettings,
  FocusedSlot,
  RoomMetadata,
  ScheduledLesson,
  ScheduleIndexes,
  ScheduleState,
  SolutionMetadata,
  SubjectMetadata,
  SwapAction,
  SwapOperation,
  TeacherMetadata,
  TimetableApiResponse,
} from '../types';
import { UNDO_STACK_LIMIT } from '../types';
import { buildIndexes } from '../utils/indexBuilder';
import { logger } from '../utils/logger';
import { normalizeSchedule } from '../utils/scheduleTransformer';

/**
 * Creates empty schedule indexes
 */
function createEmptyIndexes(): ScheduleIndexes {
  return {
    bySlot: new Map(),
    byTeacherAndSlot: new Map(),
    byRoomAndSlot: new Map(),
    byClassAndSlot: new Map(),
    byTeacher: new Map(),
    byClass: new Map(),
    byRoom: new Map(),
  };
}

/**
 * Initial state for the schedule store
 * Requirements: 2.1, 8.1, 8.2, 8.3, 8.4
 * Phase 8 Requirements: 1.1, 1.2, 1.3, 1.4
 */
export const initialScheduleState: ScheduleState = {
  scheduleId: null,
  scheduleName: '',
  lessons: [],
  indexes: createEmptyIndexes(),
  metadata: null,
  statistics: null,
  teachers: new Map(),
  rooms: new Map(),
  classes: new Map(),
  subjects: new Map(),
  displaySettings: { ...DEFAULT_DISPLAY_SETTINGS },
  isLoading: false,
  error: null,

  // Phase 6: Interaction state
  interactionMode: 'idle',
  focusedSlot: null,
  selectedLesson: null,
  isLocked: false,

  // Phase 8: Edit state for undo/redo and persistence
  originalLessons: [],
  undoStack: [],
  redoStack: [],
  lastSavedAt: null,
};

/**
 * Store actions interface
 */
interface ScheduleActions {
  /**
   * Loads a schedule by ID from the API
   * Requirements: 2.2, 2.6
   */
  loadSchedule: (
    id: number,
    fetchFn: (id: number) => Promise<TimetableApiResponse>
  ) => Promise<void>;

  /**
   * Clears all schedule state to initial values
   * Requirements: 2.3
   */
  clearSchedule: () => void;

  /**
   * Rebuilds indexes from current lessons array
   * Requirements: 2.4
   */
  updateIndexes: () => void;

  /**
   * Updates display settings
   */
  setDisplaySettings: (settings: Partial<DisplaySettings>) => void;

  // Phase 6: Interaction actions (Requirements: 8.5)

  /**
   * Sets the focused slot for keyboard navigation
   */
  setFocusedSlot: (slot: FocusedSlot | null) => void;

  /**
   * Selects a lesson for editing operations
   */
  selectLesson: (lesson: ScheduledLesson | null) => void;

  /**
   * Cancels the current selection and returns to idle mode
   */
  cancelSelection: () => void;

  /**
   * Sets the lock state to prevent concurrent interactions
   */
  setLocked: (locked: boolean) => void;

  // Phase 8: Edit actions (Requirements: 3.1-3.7, 4.1-4.5, 5.1-5.5, 6.1-6.2, 15.3-15.5)

  /**
   * Executes a validated swap operation
   * Creates SwapAction, updates lessons/indexes, pushes to undoStack
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2
   */
  executeSwap: (swap: SwapOperation) => void;

  /**
   * Undoes the last swap action
   * Pops from undoStack, restores before state, pushes to redoStack
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  undo: () => void;

  /**
   * Redoes the last undone action
   * Pops from redoStack, restores after state, pushes to undoStack
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  redo: () => void;

  /**
   * Marks current state as saved
   * Updates originalLessons, clears undoStack, sets lastSavedAt
   * Requirements: 15.3, 15.4, 15.5
   */
  markAsSaved: () => void;

  /**
   * Initializes edit state when schedule is loaded
   * Sets originalLessons to current lessons, clears stacks
   * Requirements: 1.1
   */
  initializeEditState: () => void;
}

/**
 * Populates entity maps from metadata
 */
function populateEntityMaps(metadata: SolutionMetadata | null): {
  teachers: Map<string, TeacherMetadata>;
  rooms: Map<string, RoomMetadata>;
  classes: Map<string, ClassMetadata>;
  subjects: Map<string, SubjectMetadata>;
} {
  const teachers = new Map<string, TeacherMetadata>();
  const rooms = new Map<string, RoomMetadata>();
  const classes = new Map<string, ClassMetadata>();
  const subjects = new Map<string, SubjectMetadata>();

  if (metadata) {
    // Populate teachers map
    for (const teacher of metadata.teachers) {
      teachers.set(teacher.teacherId, teacher);
    }

    // Populate classes map
    for (const cls of metadata.classes) {
      classes.set(cls.classId, cls);
    }

    // Populate subjects map
    for (const subject of metadata.subjects) {
      subjects.set(subject.subjectId, subject);
    }
  }

  return { teachers, rooms, classes, subjects };
}

/**
 * Extracts room metadata from lessons (rooms are derived from lessons, not metadata)
 */
function extractRoomsFromLessons(lessons: ScheduledLesson[]): Map<string, RoomMetadata> {
  const rooms = new Map<string, RoomMetadata>();

  for (const lesson of lessons) {
    if (lesson.roomId !== null && !rooms.has(lesson.roomId)) {
      rooms.set(lesson.roomId, {
        roomId: lesson.roomId,
        roomName: lesson.roomName ?? lesson.roomId,
      });
    }
  }

  return rooms;
}

/**
 * Schedule store with Zustand and immer middleware
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export const useScheduleStore = create<ScheduleState & ScheduleActions>()(
  immer((set, get) => ({
    // Initial state
    ...initialScheduleState,

    /**
     * Loads a schedule by ID from the API
     * Requirements: 2.2, 2.6
     */
    loadSchedule: async (id: number, fetchFn: (id: number) => Promise<TimetableApiResponse>) => {
      logger.info('Loading schedule', { id });

      // Set loading state
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // Fetch schedule data
        const response = await fetchFn(id);

        // Normalize the response
        const normalized = normalizeSchedule(response);

        // Build indexes
        const indexes = buildIndexes(normalized.lessons);

        // Populate entity maps
        const entityMaps = populateEntityMaps(normalized.metadata);

        // Extract rooms from lessons
        const rooms = extractRoomsFromLessons(normalized.lessons);

        // Update state with all data
        set((state) => {
          state.scheduleId = id;
          state.scheduleName = response.name;
          state.lessons = normalized.lessons;
          state.indexes = indexes;
          state.metadata = normalized.metadata;
          state.statistics = normalized.statistics;
          state.teachers = entityMaps.teachers;
          state.rooms = rooms;
          state.classes = entityMaps.classes;
          state.subjects = entityMaps.subjects;
          state.isLoading = false;
          state.error = null;
        });

        logger.info('Schedule loaded successfully', {
          id,
          lessonsCount: normalized.lessons.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error loading schedule';
        logger.error('Failed to load schedule', { id, error: errorMessage });

        // Set error state
        set((state) => {
          state.isLoading = false;
          state.error = errorMessage;
        });
      }
    },

    /**
     * Clears all schedule state to initial values
     * Requirements: 2.3
     */
    clearSchedule: () => {
      logger.debug('Clearing schedule state');

      set((state) => {
        state.scheduleId = null;
        state.scheduleName = '';
        state.lessons = [];
        state.indexes = createEmptyIndexes();
        state.metadata = null;
        state.statistics = null;
        state.teachers = new Map();
        state.rooms = new Map();
        state.classes = new Map();
        state.subjects = new Map();
        state.displaySettings = { ...DEFAULT_DISPLAY_SETTINGS };
        state.isLoading = false;
        state.error = null;

        // Phase 6: Reset interaction state
        state.interactionMode = 'idle';
        state.focusedSlot = null;
        state.selectedLesson = null;
        state.isLocked = false;

        // Phase 8: Reset edit state
        state.originalLessons = [];
        state.undoStack = [];
        state.redoStack = [];
        state.lastSavedAt = null;
      });
    },

    /**
     * Rebuilds indexes from current lessons array
     * Requirements: 2.4
     */
    updateIndexes: () => {
      const { lessons } = get();
      logger.debug('Updating indexes', { lessonsCount: lessons.length });

      const indexes = buildIndexes(lessons);

      set((state) => {
        state.indexes = indexes;
      });
    },

    /**
     * Updates display settings
     */
    setDisplaySettings: (settings: Partial<DisplaySettings>) => {
      logger.debug('Updating display settings', { settings });

      set((state) => {
        state.displaySettings = {
          ...state.displaySettings,
          ...settings,
        };
      });
    },

    // Phase 6: Interaction actions (Requirements: 8.5)

    /**
     * Sets the focused slot for keyboard navigation
     */
    setFocusedSlot: (slot: FocusedSlot | null) => {
      logger.debug('Setting focused slot', { slot });

      set((state) => {
        state.focusedSlot = slot;
      });
    },

    /**
     * Selects a lesson for editing operations
     */
    selectLesson: (lesson: ScheduledLesson | null) => {
      logger.debug('Selecting lesson', { lesson: lesson?.subjectId });

      set((state) => {
        state.selectedLesson = lesson;
        state.interactionMode = lesson !== null ? 'selecting' : 'idle';
      });
    },

    /**
     * Cancels the current selection and returns to idle mode
     */
    cancelSelection: () => {
      logger.debug('Cancelling selection');

      set((state) => {
        state.selectedLesson = null;
        state.interactionMode = 'idle';
      });
    },

    /**
     * Sets the lock state to prevent concurrent interactions
     */
    setLocked: (locked: boolean) => {
      logger.debug('Setting lock state', { locked });

      set((state) => {
        state.isLocked = locked;
      });
    },

    // Phase 8: Edit actions (Requirements: 3.1-3.7, 4.1-4.5, 5.1-5.5, 6.1-6.2, 15.3-15.5)

    /**
     * Executes a validated swap operation
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2
     */
    executeSwap: (swap: SwapOperation) => {
      logger.info('Executing swap', {
        lessonA: swap.lessonA.subjectId,
        lessonB: swap.lessonB?.subjectId ?? 'empty',
        slotA: `${swap.slotA.day}-${swap.slotA.period}`,
        slotB: `${swap.slotB.day}-${swap.slotB.period}`,
      });

      set((state) => {
        // Create the SwapAction with before and after states
        const swapAction: SwapAction = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'swap',
          before: {
            lessonA: { ...swap.lessonA },
            lessonB: swap.lessonB ? { ...swap.lessonB } : null,
          },
          after: {
            // lessonA moves to slotB position
            lessonA: {
              ...swap.lessonA,
              day: swap.slotB.day,
              periodIndex: swap.slotB.period,
            },
            // lessonB moves to slotA position (or null if empty slot)
            lessonB: swap.lessonB
              ? {
                  ...swap.lessonB,
                  day: swap.slotA.day,
                  periodIndex: swap.slotA.period,
                }
              : null,
          },
        };

        // Update lessons array by swapping positions
        const updatedLessons = state.lessons.map((lesson) => {
          // If this is lessonA, move it to slotB
          if (
            lesson.classId === swap.lessonA.classId &&
            lesson.day === swap.lessonA.day &&
            lesson.periodIndex === swap.lessonA.periodIndex
          ) {
            return {
              ...lesson,
              day: swap.slotB.day,
              periodIndex: swap.slotB.period,
            };
          }
          // If this is lessonB, move it to slotA
          if (
            swap.lessonB &&
            lesson.classId === swap.lessonB.classId &&
            lesson.day === swap.lessonB.day &&
            lesson.periodIndex === swap.lessonB.periodIndex
          ) {
            return {
              ...lesson,
              day: swap.slotA.day,
              periodIndex: swap.slotA.period,
            };
          }
          return lesson;
        });

        state.lessons = updatedLessons;

        // Update indexes incrementally
        state.indexes = buildIndexes(updatedLessons);

        // Push to undoStack with limit enforcement (Requirements: 6.1, 6.2)
        if (state.undoStack.length >= UNDO_STACK_LIMIT) {
          // Remove oldest action (first element)
          state.undoStack.shift();
        }
        state.undoStack.push(swapAction);

        // Clear redoStack (Requirement: 3.5)
        state.redoStack = [];

        // Set interactionMode to 'idle' and clear selectedLesson (Requirements: 3.6, 3.7)
        state.interactionMode = 'idle';
        state.selectedLesson = null;
      });

      logger.info('Swap executed successfully');
    },

    /**
     * Undoes the last swap action
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     */
    undo: () => {
      const { undoStack } = get();

      // Do nothing if undoStack is empty (Requirement: 4.5)
      if (undoStack.length === 0) {
        logger.debug('Undo called but undoStack is empty');
        return;
      }

      logger.info('Undoing last action');

      set((state) => {
        // Pop from undoStack (Requirement: 4.1)
        const action = state.undoStack.pop();
        if (!action) return;

        // Restore 'before' state to lessons (Requirement: 4.2)
        const updatedLessons = state.lessons.map((lesson) => {
          // Restore lessonA to its original position
          if (
            lesson.classId === action.after.lessonA.classId &&
            lesson.day === action.after.lessonA.day &&
            lesson.periodIndex === action.after.lessonA.periodIndex
          ) {
            return {
              ...lesson,
              day: action.before.lessonA.day,
              periodIndex: action.before.lessonA.periodIndex,
            };
          }
          // Restore lessonB to its original position (if it existed)
          if (
            action.after.lessonB &&
            lesson.classId === action.after.lessonB.classId &&
            lesson.day === action.after.lessonB.day &&
            lesson.periodIndex === action.after.lessonB.periodIndex
          ) {
            return {
              ...lesson,
              day: action.before.lessonB!.day,
              periodIndex: action.before.lessonB!.periodIndex,
            };
          }
          return lesson;
        });

        state.lessons = updatedLessons;

        // Update indexes (Requirement: 4.3)
        state.indexes = buildIndexes(updatedLessons);

        // Push to redoStack (Requirement: 4.4)
        state.redoStack.push(action);
      });

      logger.info('Undo completed');
    },

    /**
     * Redoes the last undone action
     * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
     */
    redo: () => {
      const { redoStack } = get();

      // Do nothing if redoStack is empty (Requirement: 5.5)
      if (redoStack.length === 0) {
        logger.debug('Redo called but redoStack is empty');
        return;
      }

      logger.info('Redoing last undone action');

      set((state) => {
        // Pop from redoStack (Requirement: 5.1)
        const action = state.redoStack.pop();
        if (!action) return;

        // Restore 'after' state to lessons (Requirement: 5.2)
        const updatedLessons = state.lessons.map((lesson) => {
          // Move lessonA to its 'after' position
          if (
            lesson.classId === action.before.lessonA.classId &&
            lesson.day === action.before.lessonA.day &&
            lesson.periodIndex === action.before.lessonA.periodIndex
          ) {
            return {
              ...lesson,
              day: action.after.lessonA.day,
              periodIndex: action.after.lessonA.periodIndex,
            };
          }
          // Move lessonB to its 'after' position (if it existed)
          if (
            action.before.lessonB &&
            lesson.classId === action.before.lessonB.classId &&
            lesson.day === action.before.lessonB.day &&
            lesson.periodIndex === action.before.lessonB.periodIndex
          ) {
            return {
              ...lesson,
              day: action.after.lessonB!.day,
              periodIndex: action.after.lessonB!.periodIndex,
            };
          }
          return lesson;
        });

        state.lessons = updatedLessons;

        // Update indexes (Requirement: 5.3)
        state.indexes = buildIndexes(updatedLessons);

        // Push to undoStack (Requirement: 5.4)
        state.undoStack.push(action);
      });

      logger.info('Redo completed');
    },

    /**
     * Marks current state as saved
     * Requirements: 15.3, 15.4, 15.5
     */
    markAsSaved: () => {
      logger.info('Marking schedule as saved');

      set((state) => {
        // Update originalLessons to current lessons (Requirement: 15.3)
        state.originalLessons = [...state.lessons];

        // Clear undoStack (Requirement: 15.4)
        state.undoStack = [];

        // Set lastSavedAt to current timestamp (Requirement: 15.5)
        state.lastSavedAt = new Date();
      });

      logger.info('Schedule marked as saved');
    },

    /**
     * Initializes edit state when schedule is loaded
     * Requirements: 1.1
     */
    initializeEditState: () => {
      logger.debug('Initializing edit state');

      set((state) => {
        // Set originalLessons to current lessons
        state.originalLessons = [...state.lessons];

        // Clear undoStack and redoStack
        state.undoStack = [];
        state.redoStack = [];
      });
    },
  }))
);

/**
 * Helper to get initial state for testing
 */
export function getInitialScheduleState(): ScheduleState {
  return {
    ...initialScheduleState,
    indexes: createEmptyIndexes(),
    teachers: new Map(),
    rooms: new Map(),
    classes: new Map(),
    subjects: new Map(),
    displaySettings: { ...DEFAULT_DISPLAY_SETTINGS },
    // Phase 6: Interaction state
    interactionMode: 'idle',
    focusedSlot: null,
    selectedLesson: null,
    isLocked: false,
    // Phase 8: Edit state
    originalLessons: [],
    undoStack: [],
    redoStack: [],
    lastSavedAt: null,
  };
}

/**
 * Helper to create empty indexes for testing
 */
export { createEmptyIndexes };

// ============================================================================
// Phase 8: Edit State Selectors (Requirements: 1.5, 1.6, 8.3, 8.4, 8.5, 8.6)
// ============================================================================

/**
 * Selector: Get the count of unsaved changes
 * Returns the length of the undoStack
 * Requirements: 1.5
 */
export const getUnsavedChangesCount = (state: ScheduleState): number => {
  return state.undoStack.length;
};

/**
 * Selector: Check if there are unsaved changes
 * Returns true when undoStack is not empty
 * Requirements: 1.6
 */
export const getHasUnsavedChanges = (state: ScheduleState): boolean => {
  return state.undoStack.length > 0;
};

/**
 * Selector: Check if undo is available
 * Returns true when undoStack is not empty
 * Requirements: 8.3
 */
export const getCanUndo = (state: ScheduleState): boolean => {
  return state.undoStack.length > 0;
};

/**
 * Selector: Check if redo is available
 * Returns true when redoStack is not empty
 * Requirements: 8.4
 */
export const getCanRedo = (state: ScheduleState): boolean => {
  return state.redoStack.length > 0;
};
