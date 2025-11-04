import React, { useState, useEffect, useMemo } from "react";
import { Teacher } from "@/types";
import { Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { TeacherCard } from "@/components/entities/teacher/teacher-card";
import { TeacherStatistics } from "@/components/entities/teacher/teacher-statistics";
import { TeacherFilters } from "@/components/entities/teacher/teacher-filters";
import { TeacherFormWrapper } from "@/components/entities/teacher/teacher-form-wrapper";
import { useLanguageCtx } from "@/i18n/provider";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { toast } from "sonner";
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

// Calculate total periods for a teacher
const calculateTeacherTotalPeriods = (teacher: Teacher, subjects: any[]): number => {
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

// Get assigned classes count
const getAssignedClassesCount = (teacher: Teacher): number => {
  return (teacher.classAssignments || []).reduce((total, assignment) => 
    total + assignment.classIds.length, 0
  );
};

export default function TeachersPage() {
  const { isRTL, t } = useLanguageCtx();
  const [showDialog, setShowDialog] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedPeriodsFilter, setSelectedPeriodsFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const {
    teachers,
    isLoading,
    error,
    fetchTeachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
  } = useTeacherStore();

  const {
    subjects,
    fetchSubjects,
  } = useSubjectStore();

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, [fetchTeachers, fetchSubjects]);

  // Filter and sort teachers
  const filteredAndSortedTeachers = useMemo(() => {
    let filtered = teachers;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(teacher =>
        teacher.fullName.toLowerCase().includes(search)
      );
    }

    // Apply subject filter
    if (selectedSubject !== "all") {
      filtered = filtered.filter(teacher =>
        teacher.primarySubjectIds.includes(selectedSubject)
      );
    }

    // Apply periods filter
    if (selectedPeriodsFilter !== "all") {
      filtered = filtered.filter(teacher => {
        const currentPeriods = calculateTeacherTotalPeriods(teacher, subjects);
        if (selectedPeriodsFilter === "overloaded") {
          return currentPeriods >= teacher.maxPeriodsPerWeek;
        } else if (selectedPeriodsFilter === "underloaded") {
          return currentPeriods < teacher.maxPeriodsPerWeek * 0.7;
        }
        return true;
      });
    }

    // Apply sorting
    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.fullName.localeCompare(a.fullName));
        break;
      case "periods-asc":
        sorted.sort((a, b) => {
          const aPeriods = calculateTeacherTotalPeriods(a, subjects);
          const bPeriods = calculateTeacherTotalPeriods(b, subjects);
          return aPeriods - bPeriods;
        });
        break;
      case "periods-desc":
        sorted.sort((a, b) => {
          const aPeriods = calculateTeacherTotalPeriods(a, subjects);
          const bPeriods = calculateTeacherTotalPeriods(b, subjects);
          return bPeriods - aPeriods;
        });
        break;
      case "classes-asc":
        sorted.sort((a, b) => getAssignedClassesCount(a) - getAssignedClassesCount(b));
        break;
      case "classes-desc":
        sorted.sort((a, b) => getAssignedClassesCount(b) - getAssignedClassesCount(a));
        break;
      default:
        break;
    }

    return sorted;
  }, [teachers, subjects, searchTerm, selectedSubject, selectedPeriodsFilter, sortBy]);

  const handleAddTeacher = () => {
    setEditingTeacher(null);
    setShowDialog(true);
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setShowDialog(true);
  };

  const handleDeleteTeacher = (teacherId: string) => {
    setDeleteTeacherId(teacherId);
  };

  const confirmDelete = async () => {
    if (!deleteTeacherId) return;

    try {
      await deleteTeacher(deleteTeacherId);
      toast.success(t.teachers.deleteSuccess);
      setDeleteTeacherId(null);
    } catch (err) {
      console.error("Failed to delete teacher:", err);
      toast.error(t.teachers.deleteError);
    }
  };

  const handleSubmit = async (teacherData: Omit<Teacher, "id"> & { id?: string }) => {
    try {
      if (teacherData.id && !teacherData.id.startsWith("temp-")) {
        await updateTeacher(teacherData as Teacher);
        toast.success(t.teachers.updateSuccess);
      } else {
        const { id, ...dataWithoutId } = teacherData;
        await addTeacher(dataWithoutId);
        toast.success(t.teachers.saveSuccess);
      }
      setShowDialog(false);
      setEditingTeacher(null);
    } catch (err) {
      console.error("Failed to save teacher:", err);
      toast.error("id" in teacherData ? t.teachers.updateError : t.teachers.saveError);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedSubject("all");
    setSelectedPeriodsFilter("all");
    setSortBy("name-asc");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedSubject !== "all" ||
    selectedPeriodsFilter !== "all";

  // Get unique subjects for filter dropdown
  const expertSubjects = useMemo(() => {
    const subjectIds = new Set<string>();
    teachers.forEach(teacher => {
      teacher.primarySubjectIds.forEach(id => subjectIds.add(id));
    });
    return subjects
      .filter(s => subjectIds.has(s.id))
      .map(s => ({ id: s.id, name: s.name }));
  }, [teachers, subjects]);

  if (isLoading && teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title={isRTL ? "خطا در بارگذاری معلمین" : "Error Loading Teachers"}
        message={error}
        onRetry={fetchTeachers}
      />
    );
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb
        items={[
          { label: isRTL ? "خانه" : "Home", href: "/" },
          { label: t.teachers.pageTitle },
        ]}
      />

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between",
        isRTL && "flex-row"
      )}>
        <div className={cn(isRTL && "text-right")}>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3",
            isRTL && "flex-row"
          )}>
            <User className="h-8 w-8 text-blue-600" />
            {t.teachers.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.teachers.pageDescription}
          </p>
        </div>
        <Button
          onClick={handleAddTeacher}
          className={cn(
            "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
            isRTL && "flex-row"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.teachers.add}
        </Button>
      </div>

      {/* Statistics */}
      {teachers.length > 0 && <TeacherStatistics teachers={teachers} subjects={subjects} isRTL={isRTL} />}

      {/* Filters */}
      {teachers.length > 0 && (
        <TeacherFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedSubject={selectedSubject}
          onSubjectChange={setSelectedSubject}
          selectedPeriodsFilter={selectedPeriodsFilter}
          onPeriodsFilterChange={setSelectedPeriodsFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          subjects={expertSubjects}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          isRTL={isRTL}
        />
      )}

      {/* Empty State - No teachers at all */}
      {teachers.length === 0 && (
        <EmptyState
          title={t.teachers.emptyState.title}
          description={t.teachers.emptyState.description}
          icon={User}
          action={{
            label: t.teachers.emptyState.addFirst,
            onClick: handleAddTeacher,
          }}
          className="my-12"
        />
      )}

      {/* Empty State - No search results */}
      {teachers.length > 0 && filteredAndSortedTeachers.length === 0 && (
        <EmptyState
          title={t.teachers.emptySearch.title}
          description={t.teachers.emptySearch.description}
          icon={User}
          action={{
            label: t.teachers.clearFilters,
            onClick: handleClearFilters,
          }}
          className="my-12"
        />
      )}

      {/* Teacher Cards Grid */}
      {filteredAndSortedTeachers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedTeachers.map((teacher) => {
            const currentPeriods = calculateTeacherTotalPeriods(teacher, subjects);
            const assignedClassesCount = getAssignedClassesCount(teacher);
            
            return (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                subjects={subjects}
                currentPeriods={currentPeriods}
                assignedClassesCount={assignedClassesCount}
                onEdit={handleEditTeacher}
                onDelete={handleDeleteTeacher}
                isRTL={isRTL}
              />
            );
          })}
        </div>
      )}

      {/* Dialog for Add/Edit (TeacherEditModal manages its own Dialog) */}
      <TeacherFormWrapper
        open={showDialog}
        onClose={() => {
          setShowDialog(false);
          setEditingTeacher(null);
        }}
        teacher={editingTeacher}
        onSave={handleSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteTeacherId !== null}
        onOpenChange={(open) => !open && setDeleteTeacherId(null)}
      >
        <AlertDialogContent className={cn(isRTL && "rtl")}>
          <AlertDialogHeader className={cn(isRTL && "text-right")}>
            <AlertDialogTitle>
              {isRTL ? "حذف معلم" : "Delete Teacher"}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right")}>
              {t.teachers.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isRTL && "flex-row")}>
            <AlertDialogCancel>{isRTL ? "لغو" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRTL ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
