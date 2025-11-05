// src/pages/Wizard.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WizardContainer } from "@/components/wizard/wizard-container";
import {
  SchoolInfoStep,
  PeriodsStep,
  TeachersStep,
  SubjectsStep,
  RoomsStep,
  ClassesStep,
  ConstraintsStep,
  ReviewStep,
} from "@/components/wizard/steps";
import { useWizardStore } from "@/stores/useWizardStore";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { useClassStore } from "@/stores/useClassStore";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Loading } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { TimetableErrorDisplay } from "@/components/error/TimetableErrorDisplay";
import { parseTimetableError } from "@/lib/errorParser";
import {
  parseTimetableData,
  safeParseTimetableData,
  createEmptyTimetableData,
  getValidationErrors,
  type TimetableData,
} from "@/lib/schema";
import { z } from "zod";
import type {
  SchoolInfo,
  PeriodsInfo,
  Teacher,
  Subject,
  Room,
  ClassGroup,
} from "@/types";
import { autoAssignSubjectsToClass } from "@/lib/classSubjectAssignment";
import { useLanguageCtx } from "@/i18n/provider";
import { useTimetableStore } from "@/stores/useTimetableStore";
import { getExtendedTimetableStatistics, Lesson } from "@/lib/timetableTransform";

// Define the 8 wizard steps (base keys; labels will be localized at runtime)
const WIZARD_STEPS = [
  {
    key: "school-info",
    title: "School Info",
    description: "Configure basic school information",
  },
  {
    key: "periods",
    title: "Periods",
    description: "Set up lesson times and schedule structure",
  },
  {
    key: "rooms",
    title: "Rooms",
    description: "Add and configure rooms",
  },
  {
    key: "classes",
    title: "Classes",
    description: "Set up class groups and requirements",
  },
  {
    key: "subjects",
    title: "Subjects",
    description: "Create and manage subjects",
  },
  {
    key: "teachers",
    title: "Teachers",
    description: "Set up teachers and their availability/subjects",
  },
  {
    key: "constraints",
    title: "Constraints",
    description: "Configure hard and soft constraints",
  },
  {
    key: "review",
    title: "Review",
    description: "Validate data and generate timetable",
  },
];

