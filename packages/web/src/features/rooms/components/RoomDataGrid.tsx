/**
 * RoomDataGrid Component
 *
 * DataGrid for displaying and managing rooms
 * Supports row selection, type badges, and features count
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { cn } from '@/lib/utils';
import { DoorOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Room, RoomType } from '../types';
import { componentLogger } from '../utils/logger';

export interface RoomDataGridProps {
  /** Array of rooms to display */
  rooms: Room[];
  /** Currently selected room ID */
  selectedId: number | null;
  /** Callback when a room row is selected */
  onSelect: (room: Room | null) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Room type badge color mapping
 */
const TYPE_COLORS: Record<RoomType, string> = {
  classroom: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  lab: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  gym: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  library: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  '': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Translates room type value to Farsi label
 */
function translateRoomType(roomType: RoomType, t: (key: string) => string): string {
  const roomTypeMap: Record<RoomType, string> = {
    classroom: t('rooms.type.classroom'),
    lab: t('rooms.type.lab'),
    gym: t('rooms.type.gym'),
    library: t('rooms.type.library'),
    '': t('rooms.type.none'),
  };
  return roomTypeMap[roomType] || '—';
}

/**
 * TypeBadge displays a room type with appropriate coloring
 */
function TypeBadge({ type, t }: { type: RoomType; t: (key: string) => string }) {
  const colorClass = TYPE_COLORS[type] || TYPE_COLORS[''];
  const label = translateRoomType(type, t);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
        colorClass
      )}
    >
      {label}
    </span>
  );
}

/**
 * RoomDataGrid displays rooms in a table format with selection
 *
 * @example
 * ```tsx
 * <RoomDataGrid
 *   rooms={rooms}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 * />
 * ```
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function RoomDataGrid({
  rooms,
  selectedId,
  onSelect,
  isLoading = false,
  className,
}: RoomDataGridProps) {
  const { t } = useTranslation();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('RoomDataGrid', { roomCount: rooms.length, selectedId });
    return () => componentLogger.unmount('RoomDataGrid');
  }, []);

  const handleRowClick = (room: Room) => {
    // Toggle selection if clicking the same row
    if (selectedId === room.id) {
      onSelect(null);
    } else {
      onSelect(room);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, room: Room) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(room);
    }
  };

  // Empty state
  if (!isLoading && rooms.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-64 text-muted-foreground',
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
    <div
      className={cn(
        'flex flex-col h-full border rounded-md overflow-hidden bg-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex border-b bg-muted/40 font-medium text-xs text-muted-foreground">
        <div className="w-10 border-e flex items-center justify-center shrink-0">#</div>
        <div className="flex-1 min-w-[140px] px-3 py-2 border-e">{t('rooms.columns.name')}</div>
        <div className="w-24 px-3 py-2 border-e text-center">{t('rooms.columns.type')}</div>
        <div className="w-20 px-3 py-2 border-e text-center">{t('rooms.columns.capacity')}</div>
        <div className="w-24 px-3 py-2 text-center">{t('rooms.columns.features')}</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {rooms.map((room, index) => (
          <div
            key={room.id}
            className={cn(
              'flex border-b last:border-b-0 cursor-pointer transition-colors',
              selectedId === room.id ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
            )}
            onClick={() => handleRowClick(room)}
            onKeyDown={(e) => handleKeyDown(e, room)}
            role="row"
            tabIndex={0}
            aria-selected={selectedId === room.id}
          >
            {/* Row number */}
            <div className="w-10 border-e flex items-center justify-center shrink-0 text-xs text-muted-foreground bg-muted/10">
              {index + 1}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-[140px] px-3 py-2 border-e">
              <span className="truncate font-medium">{room.name}</span>
            </div>

            {/* Type */}
            <div className="w-24 px-3 py-2 border-e flex items-center justify-center">
              <TypeBadge type={room.type} t={t} />
            </div>

            {/* Capacity */}
            <div className="w-20 px-3 py-2 border-e text-center text-sm">{room.capacity}</div>

            {/* Features Count */}
            <div className="w-24 px-3 py-2 text-center text-sm">{room.features?.length || 0}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20 flex justify-between">
        <span>{t('rooms.recordCount', { count: rooms.length })}</span>
      </div>
    </div>
  );
}

export default RoomDataGrid;
