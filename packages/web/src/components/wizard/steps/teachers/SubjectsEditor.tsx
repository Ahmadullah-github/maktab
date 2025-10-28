import React from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Teacher } from "@/types";

interface SubjectsEditorProps {
  teacher: Teacher;
  subjects: Array<{ id: string; name: string; code?: string }>;
  onSubjectToggle: (subjectId: string, isPrimary: boolean) => void;
  onRestrictToggle: (restricted: boolean) => void;
}

export function SubjectsEditor({ 
  teacher, 
  subjects, 
  onSubjectToggle, 
  onRestrictToggle 
}: SubjectsEditorProps) {
  // Safety check
  if (!teacher) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">Teacher not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Primary Subjects</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {subjects.map((subject) => {
            const isSelected = teacher.primarySubjectIds?.includes(subject.id) || false;
            return (
              <Badge
                key={subject.id}
                variant={isSelected ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onSubjectToggle(subject.id, true)}
              >
                {subject.name}
                {subject.code && (
                  <span className="ml-1 text-xs opacity-75">
                    ({subject.code})
                  </span>
                )}
              </Badge>
            );
          })}
        </div>
      </div>

      {!teacher.restrictToPrimarySubjects && (
        <div>
          <Label className="text-sm font-medium">Additional Allowed Subjects</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {subjects.map((subject) => {
              const isSelected = teacher.allowedSubjectIds?.includes(subject.id) || false;
              return (
                <Badge
                  key={subject.id}
                  variant={isSelected ? "secondary" : "outline"}
                  className="cursor-pointer"
                  onClick={() => onSubjectToggle(subject.id, false)}
                >
                  {subject.name}
                  {subject.code && (
                    <span className="ml-1 text-xs opacity-75">
                      ({subject.code})
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Switch
          checked={teacher.restrictToPrimarySubjects || false}
          onCheckedChange={onRestrictToggle}
        />
        <Label className="text-sm">Restrict to primary subjects only</Label>
      </div>
    </div>
  );
}
