import { cn } from '@/lib/utils';
import { AlertTriangle, Ban, Building2, Loader2, Minus, MousePointerClick, User } from 'lucide-react';
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
    prevProps.viewScope === nextProps.viewScope &&
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
  viewScope = 'teacher',
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
  const isClassView = viewScope === 'class';

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
  const primaryTitleClass =
    cellSize === 'compact' ? 'text-sm' : cellSize === 'large' ? 'text-lg' : 'text-base';
  const secondaryTextClass = cellSize === 'compact' ? 'text-[11px]' : 'text-xs';

  const paddingClass = cellSize === 'compact' ? 'p-2' : cellSize === 'large' ? 'p-3' : 'p-2.5';

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
        'relative flex flex-col items-start justify-center rounded-xl transition-[box-shadow,transform,border-color,background-color]',
        'overflow-hidden',
        paddingClass,

        // Empty cell styling - dashed border with subtle background
        isEmpty && 'border border-dashed border-border/70 bg-muted/10',

        // Phase 7: BLOCKED cells - Pure red with reduced opacity (highest priority)
        validationStatus === 'blocked' &&
          !isEmpty &&
          'border border-red-500/70 bg-red-500/10 ring-2 ring-red-500/20',

        // Phase 7: CHECKING cells - subtle blue feedback while validation is pending
        validationStatus === 'checking' &&
          !isEmpty &&
          'border border-sky-500/70 bg-sky-500/10 ring-2 ring-sky-500/20',

        // Normal filled cell WITHOUT custom colors - card appearance with shadow
        !isEmpty &&
          !backgroundColor &&
          !subjectColors &&
          validationStatus !== 'blocked' &&
          'border border-border bg-card shadow-sm',

        // Cells WITH inline styles (new subject color system) - only add shadow and border
        !isEmpty && subjectColors?.style && validationStatus !== 'blocked' && 'border shadow-sm',

        // Legacy: Old color coding with backgroundColor variable
        !isEmpty && backgroundColor && validationStatus !== 'blocked' && 'border shadow-sm',

        // Hover state - lift effect (disabled for blocked cells)
        !isReadOnly &&
          validationStatus !== 'blocked' &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        isReadOnly && !isEmpty && 'hover:shadow-md',

        // Blocked cells have different cursor
        validationStatus === 'blocked' && 'cursor-not-allowed',
        validationStatus === 'checking' && 'cursor-progress',

        // Selected state
        isSelected && 'ring-2 ring-primary ring-offset-2',

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
        minHeight: cellSize === 'compact' ? '68px' : cellSize === 'large' ? '88px' : '76px',
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
      {isEmpty && !isReadOnly && validationStatus && validationStatus !== 'blocked' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-primary">
          <MousePointerClick className="h-4 w-4" />
          <span className="text-[10px] font-medium">مقصد جابه‌جایی</span>
        </div>
      )}
      {isEmpty && (isReadOnly || !validationStatus) && (
        <div className="flex h-full w-full items-center justify-center">
          <Minus className="h-4 w-4 text-muted-foreground/25" />
        </div>
      )}

      {/* Validation status icons (warning/blocked) */}
      {validationStatus === 'warning' && (
        <div className="absolute end-1.5 top-1.5 z-20 rounded-full bg-amber-100 p-1" title="هشدار">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
        </div>
      )}
      {validationStatus === 'checking' && (
        <div
          className="absolute end-1.5 top-1.5 z-20 rounded-full bg-sky-100 p-1"
          title="در حال بررسی"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
        </div>
      )}
      {validationStatus === 'blocked' && (
        <div
          className="absolute end-1.5 top-1.5 z-20 rounded-full bg-red-100 p-1"
          title="مسدود"
        >
          <Ban className="h-3.5 w-3.5 text-red-700" />
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
          {/* Primary headline changes by view:
              - class view: subject name
              - teacher view: class name */}
          {isClassView && showSubjectName && lesson.subjectName && (
            <span
              className={cn(
                'truncate font-bold leading-tight',
                primaryTitleClass,
                'text-foreground'
              )}
            >
              {lesson.subjectName}
            </span>
          )}
          {!isClassView && lesson.className && (
            <span
              className={cn(
                'truncate font-bold leading-tight',
                primaryTitleClass,
                'text-foreground'
              )}
            >
              {lesson.className}
            </span>
          )}

          {/* Secondary subject line for teacher view only. In class view the subject
              is already the headline, so teacher becomes the second line instead. */}
          {!isClassView && showSubjectName && lesson.subjectName && (
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
                  secondaryTextClass,
                  // Only apply text color class if NOT using subject colors
                  !subjectColors && 'text-foreground/80'
                )}
              >
                {lesson.subjectName}
              </span>
            </div>
          )}

          {/* In class view, teacher name is the useful secondary line. */}
          {isClassView && showTeacherName && teacherDisplay && (
            <div className={cn('flex items-center', cellSize === 'compact' ? 'gap-1' : 'gap-1.5')}>
              <User
                className={cn(
                  'shrink-0 text-foreground/65',
                  cellSize === 'compact' ? 'h-3 w-3' : 'h-4 w-4'
                )}
              />
              <span
                className={cn(
                  'truncate font-medium leading-tight text-foreground/75',
                  secondaryTextClass
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
                  'shrink-0 text-foreground/55',
                  cellSize === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5'
                )}
              />
              <span
                className={cn(
                  'truncate font-medium leading-tight text-foreground/65',
                  secondaryTextClass,
                  !lesson.roomName && 'italic opacity-70'
                )}
              >
                {lesson.roomName || 'بدون اتاق'}
              </span>
            </div>
          )}
        </div>
      )}

      {validationStatus === 'checking' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/45 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-background/95 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>در حال بررسی</span>
          </div>
        </div>
      )}
    </div>
  );
}, arePropsEqual);

export default ScheduleCell;
