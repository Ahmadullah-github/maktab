import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassSelectorProps {
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
}

export function ClassSelector({ classes, selectedClassId, onSelectClass }: ClassSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium">Select Class:</label>
      <Select value={selectedClassId || undefined} onValueChange={onSelectClass}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Choose a class" />
        </SelectTrigger>
        <SelectContent>
          {classes.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

