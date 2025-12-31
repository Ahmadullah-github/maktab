/**
 * SaveButton component
 *
 * Save button with unsaved badge and loading state.
 * Disabled when no unsaved changes.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { UnsavedBadge } from './UnsavedBadge';

/**
 * Props for SaveButton component
 */
export interface SaveButtonProps {
  /** Number of unsaved changes */
  count: number;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Callback when save button is clicked */
  onSave: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Save button with unsaved badge and loading state
 *
 * - Renders save icon button (Requirement: 11.1)
 * - Includes UnsavedBadge (Requirement: 11.2)
 * - Disabled when no unsaved changes (Requirement: 11.3)
 * - Shows loading state during save (Requirement: 11.4)
 * - Toast display handled by parent (Requirements: 11.5, 11.6)
 *
 * @param props - Component props
 * @returns Button element with badge
 */
export function SaveButton({
  count,
  hasChanges,
  isSaving,
  onSave,
  className,
}: SaveButtonProps): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          aria-label="ذخیره (Ctrl+S)"
          className={cn('relative h-8 w-8', className)}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <UnsavedBadge count={count} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>ذخیره</p>
        <p className="text-xs text-muted-foreground">Ctrl+S</p>
      </TooltipContent>
    </Tooltip>
  );
}
