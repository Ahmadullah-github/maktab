import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { Teacher } from "@/types";

interface TeacherFormProps {
  subjects: Array<{ id: string; name: string; code?: string }>;
  onSave: (teacher: Omit<Teacher, "id" | "createdAt" | "updatedAt">) => Promise<boolean>;
  onCancel: () => void;
  generateEmptyAvailability: () => Record<string, boolean[]>;
}

export function TeacherForm({ subjects, onSave, onCancel, generateEmptyAvailability }: TeacherFormProps) {
  const [teacher, setTeacher] = useState<Omit<Teacher, "id" | "createdAt" | "updatedAt">>({
    fullName: "",
    maxPeriodsPerWeek: 20,
    maxPeriodsPerDay: 6,
    maxConsecutivePeriods: 4,
    timePreference: "None",
    primarySubjectIds: [],
    allowedSubjectIds: [],
    restrictToPrimarySubjects: true,
    availability: generateEmptyAvailability(),
    unavailable: [],
    preferredRoomIds: [],
    preferredColleagues: [],
    meta: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [primarySubjectsOpen, setPrimarySubjectsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateTeacher = (teacherData: typeof teacher) => {
    const errors: Record<string, string> = {};

    if (!teacherData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }

    if (teacherData.maxPeriodsPerWeek < 1 || teacherData.maxPeriodsPerWeek > 40) {
      errors.maxPeriodsPerWeek = "Max periods per week must be between 1 and 40";
    }

    if (teacherData.primarySubjectIds.length === 0) {
      errors.primarySubjectIds = "At least one primary subject is required";
    }

    return errors;
  };

  const handleSubjectToggle = (subjectId: string) => {
    const isSelected = teacher.primarySubjectIds.includes(subjectId);
    setTeacher(prev => ({
      ...prev,
      primarySubjectIds: isSelected
        ? prev.primarySubjectIds.filter(id => id !== subjectId)
        : [...prev.primarySubjectIds, subjectId]
    }));
  };

  const isSubjectSelected = (subjectId: string) => {
    return teacher.primarySubjectIds.includes(subjectId);
  };

  const handleSave = async () => {
    const validationErrors = validateTeacher(teacher);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      const success = await onSave(teacher);
      if (!success) {
        setErrors({ general: "Failed to save teacher" });
      }
    } catch (error) {
      setErrors({ general: "An error occurred while saving" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Add New Teacher</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4 text-green-600" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4 text-red-600" />
            Cancel
          </Button>
        </div>
      </div>

      {errors.general && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {errors.general}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={teacher.fullName}
            onChange={(e) => {
              setTeacher({ ...teacher, fullName: e.target.value });
              if (errors.fullName) {
                setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.fullName;
                  return newErrors;
                });
              }
            }}
            placeholder="Enter full name"
          />
          {errors.fullName && (
            <p className="text-sm text-red-600">{errors.fullName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxPeriodsPerWeek">Max Periods/Week *</Label>
          <Input
            id="maxPeriodsPerWeek"
            type="number"
            min="1"
            max="40"
            value={teacher.maxPeriodsPerWeek}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 20;
              setTeacher({ ...teacher, maxPeriodsPerWeek: value });
              if (errors.maxPeriodsPerWeek) {
                setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.maxPeriodsPerWeek;
                  return newErrors;
                });
              }
            }}
          />
          {errors.maxPeriodsPerWeek && (
            <p className="text-sm text-red-600">{errors.maxPeriodsPerWeek}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timePreference">Time Preference</Label>
          <Select
            value={teacher.timePreference}
            onValueChange={(value: "Morning" | "Afternoon" | "None") =>
              setTeacher({ ...teacher, timePreference: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">No Preference</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Afternoon">Afternoon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primarySubjects">Primary Subjects *</Label>
          
          {/* Selected Subjects Display */}
          <div className="border rounded-md p-2 min-h-[42px]">
            {teacher.primarySubjectIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select primary subjects
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {teacher.primarySubjectIds.map((subjectId) => {
                  const subject = subjects.find(s => s.id === subjectId);
                  return (
                    <Badge
                      key={subjectId}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {subject?.name}
                      <button
                        type="button"
                        onClick={() => handleSubjectToggle(subjectId)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          {errors.primarySubjectIds && (
            <p className="text-sm text-red-600">{errors.primarySubjectIds}</p>
          )}

          {/* Subject Selection Dropdown */}
          <Popover
            open={primarySubjectsOpen}
            onOpenChange={setPrimarySubjectsOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={primarySubjectsOpen}
                className="w-full justify-between"
              >
                Select subjects...
                <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search subjects..." />
                <CommandList>
                  <CommandEmpty>No subjects found.</CommandEmpty>
                  <CommandGroup>
                    {subjects.map((subject) => (
                      <CommandItem
                        key={subject.id}
                        value={subject.name}
                        onSelect={() => {
                          handleSubjectToggle(subject.id);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSubjectSelected(subject.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {subject.name}
                        {subject.code && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({subject.code})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
