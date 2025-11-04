import React, { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container";
import { EmptyState } from "@/components/common/empty-state";
import { useLanguageCtx } from "@/i18n/provider";
import { Building, Plus, Trash2, Save, AlertCircle, Users, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { Room } from "@/types";
import { useRoomStore } from "@/stores/useRoomStore";
import { dataService } from "@/lib/dataService";
import { toast } from "sonner";

interface RoomsStepProps {
  data: Room[];
  onUpdate: (data: Room[]) => void;
}

// Common room types in Afghanistan schools
const COMMON_ROOM_TYPES = [
  "عادی",
  "آزمایشگاه کیمیا",
  "آزمایشگاه فزیک",
  "آزمایشگاه کمپیوتر",
  "آزمایشگاه بیولوژی",
  "سالن بزرگ",
  "کتابخانه",
  "سالن ورزشی",
];

const COMMON_ROOM_TYPES_EN = [
  "Regular",
  "Chemistry Lab",
  "Physics Lab",
  "Computer Lab",
  "Biology Lab",
  "Assembly Hall",
  "Library",
  "Gymnasium",
];

export function RoomsStep({ data, onUpdate }: RoomsStepProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pendingRooms, setPendingRooms] = useState<Room[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const { isRTL, t, language } = useLanguageCtx();
  const { addRoom, updateRoom, deleteRoom, fetchRooms } = useRoomStore();
  const [isSaving, setIsSaving] = useState(false);
  const roomsLoadedRef = useRef(false);

  const commonRoomTypes = language === "fa" ? COMMON_ROOM_TYPES : COMMON_ROOM_TYPES_EN;

  useEffect(() => {
    // Initialize with data from props if available, otherwise load from database
    if (data && data.length > 0) {
      setRooms(data);
      setPendingRooms(data);
      // Don't call onUpdate here to prevent infinite loop - only call when user makes changes
      const types: string[] = [...new Set(data.map(r => r.type).filter(Boolean) as string[])];
      setAvailableRoomTypes(types);
      roomsLoadedRef.current = true;
    } else {
      loadRoomsAndTypes();
    }
  }, [data]);

  const loadRoomsAndTypes = async () => {
    try {
      const existingRooms = await dataService.getRooms();
      // Only set rooms if we haven't loaded them yet to prevent duplication
      if (!roomsLoadedRef.current) {
        setRooms(existingRooms);
        setPendingRooms(existingRooms);
        // Don't call onUpdate here to prevent infinite loop - only call when user makes changes
        roomsLoadedRef.current = true;
      }
      const types: string[] = [...new Set(existingRooms.map(r => r.type).filter(Boolean) as string[])];
      setAvailableRoomTypes(types);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const handleAddBlankRow = () => {
    const newRoom: Room = {
      id: `temp-${Date.now()}`,
      name: "",
      capacity: 30,
      type: "",
      features: [],
      unavailable: [],
    };
    setPendingRooms([...pendingRooms, newRoom]);
  };

  const handleFieldChange = (id: string, field: keyof Room, value: any) => {
    setPendingRooms(pendingRooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRow = (id: string) => {
    setPendingRooms(pendingRooms.filter(r => r.id !== id));
  };

  const isRowValid = (room: Room) => {
    return room.name.trim().length > 0 && room.type.trim().length > 0 && room.capacity > 0;
  };

  const handleSaveAll = async () => {
    const roomsToSave = pendingRooms.filter(isRowValid);
    const invalidRooms = pendingRooms.filter(r => !isRowValid(r));

    if (invalidRooms.length > 0) {
      toast.error(
        language === "fa" 
          ? `${invalidRooms.length} کلاس اطلاعات ناقص دارد. لطفاً تمام فیلدها را پر کنید.`
          : `${invalidRooms.length} room(s) have incomplete information. Please fill all fields.`
      );
      return;
    }

    if (roomsToSave.length === 0) {
      toast.error(t.common.noRoomsToSave || "No rooms to save");
      return;
    }

    setIsSaving(true);
    try {
      const savedRooms: Room[] = [];
      
      for (const room of roomsToSave) {
        if (String(room.id).startsWith("temp-")) {
          const { id, ...roomData } = room;
          const saved = await addRoom(roomData);
          if (saved) {
            savedRooms.push(saved);
            // Add new room types to available types
            if (room.type && !availableRoomTypes.includes(room.type)) {
              setAvailableRoomTypes([...availableRoomTypes, room.type]);
            }
          }
        } else {
          const updated = await updateRoom(room);
          if (updated) {
            savedRooms.push(updated);
            if (room.type && !availableRoomTypes.includes(room.type)) {
              setAvailableRoomTypes([...availableRoomTypes, room.type]);
            }
          }
        }
      }

      setPendingRooms(savedRooms);
      setRooms(savedRooms);
      onUpdate(savedRooms);
      // Update the store state directly to avoid refetching and duplication
      await fetchRooms();

      toast.success(t.common.roomsSavedSuccess?.replace('{{count}}', `${savedRooms.length}`) || `${savedRooms.length} room(s) saved successfully`);
    } catch (error) {
      console.error("Error saving rooms:", error);
      toast.error(t.common.failedToSaveRooms || "Failed to save rooms");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedRoom = async (id: string) => {
    if (!confirm(t.rooms?.deleteConfirm || "Are you sure you want to delete this room?")) {
      return;
    }

    try {
      await deleteRoom(id);
      const updatedRooms = pendingRooms.filter(r => r.id !== id);
      setPendingRooms(updatedRooms);
      setRooms(updatedRooms);
      onUpdate(updatedRooms);
      toast.success(t.common.roomDeleted || "Room deleted successfully");
    } catch (error) {
      toast.error(t.common.failedToDeleteRoom || "Failed to delete room");
    }
  };

  const stats = useMemo(() => {
    const savedRooms = pendingRooms.filter(r => !String(r.id).startsWith("temp-"));
    const newRooms = pendingRooms.filter(r => String(r.id).startsWith("temp-"));
    const totalCapacity = pendingRooms.filter(isRowValid).reduce((sum, r) => sum + r.capacity, 0);
    
    return {
      totalSaved: savedRooms.length,
      totalNew: newRooms.length,
      totalCapacity,
      avgCapacity: pendingRooms.filter(isRowValid).length > 0 
        ? Math.round(totalCapacity / pendingRooms.filter(isRowValid).length) 
        : 0,
      uniqueTypes: new Set(pendingRooms.filter(isRowValid).map(r => r.type).filter(Boolean)).size,
    };
  }, [pendingRooms]);

  const hasChanges = JSON.stringify(pendingRooms) !== JSON.stringify(rooms);
  const hasValidRows = pendingRooms.some(isRowValid);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <WizardStepContainer
        title={t.rooms.title}
        description={t.rooms?.pageDescription || "Manage your school rooms and laboratories"}
        icon={<Building className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        {/* Statistics Cards */}
        {pendingRooms.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Building className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {t.common.savedRooms || "Saved Rooms"}
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalSaved}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  {t.common.newRooms || "New Rooms"}
                </span>
              </div>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.totalNew}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  {t.rooms?.totalCapacity || "Total Capacity"}
                </span>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.totalCapacity}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-1">
                <Building className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {t.common.uniqueTypes || "Unique Types"}
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.uniqueTypes}</p>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Button
            onClick={handleAddBlankRow}
            variant="outline"
            className={cn("flex items-center gap-2 border-dashed border-2", isRTL && "flex-row")}
          >
            <Plus className="h-4 w-4" />
            {t.common.addNewRoom || "Add New Room"}
          </Button>
          
          {hasChanges && hasValidRows && (
            <Button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Save className="h-4 w-4" />
              {isSaving 
                ? (t.common.saving || "Saving...") 
                : (language === "fa" ? `ذخیره تمام تغییرات (${pendingRooms.filter(isRowValid).length})` : `Save All Changes (${pendingRooms.filter(isRowValid).length})`)
              }
            </Button>
          )}
        </div>

        {/* Empty State */}
        {pendingRooms.length === 0 && (
          <EmptyState
            title={t.rooms.emptyState?.title || "No rooms added yet"}
            description={t.rooms.emptyState?.description || "Add your school rooms. Each room needs a name, type, and capacity."}
            icon={Building}
            action={{ label: t.rooms.emptyState?.addFirst || "Add First Room", onClick: handleAddBlankRow }}
            className="my-12"
          />
        )}

        {/* Rooms Table */}
        {pendingRooms.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-700">
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.rooms.name} <span className="text-red-500">*</span>
                    <span className="inline-block align-middle ml-1">
                      <HelpCircle className="h-3 w-3 text-gray-400" aria-label={t.rooms.help?.name} />
                    </span>
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.rooms.type} <span className="text-red-500">*</span>
                    <span className="inline-block align-middle ml-1">
                      <HelpCircle className="h-3 w-3 text-gray-400" aria-label={t.rooms.help?.type} />
                    </span>
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.rooms.capacity} <span className="text-red-500">*</span>
                    <span className="inline-block align-middle ml-1">
                      <HelpCircle className="h-3 w-3 text-gray-400" aria-label={t.rooms.help?.capacity} />
                    </span>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300 min-w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingRooms.map((room, index) => {
                  const isValid = isRowValid(room);
                  const isNew = String(room.id).startsWith("temp-");
                  const isEdited = !isNew && JSON.stringify(room) !== JSON.stringify(rooms.find(r => r.id === room.id));

                  return (
                    <tr
                      key={room.id}
                      className={cn(
                        "border-b border-gray-200 dark:border-gray-700 transition-colors",
                        !isValid && "bg-red-50 dark:bg-red-950/20",
                        isValid && isNew && "bg-green-50 dark:bg-green-950/20",
                        isValid && isEdited && "bg-yellow-50 dark:bg-yellow-950/20"
                      )}
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <Input
                          value={room.name}
                          onChange={(e) => handleFieldChange(room.id, "name", e.target.value)}
                          placeholder={t.rooms.placeholder?.name}
                          className={cn("min-w-[200px]", !isValid && "border-red-500")}
                        />
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <Input
                          value={room.type}
                          onChange={(e) => handleFieldChange(room.id, "type", e.target.value)}
                          placeholder={t.rooms.placeholder?.type}
                          list={`room-types-${room.id}`}
                          className={cn("min-w-[180px]", !isValid && "border-red-500")}
                        />
                        <datalist id={`room-types-${room.id}`}>
                          {commonRoomTypes.map(type => <option key={type} value={type} />)}
                          {availableRoomTypes.filter(type => !commonRoomTypes.includes(type)).map(type => <option key={type} value={type} />)}
                        </datalist>
                      </td>

                      {/* Capacity */}
                      <td className="py-3 px-4">
                        <div className="relative">
                          <Input
                            type="number"
                            value={room.capacity || ""}
                            onChange={(e) => handleFieldChange(room.id, "capacity", e.target.value ? parseInt(e.target.value) : 0)}
                            placeholder={t.rooms.placeholder?.capacity}
                            className={cn("min-w-[100px]", !isValid && "border-red-500")}
                            min="1"
                            max="1000"
                          />
                          <div className={cn("absolute top-1/2 -translate-y-1/2 flex items-center text-gray-400 pointer-events-none", isRTL ? "left-3" : "right-3")}>
                            <Users className="h-4 w-4" />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {isValid && (
                            <Badge variant={isNew ? "default" : isEdited ? "secondary" : "outline"} className="mr-2">
                              {isNew 
                                ? (t.common.new || "New") 
                                : isEdited 
                                  ? (t.common.edited || "Edited") 
                                  : (t.common.saved || "Saved")
                              }
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => !isNew && confirm(
                              t.common.confirm || "Are you sure?"
                            ) && handleDeleteSavedRoom(room.id)}
                            disabled={isNew}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title={isNew ? (t.common.deleteAvailableAfterSaving || "Delete will be available after saving") : t.actions?.delete || "Delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Help Text */}
        {pendingRooms.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className={cn("text-sm text-blue-900 dark:text-blue-100", isRTL && "text-right")}>
              <strong>{t.common.tip || "Tip:"}</strong>{" "}
              {language === "fa" 
                ? "می‌توانید چندین کلاس را همزمان اضافه کنید. کلاس‌های جدید به رنگ سبز، کلاس‌های ویرایش شده به رنگ زرد نمایش داده می‌شوند. برای ذخیره همه تغییرات روی دکمه 'ذخیره تمام تغییرات' کلیک کنید."
                : "You can add multiple rooms at once. New rooms are highlighted in green, edited rooms in yellow. Click 'Save All Changes' to save all modifications at once."}
            </p>
          </div>
        )}
      </WizardStepContainer>
    </div>
  );
}
