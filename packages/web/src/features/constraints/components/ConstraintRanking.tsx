/**
 * ConstraintRanking Component
 * Drag-to-rank list for custom constraint prioritization
 * Enabled items at top (ranked), disabled items at bottom
 * Animated with Framer Motion
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConstraintWeightKey, ConstraintRankItem as RankItemType } from '../types';
import { ConstraintRankItem, ConstraintRankItemOverlay } from './ConstraintRankItem';

export interface ConstraintRankingProps {
  ranking: RankItemType[];
  onRankingChange: (ranking: RankItemType[]) => void;
  className?: string;
}

export function ConstraintRanking({ ranking, onRankingChange, className }: ConstraintRankingProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Split into enabled and disabled
  const { enabledItems, disabledItems } = useMemo(() => {
    const enabled = ranking.filter((item) => item.enabled).sort((a, b) => a.rank - b.rank);
    const disabled = ranking.filter((item) => !item.enabled);
    return { enabledItems: enabled, disabledItems: disabled };
  }, [ranking]);

  // Get active item for overlay
  const activeItem = useMemo(
    () => (activeId ? ranking.find((item) => item.key === activeId) : null),
    [activeId, ranking]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end - reorder within enabled list
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const activeKey = active.id as ConstraintWeightKey;
      const overKey = over.id as ConstraintWeightKey;

      // Find indices in enabled items
      const oldIndex = enabledItems.findIndex((item) => item.key === activeKey);
      const newIndex = enabledItems.findIndex((item) => item.key === overKey);

      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder enabled items
      const newEnabled = [...enabledItems];
      const [removed] = newEnabled.splice(oldIndex, 1);
      newEnabled.splice(newIndex, 0, removed);

      // Reassign ranks
      const updatedRanks = newEnabled.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

      // Combine with disabled items
      const newRanking = [...updatedRanks, ...disabledItems];
      onRankingChange(newRanking);
    },
    [enabledItems, disabledItems, onRankingChange]
  );

  // Toggle enabled state
  const handleToggleEnabled = useCallback(
    (key: string) => {
      const item = ranking.find((i) => i.key === key);
      if (!item) return;

      let newRanking: RankItemType[];

      if (item.enabled) {
        // Disable: move to disabled list
        newRanking = ranking.map((i) => {
          if (i.key === key) {
            return { ...i, enabled: false, rank: 100 };
          }
          return i;
        });
      } else {
        // Enable: add to end of enabled list
        const maxRank = Math.max(0, ...enabledItems.map((i) => i.rank));
        newRanking = ranking.map((i) => {
          if (i.key === key) {
            return { ...i, enabled: true, rank: maxRank + 1 };
          }
          return i;
        });
      }

      // Re-sort and reassign ranks
      const enabled = newRanking
        .filter((i) => i.enabled)
        .sort((a, b) => a.rank - b.rank)
        .map((item, index) => ({ ...item, rank: index + 1 }));
      const disabled = newRanking.filter((i) => !i.enabled);

      onRankingChange([...enabled, ...disabled]);
    },
    [ranking, enabledItems, onRankingChange]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-gray-500" />
            <CardTitle className="text-lg">{t('constraints.ranking.title')}</CardTitle>
          </div>
          <CardDescription>{t('constraints.ranking.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Enabled items (sortable) */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('constraints.ranking.enabled')} ({enabledItems.length})
              </p>
              <SortableContext
                items={enabledItems.map((item) => item.key)}
                strategy={verticalListSortingStrategy}
              >
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">
                    {enabledItems.map((item) => (
                      <motion.div
                        key={item.key}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ConstraintRankItem item={item} onToggleEnabled={handleToggleEnabled} />
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </SortableContext>

              {enabledItems.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg"
                >
                  {t('constraints.ranking.noEnabled')}
                </motion.div>
              )}
            </div>

            {/* Divider */}
            <AnimatePresence>
              {disabledItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative py-2"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dashed" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Disabled items (not sortable, but can be enabled) */}
            <AnimatePresence>
              {disabledItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('constraints.ranking.disabled')} ({disabledItems.length})
                  </p>
                  <div className="space-y-2">
                    {disabledItems.map((item) => (
                      <motion.div
                        key={item.key}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ConstraintRankItem item={item} onToggleEnabled={handleToggleEnabled} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Drag overlay */}
            <DragOverlay>
              {activeItem ? <ConstraintRankItemOverlay item={activeItem} /> : null}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>
    </motion.div>
  );
}
