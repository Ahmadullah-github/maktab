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
    default: 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700',
    primary: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
    allowed: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-xs font-medium transition-all select-none',
        variantStyles[variant],
        isDragging && 'opacity-90 shadow-lg scale-105 ring-2 ring-blue-400',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {!disabled && <GripVertical className="h-3 w-3 text-slate-400 cursor-grab shrink-0" />}
      <span className="truncate max-w-[100px]">{subject.name}</span>
      {subject.code && (
        <span className="text-[10px] text-slate-400 shrink-0">({subject.code})</span>
      )}
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 rounded hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
          aria-label={`Remove ${subject.name}`}
        >
          <X className="h-3 w-3" />
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
      base: 'border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl',
      active: 'border-blue-400 bg-blue-50/50',
      disabled: 'opacity-50 bg-slate-100/50',
    },
    primary: {
      base: 'border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-xl',
      active: 'border-blue-400 bg-blue-100/50',
      disabled: 'opacity-50',
    },
    allowed: {
      base: 'border-2 border-dashed border-amber-200 bg-amber-50/30 rounded-xl',
      active: 'border-amber-400 bg-amber-100/50',
      disabled: 'opacity-40 bg-slate-100/50',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200',
        styles.base,
        isOver && !disabled && styles.active,
        disabled && styles.disabled,
        className
      )}
    >
      {isEmpty ? (
        <div className="flex items-center justify-center h-full min-h-[100px] text-xs text-slate-400 px-2 text-center">
          {emptyMessage || label}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
