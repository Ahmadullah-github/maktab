import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Loader2, Save, X, Plus, Trash2, Search, Star, CheckCircle, AlertCircle } from "lucide-react";
import { Teacher, Subject, ClassGroup, SchoolInfo, PeriodsInfo } from "@/types";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { gradeToSection } from "@/lib/classSubjectAssignment";
import { useLanguageCtx } from "@/i18n/provider";
import { useTeacherStore } from "@/stores/useTeacherStore";

interface TeacherEditModalProps {
  open: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  subjects: Subject[];
  classes: ClassGroup[];
  schoolInfo: SchoolInfo;
  periodsInfo: PeriodsInfo;
  onSave: (teacher: Omit<Teacher, "id"> & { id?: string }) => Promise<void>;
}

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TeacherEditModal({ open, onClose, teacher, subjects, classes, schoolInfo, periodsInfo, onSave }: TeacherEditModalProps) {
  const { t, isRTL } = useLanguageCtx();
  const { teachers: allTeachers } = useTeacherStore();
  
  // Ensure availability has correct shape for displayed days/periods
  function ensureAvailabilityShape(days: string[], periods: number, prev?: Record<string, boolean[]>) {
    const out: Record<string, boolean[]> = {};
    days.forEach(d => {
      const existing = (prev?.[d] || []).slice(0, periods);
      while (existing.length < periods) existing.push(false);
      out[d] = existing.map(v => !!v);
    });
    return out;
  }
  
  const [formData, setFormData] = useState<Omit<Teacher, "id"> & { id?: string }>({
    fullName: "",
    maxPeriodsPerWeek: 30,
    maxPeriodsPerDay: 6,
    maxConsecutivePeriods: 3,
    primarySubjectIds: [],
    allowedSubjectIds: [],
    restrictToPrimarySubjects: true,
    availability: {},
    classAssignments: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number | null>(null);
  const [searchQueryAllowed, setSearchQueryAllowed] = useState("");
  const [selectedGradeFilterAllowed, setSelectedGradeFilterAllowed] = useState<number | null>(null);

  // Filter subjects by enabled sections
  const enabledSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (!s.grade) return true;
      const section = gradeToSection(s.grade);
      if (section === 'PRIMARY') return schoolInfo.enablePrimary;
      if (section === 'MIDDLE') return schoolInfo.enableMiddle;
      return schoolInfo.enableHigh;
    });
  }, [subjects, schoolInfo]);

  // Filter subjects for Expert Subjects section
  const filteredExpertSubjects = useMemo(() => {
    let filtered = enabledSubjects;
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by grade
    if (selectedGradeFilter !== null) {
      filtered = filtered.filter(s => s.grade === selectedGradeFilter);
    }
    
    return filtered;
  }, [enabledSubjects, searchQuery, selectedGradeFilter]);

  // Filter subjects for Additional Allowed Subjects section
  const filteredAllowedSubjects = useMemo(() => {
    let filtered = enabledSubjects.filter(s => !formData.primarySubjectIds.includes(s.id));
    
    // Filter by search query
    if (searchQueryAllowed) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQueryAllowed.toLowerCase())
      );
    }
    
    // Filter by grade
    if (selectedGradeFilterAllowed !== null) {
      filtered = filtered.filter(s => s.grade === selectedGradeFilterAllowed);
    }
    
    return filtered;
  }, [enabledSubjects, formData.primarySubjectIds, searchQueryAllowed, selectedGradeFilterAllowed]);

  // Group filtered subjects by grade
  const expertSubjectsByGrade = useMemo(() => {
    const grouped = new Map<number, Subject[]>();
    filteredExpertSubjects.forEach(subject => {
      if (subject.grade !== null && subject.grade !== undefined) {
        if (!grouped.has(subject.grade)) {
          grouped.set(subject.grade, []);
        }
        grouped.get(subject.grade)!.push(subject);
      }
    });
    // Sort grades
    const sortedGrades = Array.from(grouped.keys()).sort((a, b) => a - b);
    return { grouped, sortedGrades };
  }, [filteredExpertSubjects]);

  // Group filtered allowed subjects by grade
  const allowedSubjectsByGrade = useMemo(() => {
    const grouped = new Map<number, Subject[]>();
    filteredAllowedSubjects.forEach(subject => {
      if (subject.grade !== null && subject.grade !== undefined) {
        if (!grouped.has(subject.grade)) {
          grouped.set(subject.grade, []);
        }
        grouped.get(subject.grade)!.push(subject);
      }
    });
    // Sort grades
    const sortedGrades = Array.from(grouped.keys()).sort((a, b) => a - b);
    return { grouped, sortedGrades };
  }, [filteredAllowedSubjects]);

  // Get enabled grades for filter dropdown
  const enabledGrades = useMemo(() => {
    const grades: number[] = [];
    if (schoolInfo.enablePrimary) for (let g=1; g<=6; g++) grades.push(g);
    if (schoolInfo.enableMiddle) for (let g=7; g<=9; g++) grades.push(g);
    if (schoolInfo.enableHigh) for (let g=10; g<=12; g++) grades.push(g);
    return grades;
  }, [schoolInfo]);

  // Helper functions for select all/clear all - update all at once
  const selectAllSubjectsInGrade = (grade: number, subjectIds: string[]) => {
    const idsToAdd = subjectIds.filter(id => !formData.primarySubjectIds.includes(id));
    if (idsToAdd.length === 0) return;
    
    setFormData(prev => ({
      ...prev,
      primarySubjectIds: [...prev.primarySubjectIds, ...idsToAdd],
      // Remove class assignments for deselected subjects if they were removed
      classAssignments: (prev.classAssignments || []).filter(a => 
        prev.primarySubjectIds.includes(a.subjectId) || idsToAdd.includes(a.subjectId)
      ),
    }));
  };

  const clearAllSubjectsInGrade = (grade: number, subjectIds: string[]) => {
    const idsToRemove = subjectIds.filter(id => formData.primarySubjectIds.includes(id));
    if (idsToRemove.length === 0) return;
    
    setFormData(prev => ({
      ...prev,
      primarySubjectIds: prev.primarySubjectIds.filter(id => !idsToRemove.includes(id)),
      // Remove class assignments for deselected subjects
      classAssignments: (prev.classAssignments || []).filter(a => !idsToRemove.includes(a.subjectId)),
    }));
  };

  const selectAllAllowedSubjectsInGrade = (grade: number, subjectIds: string[]) => {
    const idsToAdd = subjectIds.filter(id => !(formData.allowedSubjectIds || []).includes(id));
    if (idsToAdd.length === 0) return;
    
    setFormData(prev => ({
      ...prev,
      allowedSubjectIds: [...(prev.allowedSubjectIds || []), ...idsToAdd],
    }));
  };

  const clearAllAllowedSubjectsInGrade = (grade: number, subjectIds: string[]) => {
    const idsToRemove = subjectIds.filter(id => (formData.allowedSubjectIds || []).includes(id));
    if (idsToRemove.length === 0) return;
    
    setFormData(prev => ({
      ...prev,
      allowedSubjectIds: (prev.allowedSubjectIds || []).filter(id => !idsToRemove.includes(id)),
    }));
  };

  // Initialize form data when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      // Small delay to ensure smooth opening animation
      const timer = setTimeout(() => {
        if (teacher) {
          setFormData({
            id: teacher.id,
            fullName: teacher.fullName || "",
            maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 30,
            maxPeriodsPerDay: teacher.maxPeriodsPerDay || 6,
            maxConsecutivePeriods: teacher.maxConsecutivePeriods || 3,
            primarySubjectIds: teacher.primarySubjectIds || [],
            allowedSubjectIds: teacher.allowedSubjectIds || [],
            restrictToPrimarySubjects: teacher.restrictToPrimarySubjects ?? true,
            availability: ensureAvailabilityShape(
              DAYS.slice(0, schoolInfo.daysPerWeek || 6),
              periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7,
              teacher.availability as any
            ),
            classAssignments: teacher.classAssignments || [],
          });
          setErrors({});
        } else {
          // New teacher
          const emptyAvailability: Record<string, boolean[]> = {};
          const daysToUse = DAYS.slice(0, schoolInfo.daysPerWeek || 6);
          daysToUse.forEach(day => {
            emptyAvailability[day] = Array(periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7).fill(true);
          });

          setFormData({
            fullName: "",
            maxPeriodsPerWeek: 30,
            maxPeriodsPerDay: 6,
            maxConsecutivePeriods: 3,
            primarySubjectIds: [],
            allowedSubjectIds: [],
            restrictToPrimarySubjects: true,
            availability: emptyAvailability,
            classAssignments: [],
          });
          setErrors({});
        }
        setIsLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [open, teacher, schoolInfo, periodsInfo]);

  // Re-normalize availability if days/periods change while modal is open
  useEffect(() => {
    if (!open) return;
    setFormData(prev => ({
      ...prev,
      availability: ensureAvailabilityShape(
        DAYS.slice(0, schoolInfo.daysPerWeek || 6),
        periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7,
        prev.availability
      )
    }));
  }, [open, schoolInfo.daysPerWeek, periodsInfo?.periodsPerDay, schoolInfo.periodsPerDay]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Name is required";
    if (formData.maxPeriodsPerWeek < 1) newErrors.maxPeriodsPerWeek = "Must be at least 1";
    if (formData.primarySubjectIds.length === 0) newErrors.primarySubjectIds = "At least one expert subject required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save teacher:", error);
      setErrors({ general: "Failed to save teacher" });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePrimarySubject = (subjectId: string) => {
    const isSelected = formData.primarySubjectIds.includes(subjectId);
    const newIds = isSelected
      ? formData.primarySubjectIds.filter(id => id !== subjectId)
      : [...formData.primarySubjectIds, subjectId];
    
    setFormData(prev => ({ ...prev, primarySubjectIds: newIds }));

    // Remove class assignments for this subject if deselected
    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        classAssignments: (prev.classAssignments || []).filter(a => a.subjectId !== subjectId)
      }));
    }
  };

  const toggleAllowedSubject = (subjectId: string) => {
    const isSelected = (formData.allowedSubjectIds || []).includes(subjectId);
    const newIds = isSelected
      ? (formData.allowedSubjectIds || []).filter(id => id !== subjectId)
      : [...(formData.allowedSubjectIds || []), subjectId];
    
    setFormData(prev => ({ ...prev, allowedSubjectIds: newIds }));
  };

  const toggleClassAssignment = (subjectId: string, classId: string) => {
    const assignments = formData.classAssignments || [];
    const existing = assignments.find(a => a.subjectId === subjectId);

    if (existing) {
      const isSelected = existing.classIds.includes(classId);
      const newClassIds = isSelected
        ? existing.classIds.filter(id => id !== classId)
        : [...existing.classIds, classId];

      setFormData(prev => ({
        ...prev,
        classAssignments: assignments.map(a =>
          a.subjectId === subjectId ? { ...a, classIds: newClassIds } : a
        ),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        classAssignments: [...assignments, { subjectId, classIds: [classId] }],
      }));
    }
  };

  const toggleAvailability = (day: string, periodIndex: number) => {
    const periods = periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7;
    const current = formData.availability || {};
    const base = (current[day] || []).slice(0, periods);
    while (base.length < periods) base.push(false);
    base[periodIndex] = !base[periodIndex];
    setFormData(prev => ({ ...prev, availability: { ...(prev.availability || {}), [day]: base } }));
  };

  const setAllAvailable = () => {
    const daysToUse = DAYS.slice(0, schoolInfo.daysPerWeek || 6);
    const newAvailability: Record<string, boolean[]> = {};
    daysToUse.forEach(day => {
      newAvailability[day] = Array(periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7).fill(true);
    });
    setFormData(prev => ({ ...prev, availability: newAvailability }));
  };

  const clearAllAvailability = () => {
    const daysToUse = DAYS.slice(0, schoolInfo.daysPerWeek || 6);
    const newAvailability: Record<string, boolean[]> = {};
    daysToUse.forEach(day => {
      newAvailability[day] = Array(periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7).fill(false);
    });
    setFormData(prev => ({ ...prev, availability: newAvailability }));
  };

  // Get classes for a subject's grade
  const getClassesForSubject = (subjectId: string): ClassGroup[] => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject || !subject.grade) return [];
    return classes.filter(c => c.grade === subject.grade);
  };

  // Get all other teachers (excluding current teacher being edited)
  const otherTeachers = useMemo(() => {
    const currentTeacherId = formData.id;
    if (!currentTeacherId) return allTeachers;
    return allTeachers.filter(t => String(t.id) !== String(currentTeacherId));
  }, [allTeachers, formData.id]);

  // Get assigned class IDs for a subject from all other teachers
  const getAssignedClassIdsForSubject = (subjectId: string): Set<string> => {
    const assignedClassIds = new Set<string>();
    otherTeachers.forEach(teacher => {
      const assignment = (teacher.classAssignments || []).find(a => a.subjectId === subjectId);
      if (assignment) {
        assignment.classIds.forEach(id => assignedClassIds.add(id));
      }
    });
    return assignedClassIds;
  };

  // Check if a subject is fully assigned (all classes for that subject are assigned to other teachers)
  const isSubjectFullyAssigned = (subjectId: string): boolean => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject || !subject.grade) return false;
    
    const allClasses = classes.filter(c => c.grade === subject.grade);
    if (allClasses.length === 0) return false; // No classes available
    
    const assignedClassIds = getAssignedClassIdsForSubject(subjectId);
    
    // Check if all classes are assigned to other teachers
    return allClasses.every(c => assignedClassIds.has(c.id));
  };

  // Check if a class is assigned to another teacher for a specific subject
  const isClassAssignedToOtherTeacher = (subjectId: string, classId: string): boolean => {
    return otherTeachers.some(teacher => {
      const assignment = (teacher.classAssignments || []).find(a => a.subjectId === subjectId);
      return assignment?.classIds.includes(classId) ?? false;
    });
  };

  // Get the teacher name who has this class assigned for this subject (for tooltip)
  const getAssignedTeacherName = (subjectId: string, classId: string): string | null => {
    const assignedTeacher = otherTeachers.find(teacher => {
      const assignment = (teacher.classAssignments || []).find(a => a.subjectId === subjectId);
      return assignment?.classIds.includes(classId) ?? false;
    });
    return assignedTeacher?.fullName || null;
  };

  // Calculate total periods based on subject expertise and assigned classes
  const calculateTotalPeriods = useMemo(() => {
    const breakdown: Array<{ subjectName: string; periodsPerWeek: number; classCount: number; total: number }> = [];
    
    const total = formData.primarySubjectIds.reduce((sum, subjectId) => {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject || !subject.periodsPerWeek) return sum;

      const assignment = formData.classAssignments?.find(a => a.subjectId === subjectId);
      const classCount = assignment?.classIds.length || 0;
      const subjectTotal = subject.periodsPerWeek * classCount;

      if (classCount > 0) {
        breakdown.push({
          subjectName: subject.name,
          periodsPerWeek: subject.periodsPerWeek,
          classCount,
          total: subjectTotal,
        });
      }

      return sum + subjectTotal;
    }, 0);

    return { total, breakdown };
  }, [formData.primarySubjectIds, formData.classAssignments, subjects]);

  const daysToDisplay = DAYS.slice(0, schoolInfo.daysPerWeek || 6);
  const periodsToDisplay = periodsInfo?.periodsPerDay || schoolInfo.periodsPerDay || 7;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teacher ? (t.teachers?.editTeacher || "Edit Teacher") : (t.teachers?.addNewTeacher || "Add Teacher")}</DialogTitle>
          <DialogDescription>
            {t.teachers?.pageDescription || "Configure teacher details, subject expertise, class assignments, and availability"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
        <div className="space-y-6 py-4">
          {/* Period Configuration Warning */}
          {(!periodsInfo?.periodsPerDay || periodsToDisplay < 4 || periodsToDisplay > 12) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">{t.common.warning || "Warning"}</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
                  {t.common.periodConfigWarning?.replace('{{count}}', `${periodsToDisplay}`) || `Using ${periodsToDisplay} periods per day.`}
                  {!periodsInfo?.periodsPerDay && ` (${t.common.noPeriodConfig || "No period configuration found - using default"})`}
                  {periodsToDisplay < 4 && ` (${t.common.unusuallyLowCheck || "Unusually low - check period configuration"})`}
                  {periodsToDisplay > 12 && ` (${t.common.unusuallyHighCheck || "Unusually high - check period configuration"})`}
                </p>
              </div>
            </div>
          )}
          {/* 1. Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.common.basicInfo || "Basic Information"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="fullName">{t.teachers?.fullName || "Full Name"} *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder={t.teachers?.fullNamePlaceholder || "e.g., Ahmad Khan"}
                    className={errors.fullName ? "border-red-500" : ""}
                  />
                  {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPeriodsPerWeek">{t.teachers?.maxPeriodsPerWeek || "Max Periods Per Week"} *</Label>
                  <Input
                    id="maxPeriodsPerWeek"
                    type="number"
                    value={formData.maxPeriodsPerWeek}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPeriodsPerWeek: parseInt(e.target.value) || 0 }))}
                    min="1"
                    max="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPeriodsPerDay">{t.teachers?.maxPeriodsPerDay || "Max Periods Per Day"}</Label>
                  <Input
                    id="maxPeriodsPerDay"
                    type="number"
                    value={formData.maxPeriodsPerDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPeriodsPerDay: parseInt(e.target.value) || 0 }))}
                    min="1"
                    max="12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxConsecutive">{t.teachers?.maxConsecutivePeriods || "Max Consecutive Periods"}</Label>
                  <Input
                    id="maxConsecutive"
                    type="number"
                    value={formData.maxConsecutivePeriods}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxConsecutivePeriods: parseInt(e.target.value) || 0 }))}
                    min="1"
                    max="6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Subject Expertise */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="bg-blue-100/50 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base text-blue-900">{t.teachers?.subjectExpertise || "Subject Expertise"}</CardTitle>
              </div>
              <p className="text-sm text-blue-700">
                {formData.primarySubjectIds.length} of {enabledSubjects.length} subjects selected
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center mt-2 gap-2">
                  <Star className="h-3.5 w-3.5 text-blue-600" />
                  <span>{t.teachers?.expertSubjects || "Expert Subjects"} * ({t.teachers?.expertSubjectsDescription || "subjects teacher is qualified to teach"})</span>
                  <Badge variant="default" className="ml-2 bg-blue-600 text-white text-xs">{t.common.required || "Required"}</Badge>
                </Label>
                
                {/* Search and Filter Controls */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t.subjects.search || "Search subjects..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={selectedGradeFilter?.toString() || "all"} onValueChange={(value) => setSelectedGradeFilter(value === "all" ? null : parseInt(value))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder={t.common.allGrades || "All Grades"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.common.allGrades || "All Grades"}</SelectItem>
                      {enabledGrades.map(grade => (
                        <SelectItem key={grade} value={grade.toString()}>
                          {t.common.gradeWithNumber?.replace('{{number}}', `${grade}`) || `Grade ${grade}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subjects List - Grouped by Grade */}
                <div className="border-2 border-blue-300 rounded-md max-h-60 overflow-y-auto bg-white">
                  {enabledSubjects.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">{t.subjects?.emptyState?.description || "Add subjects first."}</p>
                    </div>
                  ) : filteredExpertSubjects.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">{t.common.noSubjectsMatchFilter || "No subjects match your search/filter criteria."}</p>
                    </div>
                  ) : (
                    <Accordion>
                      {expertSubjectsByGrade.sortedGrades.map(grade => {
                        const gradeSubjects = expertSubjectsByGrade.grouped.get(grade) || [];
                        const selectedCount = gradeSubjects.filter(s => formData.primarySubjectIds.includes(s.id)).length;
                        
                        return (
                          <AccordionItem 
                            key={grade} 
                            title={`${t.common.grade || "Grade"} ${grade} (${selectedCount}/${gradeSubjects.length} ${t.common.selected || "selected"})`}
                            defaultOpen={false}
                          >
                            <div className="space-y-1 pb-2">
                              {/* Select All / Clear All buttons for this grade */}
                              <div className="flex justify-end gap-2 mb-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => selectAllSubjectsInGrade(grade, gradeSubjects.map(s => s.id))}
                                  className="h-7 text-xs"
                                >
                                  {t.common.selectAll || "Select All"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => clearAllSubjectsInGrade(grade, gradeSubjects.map(s => s.id))}
                                  className="h-7 text-xs"
                                >
                                  {t.common.clearAll || "Clear All"}
                                </Button>
                              </div>
                              
                              {gradeSubjects.map(subject => {
                                const isFullyAssigned = isSubjectFullyAssigned(subject.id);
                                const isSelected = formData.primarySubjectIds.includes(subject.id);
                                const isDisabled = isFullyAssigned && !isSelected;
                                
                                return (
                                  <label 
                                    key={subject.id} 
                                    className={cn(
                                      "flex items-center gap-2 p-2 rounded transition-colors",
                                      isDisabled 
                                        ? "opacity-50 cursor-not-allowed bg-gray-100" 
                                        : isSelected
                                        ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                        : "hover:bg-gray-50 cursor-pointer"
                                    )}
                                    title={isDisabled ? (t.common.fullyAssignedTooltip || "All classes for this subject are already assigned to other teachers") : undefined}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => !isDisabled && togglePrimarySubject(subject.id)}
                                      disabled={isDisabled}
                                    />
                                    <span className="text-sm flex-1 font-medium">{subject.name}</span>
                                    {isDisabled && (
                                      <Badge variant="destructive" className="text-xs">{t.common.fullyAssigned || "Fully Assigned"}</Badge>
                                    )}
                                    {subject.isDifficult && (
                                      <Badge variant="outline" className="text-xs">{t.common.difficult || "Difficult"}</Badge>
                                    )}
                                    {subject.periodsPerWeek && (
                                      <Badge variant="secondary" className="text-xs">
                                        {subject.periodsPerWeek} {t.common.periodsPerWeek || "periods/week"}
                                      </Badge>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </AccordionItem>
                        );
                      })}
                      {/* Show subjects without grade at the end */}
                      {filteredExpertSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).length > 0 && (
                        <AccordionItem 
                          title={`${t.common.otherSubjects || "Other Subjects"} (${filteredExpertSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).length})`}
                          defaultOpen={false}
                        >
                          <div className="space-y-1 pb-2">
                            {filteredExpertSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).map(subject => {
                              const isFullyAssigned = isSubjectFullyAssigned(subject.id);
                              const isSelected = formData.primarySubjectIds.includes(subject.id);
                              const isDisabled = isFullyAssigned && !isSelected;
                              
                              return (
                                <label 
                                  key={subject.id} 
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded transition-colors",
                                    isDisabled 
                                      ? "opacity-50 cursor-not-allowed bg-gray-100" 
                                      : isSelected
                                      ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                      : "hover:bg-gray-50 cursor-pointer"
                                  )}
                                  title={isDisabled ? "All classes for this subject are already assigned to other teachers" : undefined}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => !isDisabled && togglePrimarySubject(subject.id)}
                                    disabled={isDisabled}
                                  />
                                  <span className="text-sm flex-1 font-medium">{subject.name}</span>
                                  {isDisabled && (
                                    <Badge variant="destructive" className="text-xs">Fully Assigned</Badge>
                                  )}
                                  {subject.periodsPerWeek && (
                                    <Badge variant="secondary" className="text-xs">
                                      {subject.periodsPerWeek} periods/week
                                    </Badge>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </AccordionItem>
                      )}
                    </Accordion>
                  )}
                </div>
                {errors.primarySubjectIds && <p className="text-xs text-red-500">{errors.primarySubjectIds}</p>}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="restrictToggle" className="cursor-pointer">{t.teachers?.restrictToPrimarySubjects || "Restrict to Expert Subjects Only"}</Label>
                  <p className="text-xs text-muted-foreground">{t.teachers?.restrictToPrimarySubjectsDescription || "If enabled, teacher can only teach their expert subjects"}</p>
                </div>
                <Switch
                  id="restrictToggle"
                  checked={formData.restrictToPrimarySubjects ?? true}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, restrictToPrimarySubjects: checked }))}
                />
              </div>

              {!formData.restrictToPrimarySubjects && (
                <div className="space-y-2 pt-4 border-t-2 border-green-200">
                  <Label className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    <span>{t.teachers?.additionalAllowedSubjects || "Additional Allowed Subjects"} ({t.common.optional || "optional"})</span>
                    <Badge variant="outline" className="ml-2 border-green-600 text-green-700 text-xs">{t.common.optional || "Optional"}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({(formData.allowedSubjectIds || []).length} {t.common.selected || "selected"})
                    </span>
                  </Label>
                  
                  {/* Search and Filter Controls for Allowed Subjects */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t.subjects.search || "Search subjects..."}
                        value={searchQueryAllowed}
                        onChange={(e) => setSearchQueryAllowed(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={selectedGradeFilterAllowed?.toString() || "all"} onValueChange={(value) => setSelectedGradeFilterAllowed(value === "all" ? null : parseInt(value))}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder={t.common.allGrades || "All Grades"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.common.allGrades || "All Grades"}</SelectItem>
                        {enabledGrades.map(grade => (
                          <SelectItem key={grade} value={grade.toString()}>
                            {t.common.gradeWithNumber?.replace('{{number}}', `${grade}`) || `Grade ${grade}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Allowed Subjects List - Grouped by Grade */}
                  <div className="border-2 border-green-300 rounded-md max-h-48 overflow-y-auto bg-green-50/30">
                    {filteredAllowedSubjects.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          {enabledSubjects.filter(s => !formData.primarySubjectIds.includes(s.id)).length === 0
                            ? (t.teachers?.noAdditionalSubjects || "No additional subjects available")
                            : (t.common.noSubjectsMatchFilter || "No subjects match your search/filter criteria.")}
                        </p>
                      </div>
                    ) : (
                      <Accordion>
                        {allowedSubjectsByGrade.sortedGrades.map(grade => {
                          const gradeSubjects = allowedSubjectsByGrade.grouped.get(grade) || [];
                          const selectedCount = gradeSubjects.filter(s => (formData.allowedSubjectIds || []).includes(s.id)).length;
                          
                          return (
                            <AccordionItem 
                              key={grade} 
                              title={`${t.common.grade || "Grade"} ${grade} (${selectedCount}/${gradeSubjects.length} ${t.common.selected || "selected"})`}
                              defaultOpen={false}
                            >
                              <div className="space-y-1 pb-2">
                                {/* Select All / Clear All buttons for this grade */}
                                <div className="flex justify-end gap-2 mb-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => selectAllAllowedSubjectsInGrade(grade, gradeSubjects.map(s => s.id))}
                                    className="h-7 text-xs"
                                  >
                                    {t.common.selectAll || "Select All"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => clearAllAllowedSubjectsInGrade(grade, gradeSubjects.map(s => s.id))}
                                    className="h-7 text-xs"
                                  >
                                    {t.common.clearAll || "Clear All"}
                                  </Button>
                                </div>
                                
                                {gradeSubjects.map(subject => (
                                  <label 
                                    key={subject.id} 
                                    className={cn(
                                      "flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors",
                                      (formData.allowedSubjectIds || []).includes(subject.id) && "bg-green-50 hover:bg-green-100"
                                    )}
                                  >
                                    <Checkbox
                                      checked={(formData.allowedSubjectIds || []).includes(subject.id)}
                                      onCheckedChange={() => toggleAllowedSubject(subject.id)}
                                    />
                                    <span className="text-sm flex-1 font-medium">{subject.name}</span>
                                    {subject.isDifficult && (
                                      <Badge variant="outline" className="text-xs">{t.common.difficult || "Difficult"}</Badge>
                                    )}
                                    {subject.periodsPerWeek && (
                                      <Badge variant="secondary" className="text-xs">
                                        {subject.periodsPerWeek} {t.common.periodsPerWeek || "periods/week"}
                                      </Badge>
                                    )}
                                  </label>
                                ))}
                              </div>
                            </AccordionItem>
                          );
                        })}
                        {/* Show subjects without grade at the end */}
                        {filteredAllowedSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).length > 0 && (
                          <AccordionItem 
                            title={`Other Subjects (${filteredAllowedSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).length})`}
                            defaultOpen={false}
                          >
                            <div className="space-y-1 pb-2">
                              {filteredAllowedSubjects.filter(s => !s.grade || s.grade === null || s.grade === undefined).map(subject => (
                                <label 
                                  key={subject.id} 
                                  className={cn(
                                    "flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors",
                                    (formData.allowedSubjectIds || []).includes(subject.id) && "bg-green-50 hover:bg-green-100"
                                  )}
                                >
                                  <Checkbox
                                    checked={(formData.allowedSubjectIds || []).includes(subject.id)}
                                    onCheckedChange={() => toggleAllowedSubject(subject.id)}
                                  />
                                  <span className="text-sm flex-1 font-medium">{subject.name}</span>
                                  {subject.periodsPerWeek && (
                                    <Badge variant="secondary" className="text-xs">
                                      {subject.periodsPerWeek} periods/week
                                    </Badge>
                                  )}
                                </label>
                              ))}
                            </div>
                          </AccordionItem>
                        )}
                      </Accordion>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Periods Summary */}
          {formData.primarySubjectIds.length > 0 && calculateTotalPeriods.total > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base">{t.teachers?.totalPeriodsCalculation || "Total Periods Calculation"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t.teachers?.totalPeriodsAssigned || "Total periods assigned:"} <span className="font-bold text-lg text-blue-700">{calculateTotalPeriods.total}</span> {t.common.periodsPerWeek || "periods/week"}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {calculateTotalPeriods.breakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex-1">
                        <span className="font-medium">{item.subjectName}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({item.periodsPerWeek} {t.common.periodsPerWeek || "periods/week"})
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        × {item.classCount} {item.classCount === 1 ? (t.common.class || 'class') : (t.common.classes || 'classes')} =
                      </div>
                      <div className="font-semibold ml-2">
                        {item.total} {t.common.periods || "periods"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. Class Assignments */}
          {formData.primarySubjectIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.teachers?.classAssignments || "Class Assignments"}</CardTitle>
                <p className="text-sm text-muted-foreground">{t.teachers?.classAssignmentsDescription || "Assign teacher to specific classes for each expert subject"}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.primarySubjectIds.map(subjectId => {
                  const subject = subjects.find(s => s.id === subjectId);
                  if (!subject) return null;

                  const availableClasses = getClassesForSubject(subjectId);
                  const assignment = (formData.classAssignments || []).find(a => a.subjectId === subjectId);
                  const selectedClassIds = assignment?.classIds || [];

                  return (
                    <div key={subjectId} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold">{subject.name}</p>
                          {subject.grade && (
                            <p className="text-xs text-muted-foreground">{`${t.common.grade || "Grade"} ${subject.grade}`}</p>
                          )}
                        </div>
                        <Badge>{selectedClassIds.length} {t.common.classes || "classes"}</Badge>
                      </div>

                      {availableClasses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.teachers?.noClassesForSubject || "No classes available for this subject's grade"}</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {availableClasses.map(cls => {
                            const isAssigned = isClassAssignedToOtherTeacher(subjectId, cls.id);
                            const isSelected = selectedClassIds.includes(cls.id);
                            const isDisabled = isAssigned && !isSelected;
                            const assignedTeacherName = isDisabled ? getAssignedTeacherName(subjectId, cls.id) : null;
                            
                            return (
                              <label 
                                key={cls.id} 
                                className={cn(
                                  "flex items-center gap-2 p-2 text-sm rounded transition-colors",
                                  isDisabled 
                                    ? "opacity-50 cursor-not-allowed bg-gray-100" 
                                    : isSelected
                                    ? "bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                    : "hover:bg-gray-50 cursor-pointer"
                                )}
                                title={isDisabled && assignedTeacherName ? (t.teachers?.assignedToOtherTeacher?.replace('{{name}}', assignedTeacherName) || `Already assigned to ${assignedTeacherName}`) : undefined}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => !isDisabled && toggleClassAssignment(subjectId, cls.id)}
                                  disabled={isDisabled}
                                />
                                <span className={cn("flex-1", isDisabled && "line-through")}>
                                  {cls.displayName || cls.name}
                                </span>
                                {isDisabled && assignedTeacherName && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    {assignedTeacherName.split(' ')[0]}
                                  </Badge>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 4. Availability Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.teachers?.dailyAvailability || "Daily Availability"}</CardTitle>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={setAllAvailable}>
                    {t.common.selectAll || "Select All"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={clearAllAvailability}>
                    {t.common.clearAll || "Clear All"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t.teachers?.dailyAvailabilityDescription || "Mark periods when teacher is available"}</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 text-sm font-semibold bg-gray-50">{t.common.day || "Day"}</th>
                      {Array.from({ length: periodsToDisplay }, (_, i) => (
                        <th key={i} className="border p-2 text-sm font-semibold bg-gray-50">
                          {t.common.periodShort || "P"}{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daysToDisplay.map(day => {
                      const dayAvailability = formData.availability?.[day] || Array(periodsToDisplay).fill(false);
                      return (
                        <tr key={day}>
                          <td className="border p-2 text-sm font-medium bg-gray-50">{t.days?.[day as keyof typeof t.days] || day}</td>
                          {Array.from({ length: periodsToDisplay }, (_, i) => {
                            const isAvailable = !!dayAvailability[i];
                            const isBreak = schoolInfo.breakPeriods?.some(b => b.afterPeriod === i + 1 && b.duration > 0);
                            return (
                              <td
                                key={i}
                                className={cn(
                                  "border p-1 text-center cursor-pointer transition-colors",
                                  isBreak && "bg-amber-50",
                                  isAvailable && !isBreak && "bg-green-100 hover:bg-green-200",
                                  !isAvailable && !isBreak && "bg-red-50 hover:bg-red-100"
                                )}
                                onClick={() => toggleAvailability(day, i)}
                              >
                                <Checkbox
                                  checked={isAvailable}
                                  onCheckedChange={() => toggleAvailability(day, i)}
                                  className="mx-auto"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {errors.general && (
            <p className="text-sm text-red-500 text-center">{errors.general}</p>
          )}
        </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isLoading} className={cn(isRTL && "flex-row")}>
            <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            {t.actions?.cancel || "Cancel"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isLoading} className={cn(isRTL && "flex-row")}>
            {isSaving ? (
              <Loader2 className={cn("h-4 w-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
            ) : (
              <Save className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            )}
            {teacher ? (t.teachers?.updateTeacher || "Update Teacher") : (t.teachers?.addNewTeacher || "Add Teacher")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

