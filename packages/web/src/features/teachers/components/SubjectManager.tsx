/**
 * SubjectManager Component
 *
 * Drag-and-drop interface for managing teacher subject assignments.
 * - Three zones: available subjects, primary subjects, allowed subjects
 * - Uses @dnd-kit for drag-drop functionality
 * - Search filter for available subjects
 * - Switch for "restrict to primary subjects"
 * - Remove button (X) on assigned subjects
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DraggableSubject, DroppableZone, SubjectChip } from './SubjectManagerParts';

/**
 * Subject entity for display
 */
export interface Subject {
  id: number;
  name: string;
  code?: string;
  grade?: number | null;
}

export interface SubjectManagerProps {
  /** IDs of primary subjects (teacher's main specialization) */
  primarySubjectIds: number[];
  /** IDs of allowed subjects (additional subjects teacher can teach) */
  allowedSubjectIds: number[];
  /** Whether teacher is restricted to only teaching primary subjects */
  restrictToPrimary: boolean;
  /** Callback when primary subjects change */
  onPrimaryChange: (ids: number[]) => void;
  /** Callback when allowed subjects change */
  onAllowedChange: (ids: number[]) => void;
  /** Callback when restrict toggle changes */
  onRestrictChange: (value: boolean) => void;
  /** All available subjects to choose from */
  availableSubjects: Subject[];
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/** Zone identifiers for drag-drop */
export type SubjectZone = 'available' | 'primary' | 'allowed';

/**
 * Determine which zone a subject belongs to
 */
export function getSubjectZone(
  subjectId: number,
  primarySubjectIds: number[],
  allowedSubjectIds: number[]
): SubjectZone {
  if (primarySubjectIds.includes(subjectId)) {
    return 'primary';
  }
  if (allowedSubjectIds.includes(subjectId)) {
    return 'allowed';
  }
  return 'available';
}

/**
 * Move a subject from one zone to another
 * Returns updated arrays for primary and allowed subjects
 */
export function moveSubjectToZone(
  subjectId: number,
  targetZone: SubjectZone,
  primarySubjectIds: number[],
  allowedSubjectIds: number[]
): { primary: number[]; allowed: number[] } {
  // Remove from current zone
  const newPrimary = primarySubjectIds.filter((id) => id !== subjectId);
  const newAllowed = allowedSubjectIds.filter((id) => id !== subjectId);

  // Add to target zone
  if (targetZone === 'primary') {
    return { primary: [...newPrimary, subjectId], allowed: newAllowed };
  }
  if (targetZone === 'allowed') {
    return { primary: newPrimary, allowed: [...newAllowed, subjectId] };
  }

  // Target is 'available' - just remove from both
  return { primary: newPrimary, allowed: newAllowed };
}

/**
 * SubjectManager provides a drag-and-drop interface for managing teacher subjects
 *
 * @example
 * ```tsx
 * <SubjectManager
 *   primarySubjectIds={[1, 2]}
 *   allowedSubjectIds={[3]}
 *   restrictToPrimary={false}
 *   onPrimaryChange={setPrimaryIds}
 *   onAllowedChange={setAllowedIds}
 *   onRestrictChange={setRestrict}
 *   availableSubjects={subjects}
 * />
 * ```
 */
export function SubjectManager({
  primarySubjectIds,
  allowedSubjectIds,
  restrictToPrimary,
  onPrimaryChange,
  onAllowedChange,
  onRestrictChange,
  availableSubjects,
  disabled = false,
  className,
}: SubjectManagerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter available subjects by search query
  const filteredAvailableSubjects = useMemo(() => {
    const assignedIds = new Set([...primarySubjectIds, ...allowedSubjectIds]);
    const unassigned = availableSubjects.filter((s) => !assignedIds.has(s.id));

    if (!searchQuery.trim()) {
      return unassigned;
    }

    const query = searchQuery.toLowerCase();
    return unassigned.filter(
      (s) =>
        s.name.toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))
    );
  }, [availableSubjects, primarySubjectIds, allowedSubjectIds, searchQuery]);

  // Get subjects for each zone
  const primarySubjects = useMemo(
    () => availableSubjects.filter((s) => primarySubjectIds.includes(s.id)),
    [availableSubjects, primarySubjectIds]
  );

  const allowedSubjects = useMemo(
    () => availableSubjects.filter((s) => allowedSubjectIds.includes(s.id)),
    [availableSubjects, allowedSubjectIds]
  );

  // Get the active subject being dragged
  const activeSubject = useMemo(
    () => (activeId ? availableSubjects.find((s) => s.id === activeId) : null),
    [activeId, availableSubjects]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || disabled) return;

      const subjectId = active.id as number;
      const targetZone = over.id as SubjectZone;

      // Get current zone
      const currentZone = getSubjectZone(subjectId, primarySubjectIds, allowedSubjectIds);

      // Don't do anything if dropping in same zone
      if (currentZone === targetZone) return;

      // Move subject to new zone
      const { primary, allowed } = moveSubjectToZone(
        subjectId,
        targetZone,
        primarySubjectIds,
        allowedSubjectIds
      );

      onPrimaryChange(primary);
      onAllowedChange(allowed);
    },
    [primarySubjectIds, allowedSubjectIds, onPrimaryChange, onAllowedChange, disabled]
  );

  // Handle removing a subject from a zone
  const handleRemoveSubject = useCallback(
    (subjectId: number) => {
      if (disabled) return;

      const { primary, allowed } = moveSubjectToZone(
        subjectId,
        'available',
        primarySubjectIds,
        allowedSubjectIds
      );

      onPrimaryChange(primary);
      onAllowedChange(allowed);
    },
    [primarySubjectIds, allowedSubjectIds, onPrimaryChange, onAllowedChange, disabled]
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Restrict to primary toggle */}
      <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="restrict-toggle" className="text-sm font-medium">
            {t('teachers.restrictToPrimary')}
          </Label>
          <span className="text-xs text-muted-foreground">
            {t('teachers.restrictToPrimaryDesc')}
          </span>
        </div>
        <Switch
          id="restrict-toggle"
          checked={restrictToPrimary}
          onCheckedChange={onRestrictChange}
          disabled={disabled}
        />
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Available Subjects Zone */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              {t('sidebar.subjects')}
            </Label>
            {/* Search input */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('teachers.searchSubject')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
                disabled={disabled}
              />
            </div>
            <DroppableZone
              id="available"
              label=""
              isEmpty={filteredAvailableSubjects.length === 0}
              emptyMessage={t('teachers.noSubjectsFound')}
              className="min-h-[200px]"
            >
              <ScrollArea className="h-[200px]">
                <div className="flex flex-wrap gap-2 p-2">
                  {filteredAvailableSubjects.map((subject) => (
                    <DraggableSubject key={subject.id} subject={subject} disabled={disabled} />
                  ))}
                </div>
              </ScrollArea>
            </DroppableZone>
          </div>

          {/* Primary Subjects Zone */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-primary">
              {t('teachers.primarySubjects')}
            </Label>
            <DroppableZone
              id="primary"
              label={t('teachers.dropPrimaryHere')}
              isEmpty={primarySubjects.length === 0}
              variant="primary"
              className="min-h-[240px]"
            >
              <div className="flex flex-wrap gap-2 p-2">
                {primarySubjects.map((subject) => (
                  <DraggableSubject
                    key={subject.id}
                    subject={subject}
                    disabled={disabled}
                    onRemove={() => handleRemoveSubject(subject.id)}
                    variant="primary"
                  />
                ))}
              </div>
            </DroppableZone>
          </div>

          {/* Allowed Subjects Zone */}
          <div className="flex flex-col gap-2">
            <Label
              className={cn(
                'text-sm font-medium',
                restrictToPrimary ? 'text-muted-foreground line-through' : 'text-amber-600'
              )}
            >
              {t('teachers.allowedSubjects')}
            </Label>
            <DroppableZone
              id="allowed"
              label={t('teachers.dropAllowedHere')}
              isEmpty={allowedSubjects.length === 0}
              variant="allowed"
              disabled={restrictToPrimary}
              className="min-h-[240px]"
            >
              <div className="flex flex-wrap gap-2 p-2">
                {allowedSubjects.map((subject) => (
                  <DraggableSubject
                    key={subject.id}
                    subject={subject}
                    disabled={disabled || restrictToPrimary}
                    onRemove={() => handleRemoveSubject(subject.id)}
                    variant="allowed"
                  />
                ))}
              </div>
            </DroppableZone>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeSubject ? <SubjectChip subject={activeSubject} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default SubjectManager;
