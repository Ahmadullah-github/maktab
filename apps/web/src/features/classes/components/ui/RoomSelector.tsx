/**
 * RoomSelector Component
 *
 * A dropdown selector for choosing a fixed room (homeroom) for a class.
 * Fetches available rooms from the API and shows warning indicators
 * for rooms already assigned to other classes.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { componentLogger, logger } from '../../utils/logger';

/**
 * Room type matching the API response
 */
export interface Room {
  id: number;
  name: string;
  capacity: number;
  type: string;
  isDeleted?: boolean;
}

export interface RoomSelectorProps {
  /** Currently selected room ID */
  value: number | null;
  /** Callback when room selection changes */
  onChange: (roomId: number | null) => void;
  /** IDs of rooms already assigned to other classes (for warning display) */
  assignedRoomIds?: number[];
  /** Current class ID (to exclude from "assigned" warning) */
  currentClassId?: number | null;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional additional CSS classes */
  className?: string;
  /** Placeholder text when no room is selected */
  placeholder?: string;
}

/**
 * Hook to fetch rooms from the API
 */
function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = (await api.rooms.list()) as Room[];
      return response.filter((room) => !room.isDeleted);
    },
  });
}

/**
 * RoomSelector provides a searchable dropdown for room selection
 *
 * @example
 * ```tsx
 * <RoomSelector
 *   value={selectedRoomId}
 *   onChange={setSelectedRoomId}
 *   assignedRoomIds={[1, 2, 3]}
 * />
 * ```
 */
export function RoomSelector({
  value,
  onChange,
  assignedRoomIds = [],
  currentClassId: _currentClassId,
  disabled = false,
  className,
  placeholder,
}: RoomSelectorProps) {
  // Note: currentClassId is available for future use to exclude current class from warnings
  void _currentClassId;
  const { t } = useTranslation();
  const { data: rooms = [], isLoading } = useRooms();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('RoomSelector', { value, assignedRoomIds: assignedRoomIds.length });
    return () => componentLogger.unmount('RoomSelector');
  }, [value, assignedRoomIds.length]);

  // Find the selected room
  const selectedRoom = useMemo(() => {
    if (value === null) return null;
    return rooms.find((room) => room.id === value) || null;
  }, [rooms, value]);

  // Check if a room is assigned to another class
  const isRoomAssigned = (roomId: number): boolean => {
    return assignedRoomIds.includes(roomId);
  };

  const handleSelect = (roomId: number | null) => {
    logger.debug('Room selected', { roomId });
    onChange(roomId);
  };

  const placeholderText = placeholder || t('classes.form.fixedRoomPlaceholder');
  const noRoomText = t('classes.form.noRoom');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between font-normal',
            !selectedRoom && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedRoom ? (
              <>
                <Building2 className="h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">{selectedRoom.name}</span>
                {isRoomAssigned(selectedRoom.id) && (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-amber-500"
                    aria-label={t('classes.form.roomAssignedWarning')}
                  />
                )}
              </>
            ) : (
              <span>{isLoading ? t('common.loading') : placeholderText}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('common.search')} />
          <CommandList>
            <CommandEmpty>{t('classes.noClasses')}</CommandEmpty>
            <CommandGroup>
              {/* No room option */}
              <CommandItem
                value="__none__"
                onSelect={() => handleSelect(null)}
                className="flex items-center gap-2"
              >
                <Check className={cn('h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                <span className="text-muted-foreground">{noRoomText}</span>
              </CommandItem>

              {/* Room options */}
              {rooms.map((room) => {
                const isAssigned = isRoomAssigned(room.id);
                return (
                  <CommandItem
                    key={room.id}
                    value={room.name}
                    onSelect={() => handleSelect(room.id)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn('h-4 w-4', value === room.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <Building2 className="h-4 w-4 shrink-0 opacity-50" />
                    <span className="flex-1 truncate">{room.name}</span>
                    {room.capacity > 0 && (
                      <span className="text-xs text-muted-foreground">({room.capacity})</span>
                    )}
                    {isAssigned && (
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-500"
                        aria-label={t('classes.form.roomAssignedWarning')}
                      />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default RoomSelector;
