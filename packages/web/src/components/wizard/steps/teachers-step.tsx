import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container";
import { Plus, Edit, Trash2, Users, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Teacher } from "@/types";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useClassStore } from "@/stores/useClassStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { useLanguage } from "@/hooks/useLanguage";
import { TeacherEditModal } from "./teachers/TeacherEditModal";
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
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface TeachersStepProps {
  onDataChange?: () => void;
}

export function TeachersStep({ onDataChange }: TeachersStepProps) {
  const { teachers, isLoading, addTeacher, updateTeacher, deleteTeacher, fetchTeachers } = useTeacherStore();
  const { subjects, fetchSubjects } = useSubjectStore();
  const { classes, fetchClasses } = useClassStore();
  const { schoolInfo, periodsInfo } = useWizardStore();
  const { language } = useLanguage();

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchTeachers(), fetchSubjects(), fetchClasses()]);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load data");
      }
    };
    loadData();
  }, [fetchTeachers, fetchSubjects, fetchClasses]);

  const handleSaveTeacher = async (teacherData: Omit<Teacher, "id"> & { id?: string }) => {
    try {
      if (teacherData.id && !teacherData.id.startsWith("temp-")) {
        // Update existing
        const result = await updateTeacher(teacherData as Teacher);
        if (result) {
          toast.success(language === "fa" ? "استاد به‌روزرسانی شد" : "Teacher updated");
          onDataChange?.();
        }
      } else {
        // Add new
        const { id, ...dataWithoutId } = teacherData;
        const result = await addTeacher(dataWithoutId);
        if (result) {
          toast.success(language === "fa" ? "استاد اضافه شد" : "Teacher added");
          onDataChange?.();
        }
      }
    } catch (error) {
      console.error("Failed to save teacher:", error);
      throw error;
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;

    setIsDeleting(true);
    try {
      // Ensure ID is converted to string for the API call
      const teacherId = String(deletingTeacher.id);
      const success = await deleteTeacher(teacherId);
      if (success) {
        toast.success(language === "fa" ? "استاد حذف شد" : "Teacher deleted");
        setDeletingTeacher(null);
        // Refresh teachers list to ensure consistency
        await fetchTeachers();
        // Don't call onDataChange immediately - let the store update first
        // The store update will trigger any necessary refreshes
      } else {
        toast.error(language === "fa" ? "خطا در حذف استاد" : "Failed to delete teacher");
      }
    } catch (error) {
      console.error("Failed to delete teacher:", error);
      toast.error(language === "fa" ? "خطا در حذف استاد" : "Failed to delete teacher");
    } finally {
      setIsDeleting(false);
    }
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || "Unknown";
  };

  const getSubjectWithGrade = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId) || null;
  };

  const getAssignedClassesCount = (teacher: Teacher) => {
    return (teacher.classAssignments || []).reduce((total, assignment) => total + assignment.classIds.length, 0);
  };

  // Calculate enabled grades based on schoolInfo
  const enabledGrades = useMemo(() => {
    const grades: number[] = [];
    if (schoolInfo.enablePrimary) for (let g=1; g<=6; g++) grades.push(g);
    if (schoolInfo.enableMiddle) for (let g=7; g<=9; g++) grades.push(g);
    if (schoolInfo.enableHigh) for (let g=10; g<=12; g++) grades.push(g);
    return grades;
  }, [schoolInfo.enablePrimary, schoolInfo.enableMiddle, schoolInfo.enableHigh]);

  // Filter subjects to only include those from enabled grades
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (s.grade === null || s.grade === undefined) return false;
      return enabledGrades.includes(s.grade);
    });
  }, [subjects, enabledGrades]);

  // Calculate total periods for a teacher based on subject expertise and assigned classes
  const calculateTeacherTotalPeriods = (teacher: Teacher): number => {
    let total = 0;
    
    (teacher.primarySubjectIds || []).forEach(subjectId => {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject || !subject.periodsPerWeek) return;

      const assignment = (teacher.classAssignments || []).find(a => a.subjectId === subjectId);
      const classCount = assignment?.classIds.length || 0;
      total += subject.periodsPerWeek * classCount;
    });

    return total;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <WizardStepContainer
        title={language === "fa" ? "مدیریت اساتید" : "Teacher Management"}
        description={language === "fa" ? "اساتید را اضافه کرده و به صنف‌ها اختصاص دهید" : "Add teachers and assign them to classes"}
        icon={<Users className="h-6 w-6 text-blue-600" />}
      >
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
            <p className="text-xs text-blue-600 font-medium">Total Teachers</p>
            <p className="text-2xl font-bold text-blue-900">{teachers.length}</p>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200">
            <p className="text-xs text-green-600 font-medium">Total Subjects</p>
            <p className="text-2xl font-bold text-green-900">{filteredSubjects.length}</p>
          </Card>
          <Card className="p-4 bg-purple-50 dark:bg-purple-950 border-purple-200">
            <p className="text-xs text-purple-600 font-medium">Total Classes</p>
            <p className="text-2xl font-bold text-purple-900">{classes.length}</p>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Teachers List</h3>
          <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "fa" ? "افزودن استاد" : "Add Teacher"}
          </Button>
        </div>

        {/* Teachers Table */}
        {teachers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {language === "fa" ? "هیچ استادی اضافه نشده" : "No Teachers Added"}
            </h3>
            <p className="text-gray-600 mb-4">
              {language === "fa" ? "برای شروع یک استاد اضافه کنید" : "Add your first teacher to get started"}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "fa" ? "افزودن استاد" : "Add Teacher"}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-sm">
                    {language === "fa" ? "نام" : "Name"}
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">
                    {language === "fa" ? "مواد تخصصی" : "Expert Subjects"}
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-sm">
                    {language === "fa" ? "دوره/هفته" : "Periods/Week"}
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-sm">
                    {language === "fa" ? "صنف‌های اختصاص داده شده" : "Assigned Classes"}
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-sm">
                    {language === "fa" ? "عملیات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id} className="border-b hover:bg-gray-50">
                    {/* Name */}
                    <td className="py-3 px-4">
                      <p className="font-medium">{teacher.fullName}</p>
                    </td>

                    {/* Expert Subjects */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.primarySubjectIds.slice(0, 3).map(subjectId => {
                          const subject = getSubjectWithGrade(subjectId);
                          if (!subject) return null;
                          return (
                            <Badge key={subjectId} variant="secondary" className="text-xs flex items-center gap-1">
                              <span>{subject.name}</span>
                              {subject.grade && (
                                <span className="text-[10px] opacity-75">(G{subject.grade})</span>
                              )}
                            </Badge>
                          );
                        })}
                        {teacher.primarySubjectIds.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{teacher.primarySubjectIds.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Periods/Week */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-semibold">
                        {calculateTeacherTotalPeriods(teacher)}/{teacher.maxPeriodsPerWeek}
                      </span>
                    </td>

                    {/* Assigned Classes */}
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-purple-100 text-purple-700">
                        {getAssignedClassesCount(teacher)} classes
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingTeacher(teacher)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingTeacher(teacher)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WizardStepContainer>

      {/* Add/Edit Modal */}
       <TeacherEditModal
        open={isAddModalOpen || !!editingTeacher}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTeacher(null);
        }}
        teacher={editingTeacher}
        subjects={subjects}
        classes={classes}
        schoolInfo={schoolInfo}
        periodsInfo={periodsInfo}
        onSave={handleSaveTeacher}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeacher} onOpenChange={() => setDeletingTeacher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Teacher?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingTeacher?.fullName}</strong>?
              <br />
              <span className="text-red-600 font-medium mt-2 block">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeacher}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Teacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> 
    </div>
  );
}

