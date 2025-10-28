// src/stores/useClassStore.ts
import { create } from "zustand";
import { ClassGroup } from "../types";
import { dataService } from "../lib/dataService";

// Define the store state and actions
interface ClassStore {
  classes: ClassGroup[];
  isLoading: boolean;
  error: string | null;
  fetchClasses: () => Promise<void>;
  addClass: (classGroup: Omit<ClassGroup, "id">) => Promise<ClassGroup | null>;
  updateClass: (classGroup: ClassGroup) => Promise<ClassGroup | null>;
  deleteClass: (id: string) => Promise<boolean>;
}

// Create the Zustand store
export const useClassStore = create<ClassStore>((set, get) => ({
  classes: [],
  isLoading: false,
  error: null,

  fetchClasses: async () => {
    set({ isLoading: true, error: null });
    try {
      const classes = await dataService.getClasses();
      const normalized = (classes || []).map((c: any) => ({
        ...c,
        id: String(c.id),
        subjectRequirements: Array.isArray(c.subjectRequirements)
          ? c.subjectRequirements.map((r: any) => ({
              ...r,
              subjectId: String(r.subjectId),
            }))
          : [],
      }));
      set({ classes: normalized, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addClass: async (classData) => {
    try {
      const newClass = await dataService.saveClass(classData);
      if (newClass) {
        const normalized = {
          ...newClass,
          id: String((newClass as any).id),
          subjectRequirements: Array.isArray(newClass.subjectRequirements)
            ? newClass.subjectRequirements.map((r: any) => ({
                ...r,
                subjectId: String(r.subjectId),
              }))
            : [],
        } as any;
        set((state) => ({ classes: [...state.classes, normalized] }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  updateClass: async (classGroup) => {
    try {
      const updatedClass = await dataService.saveClass(classGroup);
      if (updatedClass) {
        const normalized = {
          ...updatedClass,
          id: String((updatedClass as any).id),
          subjectRequirements: Array.isArray(updatedClass.subjectRequirements)
            ? updatedClass.subjectRequirements.map((r: any) => ({
                ...r,
                subjectId: String(r.subjectId),
              }))
            : [],
        } as any;
        set((state) => ({
          classes: state.classes.map((c) =>
            String(c.id) === String(normalized.id) ? normalized : c
          ),
        }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  deleteClass: async (id) => {
    try {
      await dataService.deleteClass(id);
      set((state) => ({
        classes: state.classes.filter(
          (classGroup) => String(classGroup.id) !== String(id)
        ),
      }));
      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },
}));
