/**
 * Zustand store for Schedule feature state management
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { DEFAULT_DISPLAY_SETTINGS } from '../constants';
import type {
  ClassMetadata,
  DayOfWeek,
  DisplaySettings,
  EnrichedLesson,
  EnrichedScheduleIndexes,
  FocusedSlot,
  LessonMove,
  NormalizedSchedule,
  RoomMetadata,
  ScheduledLesson,
  ScheduleIndexes,
  ScheduleState,
  SolutionMetadata,
  SwapConstraintContext,
  SubjectMetadata,
  SwapAction,
  SwapOperation,
  TeacherMetadata,
} from '../types';
import { UNDO_STACK_LIMIT } from '../types';
import { buildIndexes } from '../utils/indexBuilder';
import { logger } from '../utils/logger';
import {
  cloneClassMetadata,
  cloneTeacherMetadata,
} from '../utils/metadataCloners';

enableMapSet();

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
 * Creates empty enriched indexes
 * Phase 1 Enhancement: Issue #4, #5
 */
function createEmptyEnrichedIndexes(): import('../types').EnrichedScheduleIndexes {
  return {
    byClassAndSlot: new Map(),
    bySlot: new Map(),
  };
}

/**
 * Initial state for the schedule store
 * Requirements: 2.1, 8.1, 8.2, 8.3, 8.4
 * Phase 8 Requirements: 1.1, 1.2, 1.3, 1.4
 * Phase 1 Enhancement: Added enrichedLessons and enrichedIndexes
 */
export const initialScheduleState: ScheduleState = {
  scheduleId: null,
  scheduleRevision: null,
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

  // Phase 1: Pre-enriched lessons and indexes
  enrichedLessons: [],
  enrichedIndexes: createEmptyEnrichedIndexes(),

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
  pendingRecoveryDraft: null,
  draftRecovered: false,
};

/**
 * Store actions interface
 */
interface ScheduleActions {
  /**
   * Loads a schedule with pre-normalized data
   * Requirements: 2.2, 2.6
   */
  loadSchedule: (id: number, name: string, normalized: NormalizedSchedule, revision: number) => void;

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
   * Executes a move plan containing one or more lesson moves.
   * Supports multi-move swap execution while preserving undo/redo history.
   */
  executeCascadingSwap: (affectedLessons: LessonMove[]) => void;

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
  markAsSaved: (revision?: number) => void;

  /**
   * Initializes edit state when schedule is loaded
   * Sets originalLessons to current lessons, clears stacks
   * Requirements: 1.1
   */
  initializeEditState: () => void;

  /**
   * Merges backend swap constraint context into existing entity maps.
   */
  mergeConstraintContext: (context: SwapConstraintContext) => void;
  offerDraftRecovery: (lessons: ScheduledLesson[]) => void;
  recoverDraft: () => void;
  discardDraftRecovery: () => void;
}

/**
 * Enriches lessons with metadata lookups
 * Called once during loadSchedule, results cached in store
 *
 * Phase 1 Enhancement: Addresses Issue #4, #5, #13
 * - Computes display names once, not on every render
 * - Guarantees non-null display fields
 * - Provides fallbacks for missing metadata
 *
 * @param lessons - Raw lessons from solver
 * @param classes - Class metadata map
 * @param subjects - Subject metadata map
 * @param teachers - Teacher metadata map
 * @param rooms - Room metadata map
 * @returns Array of enriched lessons with guaranteed display names
 */
