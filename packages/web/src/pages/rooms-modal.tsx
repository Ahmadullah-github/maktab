import React, { useState, useEffect, useMemo } from "react";
import { Room } from "@/types";
import { Plus, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useRoomStore } from "@/stores/useRoomStore";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { RoomCard } from "@/components/entities/room/room-card";
import { RoomStatistics } from "@/components/entities/room/room-statistics";
import { RoomFilters } from "@/components/entities/room/room-filters";
import { RoomForm } from "@/components/entities/room/room-form";
import { useLanguageCtx } from "@/i18n/provider";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RoomsPageModal() {
  const { isRTL, t, language } = useLanguageCtx();
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const {
    rooms,
    isLoading,
    error,
    fetchRooms,
    addRoom,
    updateRoom,
    deleteRoom,
  } = useRoomStore();

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Get unique room types for filter pills
  const roomTypes = useMemo(() => {
    const types = new Set(rooms.map((room) => room.type).filter(Boolean));
    return Array.from(types).sort();
  }, [rooms]);

  // Filter and sort rooms
  const filteredAndSortedRooms = useMemo(() => {
    let filtered = rooms;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(search) ||
          room.type.toLowerCase().includes(search)
      );
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((room) => room.type === selectedType);
    }

    // Apply sorting
    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "capacity-asc":
        sorted.sort((a, b) => a.capacity - b.capacity);
        break;
      case "capacity-desc":
        sorted.sort((a, b) => b.capacity - a.capacity);
        break;
      case "type-asc":
        sorted.sort((a, b) => a.type.localeCompare(b.type));
        break;
      default:
        break;
    }

    return sorted;
  }, [rooms, searchTerm, selectedType, sortBy]);

  const handleAddRoom = () => {
    setEditingRoom(null);
    setShowDialog(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setShowDialog(true);
  };

  const handleDeleteRoom = (roomId: string) => {
    setDeleteRoomId(roomId);
  };

  const confirmDelete = async () => {
    if (!deleteRoomId) return;

    try {
      await deleteRoom(deleteRoomId);
      toast.success(t.rooms.deleteSuccess);
      setDeleteRoomId(null);
    } catch (err) {
      console.error("Failed to delete room:", err);
      toast.error(t.rooms.deleteError);
    }
  };

  const handleSubmit = async (roomData: Omit<Room, "id"> | Room) => {
    try {
      if ("id" in roomData) {
        await updateRoom(roomData);
        toast.success(t.rooms.updateSuccess);
      } else {
        await addRoom(roomData);
        toast.success(t.rooms.saveSuccess);
      }
      setShowDialog(false);
      setEditingRoom(null);
    } catch (err) {
      console.error("Failed to save room:", err);
      toast.error("id" in roomData ? t.rooms.updateError : t.rooms.saveError);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    setSortBy("name-asc");
  };

  const hasActiveFilters = searchTerm !== "" || selectedType !== "all";

  if (isLoading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title={isRTL ? "خطا در بارگذاری کلاس‌ها" : "Error Loading Rooms"}
        message={error}
        onRetry={fetchRooms}
      />
    );
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb
        items={[
          { label: isRTL ? "خانه" : "Home", href: "/" },
          { label: t.rooms.pageTitle },
        ]}
      />

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between",
        isRTL && "flex-row"
      )}>
        <div className={cn(isRTL && "text-right")}>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3",
            isRTL && "flex-row"
          )}>
            <Building className="h-8 w-8 text-blue-600" />
            {t.rooms.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.rooms.pageDescription}
          </p>
        </div>
        <Button
          onClick={handleAddRoom}
          className={cn(
            "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
            isRTL && "flex-row"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.rooms.add}
        </Button>
      </div>

      {/* Statistics */}
      {rooms.length > 0 && <RoomStatistics rooms={rooms} isRTL={isRTL} />}

      {/* Filters */}
      {rooms.length > 0 && (
        <RoomFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          sortBy={sortBy}
          onSortChange={setSortBy}
          roomTypes={roomTypes}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          isRTL={isRTL}
        />
      )}

      {/* Empty State - No rooms at all */}
      {rooms.length === 0 && (
        <EmptyState
          title={t.rooms.emptyState.title}
          description={t.rooms.emptyState.description}
          icon={Building}
          action={{
            label: t.rooms.emptyState.addFirst,
            onClick: handleAddRoom,
          }}
          className="my-12"
        />
      )}

      {/* Empty State - No search results */}
      {rooms.length > 0 && filteredAndSortedRooms.length === 0 && (
        <EmptyState
          title={t.rooms.emptySearch.title}
          description={t.rooms.emptySearch.description}
          icon={Building}
          action={{
            label: t.rooms.clearFilters,
            onClick: handleClearFilters,
          }}
          className="my-12"
        />
      )}

      {/* Room Cards Grid */}
      {filteredAndSortedRooms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={handleEditRoom}
              onDelete={handleDeleteRoom}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={cn("sm:max-w-md", isRTL && "rtl")}>
          <DialogHeader className={cn(isRTL && "text-right")}>
            <DialogTitle>
              {editingRoom ? t.rooms.editRoom : t.rooms.addNewRoom}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right")}>
              {editingRoom
                ? (isRTL ? "اطلاعات کلاس را ویرایش کنید" : "Edit the room's information")
                : (isRTL ? "اطلاعات کلاس نو را وارد کنید" : "Enter the new room's information")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <RoomForm
              room={editingRoom || undefined}
              onSubmit={handleSubmit}
              onCancel={() => setShowDialog(false)}
              isRTL={isRTL}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteRoomId !== null}
        onOpenChange={(open) => !open && setDeleteRoomId(null)}
      >
        <AlertDialogContent className={cn(isRTL && "rtl")}>
          <AlertDialogHeader className={cn(isRTL && "text-right")}>
            <AlertDialogTitle>
              {isRTL ? "حذف کلاس" : "Delete Room"}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right")}>
              {t.rooms.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isRTL && "flex-row")}>
            <AlertDialogCancel>{isRTL ? "لغو" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRTL ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

