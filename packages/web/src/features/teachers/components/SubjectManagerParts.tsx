/**
 * SubjectManager Parts - Draggable and Droppable components
 *
 * Separated for cleaner code organization and reusability.
 * Uses @dnd-kit for drag-drop functionality.
 */

import { cn } from '@/lib/utils';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, X } from 'lucide-react';
import type { Subject, SubjectZone } from './SubjectManager';

interface SubjectChipProps {
  subject: Subject;
  isDragging?: boolean;
  variant?: 'default' | 'primary' | 'allowed';
  onRemove?: () => void;
  disabled?: boolean;
}

/**
 * Visual chip representing a subject
 */
export function SubjectChip({
  subject,
  isDragging = false,
  variant = 'default',
  onRemove,
  disabled = false,
}: SubjectChipProps) {
  const variantStyles = {
    default: 'bg-muted hover:bg-muted/80 border-border',
    primary: 'bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary',
    allowed:
      'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-sm font-medium transition-colors select-none',
        variantStyles[variant],
        isDragging && 'opacity-90 shadow-lg scale-105',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {!disabled && <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />}
      <span className="truncate max-w-[120px]">{subject.name}</span>
      {subject.code && <span className="text-xs text-muted-foreground">({subject.code})</span>}
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
          aria-label={`Remove ${subject.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface DraggableSubjectProps {
  subject: Subject;
  disabled?: boolean;
  onRemove?: () => void;
  variant?: 'default' | 'primary' | 'allowed';
}

/**
 * Draggable wrapper for SubjectChip
 */
export function DraggableSubject({
  subject,
  disabled = false,
  onRemove,
  variant = 'default',
}: DraggableSubjectProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: subject.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('touch-none', isDragging && 'opacity-50')}
    >
      <SubjectChip
        subject={subject}
        isDragging={isDragging}
        variant={variant}
        onRemove={onRemove}
        disabled={disabled}
      />
    </div>
  );
}

interface DroppableZoneProps {
  id: SubjectZone;
  label: string;
  isEmpty: boolean;
  emptyMessage?: string;
  variant?: 'default' | 'primary' | 'allowed';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Droppable zone for subjects
 */
export function DroppableZone({
  id,
  label,
  isEmpty,
  emptyMessage,
  variant = 'default',
  disabled = false,
  className,
  children,
}: DroppableZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled,
  });

  const variantStyles = {
    default: {
      base: 'border-dashed border-2 border-muted-foreground/30',
      active: 'border-primary bg-primary/5',
      disabled: 'opacity-50 bg-muted/20',
    },
    primary: {
      base: 'border-dashed border-2 border-primary/30 bg-primary/5',
      active: 'border-primary bg-primary/10',
      disabled: 'opacity-50',
    },
    allowed: {
      base: 'border-dashed border-2 border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10',
      active: 'border-amber-400 bg-amber-100/50 dark:bg-amber-900/20',
      disabled: 'opacity-40 bg-muted/30',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        styles.base,
        isOver && !disabled && styles.active,
        disabled && styles.disabled,
        className
      )}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center h-full min-h-[100px] text-sm text-muted-foreground">
          {emptyMessage || label}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
