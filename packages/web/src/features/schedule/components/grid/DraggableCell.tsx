/**
 * DraggableCell - A draggable wrapper for ScheduleCell
 *
 * Wraps ScheduleCell with dnd-kit's useDraggable hook to enable
 * drag-and-drop functionality for schedule lessons.
 *
 * Requirements: 4.3
 */

import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { memo } from 'react';

import type { DragData } from '../../hooks/useDragDrop';
import type {
  CellValidationStatus,
  DayOfWeek,
  DisplaySettings,
  ScheduledLesson,
} from '../../types';
import { ScheduleCell } from './ScheduleCell';

/**
 * Props for DraggableCell component
 */
export interface DraggableCellProps {
  /** Unique identifier for the cell (format: "${day}-${period}") */
  id: string;
  /** Day of the week for this cell */
  day: DayOfWeek;
  /** Period index for this cell */
  period: number;
  /** Lesson data for this cell (null if empty) */
  lesson: ScheduledLesson | null;
  /** Display settings for rendering */
  displaySettings: DisplaySettings;
  /** Whether this cell is selected */
  isSelected?: boolean;
  /** Whether this cell is focused (keyboard navigation) */
  isFocused?: boolean;
  /** Whether this cell is highlighted */
  isHighlighted?: boolean;
  /** Validation status for the cell */
  validationStatus?: CellValidationStatus;
  /** Whether dragging is disabled (e.g., when locked and not the dragged item) */
  disabled?: boolean;
  /** View scope for drag data */
  viewScope: 'class' | 'teacher';
  /** View ID for drag data */
  viewId: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the cell is read-only */
  isReadOnly?: boolean;
}

/**
 * Custom comparison function for React.memo
 * Only re-renders when relevant props change
 */
function arePropsEqual(prevProps: DraggableCellProps, nextProps: DraggableCellProps): boolean {
  // Compare primitive props
  if (
    prevProps.id !== nextProps.id ||
    prevProps.day !== nextProps.day ||
    prevProps.period !== nextProps.period ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isFocused !== nextProps.isFocused ||
    prevProps.isHighlighted !== nextProps.isHighlighted ||
    prevProps.validationStatus !== nextProps.validationStatus ||
    prevProps.disabled !== nextProps.disabled ||
    prevProps.viewScope !== nextProps.viewScope ||
    prevProps.viewId !== nextProps.viewId ||
    prevProps.isReadOnly !== nextProps.isReadOnly ||
    prevProps.onClick !== nextProps.onClick
  ) {
    return false;
  }

  // Compare lesson by reference or key fields
  if (prevProps.lesson !== nextProps.lesson) {
    if (!prevProps.lesson || !nextProps.lesson) return false;
    if (
      prevProps.lesson.subjectId !== nextProps.lesson.subjectId ||
      prevProps.lesson.subjectName !== nextProps.lesson.subjectName ||
      prevProps.lesson.className !== nextProps.lesson.className ||
      prevProps.lesson.roomId !== nextProps.lesson.roomId ||
      prevProps.lesson.roomName !== nextProps.lesson.roomName ||
      prevProps.lesson.teacherIds.join() !== nextProps.lesson.teacherIds.join() ||
      prevProps.lesson.teacherNames?.join() !== nextProps.lesson.teacherNames?.join() ||
      prevProps.lesson.isFixed !== nextProps.lesson.isFixed
    ) {
      return false;
    }
  }

  // Compare display settings
  if (
    prevProps.displaySettings.showSubjectName !== nextProps.displaySettings.showSubjectName ||
    prevProps.displaySettings.showTeacherName !== nextProps.displaySettings.showTeacherName ||
    prevProps.displaySettings.showRoomName !== nextProps.displaySettings.showRoomName ||
    prevProps.displaySettings.cellSize !== nextProps.displaySettings.cellSize ||
    prevProps.displaySettings.fontSize !== nextProps.displaySettings.fontSize ||
    prevProps.displaySettings.colorBy !== nextProps.displaySettings.colorBy
  ) {
    return false;
  }

  return true;
}

/**
 * DraggableCell - Wraps ScheduleCell with drag functionality
 *
 * Features:
 * - Enables drag-and-drop for cells with lessons
 * - Applies drag styles (opacity, scale) when dragging
 * - Disables dragging when locked and not the dragged item
 * - Passes drag data with lesson and source slot information
 *
 * Requirements: 4.3
 */
export const DraggableCell = memo(function DraggableCell({
  id,
  day,
  period,
  lesson,
  displaySettings,
  isSelected = false,
  isFocused = false,
  isHighlighted = false,
  validationStatus,
  disabled = false,
  viewScope,
  viewId,
  onClick,
  isReadOnly = true,
}: DraggableCellProps) {
  // Only enable dragging for cells with lessons
  const canDrag = lesson !== null && !lesson.isFixed && !disabled && !isReadOnly;

  // Build drag data for the lesson
  const dragData: DragData | undefined = lesson
    ? {
        type: 'lesson',
        lesson,
        sourceSlot: { day, period },
        viewScope,
        viewId,
      }
    : undefined;

  // Use dnd-kit's useDraggable hook
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !canDrag,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      className={cn(
        // Base styles for the draggable wrapper
        'touch-none',
        // Drag styles - Requirement 4.3: reduced opacity and scale when dragging
        isDragging && 'opacity-50 scale-95 z-50',
        // Disabled state styling
        disabled && lesson && 'cursor-not-allowed'
      )}
    >
      <ScheduleCell
        lesson={lesson}
        displaySettings={displaySettings}
        viewScope={viewScope}
        isSelected={isSelected}
        isFocused={isFocused}
        isHighlighted={isHighlighted}
        validationStatus={validationStatus}
        onClick={onClick}
        isReadOnly={isReadOnly || disabled}
      />
    </div>
  );
}, arePropsEqual);

export default DraggableCell;
