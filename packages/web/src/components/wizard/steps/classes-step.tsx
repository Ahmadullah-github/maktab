import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container";
import { useLanguage } from "@/hooks/useLanguage";
import { Users, Plus, Trash2, Save, AlertCircle, UserPlus, Zap, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { ClassGroup } from "@/types";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { toast } from "sonner";
import { getAllGrades } from "@/data/afghanistanCurriculum";
import { autoAssignSubjectsToClass, validateClassSubjects, extractGradeFromClassName, gradeToSection } from "@/lib/classSubjectAssignment";

interface ClassesStepProps {
  data: ClassGroup[];
  onUpdate: (data: ClassGroup[]) => void;
}

export function ClassesStep({ data, onUpdate }: ClassesStepProps) {
  const [classes, setClasses] = useState<ClassGroup[]>(data.length > 0 ? data : []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [sectionsPerGrade, setSectionsPerGrade] = useState<Record<number, number>>({});
  const [avgStudentsPerClass, setAvgStudentsPerClass] = useState(30);
  const { isRTL, t, language } = useLanguage();
  const { addClass, updateClass, deleteClass } = useClassStore();
  const { subjects } = useSubjectStore();
  const { periodsInfo, schoolInfo } = useWizardStore();
  const prevClassesRef = useRef<ClassGroup[]>([]);
  const onUpdateRef = useRef(onUpdate);
  
  // Calculate expected periods per class based on section
  const getExpectedPeriodsForClass = useCallback((classGroup: ClassGroup): number => {
    const grade = classGroup.grade || extractGradeFromClassName(classGroup.name);
    if (!grade) return 0;
    
    const section = gradeToSection(grade);
    const commonPeriodsPerDay = schoolInfo.periodsPerDay || periodsInfo.periodsPerDay || 8;
    const daysPerWeek = schoolInfo.daysPerWeek || 6;
    const commonBreakPeriods = schoolInfo.breakPeriods?.length || periodsInfo.breakPeriods?.length || 0;
    
    // Check if section-specific overrides exist
    const useSectionOverrides = !!(
      schoolInfo.primaryPeriodsPerDay || schoolInfo.middlePeriodsPerDay || schoolInfo.highPeriodsPerDay ||
      schoolInfo.primaryBreakPeriods || schoolInfo.middleBreakPeriods || schoolInfo.highBreakPeriods
    );
    
    if (useSectionOverrides) {
      const periodsPerDay = section === 'PRIMARY'
        ? (schoolInfo.primaryPeriodsPerDay ?? commonPeriodsPerDay)
        : section === 'MIDDLE'
          ? (schoolInfo.middlePeriodsPerDay ?? commonPeriodsPerDay)
          : (schoolInfo.highPeriodsPerDay ?? commonPeriodsPerDay);
      
      const breakPeriods = section === 'PRIMARY'
        ? (schoolInfo.primaryBreakPeriods?.length || 0)
        : section === 'MIDDLE'
          ? (schoolInfo.middleBreakPeriods?.length || 0)
          : (schoolInfo.highBreakPeriods?.length || 0);
      
    return (periodsPerDay * daysPerWeek) - breakPeriods;
    }
    
    return (commonPeriodsPerDay * daysPerWeek) - commonBreakPeriods;
  }, [schoolInfo, periodsInfo]);

  const enabledGrades = useMemo(() => {
    const grades: number[] = [];
    const addRange = (a: number, b: number) => { for (let g=a; g<=b; g++) grades.push(g); };
    if (schoolInfo.enablePrimary) addRange(1,6);
    if (schoolInfo.enableMiddle) addRange(7,9);
    if (schoolInfo.enableHigh) addRange(10,12);
    return grades;
  }, [schoolInfo.enablePrimary, schoolInfo.enableMiddle, schoolInfo.enableHigh]);

  // Keep onUpdate ref up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Initialize with 3 empty rows if no data
  useEffect(() => {
    if (classes.length === 0) {
      const emptyClasses = Array.from({ length: 3 }, (_, i) => ({
        id: `temp-${i}`,
        name: "",
        grade: null,
        studentCount: 30,
        subjectRequirements: [],
      }));
      setClasses(emptyClasses);
    }
  }, []);

  // Don't auto-update parent - only update on explicit saves
  // This prevents excessive API calls during typing

  const handleFieldChange = (id: string, field: keyof ClassGroup, value: any) => {
    setClasses(classes.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleAddRow = () => {
    const newClass: ClassGroup = {
      id: `temp-${Date.now()}`,
      name: "",
      grade: null,
      studentCount: 30,
      subjectRequirements: [],
    };
    setClasses([...classes, newClass]);
  };

  // Helper function to get section letter based on language
  const getSectionLetter = (sectionNumber: number, lang: string): string => {
    if (lang === "fa") {
      // Persian letters: الف (Alef), ب (Be), ج (Jeem), د (Dal), etc.
      const persianLetters = ["الف", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط", "ی"];
      return persianLetters[sectionNumber - 1] || String.fromCharCode(64 + sectionNumber);
    } else {
      // English letters: A, B, C, D, etc.
      return String.fromCharCode(64 + sectionNumber);
    }
  };

  // Helper function to get grade name in Persian
  const getPersianGradeName = (grade: number): string => {
    const gradeNames: { [key: number]: string } = {
      1: "اول", 2: "دوم", 3: "سوم", 4: "چهارم", 5: "پنجم",
      6: "ششم", 7: "هفتم", 8: "هشتم", 9: "نهم",
      10: "دهم", 11: "یازدهم", 12: "دوازدهم"
    };
    return gradeNames[grade] || grade.toString();
  };

  const handleGenerateClasses = () => {
    const newClasses: ClassGroup[] = [];
    const existingNames = new Set(classes.map(c => c.name.toLowerCase()));

    selectedGrades.forEach(grade => {
      const sections = sectionsPerGrade[grade] || 1;
      const classSection = gradeToSection(grade);
      for (let section = 1; section <= sections; section++) {
        const sectionLetter = getSectionLetter(section, language);
        let className: string;
        
        if (language === "fa") {
          const persianGrade = getPersianGradeName(grade);
          className = `صنف ${persianGrade} ${sectionLetter}`;
        } else {
          className = `Grade${grade}-${sectionLetter}`;
        }
        
        if (!existingNames.has(className.toLowerCase())) {
          // Auto-assign subjects based on grade
          const subjectReqs = autoAssignSubjectsToClass(className, subjects);
          
          newClasses.push({
            id: `temp-${Date.now()}-${grade}-${section}`,
            name: className,
            displayName: className,
            section: classSection,
            grade: grade,
            sectionIndex: sectionLetter,
            studentCount: avgStudentsPerClass,
            subjectRequirements: subjectReqs,
          });
          existingNames.add(className.toLowerCase());
        }
      }
    });

    if (newClasses.length > 0) {
      setClasses([...classes, ...newClasses]);
      toast.success(
        language === "fa" 
          ? `${newClasses.length} صنف با موفقیت ساخته شد با مواد درسی خودکار` 
          : `${newClasses.length} classes created with auto-assigned subjects`
      );
    } else {
      toast.info(language === "fa" ? "همه صنف‌ها قبلاً اضافه شده‌اند" : "All classes already exist");
    }

    setShowQuickSetup(false);
    setSelectedGrades([]);
    setSectionsPerGrade({});
  };
  
  // Auto-assign subjects to all classes
  const handleAutoAssignAllSubjects = () => {
    const updatedClasses = classes.map(cls => {
      // Use grade from class if set, otherwise extract from name
      const grade = cls.grade || (cls.name.trim() ? extractGradeFromClassName(cls.name) : null);
      if (grade && cls.name.trim()) {
        // Update grade and section if not set
        let updated = cls;
        if (!cls.grade) {
          const section = gradeToSection(grade);
          updated = { ...cls, grade, section };
        }
        const subjectReqs = autoAssignSubjectsToClass(cls.name, subjects);
        if (subjectReqs.length > 0) {
          return { ...updated, subjectRequirements: subjectReqs };
        }
        return updated;
      }
      return cls;
    });
    
    setClasses(updatedClasses);
    toast.success(
      language === "fa"
        ? "مواد درسی به صورت خودکار به صنف‌ها اختصاص داده شد"
        : "Subjects auto-assigned to all classes"
    );
  };

  const toggleGradeSelection = (grade: number) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade].sort((a, b) => a - b)
    );
  };

  const handleDeleteRow = async (id: string) => {
    try {
      if (id.startsWith("temp-")) {
        // Temporary class - just remove from local state
        setClasses(classes.filter(c => c.id !== id));
      } else {
        // Saved class - try to delete from backend
        try {
          await deleteClass(id);
          setClasses(classes.filter(c => c.id !== id));
          onUpdate(classes.filter(c => c.id !== id));
          if (language === "fa") {
            toast.success("صنف با موفقیت حذف شد");
          } else {
            toast.success("Class deleted successfully");
          }
        } catch (deleteError: any) {
          // If class not found in backend, just remove from local state
          if (deleteError?.message?.includes("404") || deleteError?.message?.includes("not found")) {
            setClasses(classes.filter(c => c.id !== id));
            onUpdate(classes.filter(c => c.id !== id));
            if (language === "fa") {
              toast.success("صنف حذف شد");
            } else {
              toast.success("Class removed");
            }
          } else {
            throw deleteError;
          }
        }
      }
    } catch (error) {
      console.error("Error deleting class:", error);
      if (language === "fa") {
        toast.error("خطا در حذف صنف");
      } else {
        toast.error("Failed to delete class");
      }
    }
  };

  const handleSave = async (classGroup: ClassGroup) => {
    if (!classGroup.name.trim()) {
      if (language === "fa") {
        toast.error("نام صنف الزامی است");
      } else {
        toast.error("Class name is required");
      }
      return;
    }
    if (classGroup.studentCount < 1) {
      if (language === "fa") {
        toast.error("تعداد شاگردان باید حداقل 1 باشد");
      } else {
        toast.error("Student count must be at least 1");
      }
      return;
    }

    try {
      if (classGroup.id.startsWith("temp-")) {
        const { id, ...newClassData } = classGroup;
        const saved = await addClass(newClassData);
        if (saved) {
          setClasses(classes.map(c => c.id === id ? saved : c));
          if (language === "fa") {
            toast.success("صنف با موفقیت اضافه شد");
          } else {
            toast.success("Class added successfully");
          }
        }
      } else {
        const updated = await updateClass(classGroup);
        if (updated) {
          setClasses(classes.map(c => c.id === classGroup.id ? updated : c));
          onUpdate(classes.map(c => c.id === classGroup.id ? updated : c));
          if (language === "fa") {
            toast.success("صنف با موفقیت به‌روزرسانی شد");
          } else {
            toast.success("Class updated successfully");
          }
        }
      }
      setEditingId(null);
    } catch (error) {
      console.error("Error saving class:", error);
      if (language === "fa") {
        toast.error("خطا در ذخیره صنف");
      } else {
        toast.error("Failed to save class");
      }
    }
  };

  const isRowValid = (classGroup: ClassGroup) => {
    return classGroup.name.trim().length > 0 && classGroup.studentCount > 0;
  };

  // Save all unsaved classes
  const handleSaveAll = async () => {
    const tempClasses = classes.filter(c => c.id.startsWith("temp-") && isRowValid(c));
    
    if (tempClasses.length === 0) {
      if (language === "fa") {
        toast.info("هیچ صنف جدیدی برای ذخیره وجود ندارد");
      } else {
        toast.info("No new classes to save");
      }
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const classGroup of tempClasses) {
        try {
          const { id, ...newClassData } = classGroup;
          const saved = await addClass(newClassData);
          if (saved) {
            setClasses(prevClasses => prevClasses.map(c => c.id === id ? saved : c));
            successCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      if (successCount > 0) {
        if (language === "fa") {
          toast.success(`${successCount} صنف با موفقیت ذخیره شد`);
        } else {
          toast.success(`${successCount} classes saved successfully`);
        }
      }
      
      if (failCount > 0) {
        if (language === "fa") {
          toast.error(`${failCount} صنف ذخیره نشد`);
        } else {
          toast.error(`Failed to save ${failCount} classes`);
        }
      }
    } catch (error) {
      console.error("Error saving classes:", error);
      if (language === "fa") {
        toast.error("خطا در ذخیره صنف‌ها");
      } else {
        toast.error("Failed to save classes");
      }
    }
  };

  // Get unsaved classes count
  const unsavedCount = useMemo(() => {
    return classes.filter(c => c.id.startsWith("temp-") && isRowValid(c)).length;
  }, [classes]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
    const avgStudents = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;
    
    return {
      totalClasses: classes.length,
      totalStudents,
      avgStudents,
    };
  }, [classes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <WizardStepContainer
        title={t.classes.title || "Class Management"}
        description="Add and manage classes for your school"
        icon={<Users className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Classes</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalClasses}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Total Students</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.totalStudents}</p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Avg Students</p>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.avgStudents}</p>
          </div>
        </div>

        {/* Classes Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-700">
                <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                  Class Name <span className="text-red-500">*</span>
                </th>
                <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                  Grade
                </th>
                <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                  Student Count <span className="text-red-500">*</span>
                </th>
                <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Subjects/Periods
                </th>
                <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classGroup) => {
                const isValid = isRowValid(classGroup);
                const isEditing = editingId === classGroup.id;
                const expectedForClass = getExpectedPeriodsForClass(classGroup);
                const validation = validateClassSubjects(classGroup, subjects, expectedForClass);

                return (
                  <tr
                    key={classGroup.id}
                    className={cn(
                      "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                      !isValid && "bg-red-50 dark:bg-red-950/20"
                    )}
                  >
                    {/* Name */}
                    <td className="py-3 px-4">
                      <Input
                        value={classGroup.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          // Get current class state to check if grade was manually set
                          setClasses(prevClasses => {
                            const currentClass = prevClasses.find(c => c.id === classGroup.id);
                            const gradeWasManuallySet = currentClass?.grade !== null && currentClass?.grade !== undefined;
                            
                            // Only auto-extract if grade was not manually set
                            let updatedGrade = currentClass?.grade ?? null;
                            let updatedSection = currentClass?.section ?? undefined;
                            
                            if (!gradeWasManuallySet && newName.trim()) {
                              const extractedGrade = extractGradeFromClassName(newName);
                              if (extractedGrade && enabledGrades.includes(extractedGrade)) {
                                updatedGrade = extractedGrade;
                                updatedSection = gradeToSection(extractedGrade);
                              }
                            }
                            
                            return prevClasses.map(c =>
                              c.id === classGroup.id
                                ? {
                                    ...c,
                                    name: newName,
                                    grade: updatedGrade,
                                    section: updatedSection,
                                  }
                                : c
                            );
                          });
                        }}
                        onBlur={() => {
                          if (isValid && isEditing) {
                            const currentClass = classes.find(c => c.id === classGroup.id);
                            if (currentClass) handleSave(currentClass);
                          }
                        }}
                        onClick={() => setEditingId(classGroup.id)}
                        placeholder="e.g. Grade 10-A"
                        className={cn(
                          "min-w-[200px]",
                          !isValid && "border-red-500"
                        )}
                      />
                      {!isValid && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Required
                        </p>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="py-3 px-4">
                      <select
                        value={classGroup.grade ?? ""}
                        onChange={(e) => {
                          const selectedValue = e.target.value;
                          const grade = selectedValue ? parseInt(selectedValue) : null;
                          const section = grade ? gradeToSection(grade) : undefined;
                          
                          setClasses(prevClasses =>
                            prevClasses.map(c =>
                              c.id === classGroup.id
                                ? {
                                    ...c,
                                    grade: grade,
                                    section: section,
                                  }
                                : c
                            )
                          );
                        }}
                        onClick={() => setEditingId(classGroup.id)}
                        onBlur={() => {
                          if (isValid && isEditing) {
                            const currentClass = classes.find(c => c.id === classGroup.id);
                            if (currentClass) handleSave(currentClass);
                          }
                        }}
                        className={cn(
                          "min-w-[120px] h-9 px-3 border rounded-md text-sm",
                          !classGroup.grade && "text-gray-400"
                        )}
                      >
                        <option value="">Auto (from name)</option>
                        {enabledGrades.map(g => (
                          <option key={g} value={g}>
                            {language === "fa" ? `صنف ${getPersianGradeName(g)}` : `Grade ${g}`}
                          </option>
                        ))}
                      </select>
                      {classGroup.grade && (
                        <p className="text-xs text-gray-500 mt-1">
                          {gradeToSection(classGroup.grade)}
                        </p>
                      )}
                    </td>

                    {/* Student Count */}
                    <td className="py-3 px-4">
                      <div className="relative">
                        <Input
                          type="number"
                          value={classGroup.studentCount || ""}
                          onChange={(e) => handleFieldChange(classGroup.id, "studentCount", e.target.value ? parseInt(e.target.value) : 0)}
                          onBlur={() => isEditing && isValid && handleSave(classGroup)}
                          onClick={() => setEditingId(classGroup.id)}
                          placeholder="30"
                          className={cn(
                            "min-w-[120px]",
                            !isValid && "border-red-500"
                          )}
                          min="1"
                          max="1000"
                        />
                        <div className={cn("absolute top-1/2 -translate-y-1/2 flex items-center text-gray-400 pointer-events-none", isRTL ? "left-3" : "right-3")}>
                          <UserPlus className="h-4 w-4" />
                        </div>
                      </div>
                    </td>

                    {/* Subjects/Periods Validation */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {validation.grade ? (
                          <>
                            <span className={cn(
                              "font-mono text-sm font-semibold",
                              validation.isValid ? "text-green-600" : "text-red-600"
                            )}>
                              {validation.totalPeriods}/{expectedForClass}
                            </span>
                            {validation.isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing && isValid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSave(classGroup)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRow(classGroup.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-center gap-4">
          <Button
            onClick={() => setShowQuickSetup(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
          >
            <Zap className="h-4 w-4" />
            {language === "fa" ? "تنظیم سریع" : "Quick Setup"}
          </Button>
          <Button
            onClick={handleAddRow}
            variant="outline"
            className="flex items-center gap-2 border-dashed"
          >
            <Plus className="h-4 w-4" />
            {language === "fa" ? "افزودن صنف" : "Add Class"}
          </Button>
          <Button
            onClick={handleAutoAssignAllSubjects}
            disabled={subjects.length === 0 || classes.length === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {language === "fa" ? "اختصاص خودکار مواد درسی" : "Auto-Assign Subjects"}
          </Button>
          
          {unsavedCount > 0 && (
            <Button
              onClick={handleSaveAll}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="h-4 w-4" />
              {language === "fa" ? `ذخیره همه (${unsavedCount})` : `Save All (${unsavedCount})`}
            </Button>
          )}
        </div>

        {/* Quick Setup Modal */}
        {showQuickSetup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {language === "fa" ? "تنظیم سریع صنف‌ها" : "Quick Class Setup"}
                </h3>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {language === "fa" 
                  ? "صنف‌ها را به صورت گروهی ایجاد کنید. انتخاب کنید چه صنف‌هایی دارید و برای هر صنف چند بخش می‌خواهید."
                  : "Create classes in bulk. Select which grades you have and how many sections per grade."}
              </p>

              <div className="space-y-6">
                {/* Grade Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {language === "fa" ? "انتخاب صنف‌ها" : "Select Grades"}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {enabledGrades.map(grade => (
                      <Button
                        key={grade}
                        type="button"
                        variant={selectedGrades.includes(grade) ? "default" : "outline"}
                        onClick={() => toggleGradeSelection(grade)}
                        className={cn(
                          "h-10",
                          selectedGrades.includes(grade) && "bg-orange-600 text-white"
                        )}
                      >
                        {language === "fa" ? getPersianGradeName(grade) : `Grade ${grade}`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sections per Grade */}
                {selectedGrades.length > 0 && (
                  <>
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {language === "fa" ? "تعداد بخش‌ها برای هر صنف" : "Sections per Grade"}
                      </label>
                      <div className="space-y-2">
                        {selectedGrades.map(grade => (
                          <div key={grade} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {language === "fa" ? `صنف ${getPersianGradeName(grade)}` : `Grade ${grade}`}
                            </span>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={sectionsPerGrade[grade] || 1}
                              onChange={(e) => setSectionsPerGrade({
                                ...sectionsPerGrade,
                                [grade]: parseInt(e.target.value) || 1
                              })}
                              className="w-20"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Average Students */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {language === "fa" ? "میانگین شاگردان در هر صنف" : "Average Students per Class"}
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={avgStudentsPerClass}
                        onChange={(e) => setAvgStudentsPerClass(parseInt(e.target.value) || 30)}
                        className="w-full"
                      />
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        <CheckCircle2 className="inline h-4 w-4 mr-1" />
                        {language === "fa" ? "پیش‌نمایش" : "Preview"}
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {(() => {
                          const totalClasses = selectedGrades.reduce((sum, grade) => sum + (sectionsPerGrade[grade] || 1), 0);
                          const examples = selectedGrades.slice(0, 2).map(g => {
                            const sections = sectionsPerGrade[g] || 1;
                            const sectionLetter1 = getSectionLetter(1, language);
                            const sectionLetter2 = getSectionLetter(2, language);
                            
                            if (language === "fa") {
                              const persianGrade = getPersianGradeName(g);
                              return sections >= 2 
                                ? `صنف ${persianGrade} ${sectionLetter1}, صنف ${persianGrade} ${sectionLetter2}` 
                                : `صنف ${persianGrade} ${sectionLetter1}`;
                            } else {
                              return sections >= 2 
                                ? `Grade${g}-${sectionLetter1}, Grade${g}-${sectionLetter2}` 
                                : `Grade${g}-${sectionLetter1}`;
                            }
                          }).join(", ");
                          
                          return language === "fa" 
                            ? `${totalClasses} صنف ایجاد خواهد شد (مثلاً: ${examples})`
                            : `${totalClasses} classes will be created (e.g., ${examples})`;
                        })()}
                      </p>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerateClasses}
                    disabled={selectedGrades.length === 0}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {language === "fa" ? "تولید صنف‌ها" : "Generate Classes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQuickSetup(false);
                      setSelectedGrades([]);
                      setSectionsPerGrade({});
                    }}
                  >
                    {language === "fa" ? "لغو" : "Cancel"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Tip:</strong> Click on any field to edit. Changes are automatically saved when you click outside the field or press the save button. Subject requirements will be configured in the next step.
          </p>
        </div>
      </WizardStepContainer>
    </div>
  );
}
