import React, { useState, useEffect, useMemo } from "react";
import { Subject } from "@/types";
import { Plus, BookOpen } from "lucide-react";
import { Button, ButtonWithIcon } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { SubjectCard } from "@/components/entities/subject/subject-card";
import { SubjectStatistics } from "@/components/entities/subject/subject-statistics";
import { SubjectFilters } from "@/components/entities/subject/subject-filters";
import { SubjectForm } from "@/components/entities/subject/subject-form";
import { useLanguageCtx } from "@/i18n/provider";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export default function SubjectsPage() {
  const { isRTL, t } = useLanguageCtx();
  const [showSheet, setShowSheet] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const {
    subjects,
    isLoading,
    error,
    fetchSubjects,
    addSubject,
    updateSubject,
    deleteSubject,
  } = useSubjectStore();

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Get unique grades for filter pills
  const grades = useMemo(() => {
    const gradeSet = new Set(
      subjects.map((sub) => sub.grade).filter((g): g is number => g !== null && g !== undefined)
    );
    return Array.from(gradeSet).sort((a, b) => a - b);
  }, [subjects]);

  // Filter and sort subjects
  const filteredAndSortedSubjects = useMemo(() => {
    let filtered = subjects;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.name.toLowerCase().includes(search) ||
          (sub.code && sub.code.toLowerCase().includes(search))
      );
    }

    if (selectedSection !== "all") {
      filtered = filtered.filter((sub) => sub.section === selectedSection);
    }

    if (selectedGrade !== "all") {
      filtered = filtered.filter((sub) => sub.grade === Number(selectedGrade));
    }

    if (selectedDifficulty === "difficult") {
      filtered = filtered.filter((sub) => sub.isDifficult);
    } else if (selectedDifficulty === "regular") {
      filtered = filtered.filter((sub) => !sub.isDifficult);
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
      case "periods-asc":
        sorted.sort((a, b) => (a.periodsPerWeek || 0) - (b.periodsPerWeek || 0));
        break;
      case "periods-desc":
        sorted.sort((a, b) => (b.periodsPerWeek || 0) - (a.periodsPerWeek || 0));
        break;
      default:
        break;
    }

    return sorted;
  }, [subjects, searchTerm, selectedSection, selectedGrade, selectedDifficulty, sortBy]);

  const handleAddSubject = () => {
    setEditingSubject(null);
    setShowSheet(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setShowSheet(true);
  };

  const handleDeleteSubject = (subjectId: string) => {
    setDeleteSubjectId(subjectId);
  };

  const confirmDelete = async () => {
    if (!deleteSubjectId) return;

    try {
      await deleteSubject(deleteSubjectId);
      toast.success(t.subjects.deleteSuccess);
      setDeleteSubjectId(null);
    } catch (err) {
      console.error("Failed to delete subject:", err);
      toast.error(t.subjects.deleteError);
    }
  };

  const handleSubmit = async (subjectData: Omit<Subject, "id"> | Subject) => {
    try {
      if ("id" in subjectData) {
        await updateSubject(subjectData);
        toast.success(t.subjects.updateSuccess);
      } else {
        await addSubject(subjectData);
        toast.success(t.subjects.saveSuccess);
      }
      setShowSheet(false);
      setEditingSubject(null);
    } catch (err) {
      console.error("Failed to save subject:", err);
      toast.error("id" in subjectData ? t.subjects.updateError : t.subjects.saveError);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedSection("all");
    setSelectedGrade("all");
    setSelectedDifficulty("all");
    setSortBy("name-asc");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedSection !== "all" ||
    selectedGrade !== "all" ||
    selectedDifficulty !== "all";

  if (isLoading && subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title={isRTL ? "خطا در بارگذاری مواد درسی" : "Error Loading Subjects"}
        message={error}
        onRetry={fetchSubjects}
      />
    );
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb
        items={[
          { label: isRTL ? "خانه" : "Home", href: "/" },
          { label: t.subjects.pageTitle },
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
            <BookOpen className="h-8 w-8 text-blue-600" />
            {t.subjects.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.subjects.pageDescription}
          </p>
        </div>
        <ButtonWithIcon
          onClick={handleAddSubject}
          icon={<Plus className="h-4 w-4" />}
          iconPosition="start"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
        >
          {t.subjects.add}
        </ButtonWithIcon>
      </div>

      {subjects.length > 0 && <SubjectStatistics subjects={subjects} isRTL={isRTL} />}

      {subjects.length > 0 && (
        <SubjectFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedGrade={selectedGrade}
          onGradeChange={setSelectedGrade}
          selectedSection={selectedSection}
          onSectionChange={setSelectedSection}
          selectedDifficulty={selectedDifficulty}
          onDifficultyChange={setSelectedDifficulty}
          sortBy={sortBy}
          onSortChange={setSortBy}
          grades={grades}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          isRTL={isRTL}
        />
      )}

      {subjects.length === 0 && (
        <EmptyState
          title={t.subjects.emptyState.title}
          description={t.subjects.emptyState.description}
          icon={BookOpen}
          action={{
            label: t.subjects.emptyState.addFirst,
            onClick: handleAddSubject,
          }}
          className="my-12"
        />
      )}

      {subjects.length > 0 && filteredAndSortedSubjects.length === 0 && (
        <EmptyState
          title={t.subjects.emptySearch.title}
          description={t.subjects.emptySearch.description}
          icon={BookOpen}
          action={{
            label: t.subjects.clearFilters,
            onClick: handleClearFilters,
          }}
          className="my-12"
        />
      )}

      {filteredAndSortedSubjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onEdit={handleEditSubject}
              onDelete={handleDeleteSubject}
              isRTL={isRTL}
            />
          ))}
        </div>
      )}

      {/* Sheet for Add/Edit */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className={cn("sm:max-w-md overflow-y-auto", isRTL && "rtl")}
        >
          <SheetHeader className={cn(isRTL && "text-right")}>
            <SheetTitle>
              {editingSubject ? t.subjects.editSubject : t.subjects.addNewSubject}
            </SheetTitle>
            <SheetDescription className={cn(isRTL && "text-right")}>
              {editingSubject
                ? (isRTL ? "اطلاعات ماده را ویرایش کنید" : "Edit the subject's information")
                : (isRTL ? "اطلاعات مادهٔ نو را وارد کنید" : "Enter the new subject's information")}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <SubjectForm
              subject={editingSubject || undefined}
              onSubmit={handleSubmit}
              onCancel={() => setShowSheet(false)}
              isRTL={isRTL}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteSubjectId !== null}
        onOpenChange={(open) => !open && setDeleteSubjectId(null)}
      >
        <AlertDialogContent className={cn(isRTL && "rtl")}>
          <AlertDialogHeader className={cn(isRTL && "text-right")}>
            <AlertDialogTitle>
              {isRTL ? "حذف ماده" : "Delete Subject"}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right")}>
              {t.subjects.deleteConfirm}
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

