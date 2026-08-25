/**
 * ScheduleDebugPanel Component
 *
 * Visual debug panel for inspecting schedule state in development.
 * Shows real-time state information from the schedule store.
 *
 * Phase 4: Developer Tools
 * - Only renders in development mode
 * - Fixed position overlay (bottom-right)
 * - Shows all key state metrics
 * - Collapsible for minimal interference
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bug, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';

interface ScheduleDebugPanelProps {
  /** Whether to show the panel (default: true in development) */
  show?: boolean;
  /** Custom position (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
}

/**
 * Debug panel for schedule state inspection
 * Only rendered in development mode
 */
export function ScheduleDebugPanel({
  show = process.env.NODE_ENV === 'development',
  position = 'bottom-right',
  defaultCollapsed = false,
}: ScheduleDebugPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isVisible, setIsVisible] = useState(show);

  // Get all state from store
  const state = useScheduleStore();

  // Don't render in production or if explicitly hidden
  if (process.env.NODE_ENV !== 'development' || !isVisible) {
    return null;
  }

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Calculate derived metrics
  const hasUnsavedChanges = state.undoStack.length > 0;
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;
  const enrichmentRate =
    state.lessons.length > 0
      ? ((state.enrichedLessons.length / state.lessons.length) * 100).toFixed(1)
      : '0';

  return (
    <Card
      className={cn(
        'fixed z-50 bg-background/95 backdrop-blur shadow-lg border-2 border-primary/20',
        'transition-all duration-200',
        positionClasses[position],
        isCollapsed ? 'w-auto' : 'w-80'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Schedule Debug</span>
          {hasUnsavedChanges && (
            <Badge variant="destructive" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
          {/* Schedule Info */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Schedule</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-medium">{state.scheduleId || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium truncate max-w-[150px]">
                  {state.scheduleName || 'Untitled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loading:</span>
                <Badge variant={state.isLoading ? 'default' : 'secondary'} className="text-xs">
                  {state.isLoading ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Lessons Info */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Lessons</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Raw:</span>
                <span className="font-medium">{state.lessons.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enriched:</span>
                <span className="font-medium">{state.enrichedLessons.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original:</span>
                <span className="font-medium">{state.originalLessons.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrichment:</span>
                <Badge
                  variant={enrichmentRate === '100.0' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {enrichmentRate}%
                </Badge>
              </div>
            </div>
          </div>

          {/* Metadata Info */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Metadata</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Classes:</span>
                <span className="font-medium">{state.classes.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teachers:</span>
                <span className="font-medium">{state.teachers.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subjects:</span>
                <span className="font-medium">{state.subjects.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rooms:</span>
                <span className="font-medium">{state.rooms.size}</span>
              </div>
            </div>
          </div>

          {/* Indexes Info */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Indexes</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">By Slot:</span>
                <span className="font-medium">{state.indexes.bySlot.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">By Class:</span>
                <span className="font-medium">{state.indexes.byClass.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">By Teacher:</span>
                <span className="font-medium">{state.indexes.byTeacher.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">By Room:</span>
                <span className="font-medium">{state.indexes.byRoom.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enriched (Class):</span>
                <span className="font-medium">{state.enrichedIndexes.byClassAndSlot.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enriched (Slot):</span>
                <span className="font-medium">{state.enrichedIndexes.bySlot.size}</span>
              </div>
            </div>
          </div>

          {/* Interaction State */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Interaction</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <Badge variant="outline" className="text-xs">
                  {state.interactionMode}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Locked:</span>
                <Badge variant={state.isLocked ? 'destructive' : 'secondary'} className="text-xs">
                  {state.isLocked ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Focused:</span>
                <span className="font-medium">
                  {state.focusedSlot
                    ? `${state.focusedSlot.day}-${state.focusedSlot.period}`
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected:</span>
                <span className="font-medium">
                  {state.selectedLesson
                    ? `${state.selectedLesson.day}-${state.selectedLesson.periodIndex}`
                    : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Edit State */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Edit State</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Undo Stack:</span>
                <Badge variant={canUndo ? 'default' : 'secondary'} className="text-xs">
                  {state.undoStack.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Redo Stack:</span>
                <Badge variant={canRedo ? 'default' : 'secondary'} className="text-xs">
                  {state.redoStack.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Saved:</span>
                <span className="font-medium text-xs">
                  {state.lastSavedAt ? new Date(state.lastSavedAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Display</div>
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cell Size:</span>
                <Badge variant="outline" className="text-xs">
                  {state.displaySettings.cellSize}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Font Size:</span>
                <Badge variant="outline" className="text-xs">
                  {state.displaySettings.fontSize}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Color By:</span>
                <Badge variant="outline" className="text-xs">
                  {state.displaySettings.colorBy}
                </Badge>
              </div>
            </div>
          </div>

          {/* Error State */}
          {state.error && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-destructive uppercase">Error</div>
              <div className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded">
                {state.error}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default ScheduleDebugPanel;
