/**
 * RoomsPage Container Component
 *
 * Main page for managing rooms with RTL layout:
 * - Stats Card (LEFT) - hidden when drawer open
 * - DataGrid (CENTER) - 90% when closed, 60% when drawer open
 * - Edit Drawer (LEFT) - 40% width, replaces stats
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - Row click opens edit drawer
 * - Stats summary card
 * - Search and type filtering
 */

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Copy, DoorOpen, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoomFilters } from '../hooks/useRoomFilters';
import { useDeleteRoom, useRooms, useUpdateRoom } from '../hooks/useRooms';
import type { Room, RoomFormValues } from '../types';
import { BulkRoomDialog } from './BulkRoomDialog';
import { RoomDataGrid } from './RoomDataGrid';
import { RoomEditDrawer } from './RoomEditDrawer';
import { RoomFilters } from './RoomFilters';
import { RoomFormDrawer } from './RoomFormDrawer';
import { RoomStatsCard } from './RoomStatsCard';

export interface RoomsPageProps {
  initialSelectedId?: number;
}

export function RoomsPage({ initialSelectedId }: RoomsPageProps) {
  const { t } = useTranslation();

  // Selection state
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(initialSelectedId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  // Data fetching
  const { data: rooms = [], isLoading, error } = useRooms();

  // Mutations
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  // Filtering
  const { search, typeFilter, setSearch, setTypeFilter, filteredRooms, totalCount, filteredCount } =
    useRoomFilters(rooms);

  // Selected room for edit drawer
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find((r) => r.id === selectedRoomId) ?? null;
  }, [rooms, selectedRoomId]);

  // Is drawer open?
  const isDrawerOpen = selectedRoom !== null;

  // Handlers
  const handleSelectRoom = useCallback((room: Room) => {
    setSelectedRoomId(room.id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedRoomId(null);
  }, []);

  const handleToggleSelect = useCallback((roomId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredRooms.length) {
        return new Set();
      }
      return new Set(filteredRooms.map((r) => r.id));
    });
  }, [filteredRooms]);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleUpdateRoom = useCallback(
    async (id: number, data: Partial<RoomFormValues>) => {
      await updateRoom.mutateAsync({ id, data });
    },
    [updateRoom]
  );

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    // Delete all selected rooms
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await deleteRoom.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setSelectedRoomId(null);
  }, [selectedIds, deleteRoom]);

  const handleBulkEdit = useCallback(() => {
    // Open the first selected room in the drawer
    const firstSelectedId = Array.from(selectedIds)[0];
    if (firstSelectedId) {
      setSelectedRoomId(firstSelectedId);
    }
  }, [selectedIds]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#003366]/10 flex items-center justify-center animate-pulse">
            <DoorOpen className="w-6 h-6 text-[#003366]" />
          </div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <DoorOpen className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive">{t('rooms.errors.fetchFailed')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-br from-gray-50 via-slate-50 to-gray-100">
      {/* Sticky Header */}
      <PageHeader
        icon={DoorOpen}
        title={t('rooms.pageTitle')}
        subtitle={t('rooms.pageSubtitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsBulkDialogOpen(true)}
              className="gap-2 border-2 border-slate-200 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" />
              {t('rooms.bulkAdd', 'ایجاد دسته‌ای')}
            </Button>
            <Button
              onClick={handleOpenCreateDrawer}
              className="gap-2 bg-linear-to-r from-[#003366] to-[#004488] hover:from-[#002244] hover:to-[#003366] text-white shadow-lg"
            >
              <Plus className="h-4 w-4" />
              {t('rooms.add')}
            </Button>
          </>
        }
      />

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-white">
        <RoomFilters
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onAddClick={handleOpenCreateDrawer}
          totalCount={totalCount}
          filteredCount={filteredCount}
          hideAddButton
          hideStats={isDrawerOpen}
          selectedCount={selectedIds.size}
          onDeselectAll={handleDeselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
        />
      </div>

      {/* Main Content Area - Connected layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* DataGrid - Expands/Contracts based on drawer state */}
        <div
          className={`transition-all duration-300 ease-in-out h-full overflow-auto ${
            isDrawerOpen ? 'flex-1 min-w-0' : 'flex-1'
          }`}
        >
          <RoomDataGrid
            rooms={filteredRooms}
            selectedId={selectedRoomId}
            selectedIds={selectedIds}
            onSelect={handleSelectRoom}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            isLoading={isLoading}
            compact={isDrawerOpen}
            className="h-full"
          />
        </div>

        {/* Stats Card OR Edit Drawer */}
        <div
          className={`transition-all duration-300 ease-in-out h-full border-s border-gray-200 bg-gray-50 shrink-0 overflow-auto ${
            isDrawerOpen ? 'w-[480px]' : 'w-[300px]'
          }`}
        >
          {isDrawerOpen && selectedRoom ? (
            <RoomEditDrawer
              room={selectedRoom}
              onClose={handleCloseDrawer}
              onUpdate={handleUpdateRoom}
              isUpdating={updateRoom.isPending}
              className="h-full"
            />
          ) : (
            <RoomStatsCard rooms={rooms} selectedCount={selectedIds.size} className="h-full" />
          )}
        </div>
      </div>

      {/* Create Room Drawer */}
      <RoomFormDrawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen} />

      {/* Bulk Create Dialog */}
      <BulkRoomDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen} />
    </div>
  );
}

export default RoomsPage;