export function Wizard() {
  const navigate = useNavigate();
  const { t } = useLanguageCtx();
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState<any>(null);

  // Use all stores for data collection
  const wizardStore = useWizardStore();
  const teacherStore = useTeacherStore();
  const subjectStore = useSubjectStore();
  const roomStore = useRoomStore();
  const classStore = useClassStore();
  const timetableStore = useTimetableStore();

  // Initialize wizard and load existing data
  useEffect(() => {
    const initWizard = async () => {
      try {
        setIsInitializing(true);
        await wizardStore.initializeWizard(1);

        // Load all entity data
        await Promise.all([
          teacherStore.fetchTeachers(),
          subjectStore.fetchSubjects(),
          roomStore.fetchRooms(),
          classStore.fetchClasses(),
        ]);

        // Restore current step from store
        if (
          wizardStore.currentStep &&
          WIZARD_STEPS.some((step) => step.key === wizardStore.currentStep)
        ) {
          const stepIndex = WIZARD_STEPS.findIndex(
            (step) => step.key === wizardStore.currentStep
          );
          setCurrentStep(stepIndex);
        }
      } catch (err) {
        console.error("Failed to initialize wizard:", err);
        toast.error("Failed to load wizard data");
      } finally {
        setIsInitializing(false);
      }
    };

    initWizard();
  }, []);

  // Validate current step data
  const validateCurrentStep = async (): Promise<boolean> => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const stepKey = WIZARD_STEPS[currentStep].key;

      switch (stepKey) {
        case "school-info":
          return validateSchoolInfo();
        case "periods":
          return validatePeriods();
        case "teachers":
          return validateTeachers();
        case "subjects":
          return validateSubjects();
        case "rooms":
          return validateRooms();
        case "classes":
          return validateClasses();
        case "constraints":
          return validateConstraints();
        case "review":
          return await validateAllData();
        default:
          return true;
      }
    } finally {
      setIsValidating(false);
    }
  };

  // Individual step validations
  const validateSchoolInfo = (): boolean => {
    const { schoolInfo } = wizardStore;

    if (!schoolInfo.schoolName?.trim()) {
      setValidationErrors(["School name is required"]);
      return false;
    }

    return true;
  };

  const validatePeriods = (): boolean => {
    const { periodsInfo } = wizardStore;

    if (!periodsInfo.periodsPerDay || periodsInfo.periodsPerDay < 1) {
      setValidationErrors(["Periods per day must be at least 1"]);
      return false;
    }

    if (!periodsInfo.schoolStartTime) {
      setValidationErrors(["School start time is required"]);
      return false;
    }

    if (!periodsInfo.periodDuration || periodsInfo.periodDuration < 1) {
      setValidationErrors(["Period duration must be at least 1 minute"]);
      return false;
    }

    return true;
  };

  const validateTeachers = (): boolean => {
    const { teachers } = teacherStore;

    if (teachers.length === 0) {
      setValidationErrors(["At least one teacher is required"]);
      return false;
    }

    const invalidTeachers = teachers.filter(
      (teacher) =>
        !teacher.fullName?.trim() ||
        !teacher.primarySubjectIds?.length ||
        teacher.maxPeriodsPerWeek < 1
    );

    if (invalidTeachers.length > 0) {
      setValidationErrors([
        `${invalidTeachers.length} teacher(s) have missing required fields (name, subjects, or weekly periods)`,
      ]);
      return false;
    }

    return true;
  };

  const validateSubjects = (): boolean => {
    const { subjects } = subjectStore;

    if (subjects.length === 0) {
      setValidationErrors(["At least one subject is required"]);
      return false;
    }

    const invalidSubjects = subjects.filter((subject) => !subject.name?.trim());
    if (invalidSubjects.length > 0) {
      setValidationErrors([
        `${invalidSubjects.length} subject(s) are missing names`,
      ]);
      return false;
    }

    return true;
  };

  const validateRooms = (): boolean => {
    const { rooms } = roomStore;

    if (rooms.length === 0) {
      setValidationErrors(["At least one room is required"]);
      return false;
    }

    const invalidRooms = rooms.filter(
      (room) =>
        !room.name?.trim() ||
        !room.capacity ||
        room.capacity < 1 ||
        !room.type?.trim()
    );

    if (invalidRooms.length > 0) {
      setValidationErrors([
        `${invalidRooms.length} room(s) have missing required fields`,
      ]);
      return false;
    }

    return true;
  };

  const validateClasses = (): boolean => {
    const { classes } = classStore;

    if (classes.length === 0) {
      setValidationErrors(["At least one class is required"]);
      return false;
    }

    // Check if subjectRequirements is an array and has length, or if it's an object and has keys
    const invalidClasses = classes.filter((classGroup) => {
      const hasValidName = classGroup.name?.trim();
      const hasValidStudentCount = classGroup.studentCount >= 1;
      
      // SubjectRequirements can be added later in the wizard, so we don't validate it here
      // The classes step is just for creating the class structure
      
      return !hasValidName || !hasValidStudentCount;
    });

    if (invalidClasses.length > 0) {
      setValidationErrors([
        `${invalidClasses.length} class(es) have missing required fields (name or student count)`,
      ]);
      return false;
    }

    return true;
  };

  const validateConstraints = (): boolean => {
    // Constraints are optional, but validate preferences if they exist
    const { preferences } = wizardStore;

    if (preferences) {
      // Validate preference weights are non-negative
      const invalidWeights = Object.entries(preferences).filter(
        ([key, value]) => typeof value === "number" && value < 0
      );

      if (invalidWeights.length > 0) {
        setValidationErrors(["Constraint weights cannot be negative"]);
        return false;
      }
    }

    return true;
  };

  // Comprehensive validation using Zod schema
  const validateAllData = async (): Promise<boolean> => {
    try {
      // Per-section validation: each enabled grade must have exact expected periods based on its section config
      const gradeToSection = (g: number): 'PRIMARY'|'MIDDLE'|'HIGH' => {
        if (g >= 1 && g <= 6) return 'PRIMARY';
        if (g >= 7 && g <= 9) return 'MIDDLE';
        return 'HIGH';
      };
      
      // Extract enabled grades from actual classes (not just enabled sections)
      const extractGradeFromClassName = (name: string): number | null => {
        const englishMatch = name.match(/grade\s*(\d{1,2})/i);
        if (englishMatch) return parseInt(englishMatch[1]);
        const directMatch = name.match(/^(\d{1,2})/);
        if (directMatch) return parseInt(directMatch[1]);
        const persianGrades: { [key: string]: number } = {
          'اول': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5,
          'ششم': 6, 'هفتم': 7, 'هشتم': 8, 'نهم': 9,
          'دهم': 10, 'یازدهم': 11, 'دوازدهم': 12
        };
        for (const [persianName, grade] of Object.entries(persianGrades)) {
          if (name.includes(persianName)) return grade;
        }
        return null;
      };
      
      const enabledGrades: number[] = (() => {
        const gradesFromClasses = new Set<number>();
        classStore.classes.forEach(cls => {
          if (cls.grade) {
            gradesFromClasses.add(cls.grade);
          } else if (cls.name) {
            const extracted = extractGradeFromClassName(cls.name);
            if (extracted) gradesFromClasses.add(extracted);
          }
        });
        return Array.from(gradesFromClasses).sort((a, b) => a - b);
      })();
      
      // Calculate expected periods per section
      const getSectionExpected = (section: 'PRIMARY'|'MIDDLE'|'HIGH'): number => {
        const commonPeriodsPerDay = wizardStore.schoolInfo.periodsPerDay || wizardStore.periodsInfo.periodsPerDay || 7;
        const commonDaysPerWeek = wizardStore.schoolInfo.daysPerWeek || 6;
        // Break periods are time gaps between teaching periods, not replacements
        // Total teaching periods per week = periods per day * days per week
        return commonPeriodsPerDay * commonDaysPerWeek;
      };
      
      const totalsByGrade: Record<number, number> = {};
      subjectStore.subjects.forEach(s => {
        if (typeof s.grade === 'number') {
          totalsByGrade[s.grade] = (totalsByGrade[s.grade] || 0) + (s.periodsPerWeek || 0);
        }
      });
      
      const invalidGrades: Array<{grade: number, expected: number, actual: number}> = [];
      enabledGrades.forEach(g => {
        const section = gradeToSection(g);
        const expected = getSectionExpected(section);
        const actual = totalsByGrade[g] || 0;
        if (actual !== expected) {
          invalidGrades.push({ grade: g, expected, actual });
        }
      });
      
      if (invalidGrades.length) {
        const errors = invalidGrades.map(({grade, expected, actual}) => 
          `Grade ${grade}: expected ${expected} periods, got ${actual}`
        );
        setValidationErrors(errors);
        return false;
      }

      const timetableData = await collectTimetableData();
      const errors = getValidationErrors(timetableData);

      if (errors.length > 0) {
        setValidationErrors(errors);
        return false;
      }

      setValidationErrors([]);
      return true;
    } catch (error) {
      setValidationErrors(["Failed to validate timetable data"]);
      return false;
    }
  };

  // Collect all data for timetable generation
  const collectTimetableData = async (): Promise<TimetableData> => {
    const { schoolInfo, periodsInfo, preferences } = wizardStore;
    const { teachers } = teacherStore;
    const { subjects } = subjectStore;
    const { rooms } = roomStore;
    const { classes } = classStore;

    // Helper to extract grade from class name (supports both English and Persian)
    const extractGradeFromClassName = (name: string): number | null => {
      // Try English format: "Grade7-A", "Grade 10-B", "Grade7A"
      const englishMatch = name.match(/grade\s*(\d{1,2})/i);
      if (englishMatch) {
        return parseInt(englishMatch[1]);
      }
      
      // Try direct number: "7A", "10-B"
      const directMatch = name.match(/^(\d{1,2})/);
      if (directMatch) {
        return parseInt(directMatch[1]);
      }
      
      // Try Persian grade names
      const persianGrades: { [key: string]: number } = {
        'اول': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5,
        'ششم': 6, 'هفتم': 7, 'هشتم': 8, 'نهم': 9,
        'دهم': 10, 'یازدهم': 11, 'دوازدهم': 12
      };
      
      for (const [persianName, grade] of Object.entries(persianGrades)) {
        if (name.includes(persianName)) {
          return grade;
        }
      }
      
      return null;
    };
    
    // Calculate enabled grades based on actual classes (not just enabled sections)
    const enabledGrades: number[] = (() => {
      const gradesFromClasses = new Set<number>();
      classes.forEach(cls => {
        if (cls.grade) {
          gradesFromClasses.add(cls.grade);
        } else if (cls.name) {
          const extracted = extractGradeFromClassName(cls.name);
          if (extracted) gradesFromClasses.add(extracted);
        }
      });
      return Array.from(gradesFromClasses).sort((a, b) => a - b);
    })();

    // Filter subjects to only include those from enabled grades
    const filteredSubjects = subjects.filter(subject => {
      if (subject.grade === null || subject.grade === undefined) return false;
      return enabledGrades.includes(subject.grade);
    });

    // Filter classes to only include those from enabled grades
    const filteredClasses = classes.filter(classGroup => {
      const grade = classGroup.grade || (classGroup.name ? extractGradeFromClassName(classGroup.name) : null);
      if (grade === null) return false;
      return enabledGrades.includes(grade);
    });

    // Create set of enabled subject IDs for filtering teacher references
    const enabledSubjectIds = new Set(filteredSubjects.map(s => String(s.id)));

    // Filter teachers - only keep subject IDs that reference enabled subjects
    // Keep teachers that have at least one valid primary subject
    const filteredTeachers = teachers.map(teacher => {
      const filteredPrimary = (teacher.primarySubjectIds || []).filter(id => enabledSubjectIds.has(String(id)));
      const filteredAllowed = (teacher.allowedSubjectIds || []).filter(id => enabledSubjectIds.has(String(id)));
      return {
        ...teacher,
        primarySubjectIds: filteredPrimary,
        allowedSubjectIds: filteredAllowed,
      };
    }).filter(teacher => 
      // Keep teachers that have at least one valid primary subject
      teacher.primarySubjectIds.length > 0
    );

    // Convert frontend data structures to match schema requirements
    const allDays = ["Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"];
    const daysOfWeek = allDays.slice(0, Math.max(1, Math.min(7, wizardStore.schoolInfo.daysPerWeek || 6)));

    const config: any = {
      daysOfWeek,
      periodsPerDay: schoolInfo.periodsPerDay || periodsInfo.periodsPerDay || 7,
      schoolStartTime: periodsInfo.schoolStartTime || "08:00",
      periodDurationMinutes: periodsInfo.periodDuration || 45,
      periods: periodsInfo.periods || [],
      breakPeriods: (schoolInfo.breakPeriods?.length ? schoolInfo.breakPeriods : periodsInfo.breakPeriods) || [],
      timezone: "Asia/Kabul",
    };

    // Convert teachers to match schema (using filtered teachers)
    const schemaTeachers = filteredTeachers.map((teacher) => ({
      id: teacher.id,
      fullName: teacher.fullName,
      primarySubjectIds: teacher.primarySubjectIds || [],
      allowedSubjectIds: teacher.allowedSubjectIds || [],
      restrictToPrimarySubjects: teacher.restrictToPrimarySubjects ?? true,
      availability: teacher.availability || {},
      unavailable: teacher.unavailable || [],
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 0,
      maxPeriodsPerDay: teacher.maxPeriodsPerDay || 0,
      maxConsecutivePeriods: teacher.maxConsecutivePeriods || 0,
      timePreference:
        (teacher.timePreference as "Morning" | "Afternoon" | "None") || "None",
      preferredRoomIds: teacher.preferredRoomIds || [],
      preferredColleagues: teacher.preferredColleagues || [],
      meta: teacher.meta || {},
    }));

    // Convert subjects to match schema (using filtered subjects)
    const schemaSubjects = filteredSubjects.map((subject) => ({
      id: subject.id,
      name: subject.name || "",
      code: subject.code || "",
      requiredRoomType: subject.requiredRoomType || null,
      requiredFeatures: subject.requiredFeatures || [],
      desiredFeatures: subject.desiredFeatures || [],
      isDifficult: subject.isDifficult || false,
      minRoomCapacity: subject.minRoomCapacity || 0,
      meta: subject.meta || {},
    }));

    // Convert rooms to match schema
    const schemaRooms = rooms.map((room) => ({
      id: room.id,
      name: room.name || "",
      capacity: room.capacity || 0,
      type: room.type || "",
      features: room.features || [],
      unavailable: room.unavailable || [],
      meta: room.meta || {},
    }));

    // Convert classes to match schema (using filtered classes)
    const schemaClasses = filteredClasses.map((classGroup) => {
      // Convert subjectRequirements from array to object format
      // Filter to only include requirements for enabled subjects
      let subjectRequirements = {};
      
      // If class has no subject requirements, auto-assign them
      const hasRequirements = Array.isArray(classGroup.subjectRequirements) 
        ? classGroup.subjectRequirements.length > 0
        : classGroup.subjectRequirements && Object.keys(classGroup.subjectRequirements).length > 0;
      
      let requirementsToProcess = classGroup.subjectRequirements;
      if (!hasRequirements && classGroup.name) {
        // Auto-assign subjects based on class name and grade
        console.log(`[TIMETABLE DATA COLLECT] Auto-assigning subjects for class: ${classGroup.name}`);
        const autoAssigned = autoAssignSubjectsToClass(classGroup.name, subjects);
        requirementsToProcess = autoAssigned;
      }
      
      if (Array.isArray(requirementsToProcess)) {
        subjectRequirements = Object.fromEntries(
          requirementsToProcess
            .filter(req => enabledSubjectIds.has(String(req.subjectId)))
            .map((req) => {
              const reqObj: any = {
                periodsPerWeek: req.periodsPerWeek || 0,
              };
              // Only include optional fields if they have valid values (> 0)
              if (req.minConsecutive && req.minConsecutive > 0) {
                reqObj.minConsecutive = req.minConsecutive;
              }
              if (req.maxConsecutive && req.maxConsecutive > 0) {
                reqObj.maxConsecutive = req.maxConsecutive;
              }
              if (req.minDaysPerWeek && req.minDaysPerWeek > 0) {
                reqObj.minDaysPerWeek = req.minDaysPerWeek;
              }
              if (req.maxDaysPerWeek && req.maxDaysPerWeek > 0) {
                reqObj.maxDaysPerWeek = req.maxDaysPerWeek;
              }
              return [req.subjectId, reqObj];
            })
        );
      } else {
        // Filter object format subjectRequirements
        const reqs = requirementsToProcess || {};
        subjectRequirements = Object.fromEntries(
          Object.entries(reqs).filter(([subjectId]) => enabledSubjectIds.has(String(subjectId)))
        );
      }

      // If class totals don't match the expected weekly load, rebuild from current Subjects
      const expected = (schoolInfo.periodsPerDay || periodsInfo.periodsPerDay || 7) * (schoolInfo.daysPerWeek || 6);
      const actual = Object.values(subjectRequirements as any).reduce((sum: number, req: any) => sum + (req?.periodsPerWeek || 0), 0);
      if (actual !== expected && classGroup.name) {
        const autoAssigned = autoAssignSubjectsToClass(classGroup.name, subjects);
        subjectRequirements = Object.fromEntries(
          (autoAssigned || []).filter(req => enabledSubjectIds.has(String(req.subjectId))).map((req) => {
            const reqObj: any = {
              periodsPerWeek: req.periodsPerWeek || 0,
            };
            if (req.minConsecutive && req.minConsecutive > 0) reqObj.minConsecutive = req.minConsecutive;
            if (req.maxConsecutive && req.maxConsecutive > 0) reqObj.maxConsecutive = req.maxConsecutive;
            if (req.minDaysPerWeek && req.minDaysPerWeek > 0) reqObj.minDaysPerWeek = req.minDaysPerWeek;
            if (req.maxDaysPerWeek && req.maxDaysPerWeek > 0) reqObj.maxDaysPerWeek = req.maxDaysPerWeek;
            return [req.subjectId, reqObj];
          })
        );
      }

      return {
        id: classGroup.id,
        name: classGroup.name || "",
        studentCount: classGroup.studentCount || 0,
        fixedRoomId: classGroup.fixedRoomId ? String(classGroup.fixedRoomId) : null,
        subjectRequirements,
        meta: classGroup.meta || {},
      };
    });

    // Debug logging
    console.log('[TIMETABLE DATA COLLECT] Enabled Grades:', enabledGrades);
    console.log('[TIMETABLE DATA COLLECT] Filtered Teachers:', filteredTeachers.length, 'of', teachers.length);
    console.log('[TIMETABLE DATA COLLECT] Filtered Subjects:', filteredSubjects.length, 'of', subjects.length);
    console.log('[TIMETABLE DATA COLLECT] Filtered Classes:', filteredClasses.length, 'of', classes.length);
    console.log('[TIMETABLE DATA COLLECT] Teachers:', schemaTeachers.map(t => ({ id: t.id, name: t.fullName, subjects: t.primarySubjectIds })));
    console.log('[TIMETABLE DATA COLLECT] Classes:', schemaClasses.map(c => ({ id: c.id, name: c.name, fixedRoomId: c.fixedRoomId, requirements: Object.keys(c.subjectRequirements).length })));

    return {
      meta: {
        academicYear: new Date().getFullYear().toString(),
        term: "1",
        createdAt: new Date().toISOString(),
        version: "1.0.0",
      },
      config,
      preferences: preferences || {
        avoidTeacherGapsWeight: 1.0,
        avoidClassGapsWeight: 1.0,
        distributeDifficultSubjectsWeight: 0.8,
        balanceTeacherLoadWeight: 0.7,
        minimizeRoomChangesWeight: 0.3,
        preferMorningForDifficultWeight: 0.5,
        respectTeacherTimePreferenceWeight: 0.5,
        respectTeacherRoomPreferenceWeight: 0.2,
        allowConsecutivePeriodsForSameSubject: true,
      },
      rooms: schemaRooms,
      subjects: schemaSubjects,
      teachers: schemaTeachers,
      classes: schemaClasses,
      fixedLessons: [],
      schoolEvents: [],
    };
  };

  // Handle step navigation
  const handleNext = async () => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      if (validationErrors.length > 0) {
        validationErrors.forEach((error) => toast.error(error));
      }
      return;
    }

    try {
      // Save step-specific data before moving to next step
      const stepKey = WIZARD_STEPS[currentStep].key;
      
      if (stepKey === "school-info") {
        // Save school info before moving to next step
        await wizardStore.saveSchoolInfo();
      } else if (stepKey === "periods") {
        // Save periods info before moving to next step
        await wizardStore.savePeriodsInfo();
      }

      // Save current step progress
      await wizardStore.setCurrentStep(stepKey);

      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
        const nextKey = WIZARD_STEPS[currentStep + 1].key;
        const nextTitle =
          (nextKey === "school-info" && (t.wizard?.steps?.school || "School Info")) ||
          (nextKey === "periods" && (t.wizard?.steps?.periods || "Periods")) ||
          (nextKey === "rooms" && (t.wizard?.steps?.rooms || "Rooms")) ||
          (nextKey === "classes" && (t.wizard?.steps?.classes || "Classes")) ||
          (nextKey === "subjects" && (t.wizard?.steps?.subjects || "Subjects")) ||
          (nextKey === "teachers" && (t.wizard?.steps?.teachers || "Teachers")) ||
          (nextKey === "constraints" && (t.wizard?.steps?.preferences || t.wizard?.steps?.events || "Constraints")) ||
          (nextKey === "review" && (t.wizard?.steps?.review || "Review")) ||
          WIZARD_STEPS[currentStep + 1].title;
        toast.success(`Moving to ${nextTitle}`);
      }
    } catch (error) {
      console.error("Error moving to next step:", error);
      toast.error("Failed to save step progress");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      wizardStore.setCurrentStep(WIZARD_STEPS[currentStep - 1].key);
    }
  };

  // Handle wizard completion
  const handleFinish = async () => {
    const isValid = await validateAllData();

    if (!isValid) {
      toast.error(
        "Please fix all validation errors before generating timetable"
      );
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // Simulate progress while generating
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          // Slow down as we approach 95% (reserve for actual completion)
          if (prev < 80) return prev + 5;
          if (prev < 95) return prev + 1;
          return prev;
        });
      }, 500);

      toast.loading(t.nav?.timetableGenerate || "Generating timetable...");
      const timetableData = await collectTimetableData();
      setGenerationProgress(50); // Data collected
      
      const result = await wizardStore.generateTimetable(timetableData);
      clearInterval(progressInterval);
      setGenerationProgress(100);

      // Extract the actual timetable array from the result
      const timetableArray = result.data || result;
      
      // Check if the result contains an error (SOLVING_ERROR from backend)
      if (Array.isArray(timetableArray) && timetableArray.length > 0) {
        const firstItem = timetableArray[0];
        if (firstItem && firstItem.status === 'SOLVING_ERROR' && firstItem.error) {
          // This is an error response, not timetable data
          console.error('[TIMETABLE GENERATION] Solver error detected:', firstItem);
          console.error('[TIMETABLE GENERATION] Full error message:', firstItem.error);
          throw new Error(firstItem.error);
        }
      }
      
      // Store in wizard store
      wizardStore.setTimetable(timetableArray);
      
      // Save to timetable store and localStorage
      if (timetableArray && Array.isArray(timetableArray)) {
        timetableStore.setCurrentTimetable(timetableArray);
        
        // Calculate statistics and save to generation history
        try {
          const stats = getExtendedTimetableStatistics(
            timetableArray as Lesson[],
            classStore.classes,
            teacherStore.teachers,
            subjectStore.subjects,
            roomStore.rooms,
            wizardStore.schoolInfo.periodsPerDay || wizardStore.periodsInfo.periodsPerDay || 7,
            wizardStore.schoolInfo.daysPerWeek || 6
          );
          
          timetableStore.setStatistics(stats);
          
          // Add to generation history
          timetableStore.addGenerationHistory({
            totalLessons: stats.totalLessons,
            uniqueClasses: stats.uniqueClasses,
            uniqueTeachers: stats.uniqueTeachers,
            qualityScore: stats.qualityScore,
            conflictCount: stats.conflictCount,
            success: true,
          });
        } catch (statsError) {
          console.error("Failed to calculate statistics:", statsError);
          // Still add to history with basic info
          timetableStore.addGenerationHistory({
            totalLessons: timetableArray.length,
            uniqueClasses: new Set(timetableArray.map((l: Lesson) => l.classId)).size,
            uniqueTeachers: new Set(timetableArray.flatMap((l: Lesson) => Array.isArray(l.teacherIds) ? l.teacherIds : [])).size,
            qualityScore: 0,
            conflictCount: 0,
            success: true,
          });
        }
      }
      
      setTimeout(() => {
        toast.success(t.timetable?.generateSuccess || "Timetable generated successfully!");
        navigate("/timetable");
      }, 500);
    } catch (error: any) {
      console.error("Timetable generation failed:", error);
      setIsGenerating(false);
      setGenerationProgress(0);
      
      // Add failed generation to history
      const errorMessage = error?.message || error?.error || "Unknown error";
      timetableStore.addGenerationHistory({
        totalLessons: 0,
        uniqueClasses: 0,
        uniqueTeachers: 0,
        qualityScore: 0,
        conflictCount: 0,
        success: false,
        error: errorMessage,
      });
      
      // Extract structured error if available - check multiple possible locations
      let errorData: any = null;
      
      // Check for structured error in different possible locations
      if (error?.error && typeof error.error === 'object' && error.error.type) {
        // Structured error attached directly
        errorData = error.error;
      } else if (error?.response?.error && typeof error.response.error === 'object' && error.response.error.type) {
        // Structured error in response
        errorData = error.response.error;
      } else if (error?.error && typeof error.error === 'string') {
        // String error, try to parse it
        errorData = error.error;
      } else if (error?.message) {
        // Error message
        errorData = error.message;
      } else {
        // Fallback
        errorData = error;
      }
      
      setGenerationError(errorData);
      
      // Also show a toast for immediate feedback
      const parsedError = parseTimetableError(errorData);
      if (parsedError && parsedError.userMessage) {
        toast.error(parsedError.userMessage);
      } else {
        toast.error(error.message || (t.timetable?.generateError || "Failed to generate timetable. Please check your data."));
      }
    }
  };

  // Render current step component
  const renderCurrentStep = () => {
    const stepKey = WIZARD_STEPS[currentStep].key;

    switch (stepKey) {
      case "school-info":
        return (
          <SchoolInfoStep
            data={wizardStore.schoolInfo}
            onUpdate={(data) => {
              wizardStore.setSchoolInfo(data);
              setValidationErrors([]);
            }}
          />
        );
      case "periods":
        return (
          <PeriodsStep
            data={wizardStore.periodsInfo}
            schoolInfo={wizardStore.schoolInfo}
            onUpdate={(data) => {
              wizardStore.setPeriodsInfo(data);
              setValidationErrors([]);
            }}
          />
        );
      case "teachers":
        return (
          <TeachersStep
            onDataChange={async () => {
              // Persist teacher changes - NO REFETCH (store is already updated)
              try {
                await wizardStore.saveTeachers(teacherStore.teachers as any);
                // DON'T refetch - it overwrites local changes!
                // await teacherStore.fetchTeachers();
              } catch (err) {
                console.error("Failed to persist teachers from wizard:", err);
              } finally {
                setValidationErrors([]);
              }
            }}
          />
        );
      case "subjects":
        return (
          <SubjectsStep
            data={subjectStore.subjects}
            onUpdate={async (data) => {
              try {
                await wizardStore.saveSubjects(data as any);
                await subjectStore.fetchSubjects();
              } catch (err) {
                console.error("Failed to persist subjects from wizard:", err);
              } finally {
                setValidationErrors([]);
              }
            }}
          />
        );
      case "rooms":
        return (
          <RoomsStep
            data={roomStore.rooms}
            onUpdate={async (data) => {
              try {
                await wizardStore.saveRooms(data as any);
                await roomStore.fetchRooms();
              } catch (err) {
                console.error("Failed to persist rooms from wizard:", err);
              } finally {
                setValidationErrors([]);
              }
            }}
          />
        );
      case "classes":
        return (
          <ClassesStep
            data={classStore.classes}
            onUpdate={async (data) => {
              try {
                await wizardStore.saveClasses(data as any);
                await classStore.fetchClasses();
              } catch (err) {
                console.error("Failed to persist classes from wizard:", err);
              } finally {
                setValidationErrors([]);
              }
            }}
          />
        );
      case "constraints":
        return <ConstraintsStep onDataChange={() => setValidationErrors([])} />;
      case "review":
        return (
          <ReviewStep
            schoolInfo={wizardStore.schoolInfo}
            periodsInfo={wizardStore.periodsInfo}
            teachers={teacherStore.teachers}
            subjects={subjectStore.subjects}
            rooms={roomStore.rooms}
            classes={classStore.classes}
            onGenerateTimetable={handleFinish}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  // Show loading state
  if (isInitializing || wizardStore.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
        <span className="ml-2">Loading wizard...</span>
      </div>
    );
  }


  // Show error state
  if (wizardStore.error) {
    return (
      <div className="container mx-auto p-6">
        <TimetableErrorDisplay
          error={wizardStore.error}
          onDismiss={() => window.location.reload()}
          teachers={teacherStore.teachers}
          subjects={subjectStore.subjects}
          classes={classStore.classes}
          rooms={roomStore.rooms}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Generation Progress Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 animate-spin" />
                Generating Timetable
              </CardTitle>
              <CardDescription>
                Please wait while we create your optimal timetable...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <div className="text-center text-sm font-medium">
                  {generationProgress}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[{ label: t.nav?.dashboard || "Home", href: "/" }, { label: t.wizard?.title || "Setup Wizard" }]}
          className="mb-6"
        />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">
              {t.wizard?.title || "Timetable Setup Wizard"}
            </h1>
          </div>
        </div>

        {/* Generation Error Display */}
        {generationError && (
          <div className="mb-6">
            <TimetableErrorDisplay
              error={generationError}
              onDismiss={() => setGenerationError(null)}
              teachers={teacherStore.teachers}
              subjects={subjectStore.subjects}
              classes={classStore.classes}
              rooms={roomStore.rooms}
            />
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-red-800">{t.validation?.title || "Validation Errors"}</h3>
            </div>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Wizard Container */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden min-h-[700px]">
          <WizardContainer
            title={
              (WIZARD_STEPS[currentStep].key === "school-info" && (t.wizard?.steps?.school || "School Info")) ||
              (WIZARD_STEPS[currentStep].key === "periods" && (t.wizard?.steps?.periods || "Periods")) ||
              (WIZARD_STEPS[currentStep].key === "rooms" && (t.wizard?.steps?.rooms || "Rooms")) ||
              (WIZARD_STEPS[currentStep].key === "classes" && (t.wizard?.steps?.classes || "Classes")) ||
              (WIZARD_STEPS[currentStep].key === "subjects" && (t.wizard?.steps?.subjects || "Subjects")) ||
              (WIZARD_STEPS[currentStep].key === "teachers" && (t.wizard?.steps?.teachers || "Teachers")) ||
              (WIZARD_STEPS[currentStep].key === "constraints" && (t.wizard?.steps?.preferences || "Constraints")) ||
              (WIZARD_STEPS[currentStep].key === "review" && (t.wizard?.steps?.review || "Review")) ||
              WIZARD_STEPS[currentStep].title
            }
            description={
              (WIZARD_STEPS[currentStep].key === "school-info" && (t.school?.name || "Configure basic school information")) ||
              (WIZARD_STEPS[currentStep].key === "periods" && (t.periods?.title || "Set up lesson times and schedule structure")) ||
              (WIZARD_STEPS[currentStep].key === "rooms" && (t.rooms?.pageDescription || "Add and configure rooms")) ||
              (WIZARD_STEPS[currentStep].key === "classes" && (t.classes?.pageDescription || "Set up class groups and requirements")) ||
              (WIZARD_STEPS[currentStep].key === "subjects" && (t.subjects?.pageDescription || "Create and manage subjects")) ||
              (WIZARD_STEPS[currentStep].key === "teachers" && (t.teachers?.pageDescription || "Set up teachers and their availability/subjects")) ||
              (WIZARD_STEPS[currentStep].key === "constraints" && (t.wizard?.steps?.preferences || "Configure hard and soft constraints")) ||
              (WIZARD_STEPS[currentStep].key === "review" && (t.wizard?.steps?.review || "Validate data and generate timetable")) ||
              WIZARD_STEPS[currentStep].description
            }
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            onNext={handleNext}
            onBack={handleBack}
            onFinish={handleFinish}
          >
            {isValidating ? (
              <div className="flex items-center justify-center h-40">
                <Loading />
                <span className="ml-2">{t.validation?.validating || "Validating data..."}</span>
              </div>
            ) : (
              renderCurrentStep()
            )}
          </WizardContainer>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-6 text-center">
          <div className="flex flex-row gap-6 justify-center items-center">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="border-gray-300"
            >
              <Home className="mr-2 h-4 w-4" />
              {t.nav?.dashboard || "Back to Dashboard"}
            </Button>
            <div className="text-sm text-muted-foreground">
              {t.wizard?.title || "Step"} {currentStep + 1} {t.actions?.of || "of"} {WIZARD_STEPS.length} • {t.actions?.progress || "Progress"}: {" "}
              {Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
