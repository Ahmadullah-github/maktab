import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Lock, AlertTriangle } from "lucide-react";
import { useLanguageCtx } from "@/i18n/provider";
import { useRoomStore } from "@/stores/useRoomStore";
import { ClassGroup } from "@/types";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface ClassFixedRoomModalProps {
  classItem: ClassGroup;
  isOpen: boolean;
  onSave: (updated: Partial<ClassGroup>) => Promise<void>;
  onClose: () => void;
}

export function ClassFixedRoomModal({
  classItem,
  isOpen,
  onSave,
  onClose,
}: ClassFixedRoomModalProps) {
  const { isRTL, language } = useLanguageCtx();
  const { rooms } = useRoomStore();

  const [fixedRoomEnabled, setFixedRoomEnabled] = useState(!!classItem.fixedRoomId);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
    classItem.fixedRoomId ?? null
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setFixedRoomEnabled(!!classItem.fixedRoomId);
      setSelectedRoomId(classItem.fixedRoomId ?? null);
    }
  }, [isOpen, classItem.fixedRoomId]);

  const handleSave = async () => {
    if (fixedRoomEnabled && !selectedRoomId) {
      alert(isRTL ? "لطفاً یک اتاق را انتخاب کنید" : "Please select a room");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...classItem,
        fixedRoomId: fixedRoomEnabled ? selectedRoomId : null,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
      alert(isRTL ? "خطا در ذخیره سازی" : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const getText = (key: string) => {
    const texts: Record<string, { en: string; fa: string }> = {
      title: { en: "Lock Room for Class", fa: "قفل اتاق برای صنف" },
      description: {
        en: "Configure fixed room assignment for this class",
        fa: "تنظیم اتاق ثابت برای این صنف",
      },
      lockRoom: { en: "Lock room for this class", fa: "قفل اتاق برای این صنف" },
      selectRoom: { en: "Select room", fa: "انتخاب اتاق" },
      selectPlaceholder: { en: "Choose a room...", fa: "انتخاب کنید..." },
      tooltip: {
        en: "When enabled, this class will always be scheduled in the selected room. No room changes will be allowed during timetable generation.",
        fa: "وقتی فعال باشد، این صنف همیشه در اتاق انتخاب‌شده برنامه‌ریزی می‌شود. هیچ تغییر اتاقی در تولید برنامه مجاز نیست.",
      },
      warning: {
        en: "⚠️ Warning: Locking multiple classes to the same room may make timetable generation infeasible if they have overlapping schedule requirements.",
        fa: "⚠️ هشدار: قفل کردن چندین صنف به یک اتاق ممکن است تولید برنامه را ناممکن کند اگر نیازمندی‌های زمانی همپوشانی داشته باشند.",
      },
      capacityWarning: {
        en: "Note: Room capacity is smaller than class size",
        fa: "توجه: ظرفیت اتاق کمتر از تعداد دانش‌آموزان صنف است",
      },
      save: { en: "Save", fa: "ذخیره" },
      cancel: { en: "Cancel", fa: "لغو" },
    };
    return texts[key][language];
  };

  const selectedRoom = rooms.find((r) => Number(r.id) === selectedRoomId);
  const hasCapacityIssue =
    selectedRoom && selectedRoom.capacity < classItem.studentCount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn("sm:max-w-[500px]", isRTL && "text-right")}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            <span>{getText("title")}</span>
          </DialogTitle>
          <DialogDescription>{getText("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-grow">
              <Label className="text-base font-medium">{getText("lockRoom")}</Label>
              <p className="text-sm text-muted-foreground">{getText("tooltip")}</p>
            </div>
            <Switch
              checked={fixedRoomEnabled}
              onCheckedChange={setFixedRoomEnabled}
              className={cn(isRTL && "mr-3")}
            />
          </div>

          {fixedRoomEnabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="room-select">{getText("selectRoom")}</Label>
                <Select
                  value={selectedRoomId?.toString() || ""}
                  onValueChange={(val) => setSelectedRoomId(Number(val))}
                >
                  <SelectTrigger id="room-select">
                    <SelectValue placeholder={getText("selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}{" "}
                        {room.capacity ? `(${room.capacity} ${language === "fa" ? "نفر" : "seats"})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasCapacityIssue && (
                <div className="flex items-start gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-md">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{getText("capacityWarning")}</span>
                </div>
              )}

              <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-md">
                {getText("warning")}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className={cn(isRTL && "flex-row-reverse")}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {getText("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (language === "fa" ? "در حال ذخیره..." : "Saving...") : getText("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
