import { cn } from '@/lib/utils';
import { AlertTriangle, Ban } from 'lucide-react';
import { memo } from 'react';
import { FONT_SIZE_MAP } from '../../constants';
import type { ScheduleCellProps } from '../../types';
import { generateEntityColor, getContrastTextColor } from '../../utils/colorUtils';
import { SwapIndicator } from './SwapIndicator';

/**
 * Custom comparison function for React.memo
 * Only re-renders when relevant props change
 */
function arePropsEqual(prevProps: ScheduleCellProps, nextProps: ScheduleCellProps): boolean {
  // Compare lesson by reference or key fields
  if (prevProps.lesson !== nextProps.lesson) {
    if (!prevProps.lesson || !nextProps.lesson) return false;
    if (
      prevProps.lesson.subjectId !== nextProps.lesson.subjectId ||
      prevProps.lesson.subjectName !== nextProps.lesson.subjectName ||
      prevProps.lesson.roomId !== nextProps.lesson.roomId ||
      prevProps.lesson.roomName !== nextProps.lesson.roomName ||
      prevProps.lesson.teacherIds.length !== nextProps.lesson.teacherIds.length ||
      prevProps.lesson.teacherNames?.join() !== nextProps.lesson.teacherNames?.join()
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

  // Compare visual states (including Phase 6 drag-drop states and Phase 7 swap states)
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.validationStatus === nextProps.validationStatus &&
    prevProps.isReadOnly === nextProps.isReadOnly &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDropTarget === nextProps.isDropTarget &&
    prevProps.day === nextProps.day &&
    prevProps.period === nextProps.period &&
    prevProps.onSwapAttempt === nextProps.onSwapAttempt
  );
}

/**
 * ScheduleCell - Renders a single cell in the schedule grid
 *
 * Displays lesson information (subject, teacher, room) with visual states
 * for selection, focus, highlighting, and validation status.
 */
export const ScheduleCell = memo(function ScheduleCell({
  lesson,
  displaySettings,
  isSelected = false,
  isFocused = false,
  isHighlighted = false,
  validationStatus = null,
  onClick,
  isReadOnly = true,
  isDragging = false,
  isDropTarget = false,
  onSwapAttempt,
  day,
  period,
}: ScheduleCellProps) {
  const { showSubjectName, showTeacherName, showRoomName, cellSize, fontSize, colorBy } =
    displaySettings;

  const isEmpty = !lesson;

  // Build teacher display string
  const teacherDisplay = lesson?.teacherNames?.join('، ') || '';

  // Get font size class from mapping
  const fontSizeClass = FONT_SIZE_MAP[fontSize];

  // Generate color coding based on settings
  let backgroundColor = '';
  let textColor = '';

  if (!isEmpty && colorBy !== 'none' && lesson) {
    if (colorBy === 'subject' && lesson.subjectId) {
      backgroundColor = generateEntityColor(lesson.subjectId);
      textColor = getContrastTextColor(backgroundColor);
    } else if (colorBy === 'teacher' && lesson.teacherIds.length > 0) {
      // Use the first teacher ID for color generation
      backgroundColor = generateEntityColor(lesson.teacherIds[0]);
      textColor = getContrastTextColor(backgroundColor);
    }
  }

  // Handle click with swap attempt support
  const handleClick = () => {
    // If onSwapAttempt is provided and we have day/period, call it
    if (onSwapAttempt && day !== undefined && period !== undefined) {
      onSwapAttempt({ day, period });
    }
    // Also call the regular onClick if provided
    onClick?.();
  };

  return (
    <div
      role="gridcell"
      tabIndex={isReadOnly ? -1 : 0}
      onClick={handleClick}
      className={cn(
        // Base styles
        'relative flex flex-col items-center justify-center p-1 border border-border/50 rounded-sm transition-all',
        'overflow-hidden',

        // Empty cell styling
        isEmpty && 'bg-muted/30',

        // Normal filled cell (only if no color coding)
        !isEmpty && !backgroundColor && 'bg-card',

        // Hover state
        !isReadOnly && 'cursor-pointer hover:bg-accent/50',
        isReadOnly && !isEmpty && 'hover:bg-accent/20',

        // Selected state
        isSelected && 'ring-2 ring-primary ring-offset-1 bg-primary/10',

        // Focused state
        isFocused && 'ring-2 ring-ring ring-offset-2 outline-none',

        // Highlighted state (e.g., same teacher across grid)
        isHighlighted && !isSelected && 'bg-accent/40 border-accent',

        // Phase 6: Drag-drop visual states
        // Dragging state - reduced opacity and scale
        isDragging && 'opacity-50 scale-95',

        // Drop target state - subtle background highlight
        isDropTarget && 'bg-primary/5'
      )}
      style={{
        minHeight: 'var(--cell-min-height, 60px)',
        ...(backgroundColor && {
          backgroundColor,
          color: textColor,
        }),
      }}
      aria-selected={isSelected}
      aria-readonly={isReadOnly}
    >
      {/* Phase 7: SwapIndicator overlay for validation status */}
      <SwapIndicator status={validationStatus ?? null} />

      {/* Validation status icons (warning/blocked) */}
      {validationStatus === 'warning' && (
        <div className="absolute top-0.5 end-0.5 z-20" title="هشدار">
          <AlertTriangle className="h-3 w-3 text-yellow-600" />
        </div>
      )}
      {validationStatus === 'blocked' && (
        <div className="absolute top-0.5 end-0.5 z-20" title="مسدود">
          <Ban className="h-3 w-3 text-destructive" />
        </div>
      )}

      {/* Cell content */}
      {!isEmpty && (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 text-center w-full px-1',
            fontSizeClass
          )}
        >
          {/* Subject name - prominent */}
          {showSubjectName && lesson.subjectName && (
            <span className="font-medium text-foreground truncate w-full leading-tight">
              {lesson.subjectName}
            </span>
          )}

          {/* Teacher name - smaller */}
          {showTeacherName && teacherDisplay && (
            <span className="text-muted-foreground truncate w-full leading-tight text-[0.9em]">
              {teacherDisplay}
            </span>
          )}

          {/* Room name - smallest */}
          {showRoomName && lesson.roomName && (
            <span className="text-muted-foreground/70 truncate w-full leading-tight text-[0.8em]">
              {lesson.roomName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}, arePropsEqual);

export default ScheduleCell;
