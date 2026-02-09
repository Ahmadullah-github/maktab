/**
 * ConstraintRankItem Component
 * Single draggable constraint item for ranking UI
 * Shows constraint label, category icon, enable toggle, drag handle
 */

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, DoorOpen, GraduationCap, GripVertical, Settings2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConstraintCategory, ConstraintRankItem as RankItemType } from '../types';

const CATEGORY_ICONS: Record<ConstraintCategory, React.ComponentType<{ className?: string }>> = {
  teacher: Users,
  class: GraduationCap,
  subject: BookOpen,
  room: DoorOpen,
  general: Settings2,
};

const CATEGORY_COLORS: Record<ConstraintCategory, string> = {
  teacher: 'bg-blue-100 text-blue-700',
  class: 'bg-green-100 text-green-700',
  subject: 'bg-purple-100 text-purple-700',
  room: 'bg-orange-100 text-orange-700',
  general: 'bg-gray-100 text-gray-700',
};

/**
 * Map constraint key to translation key
 */
function getConstraintTranslationKey(key: string): string {
  const mapping: Record<string, string> = {
    avoidTeacherGapsWeight: 'avoidTeacherGaps',
    balanceTeacherLoadWeight: 'balanceTeacherLoad',
    respectTeacherTimePreferenceWeight: 'respectTeacherTimePreference',
    respectTeacherRoomPreferenceWeight: 'respectTeacherRoomPreference',
    avoidClassGapsWeight: 'avoidClassGaps',
    distributeDifficultSubjectsWeight: 'distributeDifficultSubjects',
    preferMorningForDifficultWeight: 'preferMorningForDifficult',
    subjectSpreadWeight: 'subjectSpread',
    minimizeRoomChangesWeight: 'minimizeRoomChanges',
    avoidFirstLastPeriodWeight: 'avoidFirstLastPeriod',
  };
  return mapping[key] || key;
}

export interface ConstraintRankItemProps {
  item: RankItemType;
  onToggleEnabled: (key: string) => void;
  isDragging?: boolean;
}

export function ConstraintRankItem({
  item,
  onToggleEnabled,
  isDragging: isDraggingProp,
}: ConstraintRankItemProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = CATEGORY_ICONS[item.category];
  const colorClass = CATEGORY_COLORS[item.category];
  const translationKey = getConstraintTranslationKey(item.key);
  const isCurrentlyDragging = isDragging || isDraggingProp;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card transition-all',
        'hover:shadow-sm',
        isCurrentlyDragging && 'shadow-lg ring-2 ring-primary/20 opacity-90 z-50',
        !item.enabled && 'opacity-50 bg-muted/30'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className={cn(
          'touch-none cursor-grab p-1 rounded hover:bg-muted transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          isCurrentlyDragging && 'cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
        aria-label={t('constraints.ranking.dragHint')}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Rank number */}
      {item.enabled && (
        <Badge variant="outline" className="w-6 h-6 p-0 justify-center font-mono text-xs">
          {item.rank}
        </Badge>
      )}

      {/* Category icon */}
      <div className={cn('p-1.5 rounded', colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label and description */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', !item.enabled && 'line-through')}>
          {t(`constraints.constraints.${translationKey}.label`)}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {t(`constraints.constraints.${translationKey}.description`)}
        </p>
      </div>

      {/* Enable/disable toggle */}
      <Switch
        checked={item.enabled}
        onCheckedChange={() => onToggleEnabled(item.key)}
        aria-label={t('constraints.ranking.enableHint')}
      />
    </div>
  );
}

/**
 * Drag overlay version (shown while dragging)
 */
export function ConstraintRankItemOverlay({ item }: { item: RankItemType }) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICONS[item.category];
  const colorClass = CATEGORY_COLORS[item.category];
  const translationKey = getConstraintTranslationKey(item.key);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card shadow-xl',
        'ring-2 ring-primary/30',
        !item.enabled && 'opacity-50 bg-muted/30'
      )}
    >
      <div className="p-1 rounded">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {item.enabled && (
        <Badge variant="outline" className="w-6 h-6 p-0 justify-center font-mono text-xs">
          {item.rank}
        </Badge>
      )}

      <div className={cn('p-1.5 rounded', colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', !item.enabled && 'line-through')}>
          {t(`constraints.constraints.${translationKey}.label`)}
        </p>
      </div>
    </div>
  );
}
