// src/stores/useTeacherStore.ts
import { create } from "zustand";
import { Teacher } from "../types";
import { dataService } from "../lib/dataService";

// Define the store state and actions
interface TeacherStore {
  teachers: Teacher[];
  isLoading: boolean;
  error: string | null;
  fetchTeachers: () => Promise<void>;
  addTeacher: (teacher: Omit<Teacher, "id">) => Promise<Teacher | null>;
  updateTeacher: (teacher: Teacher) => Promise<Teacher | null>;
  deleteTeacher: (id: string) => Promise<boolean>;
  bulkImportTeachers: (teachers: Omit<Teacher, "id">[]) => Promise<Teacher[]>;
  set: (fn: (state: TeacherStore) => Partial<TeacherStore>) => void;
}

// Create the Zustand store
export const useTeacherStore = create<TeacherStore>((set, get) => ({
  teachers: [],
  isLoading: false,
  error: null,
  set,

  fetchTeachers: async () => {
    set({ isLoading: true, error: null });
    try {
      const teachers = await dataService.getTeachers();
      const normalized = (teachers || []).map((t: any) => ({
        ...t,
        id: String(t.id),
        primarySubjectIds: typeof t.primarySubjectIds === 'string' 
          ? JSON.parse(t.primarySubjectIds || '[]')
          : Array.isArray(t.primarySubjectIds)
          ? t.primarySubjectIds
          : [],
        allowedSubjectIds: typeof t.allowedSubjectIds === 'string'
          ? JSON.parse(t.allowedSubjectIds || '[]')
          : Array.isArray(t.allowedSubjectIds)
          ? t.allowedSubjectIds
          : [],
        restrictToPrimarySubjects: Boolean(t.restrictToPrimarySubjects),
        availability: typeof t.availability === 'string'
          ? JSON.parse(t.availability || '{}')
          : t.availability || {},
        unavailable: typeof t.unavailable === 'string'
          ? JSON.parse(t.unavailable || '[]')
          : Array.isArray(t.unavailable)
          ? t.unavailable
          : [],
        preferredRoomIds: typeof t.preferredRoomIds === 'string'
          ? JSON.parse(t.preferredRoomIds || '[]')
          : Array.isArray(t.preferredRoomIds)
          ? t.preferredRoomIds
          : [],
        preferredColleagues: typeof t.preferredColleagues === 'string'
          ? JSON.parse(t.preferredColleagues || '[]')
          : Array.isArray(t.preferredColleagues)
          ? t.preferredColleagues
          : [],
        meta: typeof t.meta === 'string'
          ? JSON.parse(t.meta || '{}')
          : t.meta || {},
      }));
      set({ teachers: normalized, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addTeacher: async (teacherData) => {
    try {
      // Include all teacher fields to prevent data loss
      const payload: any = {
        fullName: teacherData.fullName,
        maxPeriodsPerWeek: Number(teacherData.maxPeriodsPerWeek),
        maxPeriodsPerDay: Number(teacherData.maxPeriodsPerDay || 0),
        maxConsecutivePeriods: Number(teacherData.maxConsecutivePeriods || 0),
        timePreference: teacherData.timePreference || "None",
        primarySubjectIds: Array.isArray(teacherData.primarySubjectIds)
          ? teacherData.primarySubjectIds
          : [],
        allowedSubjectIds: Array.isArray(teacherData.allowedSubjectIds)
          ? teacherData.allowedSubjectIds
          : [],
        restrictToPrimarySubjects: Boolean(teacherData.restrictToPrimarySubjects),
        availability: teacherData.availability || {},
        unavailable: Array.isArray(teacherData.unavailable)
          ? teacherData.unavailable
          : [],
        preferredRoomIds: Array.isArray(teacherData.preferredRoomIds)
          ? teacherData.preferredRoomIds
          : [],
        preferredColleagues: Array.isArray(teacherData.preferredColleagues)
          ? teacherData.preferredColleagues
          : [],
        meta: teacherData.meta || {},
      };
      const newTeacher = await dataService.saveTeacher(payload);
      if (newTeacher) {
        // Parse JSON fields from the API response
        const normalized = {
          ...newTeacher,
          id: String((newTeacher as any).id),
          primarySubjectIds: typeof (newTeacher as any).primarySubjectIds === 'string' 
            ? JSON.parse((newTeacher as any).primarySubjectIds || '[]')
            : Array.isArray((newTeacher as any).primarySubjectIds)
            ? (newTeacher as any).primarySubjectIds
            : [],
          allowedSubjectIds: typeof (newTeacher as any).allowedSubjectIds === 'string'
            ? JSON.parse((newTeacher as any).allowedSubjectIds || '[]')
            : Array.isArray((newTeacher as any).allowedSubjectIds)
            ? (newTeacher as any).allowedSubjectIds
            : [],
          restrictToPrimarySubjects: Boolean((newTeacher as any).restrictToPrimarySubjects),
          availability: typeof (newTeacher as any).availability === 'string'
            ? JSON.parse((newTeacher as any).availability || '{}')
            : (newTeacher as any).availability || {},
          unavailable: typeof (newTeacher as any).unavailable === 'string'
            ? JSON.parse((newTeacher as any).unavailable || '[]')
            : Array.isArray((newTeacher as any).unavailable)
            ? (newTeacher as any).unavailable
            : [],
          preferredRoomIds: typeof (newTeacher as any).preferredRoomIds === 'string'
            ? JSON.parse((newTeacher as any).preferredRoomIds || '[]')
            : Array.isArray((newTeacher as any).preferredRoomIds)
            ? (newTeacher as any).preferredRoomIds
            : [],
          preferredColleagues: typeof (newTeacher as any).preferredColleagues === 'string'
            ? JSON.parse((newTeacher as any).preferredColleagues || '[]')
            : Array.isArray((newTeacher as any).preferredColleagues)
            ? (newTeacher as any).preferredColleagues
            : [],
          meta: typeof (newTeacher as any).meta === 'string'
            ? JSON.parse((newTeacher as any).meta || '{}')
            : (newTeacher as any).meta || {},
        } as Teacher;
        set((state) => ({ teachers: [...state.teachers, normalized] }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  updateTeacher: async (teacher) => {
    try {
      // Include all teacher fields to prevent data loss
      const payload: any = {
        id: teacher.id,
        fullName: teacher.fullName,
        maxPeriodsPerWeek: Number(teacher.maxPeriodsPerWeek),
        maxPeriodsPerDay: Number(teacher.maxPeriodsPerDay || 0),
        maxConsecutivePeriods: Number(teacher.maxConsecutivePeriods || 0),
        timePreference: teacher.timePreference || "None",
        primarySubjectIds: Array.isArray(teacher.primarySubjectIds)
          ? teacher.primarySubjectIds
          : [],
        allowedSubjectIds: Array.isArray(teacher.allowedSubjectIds)
          ? teacher.allowedSubjectIds
          : [],
        restrictToPrimarySubjects: Boolean(teacher.restrictToPrimarySubjects),
        availability: teacher.availability || {},
        unavailable: Array.isArray(teacher.unavailable)
          ? teacher.unavailable
          : [],
        preferredRoomIds: Array.isArray(teacher.preferredRoomIds)
          ? teacher.preferredRoomIds
          : [],
        preferredColleagues: Array.isArray(teacher.preferredColleagues)
          ? teacher.preferredColleagues
          : [],
        meta: teacher.meta || {},
      };
      const updatedTeacher = await dataService.updateTeacher(payload);
      if (updatedTeacher) {
        // Parse JSON fields from the API response
        const normalizedUpdated = {
          ...updatedTeacher,
          id: String((updatedTeacher as any).id),
          primarySubjectIds: typeof (updatedTeacher as any).primarySubjectIds === 'string' 
            ? JSON.parse((updatedTeacher as any).primarySubjectIds || '[]')
            : Array.isArray((updatedTeacher as any).primarySubjectIds)
            ? (updatedTeacher as any).primarySubjectIds
            : [],
          allowedSubjectIds: typeof (updatedTeacher as any).allowedSubjectIds === 'string'
            ? JSON.parse((updatedTeacher as any).allowedSubjectIds || '[]')
            : Array.isArray((updatedTeacher as any).allowedSubjectIds)
            ? (updatedTeacher as any).allowedSubjectIds
            : [],
          restrictToPrimarySubjects: Boolean((updatedTeacher as any).restrictToPrimarySubjects),
          availability: typeof (updatedTeacher as any).availability === 'string'
            ? JSON.parse((updatedTeacher as any).availability || '{}')
            : (updatedTeacher as any).availability || {},
          unavailable: typeof (updatedTeacher as any).unavailable === 'string'
            ? JSON.parse((updatedTeacher as any).unavailable || '[]')
            : Array.isArray((updatedTeacher as any).unavailable)
            ? (updatedTeacher as any).unavailable
            : [],
          preferredRoomIds: typeof (updatedTeacher as any).preferredRoomIds === 'string'
            ? JSON.parse((updatedTeacher as any).preferredRoomIds || '[]')
            : Array.isArray((updatedTeacher as any).preferredRoomIds)
            ? (updatedTeacher as any).preferredRoomIds
            : [],
          preferredColleagues: typeof (updatedTeacher as any).preferredColleagues === 'string'
            ? JSON.parse((updatedTeacher as any).preferredColleagues || '[]')
            : Array.isArray((updatedTeacher as any).preferredColleagues)
            ? (updatedTeacher as any).preferredColleagues
            : [],
          meta: typeof (updatedTeacher as any).meta === 'string'
            ? JSON.parse((updatedTeacher as any).meta || '{}')
            : (updatedTeacher as any).meta || {},
        } as Teacher;
        
        // Update the store state
        set((state) => ({
          teachers: state.teachers.map((t) =>
            String(t.id) === String(normalizedUpdated.id)
              ? normalizedUpdated
              : t
          ),
        }));
        return normalizedUpdated;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  deleteTeacher: async (id) => {
    try {
      // treat any successful HTTP response (no exception) as success
      await dataService.deleteTeacher(id);
      set((state) => ({
        teachers: state.teachers.filter(
          (teacher) => String(teacher.id) !== String(id)
        ),
      }));
      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },

  bulkImportTeachers: async (teachers) => {
    try {
      const importedTeachers = await dataService.bulkImportTeachers(teachers);
      set((state) => ({ teachers: [...state.teachers, ...importedTeachers] }));
      return importedTeachers;
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },
}));
