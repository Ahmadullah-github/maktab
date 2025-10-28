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
import { Home, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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

// Define the 8 wizard steps
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
  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Use all stores for data collection
  const wizardStore = useWizardStore();
  const teacherStore = useTeacherStore();
  const subjectStore = useSubjectStore();
  const roomStore = useRoomStore();
  const classStore = useClassStore();

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

    if (!schoolInfo.workingDays?.length) {
      setValidationErrors(["At least one working day must be selected"]);
      return false;
    }

    if (!schoolInfo.startTime) {
      setValidationErrors(["School start time is required"]);
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

    // Convert frontend data structures to match schema requirements
    const config = {
      daysOfWeek: schoolInfo.workingDays.map((day) => day as any) || [],
      periodsPerDay: periodsInfo.periodsPerDay || 7,
      schoolStartTime: periodsInfo.schoolStartTime || "08:00",
      periodDurationMinutes: periodsInfo.periodDuration || 45,
      periods: periodsInfo.periods || [],
      breakPeriods: periodsInfo.breakPeriods || [],
      timezone: schoolInfo.timezone || "Asia/Kabul",
    };

    // Convert teachers to match schema
    const schemaTeachers = teachers.map((teacher) => ({
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

    // Convert subjects to match schema
    const schemaSubjects = subjects.map((subject) => ({
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

    // Convert classes to match schema
    const schemaClasses = classes.map((classGroup) => {
      // Convert subjectRequirements from array to object format
      let subjectRequirements = {};
      if (Array.isArray(classGroup.subjectRequirements)) {
        subjectRequirements = Object.fromEntries(
          classGroup.subjectRequirements.map((req) => [
            req.subjectId,
            {
              periodsPerWeek: req.periodsPerWeek || 0,
              minConsecutive: req.minConsecutive || 0,
              maxConsecutive: req.maxConsecutive || 0,
              minDaysPerWeek: req.minDaysPerWeek || 0,
              maxDaysPerWeek: req.maxDaysPerWeek || 0,
            },
          ])
        );
      } else {
        subjectRequirements = classGroup.subjectRequirements || {};
      }

      return {
        id: classGroup.id,
        name: classGroup.name || "",
        studentCount: classGroup.studentCount || 0,
        subjectRequirements,
        meta: classGroup.meta || {},
      };
    });

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
      // Save current step progress
      await wizardStore.setCurrentStep(WIZARD_STEPS[currentStep].key);

      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
        toast.success(`Moving to ${WIZARD_STEPS[currentStep + 1].title}`);
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

    try {
      toast.loading("Generating timetable...");
      const timetableData = await collectTimetableData();
      const result = await wizardStore.generateTimetable(timetableData);

      wizardStore.setTimetable(result);
      toast.success("Timetable generated successfully!");
      navigate("/timetable");
    } catch (error: any) {
      console.error("Timetable generation failed:", error);
      toast.error(
        error.message || "Failed to generate timetable. Please check your data."
      );
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
              // Persist teacher changes and refresh global teacher store
              try {
                await wizardStore.saveTeachers(teacherStore.teachers as any);
                await teacherStore.fetchTeachers();
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
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-red-600">
            Error Loading Wizard
          </h1>
          <p className="text-muted-foreground">{wizardStore.error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Setup Wizard" }]}
          className="mb-6"
        />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Timetable Setup Wizard
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Follow these {WIZARD_STEPS.length} steps to configure your school
            timetable. Your progress is automatically saved.
          </p>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-red-800">Validation Errors</h3>
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
            title={WIZARD_STEPS[currentStep].title}
            description={WIZARD_STEPS[currentStep].description}
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            onNext={handleNext}
            onBack={handleBack}
            onFinish={handleFinish}
          >
            {isValidating ? (
              <div className="flex items-center justify-center h-40">
                <Loading />
                <span className="ml-2">Validating data...</span>
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
              Back to Dashboard
            </Button>
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {WIZARD_STEPS.length} • Progress:{" "}
              {Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
