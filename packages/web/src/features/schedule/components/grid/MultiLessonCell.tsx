/**
 * MultiLessonCell Component
 *
 * Renders multiple lessons in a single cell (teacher view)
 * Shows first lesson with indicator, expands to show all
 *
 * Phase 2 Enhancement: Addresses Issue #1, #2, #9
 * - Handles multiple lessons at same time slot
 * - Visual indicator for lesson count
 * - Expandable overlay to show all lessons
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import type { DayOfWeek, DisplaySettings, EnrichedLesson } from '../../types';
import { ScheduleCell } from './ScheduleCell';

export interface MultiLessonCellProps {
  /** Array of lessons at this slot */
  lessons: EnrichedLesson[];
  /** Display settings for rendering */
  displaySettings: DisplaySettings;
  /** Day of week for this cell */
  day: DayOfWeek;
  /** Period index for this cell */
  period: number;
  /** Whether the cell is read-only */
  isReadOnly?: boolean;
  /** Whether this cell is selected */
  isSelected?: boolean;
  /** Whether this cell is focused */
  isFocused?: boolean;
  /** Whether this cell is highlighted */
  isHighlighted?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Custom comparison for React.memo
 * Only re-renders when relevant props change
 */
function arePropsEqual(prevProps: MultiLessonCellProps, nextProps: MultiLessonCellProps): boolean {
  // Compare lesson count
  if (prevProps.lessons.length !== nextProps.lessons.length) {
    return false;
  }

  // Compare lesson IDs (shallow comparison)
  for (let i = 0; i < prevProps.lessons.length; i++) {
    if (
      prevProps.lessons[i].classId !== nextProps.lessons[i].classId ||
      prevProps.lessons[i].subjectId !== nextProps.lessons[i].subjectId
    ) {
      return false;
    }
  }

  // Compare display settings
  if (
    prevProps.displaySettings.showTeacherName !== nextProps.displaySettings.showTeacherName ||
    prevProps.displaySettings.showRoomName !== nextProps.displaySettings.showRoomName ||
    prevProps.displaySettings.cellSize !== nextProps.displaySettings.cellSize ||
    prevProps.displaySettings.fontSize !== nextProps.displaySettings.fontSize ||
    prevProps.displaySettings.colorBy !== nextProps.displaySettings.colorBy
  ) {
    return false;
  }

  // Compare visual states
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.isReadOnly === nextProps.isReadOnly &&
    prevProps.day === nextProps.day &&
    prevProps.period === nextProps.period
  );
}

/**
 * MultiLessonCell - Renders multiple lessons in a single cell
 *
 * Features:
 * - Shows first lesson with badge indicator
 * - Badge shows total lesson count
 * - Click badge to expand/collapse
 * - Overlay shows all lessons with scroll
 * - Maintains visual consistency with ScheduleCell
 *
 * Requirements: Issue #1, #2, #9
 */
export const MultiLessonCell = memo(function MultiLessonCell({
  lessons,
  displaySettings,
  day,
  period,
  isReadOnly = true,
  isSelected = false,
  isFocused = false,
  isHighlighted = false,
  onClick,
}: MultiLessonCellProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle badge click (toggle expansion)
  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent cell click
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle cell click
  const handleCellClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Empty cell
  if (lessons.length === 0) {
    return (
      <ScheduleCell
        lesson={null}
        displaySettings={displaySettings}
        isReadOnly={isReadOnly}
        isSelected={isSelected}
        isFocused={isFocused}
        isHighlighted={isHighlighted}
        onClick={handleCellClick}
        day={day}
        period={period}
      />
    );
  }

  // Single lesson - render normally
  if (lessons.length === 1) {
    return (
      <ScheduleCell
        lesson={lessons[0]}
        displaySettings={displaySettings}
        isReadOnly={isReadOnly}
        isSelected={isSelected}
        isFocused={isFocused}
        isHighlighted={isHighlighted}
        onClick={handleCellClick}
        day={day}
        period={period}
      />
    );
  }

  // Multiple lessons - show with expansion
  return (
    <div className="relative h-full">
      {/* Primary lesson (always visible) */}
      <ScheduleCell
        lesson={lessons[0]}
        displaySettings={displaySettings}
        isReadOnly={isReadOnly}
        isSelected={isSelected}
        isFocused={isFocused}
        isHighlighted={isHighlighted}
        onClick={handleCellClick}
        day={day}
        period={period}
      />

      {/* Multi-lesson indicator badge */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleBadgeClick}
        className={cn(
          'absolute top-1 left-1 z-10',
          'h-6 px-2 py-0',
          'flex items-center gap-1',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'rounded-full',
          'shadow-md',
          'transition-all duration-200',
          'text-xs font-bold'
        )}
        title={`${lessons.length} صنف در این زمان`}
      >
        <Layers className="w-3 h-3" />
        <span>{lessons.length}</span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {/* Expanded view - overlay */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleBadgeClick}
            aria-hidden="true"
          />

          {/* Overlay panel */}
          <div
            className={cn(
              'absolute top-full left-0 right-0 z-50 mt-1',
              'bg-background border-2 border-primary rounded-lg shadow-2xl',
              'min-w-[300px]',
              'animate-in slide-in-from-top-2 duration-200'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{lessons.length} صنف در این زمان</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {day} - دوره {period + 1}
              </Badge>
            </div>

            {/* Lessons list */}
            <ScrollArea className="max-h-[400px]">
              <div className="p-2 space-y-2">
                {lessons.map((lesson, index) => (
                  <div
                    key={`${lesson.classId}-${lesson.subjectId}-${index}`}
                    className={cn(
                      'border rounded-lg overflow-hidden',
                      'transition-all duration-200',
                      'hover:shadow-md hover:border-primary/50'
                    )}
                  >
                    {/* Class name header */}
                    <div className="bg-muted/50 px-3 py-1.5 border-b">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {lesson.className}
                      </span>
                    </div>

                    {/* Lesson details */}
                    <div className="p-2">
                      <ScheduleCell
                        lesson={lesson}
                        displaySettings={displaySettings}
                        isReadOnly={isReadOnly}
                        day={day}
                        period={period}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-2 border-t bg-muted/30 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleBadgeClick} className="text-xs">
                بستن
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}, arePropsEqual);

export default MultiLessonCell;
