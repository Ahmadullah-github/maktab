import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container";
import { useLanguageCtx } from "@/i18n/provider";
import {
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Save,
  RefreshCw,
  Info,
  Edit,
  Trash2,
} from "lucide-react";
import {cn} from "@/lib/utils/tailwaindMergeUtil";
import { Subject } from "@/types";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useClassStore } from "@/stores/useClassStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { toast } from "sonner";
import { dataService } from "@/lib/dataService";
import {
  getSubjectsForGrade,
  getAllGrades,
  getTotalPeriodsForGrade,
  validateGradePeriods,
  SubjectInfo,
} from "@/data/afghanistanCurriculum";
import { extractGradeFromClassName } from "@/lib/classSubjectAssignment";
import { SubjectEditDialog } from "./subjects/SubjectEditDialog";
import { SubjectDeleteConfirm } from "./subjects/SubjectDeleteConfirm";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface SubjectsStepProps {
  data: Subject[];
  onUpdate: (data: Subject[]) => void;
}

interface GradeSubjectRow {
  officialSubject: SubjectInfo;
  savedSubject?: Subject;
  periodsPerWeek: number;
  isModified: boolean;
  isCustom?: boolean; // true if added via "Add Subject", not from curriculum
}

export function SubjectsStep({ data, onUpdate }: SubjectsStepProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [gradeSubjectData, setGradeSubjectData] = useState<Map<number, GradeSubjectRow[]>>(new Map());
  const [editingSubject, setEditingSubject] = useState<{ grade: number; subject: SubjectInfo & { periodsPerWeek: number } } | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<{ grade: number; name: string; savedSubject?: Subject } | null>(null);
  const [isSavedMode, setIsSavedMode] = useState(false); // true if subjects have been saved to DB
  
  const { isRTL, t, language } = useLanguageCtx();
  const { addSubject, updateSubject, deleteSubject } = useSubjectStore();
  const { classes } = useClassStore();
  const { periodsInfo, schoolInfo } = useWizardStore();

  const gradeToSection = useCallback((grade: number): 'PRIMARY'|'MIDDLE'|'HIGH' => {
    if (grade >= 1 && grade <= 6) return 'PRIMARY';
    if (grade >= 7 && grade <= 9) return 'MIDDLE';
    return 'HIGH';
  }, []);

  const enabledGrades = useMemo(() => {
    // Extract unique grades from classes that have been added
    const gradesFromClasses = new Set<number>();
    classes.forEach(cls => {
      if (cls.grade) {
        gradesFromClasses.add(cls.grade);
      } else if (cls.name) {
        // Extract grade from class name as fallback
        const extracted = extractGradeFromClassName(cls.name);
        if (extracted) gradesFromClasses.add(extracted);
      }
    });
    // Return sorted array
    return Array.from(gradesFromClasses).sort((a, b) => a - b);
  }, [classes]);

  // Calculate expected periods per grade based on section
  const getExpectedPeriodsForGrade = useCallback((grade: number): number => {
    const commonPeriodsPerDay = schoolInfo.periodsPerDay || periodsInfo.periodsPerDay || 8;
    const daysPerWeek = schoolInfo.daysPerWeek || 6;
    // Break periods are time gaps between teaching periods, not replacements
    // Total teaching periods per week = periods per day * days per week
    return commonPeriodsPerDay * daysPerWeek;
  }, [schoolInfo, periodsInfo]);

  // Load subjects from database and determine mode
  useEffect(() => {
    let aborted = false;
    const loadData = async () => {
      try {
        const existingSubjects = await dataService.getSubjects();
        if (aborted) return;
        
        setSubjects(existingSubjects || []);
        
        // Mode detection: Check if any subjects exist for enabled grades
        const subjectsForEnabledGrades = (existingSubjects || []).filter(s => 
          s.grade && enabledGrades.includes(s.grade)
        );
        const hasSavedSubjects = subjectsForEnabledGrades.length > 0;
        setIsSavedMode(hasSavedSubjects);
        
        const gradeMap = new Map<number, GradeSubjectRow[]>();
        
        if (hasSavedSubjects) {
          // SAVED MODE: Load only from database, group by grade
          for (const grade of enabledGrades) {
            const savedSubjectsForGrade = (existingSubjects || []).filter(
              s => s.grade === grade
            );
            
            const rows: GradeSubjectRow[] = savedSubjectsForGrade.map(saved => ({
              officialSubject: {
                name: saved.name,
                nameEn: saved.name,
                code: saved.code || "",
                periodsPerWeek: saved.periodsPerWeek || 0,
                isDifficult: saved.isDifficult,
                requiredRoomType: saved.requiredRoomType,
              } as SubjectInfo,
              savedSubject: saved,
              periodsPerWeek: saved.periodsPerWeek || 0,
              isModified: false,
              isCustom: true, // In saved mode, all are treated as custom
            }));
          
          gradeMap.set(grade, rows);
          }
        } else {
          // TEMPLATE MODE (initial): Show empty grades (allow manual add)
          for (const grade of enabledGrades) {
            gradeMap.set(grade, []);
          }
        }
        
        setGradeSubjectData(gradeMap);
      } catch (err) {
        console.error("Failed to load subjects:", err);
        toast.error("Failed to load subjects");
      } finally {
        if (!aborted) setIsLoading(false);
      }
    };
    loadData();
    return () => { aborted = true; };
  }, [enabledGrades, gradeToSection]);

  // Update selected grade when enabled grades change
  useEffect(() => {
    if (enabledGrades.length > 0 && !enabledGrades.includes(selectedGrade)) {
      setSelectedGrade(enabledGrades[0]);
    }
  }, [enabledGrades, selectedGrade]);

  // Update periods for a subject
  const handlePeriodChange = useCallback((grade: number, subjectName: string, newPeriods: number) => {
    setGradeSubjectData(prev => {
      const newMap = new Map(prev);
      const rows = newMap.get(grade) || [];
      
      const updatedRows = rows.map(row => {
        if (row.officialSubject.name === subjectName) {
          return {
            ...row,
            periodsPerWeek: newPeriods,
            isModified: newPeriods !== row.officialSubject.periodsPerWeek
          };
        }
        return row;
      });
      
      newMap.set(grade, updatedRows);
      return newMap;
    });
  }, []);


  // Reset grade to defaults
  const handleResetGrade = useCallback((grade: number) => {
    setGradeSubjectData(prev => {
      const newMap = new Map(prev);
      const officialSubjects = getSubjectsForGrade(grade);
      
      const rows: GradeSubjectRow[] = officialSubjects.map(official => {
        const saved = subjects.find(s => s.grade === grade && s.name === official.name);
        return {
          officialSubject: official,
          savedSubject: saved,
          periodsPerWeek: official.periodsPerWeek,
          isModified: false,
        };
      });
      
      newMap.set(grade, rows);
      return newMap;
    });
    
    toast.success(language === "fa" 
      ? `صنف ${grade} به حالت پیش‌فرض بازگردانده شد`
      : `Grade ${grade} reset to defaults`
    );
  }, [subjects, language]);

  // Save all subjects for all grades
  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    
    try {
      const allSubjectsToSave: Subject[] = [];
      
      // Collect all subjects from all grades
      for (const [grade, rows] of gradeSubjectData.entries()) {
        for (const row of rows) {
          const subjectToSave: Subject = {
            id: row.savedSubject ? String(row.savedSubject.id) : `temp-${grade}-${row.officialSubject.code}`,
            name: row.officialSubject.name,
            code: row.officialSubject.code,
            grade: grade,
            periodsPerWeek: row.periodsPerWeek,
            section: gradeToSection(grade),
            isDifficult: row.officialSubject.isDifficult,
            requiredRoomType: row.officialSubject.requiredRoomType || "Regular",
          };
          
          allSubjectsToSave.push(subjectToSave);
        }
      }
      
      // Save to database
      let successCount = 0;
      let errorCount = 0;
      
      for (const subject of allSubjectsToSave) {
        try {
          if (String(subject.id).startsWith('temp-')) {
            // New subject - create
            const { id, ...newSubjectData } = subject;
            const saved = await addSubject(newSubjectData);
            if (saved) {
              successCount++;
              // Update local state with saved ID
              setGradeSubjectData(prev => {
                const newMap = new Map(prev);
                const rows = newMap.get(subject.grade!) || [];
                const updatedRows = rows.map(row => {
                  if (row.officialSubject.name === subject.name) {
                    return { ...row, savedSubject: saved };
                  }
                  return row;
                });
                newMap.set(subject.grade!, updatedRows);
                return newMap;
              });
            } else {
              errorCount++;
            }
          } else {
            // Existing subject - update
            const updated = await updateSubject(subject);
            if (updated) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        } catch (err) {
          console.error("Error saving subject:", err);
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(
          language === "fa"
            ? `${successCount} ماده درسی ذخیره شد`
            : `${successCount} subjects saved`
        );
        
        // Reload subjects and switch to Saved Mode
        const reloaded = await dataService.getSubjects();
        setSubjects(reloaded || []);
        
        // Switch to Saved Mode: rebuild gradeSubjectData from saved subjects only
        const gradeMap = new Map<number, GradeSubjectRow[]>();
        for (const grade of enabledGrades) {
          const savedSubjectsForGrade = (reloaded || []).filter(s => s.grade === grade);
          const rows: GradeSubjectRow[] = savedSubjectsForGrade.map(saved => ({
            officialSubject: {
              name: saved.name,
              nameEn: saved.name,
              code: saved.code || "",
              periodsPerWeek: saved.periodsPerWeek || 0,
              isDifficult: saved.isDifficult,
              requiredRoomType: saved.requiredRoomType,
            } as SubjectInfo,
            savedSubject: saved,
            periodsPerWeek: saved.periodsPerWeek || 0,
            isModified: false,
            isCustom: true,
          }));
          gradeMap.set(grade, rows);
        }
        setGradeSubjectData(gradeMap);
        setIsSavedMode(true);
        
        onUpdate(reloaded || []);
      }
      
      if (errorCount > 0) {
        toast.error(
          language === "fa"
            ? `${errorCount} ماده درسی ذخیره نشد`
            : `${errorCount} subjects failed to save`
        );
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save subjects");
    } finally {
      setIsSaving(false);
    }
  }, [gradeSubjectData, addSubject, updateSubject, language, onUpdate, gradeToSection, enabledGrades, subjects, setSubjects, setIsSavedMode, setGradeSubjectData]);

  // Handle subject edit (works in both modes)
  const handleEditSubject = useCallback(async (updatedData: { name: string; code: string; periodsPerWeek: number; requiredRoomType?: string; isDifficult: boolean }) => {
    if (!editingSubject) return;

    const { grade, subject: originalSubject } = editingSubject;
    const rows = gradeSubjectData.get(grade) || [];
    const row = rows.find(r => r.officialSubject.name === originalSubject.name || (r.savedSubject && r.savedSubject.name === originalSubject.name));
    
    if (!row || (!originalSubject.name && !originalSubject.code)) {
      // Treat as Add (new subject)
      try {
        const created = await addSubject({
          name: updatedData.name,
          code: updatedData.code,
          periodsPerWeek: updatedData.periodsPerWeek,
          requiredRoomType: updatedData.requiredRoomType || "Regular",
          isDifficult: updatedData.isDifficult,
          grade,
          section: gradeToSection(grade),
        } as any);

        // Update local state with created subject (no reload needed)
        setGradeSubjectData(prev => {
          const next = new Map(prev);
          const prevRows = next.get(grade) || [];
          next.set(grade, [
            ...prevRows,
            {
              officialSubject: {
                name: updatedData.name,
                nameEn: updatedData.name,
                code: updatedData.code,
                periodsPerWeek: updatedData.periodsPerWeek,
                requiredRoomType: updatedData.requiredRoomType || "Regular",
                isDifficult: updatedData.isDifficult,
              } as SubjectInfo,
              savedSubject: created || undefined,
              periodsPerWeek: updatedData.periodsPerWeek,
              isModified: false,
              isCustom: true,
            },
          ]);
          return next;
        });
        
        // In Saved Mode: Also update subjects list
        if (isSavedMode && created) {
          setSubjects(prev => [...prev, created]);
        }

        toast.success(t.common.subjectAdded || "Subject added");
      } catch (e) {
        toast.error(t.common.failedToAddSubject || "Failed to add subject");
      }
      return;
    }

    // Update existing subject
    if (isSavedMode) {
      // Saved Mode: Persist immediately to DB
      if (row.savedSubject) {
        try {
          const updated = await updateSubject({
            ...row.savedSubject,
            name: updatedData.name,
            code: updatedData.code,
            periodsPerWeek: updatedData.periodsPerWeek,
            requiredRoomType: updatedData.requiredRoomType,
            isDifficult: updatedData.isDifficult,
          });

          if (updated) {
            // Update local state only (no reload)
            setGradeSubjectData(prev => {
              const newMap = new Map(prev);
              const updatedRows = rows.map(r => 
                r.savedSubject && String(r.savedSubject.id) === String(row.savedSubject!.id)
                  ? { 
                      ...r, 
                      officialSubject: {
                        name: updatedData.name,
                        nameEn: updatedData.name,
                        code: updatedData.code,
                        periodsPerWeek: updatedData.periodsPerWeek,
                        requiredRoomType: updatedData.requiredRoomType || "Regular",
                        isDifficult: updatedData.isDifficult,
                      } as SubjectInfo,
                      periodsPerWeek: updatedData.periodsPerWeek,
                      savedSubject: updated,
                      isModified: false
                    } 
                  : r
              );
              newMap.set(grade, updatedRows);
              return newMap;
            });
            
            // Update subjects list
            setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s));
            
            toast.success(t.common.subjectUpdated || "Subject updated");
          }
        } catch (err) {
          console.error("Failed to update subject:", err);
          toast.error("Failed to update subject");
          throw err;
        }
      }
    } else {
      // Template Mode: Update local state (will save on Save All)
      if (row.savedSubject) {
        // Already saved, update in DB but also update local state
        try {
          const updated = await updateSubject({
            ...row.savedSubject,
            name: updatedData.name,
            code: updatedData.code,
            periodsPerWeek: updatedData.periodsPerWeek,
            requiredRoomType: updatedData.requiredRoomType,
            isDifficult: updatedData.isDifficult,
          });

          if (updated) {
            setGradeSubjectData(prev => {
              const newMap = new Map(prev);
              const updatedRows = rows.map(r => 
                r.savedSubject && String(r.savedSubject.id) === String(row.savedSubject!.id)
                  ? { 
                      ...r, 
                      officialSubject: { ...r.officialSubject, ...updatedData },
                      periodsPerWeek: updatedData.periodsPerWeek,
                      savedSubject: updated,
                      isModified: updatedData.periodsPerWeek !== r.officialSubject.periodsPerWeek
                    } 
                  : r
              );
              newMap.set(grade, updatedRows);
              return newMap;
            });
            toast.success(t.common.changesSaved || "Changes saved");
          }
        } catch (err) {
          console.error("Failed to update subject:", err);
          toast.error(t.common.subjectUpdated || "Failed to update subject");
        }
      } else {
        // Not yet saved, just update local state
        setGradeSubjectData(prev => {
          const newMap = new Map(prev);
          const updatedRows = rows.map(r => 
            r.officialSubject.name === originalSubject.name 
              ? { 
                  ...r, 
                  officialSubject: { ...r.officialSubject, ...updatedData },
                  periodsPerWeek: updatedData.periodsPerWeek,
                  isModified: updatedData.periodsPerWeek !== r.officialSubject.periodsPerWeek
                } 
              : r
          );
          newMap.set(grade, updatedRows);
          return newMap;
        });
        toast.success(t.common.changesSaved || "Changes saved");
      }
    }
  }, [editingSubject, gradeSubjectData, updateSubject, addSubject, language, gradeToSection, isSavedMode]);

  // Handle subject delete (works in both modes)
  const handleDeleteSubject = useCallback(async () => {
    if (!deletingSubject || !deletingSubject.savedSubject) return;

    try {
      await deleteSubject(deletingSubject.savedSubject.id);

      // Update local state only (no reload)
      setGradeSubjectData(prev => {
        const newMap = new Map(prev);
        const rows = newMap.get(deletingSubject.grade) || [];
        const filtered = rows.filter(r => r.savedSubject?.id !== deletingSubject.savedSubject?.id);
        newMap.set(deletingSubject.grade, filtered);
        return newMap;
      });
      
      // Update subjects list
      setSubjects(prev => prev.filter(s => s.id !== deletingSubject.savedSubject?.id));
      
      if (isSavedMode) {
        // In saved mode, no additional action needed
      }
      
      toast.success(t.common.subjectDeleted || "Subject deleted");
    } catch (err) {
      console.error("Failed to delete subject:", err);
      toast.error("Failed to delete subject");
      throw err;
    }
  }, [deletingSubject, deleteSubject, language, isSavedMode]);

  // Load official curriculum for a grade (only works in Template Mode)
  const handleLoadOfficialCurriculum = useCallback((grade: number) => {
    if (isSavedMode) {
      toast.error(
        language === "fa"
          ? "در حالت مواد ذخیره شده نمی‌توانید برنامه درسی رسمی را بارگذاری کنید"
          : "Cannot load official curriculum in Saved Mode"
      );
      return;
    }
    
    const officialSubjects = getSubjectsForGrade(grade);
    
    setGradeSubjectData(prev => {
      const newMap = new Map(prev);
      
      const rows: GradeSubjectRow[] = officialSubjects.map(official => {
        const saved = subjects.find(s => s.grade === grade && s.name === official.name);
        return {
          officialSubject: official,
          savedSubject: saved,
          periodsPerWeek: official.periodsPerWeek,
          isModified: false,
          isCustom: false,
        };
      });
      
      newMap.set(grade, rows);
      return newMap;
    });
    
    toast.success(
      language === "fa"
        ? `برنامه درسی رسمی برای صنف ${grade} بارگذاری شد`
        : `Official curriculum loaded for Grade ${grade}`
    );
  }, [subjects, language, isSavedMode]);

  // Calculate total periods for a grade
  const getGradeTotalPeriods = useCallback((grade: number): number => {
    const rows = gradeSubjectData.get(grade) || [];
    return rows.reduce((sum, row) => sum + row.periodsPerWeek, 0);
  }, [gradeSubjectData]);

  // Check if grade is valid
  const isGradeValid = useCallback((grade: number): boolean => {
    const total = getGradeTotalPeriods(grade);
    const expected = getExpectedPeriodsForGrade(grade);
    return total === expected;
  }, [getGradeTotalPeriods, getExpectedPeriodsForGrade]);

  // Check if all grades are configured
  const allGradesConfigured = useMemo(() => {
    return enabledGrades.every(grade => {
      const rows = gradeSubjectData.get(grade);
      return rows && rows.length > 0;
    });
  }, [gradeSubjectData, enabledGrades]);

  // Count total subjects across all grades
  const totalSubjectsCount = useMemo(() => {
    let count = 0;
    gradeSubjectData.forEach(rows => {
      count += rows.length;
    });
    return count;
  }, [gradeSubjectData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Expose handlers to GradeSubjectsCard without prop threading (local scope bridge) */}
      <script suppressHydrationWarning>
        {""}
      </script>
      {(() => {
        (window as any).__subjectsStartEdit = (grade: number, subject: any) => setEditingSubject({ grade, subject });
        (window as any).__subjectsStartDelete = (grade: number, name: string, savedSubject: any) => setDeletingSubject({ grade, name, savedSubject });
        (window as any).__subjectsStartAdd = (grade: number) => setEditingSubject({
          grade,
          subject: {
            name: "",
            code: "",
            periodsPerWeek: 0,
            requiredRoomType: "Regular",
            isDifficult: false,
          } as any,
        });
        // Local grade actions bridged for GradeSubjectsCard
        (window as any).__subjectsResetGradeLocal = (grade: number) => {
          setGradeSubjectData((prev: Map<number, any>) => {
            const m = new Map(prev);
            const rows = m.get(grade) || [];
            const resetRows = rows.map((r: any) => ({
              ...r,
              periodsPerWeek: r.savedSubject?.periodsPerWeek ?? r.officialSubject.periodsPerWeek ?? 0,
              isModified: false,
            }));
            m.set(grade, resetRows);
            return m;
          });
        };
        (window as any).__subjectsInsertCurriculumForGrade = async (grade: number) => {
          const official = getSubjectsForGrade(grade).map(s => ({
            name: s.name,
            code: s.code,
            periodsPerWeek: s.periodsPerWeek,
            requiredRoomType: s.requiredRoomType || "",
            isDifficult: !!s.isDifficult,
            section: gradeToSection(grade),
          }));
          if (official.length > 0) {
            await dataService.insertCurriculumForGrade(grade, official);
          }
          const reloaded = await dataService.getSubjects();
          // Update ALL subjects state (not just for this grade)
          setSubjects(reloaded || []);
          
          const forGrade = (reloaded || []).filter((s: any) => s.grade === grade);
          const updatedRows = forGrade.map((saved: any) => ({
            officialSubject: {
              name: saved.name,
              nameEn: saved.name,
              code: saved.code || "",
              periodsPerWeek: saved.periodsPerWeek || 0,
              isDifficult: saved.isDifficult,
              requiredRoomType: saved.requiredRoomType,
            } as SubjectInfo,
            savedSubject: saved,
            periodsPerWeek: saved.periodsPerWeek || 0,
            isModified: false,
            isCustom: true,
          }));
          setGradeSubjectData((prev: Map<number, any>) => {
            const m = new Map(prev);
            m.set(grade, updatedRows);
            return m;
          });
          setIsSavedMode(true);
        };
        (window as any).__subjectsClearGrade = async (grade: number) => {
          await dataService.deleteSubjectsByGrade(grade);
          // Reload subjects from database
          const reloaded = await dataService.getSubjects();
          setSubjects(reloaded || []);
          // Update grade data - preserve entry but set to empty array
          setGradeSubjectData((prev: Map<number, any>) => {
            const m = new Map(prev);
            // Ensure grade entry exists (preserve it, just clear subjects)
            m.set(grade, []);
            return m;
          });
        };
        return null as any;
      })()}
      <WizardStepContainer
        title={t.subjects?.title || "Subject Management"}
        description={isSavedMode 
          ? (language === "fa" 
            ? "مدیریت مواد درسی ذخیره شده - تغییرات به‌طور مستقیم در پایگاه داده ذخیره می‌شوند"
            : "Managing saved subjects - Changes are saved directly to database")
          : (language === "fa" 
          ? "مواد درسی را برای هر صنف از برنامه درسی رسمی افغانستان بارگذاری کنید"
            : "Load subjects for each grade from official Afghanistan curriculum")
        }
        icon={<BookOpen className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        {/* No Classes Alert */}
        {enabledGrades.length === 0 && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {t.common.noClassesDefined || "No Classes Defined"}
            </AlertTitle>
            <AlertDescription>
              {language === "fa" 
                ? "لطفاً ابتدا صنف‌ها را در مرحله Classes اضافه کنید. مواد درسی بر اساس صنف‌های تعریف شده شما تنظیم خواهد شد."
                : "Please add classes in the Classes step first. Subjects will be configured based on the grades of your classes."}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Mode Indicator */}
        {enabledGrades.length > 0 && (
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>
              {isSavedMode 
                ? (t.common.savedSubjectsMode || "Saved Subjects Mode")
                : (t.common.curriculumTemplateMode || "Curriculum Template Mode")
              }
            </AlertTitle>
            <AlertDescription>
              {isSavedMode 
                ? (language === "fa" 
                  ? "شما در حال مدیریت مواد درسی ذخیره شده هستید. تغییرات به‌طور مستقیم در پایگاه داده ذخیره می‌شوند."
                  : "You are managing saved subjects. Changes are saved directly to the database.")
                : (language === "fa" 
                  ? "شما در حال مشاهده الگوهای برنامه درسی رسمی هستید. برای ذخیره کردن مواد درسی، دکمه 'ذخیره همه' را فشار دهید."
                  : "You are viewing official curriculum templates. Press 'Save All' to save subjects to database.")
              }
            </AlertDescription>
          </Alert>
        )}
        
        {/* Summary Bar */}
        {enabledGrades.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t.subjects?.totalSubjects || "Total Subjects"}
                </p>
                <p className="text-2xl font-bold text-blue-600">{totalSubjectsCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t.common.gradesConfigured || "Grades Configured"}
                </p>
                <p className="text-2xl font-bold text-indigo-600">
                  {Array.from(gradeSubjectData.keys()).length} / {enabledGrades.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t.common.periodsRequired || "Periods Required (by section)"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(() => {
                    const primaryExpected = getExpectedPeriodsForGrade(1);
                    const middleExpected = getExpectedPeriodsForGrade(7);
                    const highExpected = getExpectedPeriodsForGrade(10);
                    if (schoolInfo.enablePrimary && schoolInfo.enableMiddle && schoolInfo.enableHigh) {
                      return `${primaryExpected} / ${middleExpected} / ${highExpected}`;
                    } else if (schoolInfo.enablePrimary && schoolInfo.enableMiddle) {
                      return `${primaryExpected} / ${middleExpected}`;
                    } else if (schoolInfo.enablePrimary && schoolInfo.enableHigh) {
                      return `${primaryExpected} / ${highExpected}`;
                    } else if (schoolInfo.enableMiddle && schoolInfo.enableHigh) {
                      return `${middleExpected} / ${highExpected}`;
                    } else if (schoolInfo.enablePrimary) {
                      return `${primaryExpected}`;
                    } else if (schoolInfo.enableMiddle) {
                      return `${middleExpected}`;
                    } else {
                      return `${highExpected}`;
                    }
                  })()}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
            {!isSavedMode && (
              <ConfirmDialog
                title={t.common.insertCurriculum || "Insert Curriculum"}
                description={t.common.insertOfficialCurriculum || "Insert official curriculum for all enabled grades?"}
                confirmLabel={t.common.yes || "Yes"}
                cancelLabel={t.common.no || "No"}
                onConfirm={async () => {
                  try {
                    for (const g of enabledGrades) {
                      const official = getSubjectsForGrade(g).map(s => ({
                        name: s.name,
                        code: s.code,
                        periodsPerWeek: s.periodsPerWeek,
                        requiredRoomType: s.requiredRoomType || "",
                        isDifficult: !!s.isDifficult,
                        section: gradeToSection(g),
                      }));
                      if (official.length > 0) {
                        await dataService.insertCurriculumForGrade(g, official);
                      }
                    }
                    const reloaded = await dataService.getSubjects();
                    setSubjects(reloaded || []);
                    // Switch to saved mode state
                    setIsSavedMode(true);
                    const m = new Map<number, GradeSubjectRow[]>();
                    for (const g of enabledGrades) {
                      const forGrade = (reloaded || []).filter(s => s.grade === g);
                      m.set(g, forGrade.map(saved => ({
                        officialSubject: {
                          name: saved.name,
                          nameEn: saved.name,
                          code: saved.code || "",
                          periodsPerWeek: saved.periodsPerWeek || 0,
                          isDifficult: saved.isDifficult,
                          requiredRoomType: saved.requiredRoomType,
                        } as SubjectInfo,
                        savedSubject: saved,
                        periodsPerWeek: saved.periodsPerWeek || 0,
                        isModified: false,
                        isCustom: true,
                      })));
                    }
                    setGradeSubjectData(m);
                    onUpdate(reloaded || []);
                    toast.success(t.common.curriculumInserted || "Curriculum inserted");
                  } catch (e) {
                    console.error(e);
                    toast.error(t.common.insertFailed || "Insert failed");
                  }
                }}
              >
                <Button className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t.common.insertCurriculumAll || "Insert Curriculum (All)"}
                </Button>
              </ConfirmDialog>
            )}
            {isSavedMode && (
                <ConfirmDialog
                  title={t.common.clearAllSubjects || "Clear All Subjects"}
                  description={t.common.clearAllEnrolledSubjects || "Clear all enrolled subjects?"}
                  confirmLabel={t.common.yes || "Yes"}
                  cancelLabel={t.common.no || "No"}
                  onConfirm={async () => {
                    try {
                      await dataService.clearAllSubjects();
                      // Switch to Template Mode with empty grades, no reload
                      const m = new Map<number, GradeSubjectRow[]>();
                      for (const g of enabledGrades) m.set(g, []);
                      setGradeSubjectData(m);
                      setSubjects([]);
                      setIsSavedMode(false);
                      toast.success(t.common.allSubjectsCleared || "All subjects cleared");
                    } catch (err) {
                      console.error("Failed to clear subjects:", err);
                      toast.error("Failed to clear subjects");
                    }
                  }}
                >
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t.common.clearAll || "Clear All"}
                  </Button>
                </ConfirmDialog>
              )}
            <Button
              onClick={handleSaveAll}
                disabled={isSaving || (!isSavedMode && !allGradesConfigured)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t.common.saveAllSubjects || "Save All Subjects"}
            </Button>
            </div>
          </div>
        </div>
        )}

        {/* Important Info */}
        {enabledGrades.length > 0 && (
          <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>
            {t.common.important || "Important"}
          </AlertTitle>
          <AlertDescription>
            {language === "fa" ? (
              <>
                هر صنف باید دقیقاً دوره‌های مورد نیاز مطابق با بخش خود (ابتدایی/متوسطه/عالی) داشته باشد.
                این مطابق با قوانین مکاتب افغانستان است که هر بخش ممکن است دوره‌های متفاوتی داشته باشد.
              </>
            ) : (
              <>
                Each grade must have exactly the required periods per week according to its section (Primary/Middle/High).
                This matches Afghan school regulations where different sections may have different periods.
              </>
            )}
          </AlertDescription>
        </Alert>
        )}

        {/* Grade Tabs (filtered by enabled sections) */}
        {enabledGrades.length > 0 && (
          <Tabs value={String(selectedGrade)} onValueChange={(v) => setSelectedGrade(parseInt(v))}>
          <TabsList className="grid grid-cols-12 w-full">
            {enabledGrades.map(grade => {
              const isValid = isGradeValid(grade);
              const hasData = gradeSubjectData.has(grade);
              
              return (
                <TabsTrigger
                  key={grade}
                  value={String(grade)}
                  className={cn(
                    "relative",
                    isValid && hasData && "bg-green-50 dark:bg-green-950",
                    !isValid && hasData && "bg-red-50 dark:bg-red-950"
                  )}
                >
                  {language === "fa" ? `صنف ${grade}` : `Grade ${grade}`}
                  {hasData && (
                    <span className={cn(
                      "absolute -top-1 -right-1 w-3 h-3 rounded-full",
                      isValid ? "bg-green-500" : "bg-red-500"
                    )} />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {enabledGrades.map(grade => (
            <TabsContent key={grade} value={String(grade)} className="mt-6">
              <GradeSubjectsCard
                grade={grade}
                rows={gradeSubjectData.get(grade) || []}
                expectedTotal={getExpectedPeriodsForGrade(grade)}
                onPeriodChange={(subjectName, periods) => handlePeriodChange(grade, subjectName, periods)}
                onLoadOfficial={() => handleLoadOfficialCurriculum(grade)}
                onReset={() => handleResetGrade(grade)}
                language={language}
                isRTL={isRTL}
                isSavedMode={isSavedMode}
              />
            </TabsContent>
          ))}
        </Tabs>
        )}

        {/* Validation Summary */}
        {enabledGrades.length > 0 && (
          <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {t.common.validationSummary || "Validation Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {enabledGrades.map(grade => {
                const total = getGradeTotalPeriods(grade);
                const expected = getExpectedPeriodsForGrade(grade);
                const isValid = total === expected;
                const hasData = gradeSubjectData.has(grade) && (gradeSubjectData.get(grade)?.length || 0) > 0;
                
                if (!hasData) {
                  return (
                    <div key={grade} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <span className="font-medium">
                        {`${t.common.grade || "Grade"} ${grade}`}
                      </span>
                      <Badge variant="outline">
                        {t.common.notLoaded || "Not Loaded"}
                      </Badge>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={grade}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      isValid ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {isValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        {`${t.common.grade || "Grade"} ${grade}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "font-mono font-semibold",
                        isValid ? "text-green-600" : "text-red-600"
                      )}>
                        {total} / {expected}
                      </span>
                      {!isValid && (
                        <Badge variant="destructive">
                          {total < expected 
                            ? `${t.common.short || "Short"} ${expected - total}`
                            : `${t.common.over || "Over"} ${total - expected}`
                          }
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {!allGradesConfigured && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {language === "fa"
                    ? "لطفاً برنامه درسی را برای همه صنف‌ها بارگذاری کنید"
                    : "Please load curriculum for all grades"}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        )}
      </WizardStepContainer>

      {/* Edit Dialog */}
      {editingSubject && (
        <SubjectEditDialog
          open={!!editingSubject}
          onClose={() => setEditingSubject(null)}
          subject={editingSubject.subject}
          grade={editingSubject.grade}
          onSave={handleEditSubject}
        />
      )}

      {/* Delete Confirmation */}
      {deletingSubject && (
        <SubjectDeleteConfirm
          open={!!deletingSubject}
          onClose={() => setDeletingSubject(null)}
          subjectName={deletingSubject.name}
          grade={deletingSubject.grade}
          onConfirm={handleDeleteSubject}
        />
      )}
    </div>
  );
}

// Individual Grade Card Component
interface GradeSubjectsCardProps {
  grade: number;
  rows: GradeSubjectRow[];
  expectedTotal: number;
  onPeriodChange: (subjectName: string, periods: number) => void;
  onLoadOfficial: () => void;
  onReset: () => void;
  language: string;
  isRTL: boolean;
  isSavedMode: boolean;
}

function GradeSubjectsCard({
  grade,
  rows,
  expectedTotal,
  onPeriodChange,
  onLoadOfficial,
  onReset,
  language,
  isRTL,
  isSavedMode
}: GradeSubjectsCardProps) {
  const { t } = useLanguageCtx();
  const total = rows.reduce((sum, r) => sum + r.periodsPerWeek, 0);
  const isValid = total === expectedTotal;
  const hasModifications = rows.some(r => r.isModified);
  
  // Always show action buttons, even when empty
  const actionButtons = (
    <div className="flex gap-2">
      <Button
        onClick={() => (window as any).__subjectsStartAdd?.(grade)}
        size="sm"
        className="flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {t.common.addSubject || "Add Subject"}
      </Button>
      <ConfirmDialog
        title={t.common.resetChanges || "Reset Changes"}
        description={t.common.discardUnsavedChanges || "Discard unsaved changes for this grade?"}
        confirmLabel={t.common.yes || "Yes"}
        cancelLabel={t.common.no || "No"}
        onConfirm={() => (window as any).__subjectsResetGradeLocal?.(grade)}
      >
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          {t.common.reset || "Reset"}
        </Button>
      </ConfirmDialog>
      <ConfirmDialog
        title={t.common.insertCurriculum || "Insert Curriculum"}
        description={`${t.common.insertOfficialCurriculum?.replace('all', `${grade}`) || `Insert official curriculum for Grade ${grade}?`}`}
        confirmLabel={t.common.yes || "Yes"}
        cancelLabel={t.common.no || "No"}
        onConfirm={async () => {
          try {
            await (window as any).__subjectsInsertCurriculumForGrade?.(grade);
            toast.success(t.common.curriculumInserted || "Curriculum inserted");
          } catch (e) {
            console.error(e);
            toast.error(t.common.insertFailed || "Insert failed");
          }
        }}
      >
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {t.common.insertCurriculum || "Insert Curriculum"}
        </Button>
      </ConfirmDialog>
      {isSavedMode && (
        <ConfirmDialog
          title={t.common.clearGrade || "Clear Grade"}
          description={`${t.common.clearAllEnrolledSubjects?.replace('all', `${grade}`) || `Clear all enrolled subjects for Grade ${grade}?`}`}
          confirmLabel={t.common.yes || "Yes"}
          cancelLabel={t.common.no || "No"}
          onConfirm={async () => {
            try {
              await (window as any).__subjectsClearGrade?.(grade);
              toast.success(t.common.curriculumCleared || "Grade cleared");
            } catch (e) {
              console.error(e);
              toast.error(t.common.clearFailed || "Clear failed");
            }
          }}
        >
          <Button variant="destructive" size="sm" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            {t.common.clearGrade || "Clear Grade"}
          </Button>
        </ConfirmDialog>
      )}
    </div>
  );
  
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl mb-2">
                {`${t.common.grade || "Grade"} ${grade}`}
              </CardTitle>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t.common.totalPeriods || "Total Periods"}:{" "}
                  <span className="font-mono font-bold">0 / {expectedTotal}</span>
                </span>
              </div>
            </div>
            {actionButtons}
          </div>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {isSavedMode
                ? (t.common.noSubjectsSaved || "No Subjects Saved")
                : (t.common.curriculumNotLoaded || "Curriculum Not Loaded")
              }
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {isSavedMode
                ? (language === "fa"
                  ? `هیچ ماده درسی برای صنف ${grade} در پایگاه داده ذخیره نشده است`
                  : `No subjects saved for Grade ${grade} in database`)
                : (language === "fa"
                ? `برنامه درسی رسمی افغانستان را برای صنف ${grade} بارگذاری کنید`
                  : `Load the official Afghanistan curriculum for Grade ${grade}`)
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl mb-2">
              {`${t.common.grade || "Grade"} ${grade}`}
            </CardTitle>
            <div className="flex items-center gap-4">
              <span className={cn(
                "text-sm font-medium",
                isValid ? "text-green-600" : "text-red-600"
              )}>
                {t.common.totalPeriods || "Total Periods"}:{" "}
                <span className="font-mono font-bold">{total} / {expectedTotal}</span>
              </span>
              {hasModifications && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  {t.common.modified || "Modified"}
                </Badge>
              )}
            </div>
          </div>
          {actionButtons}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Validation Warning */}
        {!isValid && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {language === "fa" ? "خطای تعداد دوره‌ها" : "Period Count Error"}
            </AlertTitle>
            <AlertDescription>
              {total < expectedTotal ? (
                <>
                  {language === "fa"
                    ? `باید ${expectedTotal - total} دوره دیگر اضافه کنید`
                    : `Need ${expectedTotal - total} more periods`
                  }
                </>
              ) : (
                <>
                  {language === "fa"
                    ? `باید ${total - expectedTotal} دوره را کم کنید`
                    : `Need to remove ${total - expectedTotal} periods`
                  }
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Subjects Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className={cn("text-left py-3 px-4 font-semibold text-sm", isRTL && "text-right")}>
                  {t.common.subject || "Subject"}
                </th>
                <th className={cn("text-left py-3 px-4 font-semibold text-sm", isRTL && "text-right")}>
                  {t.common.code || "Code"}
                </th>
                <th className={cn("text-left py-3 px-4 font-semibold text-sm", isRTL && "text-right")}>
                  {t.common.roomType || "Room Type"}
                </th>
                <th className={cn("text-center py-3 px-4 font-semibold text-sm")}>
                  {t.common.difficult || "Difficult"}
                </th>
                <th className={cn("text-center py-3 px-4 font-semibold text-sm")}>
                  {t.common.periodsWeek || "Periods/Week"}
                </th>
                <th className={cn("text-center py-3 px-4 font-semibold text-sm")}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.officialSubject.code}
                  className={cn(
                    "border-b border-gray-200 dark:border-gray-700",
                    row.isModified && "bg-amber-50 dark:bg-amber-950/20"
                  )}
                >
                  {/* Subject Name */}
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {row.officialSubject.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {row.officialSubject.nameEn}
                      </div>
                    </div>
                  </td>
                  
                  {/* Code */}
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {row.officialSubject.code}
                    </span>
                  </td>
                  
                  {/* Room Type */}
                  <td className="py-3 px-4">
                    <Badge variant="outline">
                      {row.officialSubject.requiredRoomType || (t.common.regular || "Regular")}
                    </Badge>
                  </td>
                  
                  {/* Is Difficult */}
                  <td className="py-3 px-4 text-center">
                    {row.officialSubject.isDifficult && (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                        ✓
                      </Badge>
                    )}
                  </td>
                  
                  {/* Periods Per Week (Editable) */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Input
                        type="number"
                        value={row.periodsPerWeek}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value) && value >= 0 && value <= 10) {
                            onPeriodChange(row.officialSubject.name, value);
                          }
                        }}
                        className="w-20 text-center font-semibold"
                        min={0}
                        max={10}
                      />
                      {row.isModified && (
                        <span className="text-xs text-amber-600" title={t.common.modified || "Modified"}>
                          ({row.officialSubject.periodsPerWeek})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => (window as any).__subjectsStartEdit?.(grade, { ...row.officialSubject, periodsPerWeek: row.periodsPerWeek })}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {row.savedSubject && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => (window as any).__subjectsStartDelete?.(grade, row.officialSubject.name, row.savedSubject)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Total Row */}
              <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-bold">
                <td colSpan={5} className="py-3 px-4 text-right">
                  {t.common.total || "TOTAL"}:
                </td>
                <td className="py-3 px-4">
                  <div className={cn(
                    "text-center font-mono text-lg font-bold px-4 py-2 rounded-lg",
                    isValid 
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  )}>
                    {total} / {expectedTotal}
                    {isValid && <CheckCircle2 className="inline h-5 w-5 ml-2" />}
                    {!isValid && <AlertCircle className="inline h-5 w-5 ml-2" />}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
