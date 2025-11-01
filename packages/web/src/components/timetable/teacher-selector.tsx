import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeacherSelectorProps {
  teachers: Array<{ id: string; fullName: string }>;
  selectedTeacherId: string | null;
  onSelectTeacher: (teacherId: string) => void;
}

export function TeacherSelector({ teachers, selectedTeacherId, onSelectTeacher }: TeacherSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium">Select Teacher:</label>
      <Select value={selectedTeacherId || undefined} onValueChange={onSelectTeacher}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Choose a teacher" />
        </SelectTrigger>
        <SelectContent>
          {teachers.map((teacher) => (
            <SelectItem key={teacher.id} value={teacher.id}>
              {teacher.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

