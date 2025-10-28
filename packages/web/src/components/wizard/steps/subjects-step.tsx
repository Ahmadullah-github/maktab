import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container";
import { useLanguage } from "@/hooks/useLanguage";
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { Subject } from "@/types";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { toast } from "sonner";
import { dataService } from "@/lib/dataService";
import {
  getAllGrades,
  getSubjectsForGrade,
  getRoomTypeForSubject,
} from "@/data/afghanistanCurriculum";

interface SubjectsStepProps {
  data: Subject[];
  onUpdate: (data: Subject[]) => void;
}

export function SubjectsStep({ data, onUpdate }: SubjectsStepProps) {
  // --- state ---
  const [subjects, setSubjects] = useState<Subject[]>(data.length > 0 ? data : []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { isRTL, t, language } = useLanguage();
  const { addSubject, updateSubject, deleteSubject } = useSubjectStore();

  const CODE_REGEX = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Z0-9]{2,5}$/;

  // --- ID helpers ---
  const idToStr = (id: unknown) => String(id === undefined || id === null ? "" : id);
  const isTempId = (id: unknown) => {
    const idStr = idToStr(id);
    return idStr.startsWith("temp-") || idStr === "";
  };

  // --- initial data load (run once) ---
  useEffect(() => {
    let aborted = false;
    const loadData = async () => {
      try {
        const existingSubjects = await dataService.getSubjects();
        if (aborted) return;
        if (existingSubjects && existingSubjects.length > 0) {
          setSubjects(existingSubjects);
        } else {
          setSubjects([]);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
      } finally {
        if (!aborted) setIsLoading(false);
      }
    };
    loadData();
    return () => { aborted = true; };
  }, []);

  // --- room types load (run once) ---
  useEffect(() => {
    let aborted = false;
    const loadRoomTypes = async () => {
      try {
        const rooms = await dataService.getRooms();
        if (aborted) return;
        const types = [...new Set(rooms.map(r => r.type).filter(Boolean) as string[])];
        // Always include "Regular" as the default option
        const defaultTypes = language === "fa" ? ["عادی"] : ["Regular"];
        const allTypes = [...defaultTypes, ...types.filter(t => t !== "Regular" && t !== "عادی")];
        setAvailableRoomTypes(allTypes);
      } catch (err) {
        console.error("Failed to load room types:", err);
        setAvailableRoomTypes(language === "fa" ? ["عادی"] : ["Regular"]);
      }
    };
    loadRoomTypes();
    return () => { aborted = true; };
  }, [language]);

  // --- utilities for codes ---
  const getUsedCodes = useCallback((currentSubjects: Subject[]) => {
    return new Set(
      currentSubjects
        .map(s => (s.code || "").toString().toUpperCase())
        .filter(Boolean)
    );
  }, []);

  const generateSubjectCode = useCallback((name: string): string => {
    if (!name) return "";
    
    // Common words to filter out (both Persian and English)
    const commonWords = ['و', 'در', 'است', 'درسی', 'of', 'the', 'in', 'and', 'ح', 'ج'];
    const words = name.split(/[\s\-]+/).map(w => w.trim()).filter(w => w.length > 0 && !commonWords.includes(w));
    
    if (words.length === 0) {
      // If no valid words, try to extract meaningful characters
      const cleaned = name.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Z0-9]/g, '');
      return cleaned.substring(0, 3).toUpperCase();
    }
    
    if (words.length === 1) {
      const word = words[0];
      // For Persian text, take first 2-3 characters
      if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(word)) {
        return word.substring(0, Math.min(3, word.length)).toUpperCase();
      }
      // For English text, clean and take first 3 characters
      const cleaned = word.replace(/[^A-Z0-9]/gi, '');
      return cleaned.substring(0, Math.min(3, cleaned.length)).toUpperCase();
    }
    
    // For multiple words, try to create meaningful code
    const code = words.slice(0, 3).map(w => {
      // For Persian text, take first character
      if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(w)) {
        return w[0];
      }
      // For English text, take first character and clean
      return w[0].replace(/[^A-Z0-9]/gi, '');
    }).join('').toUpperCase();
    
    return code.length >= 2 ? code : name.substring(0, 3).toUpperCase();
  }, []);

  const generateUniqueCode = useCallback((name: string, currentSubjects: Subject[], excludeId?: unknown): string => {
    const baseRaw = generateSubjectCode(name) || "SUB";
    // Keep Persian characters and alphanumeric characters for base code
    const base = baseRaw.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Z0-9]/g, '').slice(0, 3).toUpperCase() || "SUB";
    const filtered = currentSubjects.filter(s => idToStr(s.id) !== idToStr(excludeId));
    const used = getUsedCodes(filtered);

    if (!used.has(base) && CODE_REGEX.test(base)) return base;

    for (let i = 1; i <= 99; i++) {
      const candidate = (base + i.toString()).slice(0, 5);
      if (!used.has(candidate) && CODE_REGEX.test(candidate)) return candidate;
    }

    return (base + Date.now().toString().slice(-2)).slice(0, 5).toUpperCase();
  }, [generateSubjectCode, getUsedCodes]);

  // --- validation ---
  const validateCode = useCallback((code: string, currentSubjectId: unknown, currentSubjects: Subject[]) => {
    if (!code || !code.trim()) {
      return { valid: false, message: language === "fa" ? "کد الزامی است" : "Code is required" };
    }
    const upper = code.toUpperCase().trim();
    if (!CODE_REGEX.test(upper)) {
      return { valid: false, message: language === "fa" ? "کد باید 2 تا 5 حرف/عدد باشد" : "Code must be 2-5 letters/numbers" };
    }
    const usedByOther = currentSubjects.find(s => idToStr(s.id) !== idToStr(currentSubjectId) && (s.code || "").toUpperCase() === upper);
    if (usedByOther) {
      return { valid: false, message: language === "fa" ? "این کد قبلاً استفاده شده" : "Code already used" };
    }
    return { valid: true };
  }, [language]);

  const validateSubject = useCallback((subject: Subject, currentSubjects: Subject[]) => {
    if (!subject.name || !subject.name.trim()) return false;
    return validateCode(subject.code || "", subject.id, currentSubjects).valid;
  }, [validateCode]);

  // --- field change (local only) ---
  const handleFieldChange = useCallback((id: unknown, field: keyof Subject, value: any) => {
    setSubjects(prev => {
      const next = prev.map(s => {
        if (idToStr(s.id) !== idToStr(id)) return s;
        if (field === "name") {
          const newName = value || "";
          if (!s.code && newName.trim()) {
            const newCode = generateUniqueCode(newName, prev, id);
            return { ...s, name: newName, code: newCode };
          }
        }
        return { ...s, [field]: value };
      });
      setHasUnsavedChanges(true);
      return next;
    });
  }, [generateUniqueCode]);

  // --- add / delete rows ---
  const handleAddRow = useCallback(() => {
    const newRow: Subject = {
      id: `temp-${Date.now()}`,
      name: "",
      code: "",
      requiredRoomType: language === "fa" ? "عادی" : "Regular",
      isDifficult: false,
      requiredFeatures: [],
      desiredFeatures: [],
      minRoomCapacity: undefined,
    };
    setSubjects(prev => {
      const next = [...prev, newRow];
      setHasUnsavedChanges(true);
      return next;
    });
  }, [language]);

  const handleDeleteRow = useCallback((id: unknown) => {
    const key = idToStr(id);
    setSubjects(prev => {
      const next = prev.filter(s => idToStr(s.id) !== key);
      setHasUnsavedChanges(true);
      return next;
    });
    setEditingId(null);
  }, []);

  // --- load from curriculum ---
  const handleConfirmCurriculumLoad = useCallback(() => {
    if (!selectedGrade) {
      toast.error(language === "fa" ? "لطفاً صنف را انتخاب کنید" : "Please select a grade");
      return;
    }

    const officialSubjects = getSubjectsForGrade(selectedGrade);

    setSubjects(prev => {
      const existingNames = new Set(prev.map(s => s.name));
      const subjectsToAdd = officialSubjects.filter(name => !existingNames.has(name));
      
      // Generate subjects sequentially to avoid code conflicts
      const newSubjects: Subject[] = [];
      let allSubjects = [...prev]; // Start with existing subjects
      
      subjectsToAdd.forEach((name, idx) => {
        const code = generateUniqueCode(name, allSubjects);
        
        const newSubject = {
          id: `temp-${Date.now()}-${idx}`,
          name,
          code,
          requiredRoomType: language === "fa" ? "عادی" : "Regular",
          isDifficult: name.includes("ریاضی") || name.includes("فزیک") || name.includes("کیمیا") ||
                       name.toLowerCase().includes("math") || name.toLowerCase().includes("physics") ||
                       name.toLowerCase().includes("chemistry"),
          requiredFeatures: [],
          desiredFeatures: [],
          minRoomCapacity: undefined,
        } as Subject;
        
        newSubjects.push(newSubject);
        allSubjects.push(newSubject); // Add to the list for next iteration
      });

      if (newSubjects.length > 0) {
        toast.success(language === "fa" ? `${newSubjects.length} ماده درسی از برنامه درسی رسمی اضافه شد` : `${newSubjects.length} subjects added from official curriculum`);
        const next = [...prev, ...newSubjects];
        setHasUnsavedChanges(true);
        return next;
      } else {
        toast.info(language === "fa" ? "تمام مواد درسی قبلاً اضافه شده اند" : "All subjects already added");
        return prev;
      }
    });

    setShowCurriculumModal(false);
    setSelectedGrade(null);
  }, [selectedGrade, generateUniqueCode, language]);

  const handleLoadFromCurriculum = useCallback(() => {
    setShowCurriculumModal(true);
  }, []);

  // --- explicit save functionality ---
  const handleSaveAll = useCallback(async () => {
    const tempSubjects = subjects.filter(s => isTempId(s.id));
    const existingSubjects = subjects.filter(s => !isTempId(s.id));
    
    if (tempSubjects.length === 0 && !hasUnsavedChanges) {
      toast.info(language === "fa" ? "هیچ تغییری برای ذخیره وجود ندارد" : "No changes to save");
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Save new subjects
      for (const subject of tempSubjects) {
        if (!subject.name || !subject.name.trim()) {
          errorCount++;
          continue;
        }

        const validation = validateCode(subject.code || "", subject.id, subjects);
        if (!validation.valid) {
          errorCount++;
          continue;
        }

        try {
          const subjectToSave = {
            ...subject,
            name: subject.name.trim(),
            code: (subject.code || "").toUpperCase().trim(),
            requiredRoomType: subject.requiredRoomType || (language === "fa" ? "عادی" : "Regular"),
          };

          const { id, ...newSubjectData } = subjectToSave as any;
          const saved = await addSubject(newSubjectData);
          
          if (saved) {
            setSubjects(prev => {
              const next = prev.map(s => idToStr(s.id) === idToStr(id) ? saved : s);
              return next;
            });
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error("Error saving subject:", err);
          errorCount++;
        }
      }

      // Update existing subjects if there are changes
      if (hasUnsavedChanges) {
        for (const subject of existingSubjects) {
          if (!subject.name || !subject.name.trim()) {
            errorCount++;
            continue;
          }

          const validation = validateCode(subject.code || "", subject.id, subjects);
          if (!validation.valid) {
            errorCount++;
            continue;
          }

          try {
            const subjectToSave = {
              ...subject,
              name: subject.name.trim(),
              code: (subject.code || "").toUpperCase().trim(),
              requiredRoomType: subject.requiredRoomType || (language === "fa" ? "عادی" : "Regular"),
            };

            const updated = await updateSubject(subjectToSave);
            if (updated) {
              setSubjects(prev => {
                const next = prev.map(s => idToStr(s.id) === idToStr(subject.id) ? updated : s);
                return next;
              });
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error("Error updating subject:", err);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        // Update wizard with all saved subjects
        const allSubjects = subjects.filter(s => !isTempId(s.id));
        onUpdate(allSubjects);
        setHasUnsavedChanges(false);
        toast.success(
          language === "fa" 
            ? `${successCount} ماده درسی با موفقیت ذخیره شد` 
            : `${successCount} subjects saved successfully`
        );
      }

      if (errorCount > 0) {
        toast.error(
          language === "fa" 
            ? `${errorCount} ماده درسی ذخیره نشد. لطفاً اطلاعات را بررسی کنید` 
            : `${errorCount} subjects failed to save. Please check the data`
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [subjects, addSubject, updateSubject, validateCode, language, hasUnsavedChanges, onUpdate]);

  // --- validation + keyboard ---
  const isRowValid = useCallback((subject: Subject) => {
    const hasName = !!(subject.name && subject.name.trim());
    const hasValidCode = validateCode(subject.code || "", subject.id, subjects).valid;
    return hasName && hasValidCode;
  }, [validateCode, subjects]);

  const validationResults = useMemo(() => {
    return subjects.map(subject => ({
      id: idToStr(subject.id),
      isValid: validateSubject(subject, subjects),
      codeValidation: validateCode(subject.code || "", subject.id, subjects),
    }));
  }, [subjects, validateSubject, validateCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, subject: Subject) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setEditingId(null);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  }, []);

  // --- loading UI ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // --- render ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <WizardStepContainer
        title={t.subjects.title || "Subject Management"}
        description="Add and manage subjects for your timetable"
        icon={<BookOpen className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subjects.length} {subjects.length === 1 ? "subject" : "subjects"} added
              {validationResults.filter(r => !r.isValid).length > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400">
                  ({validationResults.filter(r => !r.isValid).length} invalid)
                </span>
              )}
            </p>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {language === "fa" ? "تغییرات ذخیره نشده" : "Unsaved changes"}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || (!hasUnsavedChanges && subjects.filter(s => isTempId(s.id)).length === 0)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {language === "fa" ? "ذخیره همه" : "Save All"}
            </Button>
            <Button
              onClick={handleLoadFromCurriculum}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
            >
              <Sparkles className="h-4 w-4" />
              {language === "fa" ? "بارگذاری از برنامه درسی رسمی" : "Load from Official Curriculum"}
            </Button>
          </div>
        </div>

        {/* Curriculum Modal */}
        {showCurriculumModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {language === "fa" ? "بارگذاری از برنامه درسی رسمی" : "Load from Official Curriculum"}
                </h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {language === "fa"
                  ? "صنف خود را انتخاب کنید تا مواد درسی رسمی وزارت معارف افغانستان به صورت خودکار اضافه شود."
                  : "Select your grade to automatically load official subjects from Afghanistan Ministry of Education."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === "fa" ? "انتخاب صنف" : "Select Grade"} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedGrade || ""}
                    onChange={(e) => setSelectedGrade(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{language === "fa" ? "--- صنف را انتخاب کنید ---" : "--- Select Grade ---"}</option>
                    {getAllGrades().map(grade => (
                      <option key={grade} value={grade}>
                        {language === "fa" ? `صنف ${grade}` : `Grade ${grade}`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedGrade && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <CheckCircle2 className="inline h-4 w-4 mr-1" />
                      {language === "fa"
                        ? `${getSubjectsForGrade(selectedGrade).length} ماده درسی رسمی اضافه خواهد شد`
                        : `${getSubjectsForGrade(selectedGrade).length} official subjects will be added`}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirmCurriculumLoad}
                    disabled={!selectedGrade}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {language === "fa" ? "بارگذاری" : "Load Subjects"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCurriculumModal(false);
                      setSelectedGrade(null);
                    }}
                  >
                    {language === "fa" ? "لغو" : "Cancel"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {subjects.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {language === "fa" ? "هیچ ماده درسی اضافه نشده" : "No subjects added yet"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {language === "fa" 
                ? "برای شروع، مواد درسی خود را اضافه کنید یا از برنامه درسی رسمی بارگذاری کنید"
                : "Get started by adding your subjects or loading from the official curriculum"
              }
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleAddRow}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {language === "fa" ? "اضافه کردن ماده درسی" : "Add Subject"}
              </Button>
              <Button
                onClick={handleLoadFromCurriculum}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {language === "fa" ? "بارگذاری از برنامه درسی" : "Load from Curriculum"}
              </Button>
            </div>
          </div>
        )}

        {/* Subjects Table */}
        {subjects.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 dark:border-gray-700">
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.subjects.name || "Name"} <span className="text-red-500">*</span>
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.subjects.code || "Code"}
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.subjects.requiredRoomType || "Room Type"}
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    {t.subjects.isDifficult || "Difficult"}
                  </th>
                  <th className={cn("text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300", isRTL && "text-right")}>
                    Min Capacity
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {subjects.map((subject, index) => {
                const idKey = idToStr(subject.id);
                const validationResult = validationResults.find(r => r.id === idKey);
                const isValid = validationResult?.isValid || false;
                const codeValidation = validationResult?.codeValidation || { valid: true };
                const isEditing = editingId === idKey;

                return (
                  <tr
                    key={idKey}
                    className={cn(
                      "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                      !isValid && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                      isEditing && "bg-yellow-50 dark:bg-yellow-950/20 ring-1 ring-yellow-200 dark:ring-yellow-800"
                    )}
                  >
                    {/* Name */}
                    <td className="py-3 px-4">
                      <Input
                        value={subject.name}
                        onChange={(e) => handleFieldChange(subject.id, "name", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, subject)}
                        onClick={() => setEditingId(idKey)}
                        placeholder="e.g. Mathematics"
                        aria-label={`Subject name for row ${index + 1}`}
                        aria-describedby={!isValid ? `error-${idKey}` : undefined}
                        className={cn("min-w-[200px]", !isValid && "border-red-500")}
                      />
                      {!isValid && (
                        <div id={`error-${idKey}`} className="mt-1 p-2 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
                          <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {subject.name ? (language === "fa" ? "کد لازم است" : "Code is required") : (language === "fa" ? "نام و کد لازم است" : "Name and code are required")}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Code */}
                    <td className="py-3 px-4">
                      <div className="relative">
                        <Input
                          value={subject.code || ""}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            handleFieldChange(subject.id, "code", value);
                            if (!value && subject.name) {
                              const generated = generateUniqueCode(subject.name, subjects, subject.id);
                              handleFieldChange(subject.id, "code", generated);
                            }
                          }}
                          onKeyDown={(e) => handleKeyDown(e, subject)}
                          onClick={() => setEditingId(idKey)}
                          placeholder={subject.name ? generateSubjectCode(subject.name) : "e.g. MTH"}
                          aria-label={`Subject code for row ${index + 1}`}
                          className={cn("min-w-[120px]", subject.code && !codeValidation.valid && "border-red-500")}
                          maxLength={5}
                        />
                        {subject.code && !codeValidation.valid && (
                          <p className="text-xs text-red-500 mt-1">{codeValidation.message}</p>
                        )}
                      </div>
                    </td>

                    {/* Room Type */}
                    <td className="py-3 px-4">
                      <Select
                        value={subject.requiredRoomType || (language === "fa" ? "عادی" : "Regular")}
                        onValueChange={(value) => {
                          handleFieldChange(subject.id, "requiredRoomType", value);
                        }}
                        onOpenChange={(open) => {
                          if (open) setEditingId(idKey);
                        }}
                      >
                        <SelectTrigger className="min-w-[180px]">
                          <SelectValue placeholder={language === "fa" ? "عادی" : "Regular"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoomTypes.map((roomType) => (
                            <SelectItem key={roomType} value={roomType}>
                              {roomType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Is Difficult */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={!!subject.isDifficult}
                          onCheckedChange={(checked) => {
                            handleFieldChange(subject.id, "isDifficult", checked);
                          }}
                          onClick={() => setEditingId(idKey)}
                        />
                      </div>
                    </td>

                    {/* Min Capacity */}
                    <td className="py-3 px-4">
                      <Input
                        type="number"
                        value={subject.minRoomCapacity ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = value ? parseInt(value) : undefined;
                          handleFieldChange(subject.id, "minRoomCapacity", (numValue && !isNaN(numValue)) ? numValue : undefined);
                        }}
                        onClick={() => setEditingId(idKey)}
                        placeholder="e.g. 30"
                        className="min-w-[100px]"
                        min={1}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRow(subject.id)}
                          className="text-red-600 hover:text-red-700"
                          title={language === "fa" ? "حذف ماده درسی" : "Delete subject"}
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
        )}

        {/* Add Row */}
        {subjects.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={handleAddRow} variant="outline" className="flex items-center gap-2 border-dashed">
              <Plus className="h-4 w-4" />
              {language === "fa" ? "اضافه کردن ماده درسی" : "Add Subject"}
            </Button>
          </div>
        )}

        {/* Tip */}
        {subjects.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> {language === "fa" 
                ? "روی هر فیلد کلیک کنید تا ویرایش کنید. تغییرات فقط با دکمه 'ذخیره همه' ذخیره می‌شوند."
                : "Click on any field to edit. Changes are only saved when you click the 'Save All' button."
              }
            </p>
          </div>
        )}
      </WizardStepContainer>
    </div>
  );
}
