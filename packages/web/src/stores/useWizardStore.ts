// src/stores/useWizardStore.ts
import { create } from "zustand";
import {
  SchoolInfo,
  PeriodsInfo,
  WizardStepData,
  Teacher,
  Subject,
  Room,
  ClassGroup,
} from "../types";
import { dataService } from "../lib/dataService";

// Define the store state and actions
interface WizardStore {
  wizardId: number;
  currentStep: string;
  schoolInfo: SchoolInfo;
  periodsInfo: PeriodsInfo;
  preferences: Record<string, any>;
  stepData: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  timetable: any | null;
  setWizardId: (id: number) => void;
  setCurrentStep: (step: string) => void;
  setSchoolInfo: (info: SchoolInfo) => void;
  setPeriodsInfo: (info: PeriodsInfo) => void;
  setPreferences: (preferences: Record<string, any>) => void;
  setTimetable: (timetable: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initializeWizard: (id: number) => Promise<void>;
  saveWizardStep: (
    wizardId: number,
    stepKey: string,
    data: any
  ) => Promise<boolean>;
  getWizardStep: (wizardId: number, stepKey: string) => Promise<any>;
  saveStepData: (stepKey: string, data: any) => Promise<boolean>;
  loadStepData: (stepKey: string) => Promise<any>;
  loadAllStepData: () => Promise<void>;
  saveSchoolInfo: () => Promise<boolean>;
  savePeriodsInfo: () => Promise<boolean>;
  saveTeachers: (teachers: Teacher[]) => Promise<boolean>;
  saveSubjects: (subjects: Subject[]) => Promise<boolean>;
  saveRooms: (rooms: Room[]) => Promise<boolean>;
  saveClasses: (classes: ClassGroup[]) => Promise<boolean>;
  loadTeachers: () => Promise<Teacher[]>;
  loadSubjects: () => Promise<Subject[]>;
  loadRooms: () => Promise<Room[]>;
  loadClasses: () => Promise<ClassGroup[]>;
  generateTimetable: (data: any) => Promise<any>;
}

// Create the Zustand store
export const useWizardStore = create<WizardStore>((set, get) => ({
  wizardId: 1, // Default wizard ID
  currentStep: "school-info",
  schoolInfo: {
    schoolName: "",
    enablePrimary: true,
    enableMiddle: true,
    enableHigh: true,
    daysPerWeek: 6,
    periodsPerDay: 7,
    breakPeriods: [],
  },
  periodsInfo: {
    periodsPerDay: 7,
    periodDuration: 45,
    schoolStartTime: "08:00",
    periods: [],
    breakPeriods: [],
  },
  preferences: {},
  stepData: {},
  isLoading: false,
  error: null,
  timetable: null,

  setWizardId: (id) => set({ wizardId: id }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setSchoolInfo: (info) => set({ schoolInfo: info }),

  setPeriodsInfo: (info) => set({ periodsInfo: info }),

  setPreferences: (preferences) => set({ preferences }),

  setTimetable: (timetable) => set({ timetable }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  initializeWizard: async (id) => {
    set({ isLoading: true, error: null, wizardId: id });
    try {
      // Load existing wizard data
      try {
        const schoolCfg = await dataService.getSchoolConfig();
        if (schoolCfg) {
          set({
            schoolInfo: {
              schoolName: schoolCfg.schoolName || "",
              enablePrimary: !!schoolCfg.enablePrimary,
              enableMiddle: !!schoolCfg.enableMiddle,
              enableHigh: !!schoolCfg.enableHigh,
              daysPerWeek: schoolCfg.daysPerWeek ?? 6,
              periodsPerDay: schoolCfg.periodsPerDay ?? 7,
              breakPeriods: Array.isArray(schoolCfg.breakPeriods)
                ? schoolCfg.breakPeriods
                : (() => {
                    try { return JSON.parse(schoolCfg.breakPeriods || "[]"); } catch { return []; }
                  })(),
            },
          });
        }
      } catch {}
      await get().loadAllStepData();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  saveWizardStep: async (wizardId, stepKey, data) => {
    try {
      const success = await dataService.saveWizardData(
        String(wizardId),
        stepKey,
        data
      );
      if (success) {
        set((state) => ({
          stepData: { ...state.stepData, [stepKey]: data },
        }));
      }
      return success;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  getWizardStep: async (wizardId, stepKey) => {
    try {
      const data = await dataService.getWizardData(String(wizardId), stepKey);
      if (data) {
        set((state) => ({
          stepData: { ...state.stepData, [stepKey]: data },
        }));
      }
      return data;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  saveStepData: async (stepKey, data) => {
    try {
      const { wizardId } = get();
      const success = await dataService.saveWizardData(
        String(wizardId),
        stepKey,
        data
      );
      if (success) {
        set((state) => ({
          stepData: { ...state.stepData, [stepKey]: data },
        }));
      }
      return success;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  loadStepData: async (stepKey) => {
    try {
      const { wizardId } = get();
      const data = await dataService.getWizardData(String(wizardId), stepKey);
      if (data) {
        set((state) => ({
          stepData: { ...state.stepData, [stepKey]: data },
        }));
      }
      return data;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  loadAllStepData: async () => {
    set({ isLoading: true, error: null });
    try {
      const { wizardId } = get();
      const allData = await dataService.getAllWizardData(String(wizardId));

      const stepData: Record<string, any> = {};
      allData.forEach((step) => {
        stepData[step.stepKey] = step.data;
      });

      set({ stepData, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  saveSchoolInfo: async () => {
    try {
      const { schoolInfo } = get();
      const payload = {
        schoolName: schoolInfo.schoolName || null,
        enablePrimary: schoolInfo.enablePrimary,
        enableMiddle: schoolInfo.enableMiddle,
        enableHigh: schoolInfo.enableHigh,
        daysPerWeek: schoolInfo.daysPerWeek,
        periodsPerDay: schoolInfo.periodsPerDay,
        breakPeriods: JSON.stringify(schoolInfo.breakPeriods || []),
      };
      const success = await dataService.saveSchoolInfo(payload);
      return success;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  savePeriodsInfo: async () => {
    try {
      const { periodsInfo } = get();
      console.log('[WIZARD STORE] savePeriodsInfo called');
      console.log('[WIZARD STORE] periodsInfo from store:', JSON.stringify(periodsInfo, null, 2));
      const success = await dataService.savePeriodConfig(periodsInfo);
      console.log('[WIZARD STORE] savePeriodConfig result:', success);
      return success;
    } catch (error) {
      console.error('[WIZARD STORE] Error in savePeriodsInfo:', error);
      set({ error: (error as Error).message });
      return false;
    }
  },

  saveTeachers: async (teachers: Teacher[]) => {
    try {
      // Save each teacher individually (create or update)
      const results = await Promise.all(
        teachers.map((teacher) => dataService.saveTeacher(teacher))
      );

      // normalize returned teachers and save to step data
      const normalized = (results || []).map((t: any) => ({
        ...t,
        id: String(t.id),
      }));
      await get().saveStepData("teachers", normalized);

      return results.every((result) => result !== null);
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  saveSubjects: async (subjects: Subject[]) => {
    try {
      // Save each subject individually (create or update)
      const results = await Promise.all(
        subjects.map((subject) => dataService.saveSubject(subject))
      );

      const normalized = (results || []).map((s: any) => ({
        ...s,
        id: String(s.id),
      }));
      await get().saveStepData("subjects", normalized);

      return results.every((result) => result !== null);
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  saveRooms: async (rooms: Room[]) => {
    try {
      // Save each room individually (create or update)
      const results = await Promise.all(
        rooms.map((room) => dataService.saveRoom(room))
      );

      const normalized = (results || []).map((r: any) => ({
        ...r,
        id: String(r.id),
      }));
      await get().saveStepData("rooms", normalized);

      return results.every((result) => result !== null);
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  saveClasses: async (classes: ClassGroup[]) => {
    try {
      // Save each class individually (create or update)
      const results = await Promise.all(
        classes.map((classGroup) => dataService.saveClass(classGroup))
      );

      const normalized = (results || []).map((c: any) => ({
        ...c,
        id: String(c.id),
        subjectRequirements: Array.isArray(c.subjectRequirements)
          ? c.subjectRequirements.map((r: any) => ({
              ...r,
              subjectId: String(r.subjectId),
            }))
          : [],
      }));
      await get().saveStepData("classes", normalized);

      return results.every((result) => result !== null);
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  loadTeachers: async () => {
    try {
      const teachers = await dataService.getTeachers();
      return (teachers || []).map((t: any) => ({ ...t, id: String(t.id) }));
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  loadSubjects: async () => {
    try {
      const subjects = await dataService.getSubjects();
      return (subjects || []).map((s: any) => ({ ...s, id: String(s.id) }));
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  loadRooms: async () => {
    try {
      const rooms = await dataService.getRooms();
      return (rooms || []).map((r: any) => ({ ...r, id: String(r.id) }));
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  loadClasses: async () => {
    try {
      const classes = await dataService.getClasses();
      return (classes || []).map((c: any) => ({
        ...c,
        id: String(c.id),
        subjectRequirements: Array.isArray(c.subjectRequirements)
          ? c.subjectRequirements.map((r: any) => ({
              ...r,
              subjectId: String(r.subjectId),
            }))
          : [],
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  generateTimetable: async (data) => {
    try {
      set({ isLoading: true, error: null });

      console.log("Sending data to backend for timetable generation...");

      // Use the api service which handles the correct base URL
      const result = await dataService.generateTimetable(data);

      console.log("Timetable generated successfully:", result);
      set({ timetable: result });
      return result;
    } catch (error) {
      console.error("Timetable generation failed:", error);
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
