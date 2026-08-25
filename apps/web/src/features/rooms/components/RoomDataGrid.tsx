/**
 * RoomDataGrid Component
 *
 * DataGrid for displaying rooms with:
 * - Checkbox selection
 * - Row click to open edit drawer
 * - Type badges
 * - Features count
 */

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { DoorOpen } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomTypesWithIcons } from '@/features/settings';
import type { Room } from '../types';
import type { RoomTypeWithIcon } from '@/constants/roomTypes';

export interface RoomDataGridProps {
  rooms: Room[];
  selectedId: number | null;
  selectedIds: Set<number>;
  onSelect: (room: Room) => void;
  onToggleSelect: (roomId: number) => void;
  onToggleSelectAll: () => void;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
}

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  computer_lab: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  biology_lab: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  chemistry_lab: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  math_lab: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  physics_lab: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  lab: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  library: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  salon: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  gym: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sport_camp: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const CUSTOM_TYPE_COLOR = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

function TypeBadge({ type, roomTypes }: { type: string; roomTypes: RoomTypeWithIcon[] }) {
  const colorClass = TYPE_COLORS[type] || CUSTOM_TYPE_COLOR;
  const roomType = roomTypes.find((option) => option.value === type);
  const label = roomType?.label || type;
  const Icon = roomType?.IconComponent || DoorOpen;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        colorClass
      )}
    >
      <Icon className="me-1 h-3 w-3" />
      {label}
    </span>
  );
}

export function RoomDataGrid({
  rooms,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  isLoading = false,
  compact = false,
  className,
}: RoomDataGridProps) {
  const { t } = useTranslation();
  const { data: roomTypes } = useRoomTypesWithIcons();

  const handleRowClick = useCallback(
    (room: Room, e: React.MouseEvent) => {
      // Don't trigger row click if clicking checkbox
      if ((e.target as HTMLElement).closest('[data-checkbox]')) {
        return;
      }
      onSelect(room);
    },
    [onSelect]
  );

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, room: Room) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(room);
      }
    },
    [onSelect]
  );

  const visibleSelectedCount = rooms.reduce(
    (count, room) => count + (selectedIds.has(room.id) ? 1 : 0),
    0
  );
  const allSelected = rooms.length > 0 && visibleSelectedCount === rooms.length;
  const someSelected = visibleSelectedCount > 0 && !allSelected;

  // Empty state
  if (!isLoading && rooms.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-64 text-muted-foreground bg-white',
          className
        )}
      >
        <DoorOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('rooms.noRooms')}</p>
        <p className="text-sm">{t('rooms.noRoomsHint')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden bg-white', className)}>
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b text-xs text-muted-foreground">
              <th className="w-12 p-3 border-e bg-gray-50" data-checkbox>
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label={t('common.selectAll')}
                  className={cn(someSelected && 'data-[state=indeterminate]:bg-primary/50')}
                />
              </th>
              {!compact && (
                <th className="w-12 p-3 border-e bg-gray-50 text-center font-semibold">#</th>
              )}
              <th className="p-3 border-e bg-gray-50 text-start font-semibold">
                {t('rooms.columns.name')}
              </th>
              <th className="w-28 p-3 border-e bg-gray-50 text-center font-semibold">
                {t('rooms.columns.type')}
              </th>
              {!compact && (
                <th className="w-20 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('rooms.columns.capacity')}
                </th>
              )}
              {!compact && (
                <th className="w-20 p-3 bg-gray-50 text-center font-semibold">
                  {t('rooms.columns.features')}
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rooms.map((room, index) => {
              const isSelected = selectedId === room.id;
              const isChecked = selectedIds.has(room.id);

              return (
                <tr
                  key={room.id}
                  className={cn(
                    'border-b last:border-b-0 cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50',
                    isChecked && !isSelected && 'bg-primary/5'
                  )}
                  onClick={(e) => handleRowClick(room, e)}
                  onKeyDown={(e) => handleKeyDown(e, room)}
                  tabIndex={0}
                  aria-selected={isSelected}
                >
                  {/* Checkbox */}
                  <td
                    className={cn(
                      'w-12 p-3 border-e text-center',
                      isSelected && 'border-s-4 border-s-blue-500'
                    )}
                    data-checkbox
                    onClick={handleCheckboxClick}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggleSelect(room.id)}
                      aria-label={t('common.select')}
                    />
                  </td>

                  {/* Row number - hidden in compact */}
                  {!compact && (
                    <td className="w-12 p-3 border-e text-center text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                  )}

                  {/* Name */}
                  <td className="p-3 border-e">
                    <span className="font-medium text-gray-900">{room.name}</span>
                    {compact && (
                      <span className="text-xs text-muted-foreground ms-2">({room.capacity})</span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="w-28 p-3 border-e text-center">
                    <TypeBadge type={room.type} roomTypes={roomTypes} />
                  </td>

                  {/* Capacity - hidden in compact */}
                  {!compact && (
                    <td className="w-20 p-3 border-e text-center">
                      <span className="text-sm font-medium text-gray-700">{room.capacity}</span>
                    </td>
                  )}

                  {/* Features Count - hidden in compact */}
                  {!compact && (
                    <td className="w-20 p-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-xs font-medium px-2',
                          room.features?.length > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {room.features?.length || 0}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-gray-50 flex justify-between items-center shrink-0">
        <span>{t('rooms.recordCount', { count: rooms.length })}</span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">
            {selectedIds.size} {t('rooms.stats.selected')}
          </span>
        )}
      </div>
    </div>
  );
}

export default RoomDataGrid;
