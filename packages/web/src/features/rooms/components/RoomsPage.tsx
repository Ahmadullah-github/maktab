/**
 * RoomsPage Container Component
 *
 * Main page for managing rooms. Composes:
 * - RoomFilters for search and type filtering
 * - RoomDataGrid for displaying rooms
 * - RoomInspector for viewing/editing details
 * - RoomFormDrawer for creating new rooms
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomFilters } from '../hooks/useRoomFilters';
import { useDeleteRoom, useRooms, useUpdateRoom } from '../hooks/useRooms';
import type { Room, RoomFormValues } from '../types';
import { logger } from '../utils/logger';
import { RoomDataGrid } from './RoomDataGrid';
import { RoomFilters } from './RoomFilters';
import { RoomFormDrawer } from './RoomFormDrawer';
import { RoomInspector } from './RoomInspector';

export interface RoomsPageProps {
  /** Optional initial selected room ID */
  initialSelectedId?: number;
}

/**
 * RoomsPage is the main container for the rooms feature
 *
 * @example
 * ```tsx
 * <RoomsPage />
 * ```
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */
export function RoomsPage({ initialSelectedId }: RoomsPageProps) {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(initialSelectedId ?? null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Data fetching
  const { data: rooms = [], isLoading, error } = useRooms();

  // Mutations
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  // Filtering
  const { search, typeFilter, setSearch, setTypeFilter, filteredRooms, totalCount, filteredCount } =
    useRoomFilters(rooms);

  // Selected room
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find((r) => r.id === selectedRoomId) ?? null;
  }, [rooms, selectedRoomId]);

  // Handlers
  const handleSelectRoom = useCallback((room: Room | null) => {
    setSelectedRoomId(room?.id ?? null);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedRoomId(null);
  }, []);

  const handleOpenDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleUpdateRoom = useCallback(
    async (id: number, data: Partial<RoomFormValues>) => {
      logger.debug('RoomsPage: updating room', { id, data });
      await updateRoom.mutateAsync({ id, data });
    },
    [updateRoom]
  );

  const handleDeleteRoom = useCallback(
    async (id: number) => {
      logger.debug('RoomsPage: deleting room', { id });
      await deleteRoom.mutateAsync(id);
      // Close inspector after successful deletion
      setSelectedRoomId(null);
    },
    [deleteRoom]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{t('rooms.errors.fetchFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('rooms.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('rooms.pageSubtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b">
        <RoomFilters
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onAddClick={handleOpenDrawer}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* DataGrid */}
        <div className={`flex-1 p-4 overflow-auto transition-all ${selectedRoom ? 'pe-0' : ''}`}>
          <RoomDataGrid
            rooms={filteredRooms}
            selectedId={selectedRoomId}
            onSelect={handleSelectRoom}
            isLoading={isLoading}
          />
        </div>

        {/* Inspector Panel */}
        {selectedRoom && (
          <RoomInspector
            room={selectedRoom}
            onClose={handleCloseInspector}
            onUpdate={handleUpdateRoom}
            onDelete={handleDeleteRoom}
            isUpdating={updateRoom.isPending}
            isDeleting={deleteRoom.isPending}
          />
        )}
      </div>

      {/* Form Drawer */}
      <RoomFormDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </div>
  );
}

export default RoomsPage;