function enrichLessons(
  lessons: ScheduledLesson[],
  classes: Map<string, ClassMetadata>,
  subjects: Map<string, SubjectMetadata>,
  teachers: Map<string, TeacherMetadata>,
  rooms: Map<string, RoomMetadata>
): EnrichedLesson[] {
  logger.debug('Enriching lessons', { count: lessons.length });

  const enriched: EnrichedLesson[] = lessons.map((lesson, index) => {
    // Resolve class name (required - never null)
    const className =
      lesson.className || classes.get(lesson.classId)?.className || `Class ${lesson.classId}`; // Fallback

    // Resolve subject name (required - never null)
    const subjectName =
      lesson.subjectName ||
      subjects.get(lesson.subjectId)?.subjectName ||
      `Subject ${lesson.subjectId}`; // Fallback

    // Resolve teacher names (required array - never null, may be empty)
    let teacherNames: string[];
    if (lesson.teacherNames && lesson.teacherNames.length > 0) {
      teacherNames = lesson.teacherNames;
    } else {
      // Lookup from metadata
      teacherNames = lesson.teacherIds
        .map((id) => teachers.get(id)?.teacherName)
        .filter((name): name is string => name !== undefined);

      // Fallback if no names found
      if (teacherNames.length === 0) {
        teacherNames = lesson.teacherIds.map((id) => `Teacher ${id}`);
      }
    }

    // Resolve room name (nullable - some subjects have no room)
    const roomName =
      lesson.roomName || (lesson.roomId ? rooms.get(lesson.roomId)?.roomName || null : null);

    const enrichedLesson: EnrichedLesson = {
      ...lesson,
      className,
      subjectName,
      teacherNames,
      roomName,
    };

    // Validate enrichment (development only)
    if (process.env.NODE_ENV === 'development') {
      if (!className || className.length === 0) {
        logger.warn('Lesson enrichment: missing className', { index, lesson });
      }
      if (!subjectName || subjectName.length === 0) {
        logger.warn('Lesson enrichment: missing subjectName', { index, lesson });
      }
      if (teacherNames.length === 0) {
        logger.warn('Lesson enrichment: no teacher names', { index, lesson });
      }
    }

    return enrichedLesson;
  });

  logger.info('Lessons enriched successfully', {
    total: enriched.length,
    withRooms: enriched.filter((l) => l.roomName !== null).length,
  });

  return enriched;
}

/**
 * Builds enriched indexes for O(1) lookups
 * Uses enriched lessons with guaranteed display names
 *
 * Phase 1 Enhancement: Addresses Issue #4, #5
 * - Pre-computed during load, not on render
 * - Enables fast lookups without metadata queries
 * - Supports both single-class and multi-class views
 *
 * @param enrichedLessons - Array of enriched lessons
 * @returns Enriched indexes for fast lookups
 */
function buildEnrichedIndexes(enrichedLessons: EnrichedLesson[]): EnrichedScheduleIndexes {
  const byClassAndSlot = new Map<string, EnrichedLesson>();
  const bySlot = new Map<string, EnrichedLesson[]>();

  for (const lesson of enrichedLessons) {
    // Single-class lookup: "classId-day-period"
    const classSlotKey = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
    byClassAndSlot.set(classSlotKey, lesson);

    // Multi-class lookup: "day-period" (for teacher view)
    const slotKey = `${lesson.day}-${lesson.periodIndex}`;
    const existing = bySlot.get(slotKey) || [];
    existing.push(lesson);
    bySlot.set(slotKey, existing);
  }

  logger.debug('Enriched indexes built', {
    byClassAndSlot: byClassAndSlot.size,
    bySlot: bySlot.size,
  });

  return { byClassAndSlot, bySlot };
}

/**
 * Rebuilds all lesson-derived state from the current lessons and entity maps.
 * Keeps standard indexes and enriched render data in sync after edits.
 */
function deriveScheduleData(
  lessons: ScheduledLesson[],
  classes: Map<string, ClassMetadata>,
  subjects: Map<string, SubjectMetadata>,
  teachers: Map<string, TeacherMetadata>,
  rooms: Map<string, RoomMetadata>
): {
  indexes: ScheduleIndexes;
  enrichedLessons: EnrichedLesson[];
  enrichedIndexes: EnrichedScheduleIndexes;
} {
  const indexes = buildIndexes(lessons);
  const enrichedLessons = enrichLessons(lessons, classes, subjects, teachers, rooms);
  const enrichedIndexes = buildEnrichedIndexes(enrichedLessons);

  return {
    indexes,
    enrichedLessons,
    enrichedIndexes,
  };
}

/**
 * Builds the ordered list of lessons represented by a swap action state.
 */
