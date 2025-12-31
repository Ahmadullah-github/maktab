/**
 * UndoRedoButtons component
 *
 * Undo and redo buttons with tooltips and keyboard hints.
 * Buttons are disabled when respective stacks are empty.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useUndoRedo } from '../../hooks/useUndoRedo';

/**
 * Props for UndoRedoButtons component
 */
export interface UndoRedoButtonsProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Undo and redo buttons with tooltips and keyboard hints
 *
 * - Renders undo button with Undo2 icon (Requirement: 10.1)
 * - Renders redo button with Redo2 icon (Requirement: 10.2)
 * - Disables undo button when canUndo is false (Requirement: 10.3)
 * - Disables redo button when canRedo is false (Requirement: 10.4)
 * - Adds tooltips with action descriptions (Requirement: 10.5)
 * - Includes keyboard shortcut hints in tooltips (Requirement: 10.6)
 *
 * @param props - Component props
 * @returns Button group element
 */
export function UndoRedoButtons({ className }: UndoRedoButtonsProps): JSX.Element {
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Undo button (Requirement: 10.1) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            aria-label="بازگشت (Ctrl+Z)"
            className="h-8 w-8"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {/* Tooltip with description and keyboard hint (Requirements: 10.5, 10.6) */}
          <p>بازگشت</p>
          <p className="text-xs text-muted-foreground">Ctrl+Z</p>
        </TooltipContent>
      </Tooltip>

      {/* Redo button (Requirement: 10.2) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            aria-label="انجام مجدد (Ctrl+Y)"
            className="h-8 w-8"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {/* Tooltip with description and keyboard hint (Requirements: 10.5, 10.6) */}
          <p>انجام مجدد</p>
          <p className="text-xs text-muted-foreground">Ctrl+Y</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
