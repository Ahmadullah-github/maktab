import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Plus, Trash2 } from "lucide-react";
import { Teacher } from "@/types";

interface BulkTeacherFormProps {
  subjects: Array<{ id: string; name: string; code?: string }>;
  onSave: (teachers: Omit<Teacher, "id" | "createdAt" | "updatedAt">[]) => Promise<boolean>;
  onCancel: () => void;
  generateEmptyAvailability: () => Record<string, boolean[]>;
}

interface TeacherRow {
  id: string;
  fullName: string;
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: "Morning" | "Afternoon" | "None";
  primarySubjectIds: string[];
  errors: Record<string, string>;
}

export function BulkTeacherForm({ subjects, onSave, onCancel, generateEmptyAvailability }: BulkTeacherFormProps) {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addNewRow = () => {
    const newRow: TeacherRow = {
      id: `temp-${Date.now()}-${Math.random()}`,
      fullName: "",
      maxPeriodsPerWeek: 20,
      maxPeriodsPerDay: 6,
      maxConsecutivePeriods: 4,
      timePreference: "None",
      primarySubjectIds: [],
      errors: {}
    };
    setTeachers(prev => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    setTeachers(prev => prev.filter(teacher => teacher.id !== id));
  };

  const updateTeacher = (id: string, field: keyof TeacherRow, value: any) => {
    setTeachers(prev => prev.map(teacher => {
      if (teacher.id === id) {
        const updated = { ...teacher, [field]: value };
        
        // Clear errors when user starts typing
        if (field === 'fullName' && teacher.errors.fullName) {
          updated.errors = { ...teacher.errors };
          delete updated.errors.fullName;
        }
        
        return updated;
      }
      return teacher;
    }));
  };

  const validateTeacher = (teacher: TeacherRow) => {
    const errors: Record<string, string> = {};

    if (!teacher.fullName.trim()) {
      errors.fullName = "Name required";
    }

    if (teacher.maxPeriodsPerWeek < 1 || teacher.maxPeriodsPerWeek > 40) {
      errors.maxPeriodsPerWeek = "Invalid";
    }

    if (teacher.primarySubjectIds.length === 0) {
      errors.primarySubjectIds = "Required";
    }

    return errors;
  };

  const handleSave = async () => {
    // Validate all teachers
    let hasErrors = false;
    const validatedTeachers = teachers.map(teacher => {
      const errors = validateTeacher(teacher);
      if (Object.keys(errors).length > 0) {
        hasErrors = true;
      }
      return { ...teacher, errors };
    });

    setTeachers(validatedTeachers);

    if (hasErrors) {
      return;
    }

    if (teachers.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      const teachersToSave = teachers.map(teacher => ({
        fullName: teacher.fullName,
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
        maxPeriodsPerDay: teacher.maxPeriodsPerDay,
        maxConsecutivePeriods: teacher.maxConsecutivePeriods,
        timePreference: teacher.timePreference,
        primarySubjectIds: teacher.primarySubjectIds,
        allowedSubjectIds: [],
        restrictToPrimarySubjects: true,
        availability: generateEmptyAvailability(),
        unavailable: [],
        preferredRoomIds: [],
        preferredColleagues: [],
        meta: {},
      }));

      const success = await onSave(teachersToSave);
      if (success) {
        setTeachers([]);
      }
    } catch (error) {
      console.error("Failed to save teachers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || "Unknown";
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Add Multiple Teachers</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addNewRow}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No teachers added yet</p>
            <Button onClick={addNewRow} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add First Teacher
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 w-[200px]">Name *</th>
                    <th className="text-left p-2 w-[100px]">Max/Week</th>
                    <th className="text-left p-2 w-[100px]">Max/Day</th>
                    <th className="text-left p-2 w-[100px]">Max Consecutive</th>
                    <th className="text-left p-2 w-[120px]">Time Preference</th>
                    <th className="text-left p-2 w-[200px]">Primary Subjects *</th>
                    <th className="text-left p-2 w-[60px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher, index) => (
                    <tr key={teacher.id} className="border-b">
                      <td className="p-2">
                        <Input
                          value={teacher.fullName}
                          onChange={(e) => updateTeacher(teacher.id, 'fullName', e.target.value)}
                          placeholder="Enter name"
                          className={teacher.errors.fullName ? "border-red-500" : ""}
                        />
                        {teacher.errors.fullName && (
                          <p className="text-xs text-red-500 mt-1">{teacher.errors.fullName}</p>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          max="40"
                          value={teacher.maxPeriodsPerWeek}
                          onChange={(e) => updateTeacher(teacher.id, 'maxPeriodsPerWeek', parseInt(e.target.value) || 20)}
                          className={teacher.errors.maxPeriodsPerWeek ? "border-red-500" : ""}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={teacher.maxPeriodsPerDay}
                          onChange={(e) => updateTeacher(teacher.id, 'maxPeriodsPerDay', parseInt(e.target.value) || 6)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="1"
                          max="8"
                          value={teacher.maxConsecutivePeriods}
                          onChange={(e) => updateTeacher(teacher.id, 'maxConsecutivePeriods', parseInt(e.target.value) || 4)}
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={teacher.timePreference}
                          onValueChange={(value: "Morning" | "Afternoon" | "None") => 
                            updateTeacher(teacher.id, 'timePreference', value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Morning">Morning</SelectItem>
                            <SelectItem value="Afternoon">Afternoon</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {teacher.primarySubjectIds.map((subjectId) => (
                            <Badge key={subjectId} variant="secondary" className="text-xs">
                              {getSubjectName(subjectId)}
                              <button
                                type="button"
                                onClick={() => {
                                  const newSubjects = teacher.primarySubjectIds.filter(id => id !== subjectId);
                                  updateTeacher(teacher.id, 'primarySubjectIds', newSubjects);
                                }}
                                className="ml-1 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        {teacher.errors.primarySubjectIds && (
                          <p className="text-xs text-red-500 mt-1">{teacher.errors.primarySubjectIds}</p>
                        )}
                        <div className="mt-1">
                          <Select
                            onValueChange={(subjectId) => {
                              if (!teacher.primarySubjectIds.includes(subjectId)) {
                                updateTeacher(teacher.id, 'primarySubjectIds', [...teacher.primarySubjectIds, subjectId]);
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="Add subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.map((subject) => (
                                <SelectItem key={subject.id} value={subject.id}>
                                  {subject.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(teacher.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} ready to add
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={addNewRow}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Another
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isLoading || teachers.length === 0}
                  className="flex items-center gap-1"
                >
                  <Check className="h-4 w-4" />
                  {isLoading ? "Saving..." : `Save ${teachers.length} Teacher${teachers.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