function getActionLessons(state: SwapAction['before'] | SwapAction['after']): ScheduledLesson[] {
  if (state.lessons && state.lessons.length > 0) {
    return state.lessons;
  }

  return [state.lessonA, state.lessonB].filter((lesson): lesson is ScheduledLesson => lesson !== null);
}

/**
 * Creates a stable identifier for a lesson snapshot within an action.
 * Class/day/period is sufficient because a class cannot legally have
 * multiple lessons in the same slot.
 */
function createLessonSnapshotKey(lesson: ScheduledLesson): string {
  return `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
}

/**
 * Applies a lesson position remapping described by a swap action.
 * Used by undo/redo to restore the relevant lesson snapshots.
 */
function remapLessons(
  lessons: ScheduledLesson[],
  fromLessons: ScheduledLesson[],
  toLessons: ScheduledLesson[]
): ScheduledLesson[] {
  const targetBySourceKey = new Map<string, ScheduledLesson>();

  for (let index = 0; index < Math.min(fromLessons.length, toLessons.length); index++) {
    targetBySourceKey.set(createLessonSnapshotKey(fromLessons[index]), toLessons[index]);
  }

  return lessons.map((lesson) => {
    const targetLesson = targetBySourceKey.get(createLessonSnapshotKey(lesson));
    if (!targetLesson) {
      return lesson;
    }

    return {
      ...lesson,
      day: targetLesson.day,
      periodIndex: targetLesson.periodIndex,
    };
  });
}

/**
 * Creates a swap action from before/after lesson snapshots.
 */
function createSwapAction(beforeLessons: ScheduledLesson[], afterLessons: ScheduledLesson[]): SwapAction {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'swap',
    before: {
      lessonA: { ...beforeLessons[0] },
      lessonB: beforeLessons[1] ? { ...beforeLessons[1] } : null,
      lessons: beforeLessons.map((lesson) => ({ ...lesson })),
    },
    after: {
      lessonA: { ...afterLessons[0] },
      lessonB: afterLessons[1] ? { ...afterLessons[1] } : null,
      lessons: afterLessons.map((lesson) => ({ ...lesson })),
    },
  };
}

/**
 * Populates entity maps from metadata AND lessons
 * Ensures all entities are included, even if not in metadata
 *
 * Phase 1 Enhancement: Addresses Issue #7, #8
 * - Merges metadata with lesson-derived data
 * - Ensures completeness (all entities included)
 * - Provides fallbacks for missing metadata
 *
 * @param metadata - Solution metadata from solver
 * @param lessons - Raw lessons array
 * @returns Complete entity maps with all entities
 */
function populateEntityMaps(
  metadata: SolutionMetadata | null,
  lessons: ScheduledLesson[]
): {
  teachers: Map<string, TeacherMetadata>;
  rooms: Map<string, RoomMetadata>;
  classes: Map<string, ClassMetadata>;
  subjects: Map<string, SubjectMetadata>;
} {
  const teachers = new Map<string, TeacherMetadata>();
  const rooms = new Map<string, RoomMetadata>();
  const classes = new Map<string, ClassMetadata>();
  const subjects = new Map<string, SubjectMetadata>();

  // Step 1: Load from metadata (authoritative source)
  if (metadata) {
    // Populate teachers map
    for (const teacher of metadata.teachers) {
      teachers.set(teacher.teacherId, cloneTeacherMetadata(teacher));
    }

    // Populate classes map
    for (const cls of metadata.classes) {
      classes.set(cls.classId, cloneClassMetadata(cls));
    }

    // Populate subjects map
    for (const subject of metadata.subjects) {
      subjects.set(subject.subjectId, subject);
    }
  }

  // Step 2: Extract from lessons (ensures completeness)
  for (const lesson of lessons) {
    // Add class if missing
    if (!classes.has(lesson.classId)) {
      classes.set(lesson.classId, {
        classId: lesson.classId,
        className: lesson.className || `Class ${lesson.classId}`,
        gradeLevel: null,
        category: null,
        categoryDari: null,
        studentCount: 0,
        fixedRoomId: null,
        singleTeacherMode: false,
        classTeacherId: null,
        classTeacherName: null,
        classTeacherSubjects: null,
      });
      logger.warn('Class not in metadata, derived from lesson', {
        classId: lesson.classId,
      });
    }

    // Add subject if missing
    if (!subjects.has(lesson.subjectId)) {
      subjects.set(lesson.subjectId, {
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName || `Subject ${lesson.subjectId}`,
        isCustom: false,
        customCategory: null,
        customCategoryDari: null,
      });
      logger.warn('Subject not in metadata, derived from lesson', {
        subjectId: lesson.subjectId,
      });
    }

    // Add teachers if missing
    for (let i = 0; i < lesson.teacherIds.length; i++) {
      const teacherId = lesson.teacherIds[i];
      if (!teachers.has(teacherId)) {
        const teacherName = lesson.teacherNames?.[i] || `Teacher ${teacherId}`;
        teachers.set(teacherId, {
          teacherId,
          teacherName,
          primarySubjects: [lesson.subjectId],
          maxPeriodsPerWeek: 30, // Default
          classTeacherOf: [],
        });
        logger.warn('Teacher not in metadata, derived from lesson', {
          teacherId,
        });
      }
    }

    // Add room if present and missing
    if (lesson.roomId && !rooms.has(lesson.roomId)) {
      rooms.set(lesson.roomId, {
        roomId: lesson.roomId,
        roomName: lesson.roomName || `Room ${lesson.roomId}`,
      });
      logger.warn('Room not in metadata, derived from lesson', {
        roomId: lesson.roomId,
      });
    }
  }

  logger.info('Entity maps populated', {
    teachers: teachers.size,
    rooms: rooms.size,
    classes: classes.size,
    subjects: subjects.size,
  });

  return { teachers, rooms, classes, subjects };
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
     * Loads a schedule with pre-normalized data
     * Requirements: 2.2, 2.6
     * Phase 1 Enhancement: Enriches lessons once during load
     */
    loadSchedule: (id: number, name: string, normalized: NormalizedSchedule, revision: number) => {
      logger.info('Loading schedule', { id, name });

      // Populate entity maps from metadata AND lessons (Issue #7, #8)
      const entityMaps = populateEntityMaps(normalized.metadata, normalized.lessons);

      const derivedData = deriveScheduleData(
        normalized.lessons,
        entityMaps.classes,
        entityMaps.subjects,
        entityMaps.teachers,
        entityMaps.rooms
      );

      // Update state with all data
      set((state) => {
        state.scheduleId = id;
        state.scheduleRevision = revision;
        state.scheduleName = name;
        state.lessons = normalized.lessons;
        state.indexes = derivedData.indexes;
        state.metadata = normalized.metadata;
        state.statistics = normalized.statistics;
        state.teachers = entityMaps.teachers;
        state.rooms = entityMaps.rooms;
        state.classes = entityMaps.classes;
        state.subjects = entityMaps.subjects;
        state.isLoading = false;
        state.error = null;
        state.pendingRecoveryDraft = null;
        state.draftRecovered = false;

        // Phase 1: Store enriched data
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;
      });

      logger.info('Schedule loaded successfully', {
        id,
        lessonsCount: normalized.lessons.length,
        enrichedCount: derivedData.enrichedLessons.length,
        classesCount: entityMaps.classes.size,
        teachersCount: entityMaps.teachers.size,
        roomsCount: entityMaps.rooms.size,
        subjectsCount: entityMaps.subjects.size,
      });
    },

    /**
     * Clears all schedule state to initial values
     * Requirements: 2.3
     */
    clearSchedule: () => {
      logger.debug('Clearing schedule state');

      set((state) => {
        state.scheduleId = null;
        state.scheduleRevision = null;
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

        // Phase 1: Clear enriched data
        state.enrichedLessons = [];
        state.enrichedIndexes = createEmptyEnrichedIndexes();

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
        state.pendingRecoveryDraft = null;
        state.draftRecovered = false;
      });
    },

    /**
     * Rebuilds indexes from current lessons array
     * Requirements: 2.4
     */
    updateIndexes: () => {
      const { lessons, classes, subjects, teachers, rooms } = get();
      logger.debug('Updating indexes', { lessonsCount: lessons.length });

      const derivedData = deriveScheduleData(lessons, classes, subjects, teachers, rooms);

      set((state) => {
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;
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
        const beforeLessons = [swap.lessonA, swap.lessonB].filter(
          (lesson): lesson is ScheduledLesson => lesson !== null
        );
        const afterLessons = beforeLessons.map((lesson) => {
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

          return {
            ...lesson,
            day: swap.slotA.day,
            periodIndex: swap.slotA.period,
          };
        });
        const swapAction = createSwapAction(beforeLessons, afterLessons);

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

        const derivedData = deriveScheduleData(
          updatedLessons,
          state.classes,
          state.subjects,
          state.teachers,
          state.rooms
        );
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;

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
     * Executes a validated cascading swap operation
     * Handles multiple lesson moves from solver resolution
     * Phase 5: Requirements: 5.1, 5.2, 5.3, 5.4
     */
    executeCascadingSwap: (affectedLessons: LessonMove[]) => {
      logger.info('Executing cascading swap', {
        totalMoves: affectedLessons.length,
      });

      set((state) => {
        // Collect all lessons in their 'before' state
        const beforeLessons: ScheduledLesson[] = [];
        const afterLessons: ScheduledLesson[] = [];

        for (const move of affectedLessons) {
          const lesson = state.lessons.find(
            (l) =>
              l.classId === move.class_id &&
              l.day === move.from_day &&
              l.periodIndex === move.from_period
          );

          if (lesson) {
            // Store before state
            beforeLessons.push({ ...lesson });

            // Store after state (with new position)
            afterLessons.push({
              ...lesson,
              day: move.to_day as DayOfWeek,
              periodIndex: move.to_period,
            });
          }
        }

        if (beforeLessons.length === 0 || afterLessons.length === 0) {
          logger.warn('Skipping cascading swap because no matching lessons were found');
          return;
        }

        const swapAction = createSwapAction(beforeLessons, afterLessons);

        // Update all affected lessons atomically
        const updatedLessons = state.lessons.map((lesson) => {
          const move = affectedLessons.find(
            (m) =>
              m.class_id === lesson.classId &&
              m.from_day === lesson.day &&
              m.from_period === lesson.periodIndex
          );

          if (move) {
            return {
              ...lesson,
              day: move.to_day as DayOfWeek,
              periodIndex: move.to_period,
            };
          }

          return lesson;
        });

        state.lessons = updatedLessons;

        const derivedData = deriveScheduleData(
          updatedLessons,
          state.classes,
          state.subjects,
          state.teachers,
          state.rooms
        );
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;

        // Push to undoStack with limit enforcement
        if (state.undoStack.length >= UNDO_STACK_LIMIT) {
          state.undoStack.shift();
        }
        state.undoStack.push(swapAction);

        // Clear redoStack
        state.redoStack = [];

        // Reset interaction state
        state.interactionMode = 'idle';
        state.selectedLesson = null;
      });

      logger.info('Cascading swap executed successfully');
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

        const beforeLessons = getActionLessons(action.before);
        const afterLessons = getActionLessons(action.after);

        // Restore 'before' state to lessons (Requirement: 4.2)
        const updatedLessons = remapLessons(state.lessons, afterLessons, beforeLessons);

        state.lessons = updatedLessons;

        const derivedData = deriveScheduleData(
          updatedLessons,
          state.classes,
          state.subjects,
          state.teachers,
          state.rooms
        );
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;

        // Push to redoStack (Requirement: 4.4)
        state.redoStack.push(action);
        state.interactionMode = 'idle';
        state.selectedLesson = null;
        state.isLocked = false;
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

        const beforeLessons = getActionLessons(action.before);
        const afterLessons = getActionLessons(action.after);

        // Restore 'after' state to lessons (Requirement: 5.2)
        const updatedLessons = remapLessons(state.lessons, beforeLessons, afterLessons);

        state.lessons = updatedLessons;

        const derivedData = deriveScheduleData(
          updatedLessons,
          state.classes,
          state.subjects,
          state.teachers,
          state.rooms
        );
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;

        // Push to undoStack (Requirement: 5.4)
        state.undoStack.push(action);
        state.interactionMode = 'idle';
        state.selectedLesson = null;
        state.isLocked = false;
      });

      logger.info('Redo completed');
    },

    /**
     * Marks current state as saved
     * Requirements: 15.3, 15.4, 15.5
     */
    markAsSaved: (revision?: number) => {
      logger.info('Marking schedule as saved');

      set((state) => {
        // Update originalLessons to current lessons (Requirement: 15.3)
        state.originalLessons = [...state.lessons];

        // Clear undoStack (Requirement: 15.4)
        state.undoStack = [];
        state.redoStack = [];

        // Set lastSavedAt to current timestamp (Requirement: 15.5)
        state.lastSavedAt = new Date();
        if (revision !== undefined) state.scheduleRevision = revision;
        state.draftRecovered = false;
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

    offerDraftRecovery: (lessons: ScheduledLesson[]) => {
      set((state) => {
        state.pendingRecoveryDraft = lessons;
      });
    },

    recoverDraft: () => {
      const { pendingRecoveryDraft, classes, subjects, teachers, rooms } = get();
      if (!pendingRecoveryDraft) return;
      const derivedData = deriveScheduleData(
        pendingRecoveryDraft,
        classes,
        subjects,
        teachers,
        rooms
      );
      set((state) => {
        state.lessons = pendingRecoveryDraft;
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;
        state.pendingRecoveryDraft = null;
        state.draftRecovered = true;
      });
    },

    discardDraftRecovery: () => {
      set((state) => {
        state.pendingRecoveryDraft = null;
      });
    },

    mergeConstraintContext: (context: SwapConstraintContext) => {
      logger.debug('Merging swap constraint context', {
        teachers: context.teachers.length,
        subjects: context.subjects.length,
        rooms: context.rooms.length,
        classes: context.classes.length,
      });

      set((state) => {
        for (const teacher of context.teachers) {
          const current = state.teachers.get(teacher.teacherId);
          if (!current) continue;

          const nextTeacher = cloneTeacherMetadata(current);

          state.teachers.set(teacher.teacherId, {
            ...nextTeacher,
            unavailable: teacher.unavailable
              ? teacher.unavailable.map((slot) => ({ ...slot }))
              : nextTeacher.unavailable,
            timePreference: teacher.timePreference ?? nextTeacher.timePreference ?? 'None',
          });
        }

        for (const subject of context.subjects) {
          const current = state.subjects.get(subject.subjectId);
          if (!current) continue;

          state.subjects.set(subject.subjectId, {
            ...current,
            requiredRoomType: subject.requiredRoomType ?? current.requiredRoomType ?? null,
            isDifficult: subject.isDifficult ?? current.isDifficult ?? false,
          });
        }

        for (const room of context.rooms) {
          const current = state.rooms.get(room.roomId);
          if (!current) continue;

          state.rooms.set(room.roomId, {
            ...current,
            roomName: room.roomName || current.roomName,
            type: room.type ?? current.type ?? 'normal',
          });
        }

        for (const classGroup of context.classes) {
          const current = state.classes.get(classGroup.classId);
          if (!current) continue;

          state.classes.set(classGroup.classId, {
            ...current,
            fixedRoomId: classGroup.fixedRoomId ?? null,
          });
        }

        const derivedData = deriveScheduleData(
          state.lessons,
          state.classes,
          state.subjects,
          state.teachers,
          state.rooms
        );
        state.indexes = derivedData.indexes;
        state.enrichedLessons = derivedData.enrichedLessons;
        state.enrichedIndexes = derivedData.enrichedIndexes;
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
  return state.undoStack.length + (state.draftRecovered ? 1 : 0);
};

/**
 * Selector: Check if there are unsaved changes
 * Returns true when undoStack is not empty
 * Requirements: 1.6
 */
export const getHasUnsavedChanges = (state: ScheduleState): boolean => {
  return state.undoStack.length > 0 || state.draftRecovered;
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
