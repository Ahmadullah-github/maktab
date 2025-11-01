// src/types/index.ts
// Shared types and interfaces used across the application

// Teacher types
export interface Teacher {
  id: string;
  fullName: string;
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay?: number;
  timePreference?: 'Morning' | 'Afternoon' | 'None';
  primarySubjectIds: string[];
  allowedSubjectIds?: string[];
  restrictToPrimarySubjects?: boolean;
  availability?: Record<string, boolean[]>;
  unavailable?: Array<{
    day: string;
    periods: number[];
  }>;
  maxConsecutivePeriods?: number;
  preferredRoomIds?: string[];
  preferredColleagues?: string[];
  classAssignments?: Array<{
    subjectId: string;
    classIds: string[];
  }>;
  meta?: Record<string, any>;
}

// Subject types
export interface Subject {
  id: string;
  name: string;
  code?: string;
  grade?: number | null; // Grade level (7-12 for Afghan secondary schools)
  periodsPerWeek?: number | null; // Periods per week for this subject
  section?: 'PRIMARY' | 'MIDDLE' | 'HIGH';
  isDifficult?: boolean;
  requiredRoomType?: string;
  requiredFeatures?: string[];
  desiredFeatures?: string[];
  minRoomCapacity?: number;
  meta?: Record<string, any>;
}

// Room types
export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string;
  features?: string[];
  unavailable?: Array<{
    day: string;
    periods: number[];
  }>;
  meta?: Record<string, any>;
}

// Class types
export interface ClassGroup {
  id: string;
  name: string;
  displayName?: string;
  section?: 'PRIMARY' | 'MIDDLE' | 'HIGH';
  grade?: number | null;
  sectionIndex?: string; // A, B, C
  studentCount: number;
  subjectRequirements: Array<{
    subjectId: string;
    periodsPerWeek: number;
    minConsecutive?: number;
    maxConsecutive?: number;
    minDaysPerWeek?: number;
    maxDaysPerWeek?: number;
  }>;
  meta?: Record<string, any>;
}

// Configuration types
export interface SchoolInfo {
  schoolName: string;
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysPerWeek: number;
  periodsPerDay: number;
  breakPeriods: number[];
  // Section-specific overrides (optional)
  primaryPeriodsPerDay?: number | null;
  primaryPeriodDuration?: number | null;
  primaryStartTime?: string | null;
  primaryBreakPeriods?: number[] | null;

  middlePeriodsPerDay?: number | null;
  middlePeriodDuration?: number | null;
  middleStartTime?: string | null;
  middleBreakPeriods?: number[] | null;

  highPeriodsPerDay?: number | null;
  highPeriodDuration?: number | null;
  highStartTime?: string | null;
  highBreakPeriods?: number[] | null;
}

export interface PeriodInfo {
  index: number;
  startTime?: string;
  endTime?: string;
}

export interface PeriodsInfo {
  periodsPerDay: number;
  periodDuration: number;
  schoolStartTime: string;
  periods: PeriodInfo[];
  breakPeriods: number[];
}

// Wizard types
export interface WizardStepData {
  stepKey: string;
  data: any;
}

export interface TimetableGenerationData {
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  classes: ClassGroup[];
  schoolInfo: SchoolInfo;
  periodsInfo: PeriodsInfo;
  // Add other configuration options as needed
}