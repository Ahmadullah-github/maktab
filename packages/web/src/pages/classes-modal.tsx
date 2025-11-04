import React, { useState, useEffect, useMemo } from "react";
import { ClassGroup } from "@/types";
import { Plus, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { ClassCard } from "@/components/entities/class/class-card";
import { ClassStatistics } from "@/components/entities/class/class-statistics";
import { ClassFilters } from "@/components/entities/class/class-filters";
import { ClassForm } from "@/components/entities/class/class-form";
import { useLanguageCtx } from "@/i18n/provider";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function ClassesPageModal() {
  const { isRTL, t, language } = useLanguageCtx();
  const [showDialog, setShowDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const {
    classes,
    isLoading: classesLoading,
    error: classesError,
    fetchClasses,
    addClass,
    updateClass,
    deleteClass,
  } = useClassStore();

  const { fetchSubjects } = useSubjectStore();

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, [fetchClasses, fetchSubjects]);

  // Get unique grades for filter pills
  const grades = useMemo(() => {
    const gradeSet = new Set(
      classes.map((cls) => cls.grade).filter((g): g is number => g !== null && g !== undefined)
    );
    return Array.from(gradeSet).sort((a, b) => a - b);
  }, [classes]);

  // Filter and sort classes
  const filteredAndSortedClasses = useMemo(() => {
    let filtered = classes;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((cls) =>
        cls.name.toLowerCase().includes(search)
      );
    }

    if (selectedSection !== "all") {
      filtered = filtered.filter((cls) => cls.section === selectedSection);
    }

    if (selectedGrade !== "all") {
      filtered = filtered.filter((cls) => cls.grade === Number(selectedGrade));
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "grade-asc":
        sorted.sort((a, b) => (a.grade || 0) - (b.grade || 0));
        break;
      case "grade-desc":
        sorted.sort((a, b) => (b.grade || 0) - (a.grade || 0));
        break;
      case "students-asc":
        sorted.sort((a, b) => a.studentCount - b.studentCount);
        break;
      case "students-desc":
        sorted.sort((a, b) => b.studentCount - a.studentCount);
        break;
      default:
        break;
    }

    return sorted;
  }, [classes, searchTerm, selectedSection, selectedGrade, sortBy]);

  const handleAddClass = () => {
    setEditingClass(null);
    setShowDialog(true);
  };

  const handleEditClass = (classGroup: ClassGroup) => {
    setEditingClass(classGroup);
    setShowDialog(true);
  };

  const handleDeleteClass = (classId: string) => {
    setDeleteClassId(classId);
  };

  const confirmDelete = async () => {
    if (!deleteClassId) return;

    try {
      await deleteClass(deleteClassId);
      toast.success(t.classes.deleteSuccess);
      setDeleteClassId(null);
    } catch (err) {
      console.error("Failed to delete class:", err);
      toast.error(t.classes.deleteError);
    }
  };

  const handleSubmit = async (classData: Omit<ClassGroup, "id"> | ClassGroup) => {
    try {
      if ("id" in classData) {
        await updateClass(classData);
        toast.success(t.classes.updateSuccess);
      } else {
        await addClass(classData);
        toast.success(t.classes.saveSuccess);
      }
      setShowDialog(false);
      setEditingClass(null);
    } catch (err) {
      console.error("Failed to save class:", err);
      toast.error("id" in classData ? t.classes.updateError : t.classes.saveError);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedSection("all");
    setSelectedGrade("all");
    setSortBy("name-asc");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedSection !== "all" ||
    selectedGrade !== "all";

  const isLoading = classesLoading;
  const error = classesError;

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title={isRTL ? "خطا در بارگذاری صنف‌ها" : "Error Loading Classes"}
        message={error}
        onRetry={fetchClasses}
      />
    );
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb
        items={[
          { label: isRTL ? "خانه" : "Home", href: "/" },
          { label: t.classes.pageTitle },
        ]}
      />

      <div className={cn(
        "flex items-center justify-between",
        isRTL && "flex-row"
      )}>
        <div className={cn(isRTL && "text-right")}>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3",
            isRTL && "flex-row"
          )}>
            <GraduationCap className="h-8 w-8 text-blue-600" />
            {t.classes.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.classes.pageDescription}
          </p>
        </div>
        <Button
          onClick={handleAddClass}
          className={cn(
            "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
            isRTL && "flex-row"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.classes.add}
        </Button>
      </div>

      {classes.length > 0 && <ClassStatistics classes={classes} isRTL={isRTL} />}

      {classes.length > 0 && (
        <ClassFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedGrade={selectedGrade}
          onGradeChange={setSelectedGrade}
          selectedSection={selectedSection}
          onSectionChange={setSelectedSection}
          sortBy={sortBy}
          onSortChange={setSortBy}
          grades={grades}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          isRTL={isRTL}
        />
      )}

      {classes.length === 0 && (
        <EmptyState
          title={t.classes.emptyState.title}
          description={t.classes.emptyState.description}
          icon={GraduationCap}
          action={{
            label: t.classes.emptyState.addFirst,
            onClick: handleAddClass,
          }}
          className="my-12"
        />
      )}

      {classes.length > 0 && filteredAndSortedClasses.length === 0 && (
        <EmptyState
          title={t.classes.emptySearch.title}
          description={t.classes.emptySearch.description}
          icon={GraduationCap}
          action={{
            label: t.classes.clearFilters,
            onClick: handleClearFilters,
          }}
          className="my-12"
        />
      )}

      {filteredAndSortedClasses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedClasses.map((classGroup) => (
            <ClassCard
              key={classGroup.id}
              classGroup={classGroup}
              onEdit={handleEditClass}
              onDelete={handleDeleteClass}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={cn("sm:max-w-md", isRTL && "rtl")}>
          <DialogHeader className={cn(isRTL && "text-right")}>
            <DialogTitle>
              {editingClass ? t.classes.editClass : t.classes.addNewClass}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right")}>
              {editingClass
                ? (isRTL ? "اطلاعات صنف را ویرایش کنید" : "Edit the class's information")
                : (isRTL ? "اطلاعات صنف نو را وارد کنید" : "Enter the new class's information")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ClassForm
              classGroup={editingClass || undefined}
              onSubmit={handleSubmit}
              onCancel={() => setShowDialog(false)}
              isRTL={isRTL}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteClassId !== null}
        onOpenChange={(open) => !open && setDeleteClassId(null)}
      >
        <AlertDialogContent className={cn(isRTL && "rtl")}>
          <AlertDialogHeader className={cn(isRTL && "text-right")}>
            <AlertDialogTitle>
              {isRTL ? "حذف صنف" : "Delete Class"}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right")}>
              {t.classes.deleteConfirm}
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

