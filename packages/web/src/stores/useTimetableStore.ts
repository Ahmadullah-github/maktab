// src/stores/useTimetableStore.ts
import { create } from "zustand";
import { Lesson, ExtendedTimetableStatistics } from "@/lib/timetableTransform";

export interface GenerationMetadata {
  id: string;
  timestamp: number;
  timestampISO: string;
  totalLessons: number;
  uniqueClasses: number;
  uniqueTeachers: number;
  qualityScore: number;
  conflictCount: number;
  success: boolean;
  error?: string;
}

interface TimetableStore {
  currentTimetable: Lesson[] | null;
  statistics: ExtendedTimetableStatistics | null;
  generationHistory: GenerationMetadata[];
  lastGeneratedTimestamp: number | null;
  isLoading: boolean;
  error: string | null;
  
  setCurrentTimetable: (timetable: Lesson[] | null) => void;
  setStatistics: (stats: ExtendedTimetableStatistics | null) => void;
  addGenerationHistory: (metadata: Omit<GenerationMetadata, 'id' | 'timestamp' | 'timestampISO'>) => void;
  loadGenerationHistory: () => void;
  clearGenerationHistory: () => void;
  loadTimetableFromStorage: () => void;
  getTimetableAge: () => number | null;
}

const STORAGE_KEY_TIMETABLE = "generatedTimetable";
const STORAGE_KEY_TIMETABLE_TIMESTAMP = "generatedTimetableTimestamp";
const STORAGE_KEY_HISTORY = "timetableGenerationHistory";
const MAX_HISTORY_ITEMS = 10;

export const useTimetableStore = create<TimetableStore>((set, get) => ({
  currentTimetable: null,
  statistics: null,
  generationHistory: [],
  lastGeneratedTimestamp: null,
  isLoading: false,
  error: null,

  setCurrentTimetable: (timetable) => {
    const timestamp = Date.now();
    set({ currentTimetable: timetable, lastGeneratedTimestamp: timestamp });
    // Also save to localStorage
    if (timetable && Array.isArray(timetable)) {
      localStorage.setItem(STORAGE_KEY_TIMETABLE, JSON.stringify(timetable));
      localStorage.setItem(STORAGE_KEY_TIMETABLE_TIMESTAMP, timestamp.toString());
    } else {
      localStorage.removeItem(STORAGE_KEY_TIMETABLE);
      localStorage.removeItem(STORAGE_KEY_TIMETABLE_TIMESTAMP);
    }
  },

  setStatistics: (stats) => {
    set({ statistics: stats });
  },

  addGenerationHistory: (metadata) => {
    const historyItem: GenerationMetadata = {
      ...metadata,
      id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
    };

    const currentHistory = get().generationHistory;
    const newHistory = [historyItem, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);
    
    set({ generationHistory: newHistory });
    
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save generation history:", error);
    }
  },

  loadGenerationHistory: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (stored) {
        const history = JSON.parse(stored) as GenerationMetadata[];
        set({ generationHistory: history });
      }
    } catch (error) {
      console.error("Failed to load generation history:", error);
      set({ generationHistory: [] });
    }
  },

  clearGenerationHistory: () => {
    set({ generationHistory: [] });
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  },

  loadTimetableFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TIMETABLE);
      const storedTimestamp = localStorage.getItem(STORAGE_KEY_TIMETABLE_TIMESTAMP);
      if (stored) {
        const timetable = JSON.parse(stored) as Lesson[];
        const timestamp = storedTimestamp ? parseInt(storedTimestamp, 10) : null;
        set({ currentTimetable: timetable, lastGeneratedTimestamp: timestamp });
      }
    } catch (error) {
      console.error("Failed to load timetable from storage:", error);
      set({ currentTimetable: null, lastGeneratedTimestamp: null });
    }
  },

  getTimetableAge: () => {
    const timestamp = get().lastGeneratedTimestamp;
    if (!timestamp) return null;
    return Date.now() - timestamp;
  },
}));

