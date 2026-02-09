import { cn } from '@/lib/utils';
import { AlertTriangle, Ban, Building2, Plus, User } from 'lucide-react';
import { memo, useMemo } from 'react';
import { FONT_SIZE_MAP } from '../../constants';
import type { ScheduleCellProps } from '../../types';
import { generateEntityColor, getContrastTextColor } from '../../utils/colorUtils';
import { getRoomIcon } from '../../utils/roomIcons';
import { getSubjectColors } from '../../utils/subjectColors';
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
  // Phase 3: Issue #16 - Handle overflow with "+N more" indicator
  const teacherDisplay = useMemo(() => {
    if (!lesson?.teacherNames || lesson.teacherNames.length === 0) return '';

    if (lesson.teacherNames.length <= 2) {
      return lesson.teacherNames.join('، ');
    }

    // Show first teacher + count of remaining
    return `${lesson.teacherNames[0]} +${lesson.teacherNames.length - 1}`;
  }, [lesson?.teacherNames]);

  // Get font size class from mapping
  const fontSizeClass = FONT_SIZE_MAP[fontSize];

  // Adjust padding based on cell size - AGGRESSIVE reduction for better density
  const paddingClass = cellSize === 'compact' ? 'p-1.5' : cellSize === 'large' ? 'p-3' : 'p-2';

  // Generate color coding based on settings
  let backgroundColor = '';
  let textColor = '';
  let subjectColors = null;

  if (!isEmpty && lesson) {
    if (colorBy === 'subject' && lesson.subjectId) {
      // Legacy: Use old color generation for backward compatibility
      backgroundColor = generateEntityColor(lesson.subjectId);
      textColor = getContrastTextColor(backgroundColor);
    } else if (colorBy === 'teacher' && lesson.teacherIds.length > 0) {
      // Legacy: Use the first teacher ID for color generation
      backgroundColor = generateEntityColor(lesson.teacherIds[0]);
      textColor = getContrastTextColor(backgroundColor);
    } else if (lesson.subjectName) {
      // Default: Use new intelligent per-subject color system
      // Works for both colorBy='none' and as fallback
      subjectColors = getSubjectColors(lesson.subjectName);
    }
  }

  // Phase 3: Issue #11 - Get room icon with fallback
  const RoomIcon = useMemo(() => {
    if (!lesson?.roomName) return Building2; // Fallback icon for null rooms
    return getRoomIcon(lesson.roomName);
  }, [lesson?.roomName]);

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
        // Base styles - Modern card design with dynamic padding
        'relative flex flex-col items-start justify-center rounded-lg transition-all',
        'overflow-hidden',
        paddingClass,

        // Empty cell styling - dashed border with subtle background
        isEmpty && 'border-2 border-dashed border-border bg-muted/20',

        // Phase 7: BLOCKED cells - Pure red with reduced opacity (highest priority)
        validationStatus === 'blocked' &&
          !isEmpty &&
          'bg-red-500/20 border-2 border-red-600 ring-2 ring-red-500/30 shadow-lg',

        // Normal filled cell WITHOUT custom colors - card appearance with shadow
        !isEmpty &&
          !backgroundColor &&
          !subjectColors &&
          validationStatus !== 'blocked' &&
          'bg-card shadow-card border border-border',

        // Cells WITH inline styles (new subject color system) - only add shadow and border
        !isEmpty && subjectColors?.style && validationStatus !== 'blocked' && 'shadow-card border',

        // Legacy: Old color coding with backgroundColor variable
        !isEmpty && backgroundColor && validationStatus !== 'blocked' && 'shadow-card border',

        // Hover state - lift effect (disabled for blocked cells)
        !isReadOnly &&
          validationStatus !== 'blocked' &&
          'cursor-pointer hover:shadow-card-hover hover:scale-[1.02]',
        isReadOnly && !isEmpty && 'hover:shadow-card-hover',

        // Blocked cells have different cursor
        validationStatus === 'blocked' && 'cursor-not-allowed',

        // Selected state
        isSelected && 'ring-2 ring-primary ring-offset-1',

        // Focused state
        isFocused && 'ring-2 ring-ring ring-offset-2 outline-none',

        // Highlighted state (e.g., same teacher across grid)
        isHighlighted && !isSelected && 'ring-2 ring-accent',

        // Phase 6: Drag-drop visual states
        // Dragging state - reduced opacity and scale
        isDragging && 'opacity-50 scale-95',

        // Drop target state - subtle background highlight
        isDropTarget && 'ring-2 ring-primary/50 bg-primary/5'
      )}
      style={{
        minHeight: cellSize === 'compact' ? '60px' : cellSize === 'large' ? '80px' : '70px',
        // Blocked cells override all color styles with pure red
        ...(validationStatus === 'blocked'
          ? {
              backgroundColor: 'rgba(239, 68, 68, 0.15)', // Pure red with 15% opacity
              borderColor: '#dc2626', // Pure red-600
            }
          : {
              // Apply inline styles for subject colors (Tailwind v4 compatibility)
              ...(subjectColors?.style || {}),
              // Old color coding takes precedence if set
              ...(backgroundColor && {
                backgroundColor,
                color: textColor,
              }),
            }),
      }}
      aria-selected={isSelected}
      aria-readonly={isReadOnly}
    >
      {/* Phase 7: SwapIndicator overlay for validation status */}
      <SwapIndicator status={validationStatus ?? null} />

      {/* Empty cell content - Phase 3: Issue #10 - Context-aware icon */}
      {isEmpty && !isReadOnly && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-1">
          <Plus className="h-5 w-5 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/60">اضافه کردن</span>
        </div>
      )}
      {isEmpty && isReadOnly && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-1">
          <svg
            className="h-5 w-5 text-muted-foreground/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
          <span className="text-[10px] text-muted-foreground/50">خالی</span>
        </div>
      )}

      {/* Validation status icons (warning/blocked) */}
      {validationStatus === 'warning' && (
        <div className="absolute top-1 end-1 z-20 bg-yellow-100 rounded-full p-0.5" title="هشدار">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        </div>
      )}
      {validationStatus === 'blocked' && (
        <div
          className="absolute top-1 end-1 z-20 bg-red-100 rounded-full p-0.5 shadow-md"
          title="مسدود"
        >
          <Ban className="h-5 w-5 text-red-600 font-bold" />
        </div>
      )}

      {/* Cell content */}
      {!isEmpty && (
        <div
          className={cn(
            'flex flex-col w-full',
            cellSize === 'compact' ? 'gap-1' : 'gap-1.5',
            fontSizeClass
          )}
        >
          {/* Class name - MOST PROMINENT for teacher view */}
          {lesson.className && (
            <span
              className={cn(
                'font-extrabold leading-tight truncate',
                cellSize === 'compact' ? 'text-lg' : cellSize === 'large' ? 'text-2xl' : 'text-xl',
                // High contrast for maximum visibility
                'text-foreground'
              )}
            >
              {lesson.className}
            </span>
          )}

          {/* Subject name with book icon - smaller, secondary */}
          {showSubjectName && lesson.subjectName && (
            <div className={cn('flex items-center gap-1')}>
              <svg
                className={cn('shrink-0', cellSize === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span
                className={cn(
                  'font-medium truncate leading-tight',
                  cellSize === 'compact' ? 'text-xs' : 'text-sm',
                  // Only apply text color class if NOT using subject colors
                  !subjectColors && 'text-slate-700'
                )}
              >
                {lesson.subjectName}
              </span>
            </div>
          )}

          {/* Teacher name with icon - medium size (hide in teacher view if className is shown) */}
          {showTeacherName && teacherDisplay && !lesson.className && (
            <div className={cn('flex items-center', cellSize === 'compact' ? 'gap-1' : 'gap-1.5')}>
              <User
                className={cn(
                  'text-slate-700 shrink-0',
                  cellSize === 'compact' ? 'h-3 w-3' : 'h-4 w-4'
                )}
              />
              <span
                className={cn(
                  'font-medium text-slate-700 truncate leading-tight',
                  cellSize === 'compact' ? 'text-xs' : 'text-sm'
                )}
              >
                {teacherDisplay}
              </span>
            </div>
          )}

          {/* Room number with icon - Phase 3: Issue #11 - Show "بدون اتاق" for null rooms */}
          {showRoomName && (
            <div className={cn('flex items-center gap-1')}>
              <RoomIcon
                className={cn(
                  'text-slate-600 shrink-0',
                  cellSize === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5'
                )}
              />
              <span
                className={cn(
                  'font-medium text-slate-600 truncate leading-tight',
                  cellSize === 'compact' ? 'text-xs' : 'text-sm',
                  !lesson.roomName && 'italic opacity-70'
                )}
              >
                {lesson.roomName || 'بدون اتاق'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, arePropsEqual);

export default ScheduleCell;
