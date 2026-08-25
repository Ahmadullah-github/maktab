/**
 * Hook for drag-and-drop functionality in the schedule grid
 *
 * Configures dnd-kit sensors and handles drag events:
 * - onDragStart: set lock, select lesson
 * - onDragEnd: unlock, prepare for swap
 * - onDragCancel: reset state
 *
 * Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.4
 */

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { useCallback } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type { DayOfWeek, FocusedSlot, ScheduledLesson } from '../types';

/**
 * Drag data attached to draggable items
 */
export interface DragData {
  type: 'lesson';
  lesson: ScheduledLesson;
  sourceSlot: FocusedSlot;
  viewScope: 'class' | 'teacher';
  viewId: string;
}

/**
 * Options for the useDragDrop hook
 */
export interface UseDragDropOptions {
  /** View scope for drop validation (class or teacher view) */
  viewScope: 'class' | 'teacher';
  /** ID of the current view (classId or teacherId) */
  viewId: string;
  /** Callback when a valid drop occurs (for swap operation in Phase 7) */
  onDropComplete?: (source: DragData, targetSlot: FocusedSlot) => void;
}

/**
 * Return type for the useDragDrop hook
 */
export interface UseDragDropReturn {
  /** Configured dnd-kit sensors */
  sensors: SensorDescriptor<SensorOptions>[];
  /** Handler for drag start event */
  handleDragStart: (event: DragStartEvent) => void;
  /** Handler for drag end event */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Handler for drag cancel event */
  handleDragCancel: () => void;
}

/**
 * Create a cell ID from day and period
 */
export function createCellId(day: DayOfWeek, period: number): string {
  return `${day}-${period}`;
}

/**
 * Parse a cell ID into day and period
 */
export function parseCellId(id: string): FocusedSlot | null {
  const parts = id.split('-');
  if (parts.length < 2) {
    return null;
  }

  // Day is everything except the last part (period)
  const periodStr = parts[parts.length - 1];
  const day = parts.slice(0, -1).join('-');
  const period = parseInt(periodStr, 10);

  if (isNaN(period) || period < 0) {
    return null;
  }

  // Validate day is a valid DayOfWeek
  const validDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (!validDays.includes(day)) {
    return null;
  }

  return { day: day as DayOfWeek, period };
}

/**
 * Validate if a drop is valid based on view scope
 * Drops are only valid within the same view scope
 *
 * Requirements: 5.1, 5.4
 */
export function isValidDrop(
  sourceDragData: DragData,
  targetViewScope: 'class' | 'teacher',
  targetViewId: string
): boolean {
  // Drop is valid only if source and target are in the same view scope
  return sourceDragData.viewScope === targetViewScope && sourceDragData.viewId === targetViewId;
}

/**
 * Hook for drag-and-drop functionality in the schedule grid
 *
 * Manages drag operations using dnd-kit, including:
 * - Sensor configuration (pointer and keyboard)
 * - Lock state management during drag
 * - Lesson selection on drag start
 * - State reset on drag cancel
 *
 * Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.4
 *
 * @param options - Drag-drop configuration
 * @returns Object with sensors and event handlers
 */
export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const { viewScope, viewId, onDropComplete } = options;

  // Get store actions
  const selectLesson = useScheduleStore((state) => state.selectLesson);
  const cancelSelection = useScheduleStore((state) => state.cancelSelection);
  const setLocked = useScheduleStore((state) => state.setLocked);

  // Configure sensors with activation constraints
  // Pointer sensor requires 8px movement to start drag (prevents accidental drags)
  // Keyboard sensor allows drag via keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  /**
   * Handle drag start event
   * Requirements: 4.1, 4.2
   *
   * - Sets lock state to true to prevent concurrent interactions
   * - Selects the dragged lesson
   */
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dragData = event.active.data.current as DragData | undefined;

      if (!dragData || dragData.type !== 'lesson') {
        return;
      }

      // Requirement 4.2: Set lock state to prevent concurrent interactions
      setLocked(true);

      // Requirement 4.1: Select the dragged lesson
      selectLesson(dragData.lesson);
    },
    [setLocked, selectLesson]
  );

  /**
   * Handle drag end event
   * Requirements: 4.5, 5.1, 5.4
   *
   * - Unlocks the state
   * - Validates drop target
   * - Initiates swap if valid (Phase 7)
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Requirement 4.5: Always unlock on drag end
      setLocked(false);

      // If no drop target, just unlock (don't cancel selection)
      if (!over) {
        return;
      }

      const dragData = active.data.current as DragData | undefined;
      if (!dragData || dragData.type !== 'lesson') {
        return;
      }

      // Parse the drop target cell ID
      const targetSlot = parseCellId(over.id as string);
      if (!targetSlot) {
        return;
      }

      // Requirement 5.1, 5.4: Validate drop is within same view scope
      if (!isValidDrop(dragData, viewScope, viewId)) {
        // Invalid drop - cancel selection and return to idle
        cancelSelection();
        return;
      }

      // Valid drop - call the completion callback (Phase 7 will handle swap)
      if (onDropComplete) {
        onDropComplete(dragData, targetSlot);
      }
    },
    [viewScope, viewId, setLocked, cancelSelection, onDropComplete]
  );

  /**
   * Handle drag cancel event
   * Requirement: 4.6
   *
   * - Unlocks the state
   * - Clears selection
   * - Returns to idle mode
   */
  const handleDragCancel = useCallback(() => {
    // Requirement 4.6: Reset state on cancel
    setLocked(false);
    cancelSelection();
  }, [setLocked, cancelSelection]);

  return {
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
