// src/stores/useSubjectStore.ts
import { create } from "zustand";
import { Subject } from "../types";
import { dataService } from "../lib/dataService";

// Define the store state and actions
interface SubjectStore {
  subjects: Subject[];
  isLoading: boolean;
  error: string | null;
  fetchSubjects: () => Promise<void>;
  addSubject: (subject: Omit<Subject, "id">) => Promise<Subject | null>;
  updateSubject: (subject: Subject) => Promise<Subject | null>;
  deleteSubject: (id: string) => Promise<boolean>;
}

// Create the Zustand store
export const useSubjectStore = create<SubjectStore>((set, get) => ({
  subjects: [],
  isLoading: false,
  error: null,

  fetchSubjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const subjects = await dataService.getSubjects();
      // normalize ids to strings
      const normalized = (subjects || []).map((s: any) => ({
        ...s,
        id: String(s.id),
      }));
      set({ subjects: normalized, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addSubject: async (subjectData) => {
    try {
      const newSubject = await dataService.saveSubject(subjectData);
      if (newSubject) {
        const normalized = {
          ...newSubject,
          id: String((newSubject as any).id),
        };
        set((state) => ({ subjects: [...state.subjects, normalized] }));
        return normalized;
      }
      return null;
    } catch (error) {
      set({ error: (error as Error).message });
      return null;
    }
  },

  updateSubject: async (subject) => {
    try {
      const updatedSubject = await dataService.saveSubject(subject);
      if (updatedSubject) {
        const normalized = {
          ...updatedSubject,
          id: String((updatedSubject as any).id),
        };
        set((state) => ({
          subjects: state.subjects.map((s) =>
            String(s.id) === String(normalized.id) ? normalized : s
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

  deleteSubject: async (id) => {
    try {
      await dataService.deleteSubject(id);
      set((state) => ({
        subjects: state.subjects.filter(
          (subject) => String(subject.id) !== String(id)
        ),
      }));
      return true;
    } catch (error) {
      set({ error: (error as Error).message });
      return false;
    }
  },
}));
