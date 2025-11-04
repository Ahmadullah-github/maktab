import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, Minus, Plus } from "lucide-react";
import { SubjectInfo } from "@/data/afghanistanCurriculum";
import { useLanguageCtx } from "@/i18n/provider";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface SubjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  subject: SubjectInfo & { periodsPerWeek: number };
  grade: number;
  onSave: (updatedSubject: { name: string; code: string; periodsPerWeek: number; requiredRoomType?: string; isDifficult: boolean }) => Promise<void>;
}

const ROOM_TYPES = [
  "Regular",
  "Lab",
  "Computer Lab",
  "Science Lab",
  "Library",
  "Sports Hall",
  "Art Room",
  "Music Room"
];

export function SubjectEditDialog({ open, onClose, subject, grade, onSave }: SubjectEditDialogProps) {
  const { isRTL, t } = useLanguageCtx();
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code);
  const [periodsPerWeek, setPeriodsPerWeek] = useState(subject.periodsPerWeek);
  const [roomType, setRoomType] = useState(subject.requiredRoomType || "Regular");
  const [isDifficult, setIsDifficult] = useState(subject.isDifficult || false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(subject.name);
      setCode(subject.code);
      setPeriodsPerWeek(subject.periodsPerWeek);
      setRoomType(subject.requiredRoomType || "Regular");
      setIsDifficult(subject.isDifficult || false);
      setErrors({});
    }
  }, [open, subject]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Subject name is required";
    if (!code.trim()) newErrors.code = "Subject code is required";
    if (periodsPerWeek < 1 || periodsPerWeek > 10) newErrors.periodsPerWeek = "Periods must be between 1 and 10";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave({
        name,
        code,
        periodsPerWeek,
        requiredRoomType: roomType,
        isDifficult,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save subject:", error);
      setErrors({ general: "Failed to save subject" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.common.subjectDialog?.editTitle?.replace("{{grade}}", grade.toString()) || `Edit Subject - Grade ${grade}`}</DialogTitle>
          <DialogDescription>
            {t.common.subjectDialog?.editDescription || "Modify subject details and update periods per week"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subject Name */}
          <div className="space-y-2">
            <Label htmlFor="subjectName">{t.common.subjectDialog?.subjectName || "Subject Name"} *</Label>
            <Input
              id="subjectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.common.subjectDialog?.namePlaceholder || "e.g., Mathematics"}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Subject Code */}
          <div className="space-y-2">
            <Label htmlFor="subjectCode">{t.common.subjectDialog?.subjectCode || "Subject Code"} *</Label>
            <Input
              id="subjectCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.common.subjectDialog?.codePlaceholder || "e.g., MATH7"}
              className={errors.code ? "border-red-500" : ""}
            />
            {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
          </div>

          {/* Periods Per Week */}
          <div className="space-y-2">
            <Label htmlFor="periodsPerWeek">{t.common.subjectDialog?.periodsPerWeek || "Periods Per Week"} *</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPeriodsPerWeek(Math.max(1, periodsPerWeek - 1))}
                disabled={periodsPerWeek <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="periodsPerWeek"
                type="number"
                value={periodsPerWeek}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 10) {
                    setPeriodsPerWeek(val);
                  }
                }}
                className={`text-center font-semibold w-20 ${errors.periodsPerWeek ? "border-red-500" : ""}`}
                min="1"
                max="10"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPeriodsPerWeek(Math.min(10, periodsPerWeek + 1))}
                disabled={periodsPerWeek >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.periodsPerWeek && <p className="text-xs text-red-500">{errors.periodsPerWeek}</p>}
          </div>

          {/* Room Type */}
          <div className="space-y-2">
            <Label htmlFor="roomType">{t.common.subjectDialog?.requiredRoomType || "Required Room Type"}</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger>
                <SelectValue placeholder={t.common.subjectDialog?.selectRoomType || "Select room type"} />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Is Difficult */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="isDifficult" className="cursor-pointer">{t.common.subjectDialog?.difficultSubject || "Difficult Subject"}</Label>
              <p className="text-xs text-muted-foreground">{t.common.subjectDialog?.difficultDescription || "Mark if requires more focus (scheduled in morning)"}</p>
            </div>
            <Switch
              id="isDifficult"
              checked={isDifficult}
              onCheckedChange={setIsDifficult}
            />
          </div>

          {errors.general && (
            <p className="text-sm text-red-500 text-center">{errors.general}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className={cn(isRTL && "flex-row")}>
            <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            {t.actions?.cancel || "Cancel"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving} className={cn(isRTL && "flex-row")}>
            {isSaving ? (
              <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
            ) : (
              <Save className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            )}
            {t.actions?.save || "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

