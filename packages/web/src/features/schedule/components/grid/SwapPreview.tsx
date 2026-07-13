/**
 * SwapPreview - Ghost preview showing swap result
 *
 * Displays a preview of what the schedule would look like after a swap.
 * Shows the source lesson at the target position and the target lesson
 * at the source position, both with reduced opacity.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { cn } from '@/lib/utils';
import { memo } from 'react';

import { FONT_SIZE_MAP } from '../../constants';
import type { DayOfWeek, DisplaySettings, ScheduledLesson } from '../../types';
import { generateEntityColor, getContrastTextColor } from '../../utils/colorUtils';

/**
 * Props for SwapPreview component
 */
export interface SwapPreviewProps {
  /** The lesson being moved (source) */
  sourceLesson: ScheduledLesson;
  /** The lesson at the target slot (null for empty slot) */
  targetLesson: ScheduledLesson | null;
  /** Source slot position */
  sourceSlot: { day: DayOfWeek; period: number };
  /** Target slot position */
  targetSlot: { day: DayOfWeek; period: number };
  /** Display settings for rendering */
  displaySettings: DisplaySettings;
}

/**
 * Internal component for rendering a lesson preview
 */
interface LessonPreviewProps {
  lesson: ScheduledLesson | null;
  displaySettings: DisplaySettings;
  /** Label to show when slot is empty */
  emptyLabel?: string;
}

const LessonPreview = memo(function LessonPreview({
  lesson,
  displaySettings,
  emptyLabel = '',
}: LessonPreviewProps) {
  const { showSubjectName, showTeacherName, showRoomName, fontSize, colorBy } = displaySettings;

  const fontSizeClass = FONT_SIZE_MAP[fontSize];
  const isEmpty = !lesson;

  // Build teacher display string
  const teacherDisplay = lesson?.teacherNames?.join('، ') || '';

  // Generate color coding based on settings
  let backgroundColor = '';
  let textColor = '';

  if (!isEmpty && colorBy !== 'none' && lesson) {
    if (colorBy === 'subject' && lesson.subjectId) {
      backgroundColor = generateEntityColor(lesson.subjectId);
      textColor = getContrastTextColor(backgroundColor);
    } else if (colorBy === 'teacher' && lesson.teacherIds.length > 0) {
      backgroundColor = generateEntityColor(lesson.teacherIds[0]);
      textColor = getContrastTextColor(backgroundColor);
    }
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-full h-full',
          'text-muted-foreground/70 italic',
          fontSizeClass
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 text-center w-full h-full px-1',
        fontSizeClass
      )}
      style={{
        ...(backgroundColor && {
          backgroundColor,
          color: textColor,
        }),
      }}
    >
      {/* Subject name - prominent */}
      {showSubjectName && lesson.subjectName && (
        <span className="font-medium truncate w-full leading-tight">{lesson.subjectName}</span>
      )}

      {/* Teacher name - smaller */}
      {showTeacherName && teacherDisplay && (
        <span
          className={cn(
            'truncate w-full leading-tight text-[0.9em]',
            !backgroundColor && 'text-muted-foreground'
          )}
        >
          {teacherDisplay}
        </span>
      )}

      {/* Room name - smallest */}
      {showRoomName && lesson.roomName && (
        <span
          className={cn(
            'truncate w-full leading-tight text-[0.8em]',
            !backgroundColor && 'text-muted-foreground/70'
          )}
        >
          {lesson.roomName}
        </span>
      )}
    </div>
  );
});

/**
 * SwapPreview - Ghost preview showing swap result
 *
 * Features:
 * - Shows source lesson at target position with opacity-50 (Requirement 13.1)
 * - Shows target lesson at source position with opacity-50 (Requirement 13.2)
 * - Uses CSS transitions for smooth animation (Requirement 13.3)
 * - Displays alongside current state, not replacing it (Requirement 13.4)
 *
 * The component renders two ghost overlays:
 * 1. Source lesson preview at the target position
 * 2. Target lesson preview at the source position
 *
 * These are meant to be positioned absolutely over the schedule grid cells.
 */
export const SwapPreview = memo(function SwapPreview({
  sourceLesson,
  displaySettings,
}: SwapPreviewProps) {
  return (
    <>
      {/* Source lesson preview - shown at target position */}
      <div
        className={cn(
          // Positioning - absolute overlay
          'absolute inset-0 z-20',
          // Reduced opacity for ghost effect - Requirement 13.1, 13.2
          'opacity-50',
          // Smooth animation - Requirement 13.3
          'transition-all duration-200 ease-out',
          // Visual styling
          'bg-card border-2 border-dashed border-primary rounded-sm',
          // Pointer events none so it doesn't interfere with interactions
          'pointer-events-none',
          // Flex for content centering
          'flex items-center justify-center'
        )}
        role="presentation"
        aria-hidden="true"
        data-testid="swap-preview-source"
      >
        <LessonPreview lesson={sourceLesson} displaySettings={displaySettings} />
      </div>
    </>
  );
});

/**
 * SwapPreviewAtSource - Preview of target lesson at source position
 *
 * This is a separate component to be rendered at the source cell position,
 * showing what the target lesson (or empty slot) would look like there.
 */
export interface SwapPreviewAtSourceProps {
  /** The lesson at the target slot (null for empty slot) */
  targetLesson: ScheduledLesson | null;
  /** Display settings for rendering */
  displaySettings: DisplaySettings;
}

export const SwapPreviewAtSource = memo(function SwapPreviewAtSource({
  targetLesson,
  displaySettings,
}: SwapPreviewAtSourceProps) {
  return (
    <div
      className={cn(
        // Positioning - absolute overlay
        'absolute inset-0 z-20',
        // Reduced opacity for ghost effect - Requirement 13.2
        'opacity-50',
        // Smooth animation - Requirement 13.3
        'transition-all duration-200 ease-out',
        // Visual styling
        'bg-card border-2 border-dashed border-secondary rounded-sm',
        // Pointer events none so it doesn't interfere with interactions
        'pointer-events-none',
        // Flex for content centering
        'flex items-center justify-center'
      )}
      role="presentation"
      aria-hidden="true"
      data-testid="swap-preview-target"
    >
      <LessonPreview lesson={targetLesson} displaySettings={displaySettings} emptyLabel="خالی" />
    </div>
  );
});

export default SwapPreview;
