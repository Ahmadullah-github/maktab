/**
 * SubjectManager Component
 *
 * @deprecated This component is replaced by SubjectAssignmentManager which provides
 * a unified interface for managing both subject capabilities AND class assignments.
 * This file is kept for reference but should not be used in new code.
 *
 * Migration: Use SubjectAssignmentManager instead, which combines the functionality
 * of this component with the Assignments tab into a single "Subjects & Classes" tab.
 *
 * Original description:
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
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimary: boolean;
  onPrimaryChange: (ids: number[]) => void;
  onAllowedChange: (ids: number[]) => void;
  onRestrictChange: (value: boolean) => void;
  availableSubjects: Subject[];
  disabled?: boolean;
  className?: string;
}

export type SubjectZone = 'available' | 'primary' | 'allowed';

export function getSubjectZone(
  subjectId: number,
  primarySubjectIds: number[],
  allowedSubjectIds: number[]
): SubjectZone {
  if (primarySubjectIds.includes(subjectId)) return 'primary';
  if (allowedSubjectIds.includes(subjectId)) return 'allowed';
  return 'available';
}

export function moveSubjectToZone(
  subjectId: number,
  targetZone: SubjectZone,
  primarySubjectIds: number[],
  allowedSubjectIds: number[]
): { primary: number[]; allowed: number[] } {
  const newPrimary = primarySubjectIds.filter((id) => id !== subjectId);
  const newAllowed = allowedSubjectIds.filter((id) => id !== subjectId);

  if (targetZone === 'primary') {
    return { primary: [...newPrimary, subjectId], allowed: newAllowed };
  }
  if (targetZone === 'allowed') {
    return { primary: newPrimary, allowed: [...newAllowed, subjectId] };
  }
  return { primary: newPrimary, allowed: newAllowed };
}

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const filteredAvailableSubjects = useMemo(() => {
    const assignedIds = new Set([...primarySubjectIds, ...allowedSubjectIds]);
    const unassigned = availableSubjects.filter((s) => !assignedIds.has(s.id));
    if (!searchQuery.trim()) return unassigned;
    const query = searchQuery.toLowerCase();
    return unassigned.filter(
      (s) =>
        s.name.toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query))
    );
  }, [availableSubjects, primarySubjectIds, allowedSubjectIds, searchQuery]);

  const primarySubjects = useMemo(
    () => availableSubjects.filter((s) => primarySubjectIds.includes(s.id)),
    [availableSubjects, primarySubjectIds]
  );

  const allowedSubjects = useMemo(
    () => availableSubjects.filter((s) => allowedSubjectIds.includes(s.id)),
    [availableSubjects, allowedSubjectIds]
  );

  const activeSubject = useMemo(
    () => (activeId ? availableSubjects.find((s) => s.id === activeId) : null),
    [activeId, availableSubjects]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || disabled) return;

      const subjectId = active.id as number;
      const targetZone = over.id as SubjectZone;
      const currentZone = getSubjectZone(subjectId, primarySubjectIds, allowedSubjectIds);
      if (currentZone === targetZone) return;

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
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border-2 border-slate-100">
        <Switch
          id="restrict-toggle"
          checked={restrictToPrimary}
          onCheckedChange={onRestrictChange}
          disabled={disabled}
          className="shrink-0"
        />
        <div className="flex flex-col gap-0.5 flex-1">
          <Label
            htmlFor="restrict-toggle"
            className="text-sm font-medium text-slate-700 cursor-pointer"
          >
            {t('teachers.restrictToPrimary')}
          </Label>
          <span className="text-xs text-slate-500">{t('teachers.restrictToPrimaryDesc')}</span>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Three-column grid with consistent alignment */}
        <div className="grid grid-cols-3 gap-3">
          {/* Column 1: Available Subjects */}
          <div className="flex flex-col">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 h-4">
              {t('sidebar.subjects')}
            </Label>
            <div className="relative mb-2">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('teachers.searchSubject')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 ps-9 text-sm border-2 border-slate-200 focus:border-blue-400 bg-white"
                disabled={disabled}
              />
            </div>
            <DroppableZone
              id="available"
              label=""
              isEmpty={filteredAvailableSubjects.length === 0}
              emptyMessage={t('teachers.noSubjectsFound')}
              className="flex-1 min-h-[180px]"
            >
              <div className="flex flex-wrap gap-1.5 p-2 content-start h-full overflow-y-auto max-h-[180px]">
                {filteredAvailableSubjects.map((subject) => (
                  <DraggableSubject key={subject.id} subject={subject} disabled={disabled} />
                ))}
              </div>
            </DroppableZone>
          </div>

          {/* Column 2: Primary Subjects */}
          <div className="flex flex-col">
            <Label className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 h-4">
              {t('teachers.primarySubjects')}
            </Label>
            {/* Spacer to align with search input */}
            <div className="h-9 mb-2" />
            <DroppableZone
              id="primary"
              label={t('teachers.dropPrimaryHere')}
              isEmpty={primarySubjects.length === 0}
              variant="primary"
              className="flex-1 min-h-[180px]"
            >
              <div className="flex flex-wrap gap-1.5 p-2 content-start h-full overflow-y-auto max-h-[180px]">
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

          {/* Column 3: Allowed Subjects */}
          <div className="flex flex-col">
            <Label
              className={cn(
                'text-xs font-semibold uppercase tracking-wide mb-2 h-4',
                restrictToPrimary ? 'text-slate-400 line-through' : 'text-amber-600'
              )}
            >
              {t('teachers.allowedSubjects')}
            </Label>
            {/* Spacer to align with search input */}
            <div className="h-9 mb-2" />
            <DroppableZone
              id="allowed"
              label={t('teachers.dropAllowedHere')}
              isEmpty={allowedSubjects.length === 0}
              variant="allowed"
              disabled={restrictToPrimary}
              className="flex-1 min-h-[180px]"
            >
              <div className="flex flex-wrap gap-1.5 p-2 content-start h-full overflow-y-auto max-h-[180px]">
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

        <DragOverlay>
          {activeSubject ? <SubjectChip subject={activeSubject} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default SubjectManager;
