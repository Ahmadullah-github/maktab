/**
 * Schedule transformer utility
 * Normalizes API responses into typed schedule data structures
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type {
  ClassMetadata,
  DayOfWeek,
  NormalizedSchedule,
  PeriodConfiguration,
  ScheduledLesson,
  SolutionMetadata,
  SolutionStatistics,
  SubjectMetadata,
  TeacherMetadata,
  TimetableApiResponse,
} from '../types';
import { logger } from './logger';

/**
 * Custom error class for schedule transformation errors
 */
export class ScheduleTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleTransformError';
  }
}

/**
 * Raw solver output structure from API data field
 */
interface RawSolverOutput {
  schedule?: unknown[];
  metadata?: {
    classes?: unknown[];
    subjects?: unknown[];
    teachers?: unknown[];
    periodConfiguration?: unknown;
  };
  statistics?: unknown;
  status?: string;
  errors?: string[];
}

/**
 * Validates and converts a day value to DayOfWeek enum
 */
function validateDay(value: unknown): DayOfWeek {
  const validDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (typeof value !== 'string' || !validDays.includes(value)) {
    throw new ScheduleTransformError(`Invalid day value: ${value}`);
  }
  return value as DayOfWeek;
}

/**
 * Safely extracts a string or null from unknown value
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Safely extracts a number or null from unknown value
 */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely extracts a string array from unknown value
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

/**
 * Safely extracts a string array or null from unknown value
 */
function toStringArrayOrNull(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return value.map((v) => String(v));
}

/**
 * Maps a raw lesson object to a ScheduledLesson
 */
function mapLesson(raw: unknown, index: number): ScheduledLesson {
  if (typeof raw !== 'object' || raw === null) {
    throw new ScheduleTransformError(`Invalid lesson at index ${index}: expected object`);
  }

  const lesson = raw as Record<string, unknown>;

  // Validate required fields
  if (lesson.day === undefined) {
    throw new ScheduleTransformError(`Invalid lesson at index ${index}: missing day`);
  }
  if (lesson.periodIndex === undefined) {
    throw new ScheduleTransformError(`Invalid lesson at index ${index}: missing periodIndex`);
  }
  if (lesson.classId === undefined) {
    throw new ScheduleTransformError(`Invalid lesson at index ${index}: missing classId`);
  }
  if (lesson.subjectId === undefined) {
    throw new ScheduleTransformError(`Invalid lesson at index ${index}: missing subjectId`);
  }

  return {
    day: validateDay(lesson.day),
    periodIndex: Number(lesson.periodIndex),
    classId: String(lesson.classId),
    className: toStringOrNull(lesson.className),
    subjectId: String(lesson.subjectId),
    subjectName: toStringOrNull(lesson.subjectName),
    teacherIds: toStringArray(lesson.teacherIds),
    teacherNames: toStringArrayOrNull(lesson.teacherNames),
    roomId: toStringOrNull(lesson.roomId),
    roomName: toStringOrNull(lesson.roomName),
    isFixed: Boolean(lesson.isFixed),
    periodsThisDay: toNumberOrNull(lesson.periodsThisDay),
  };
}

/**
 * Maps raw class metadata to ClassMetadata
 */
function mapClassMetadata(raw: unknown): ClassMetadata {
  if (typeof raw !== 'object' || raw === null) {
    return {
      classId: '',
      className: '',
      gradeLevel: null,
      category: null,
      categoryDari: null,
      studentCount: 0,
      singleTeacherMode: false,
      classTeacherId: null,
      classTeacherName: null,
      classTeacherSubjects: null,
    };
  }

  const data = raw as Record<string, unknown>;
  return {
    classId: String(data.classId ?? ''),
    className: String(data.className ?? ''),
    gradeLevel: toNumberOrNull(data.gradeLevel),
    category: toStringOrNull(data.category),
    categoryDari: toStringOrNull(data.categoryDari),
    studentCount: Number(data.studentCount ?? 0),
    singleTeacherMode: Boolean(data.singleTeacherMode),
    classTeacherId: toStringOrNull(data.classTeacherId),
    classTeacherName: toStringOrNull(data.classTeacherName),
    classTeacherSubjects: toStringArrayOrNull(data.classTeacherSubjects),
  };
}

/**
 * Maps raw subject metadata to SubjectMetadata
 */
function mapSubjectMetadata(raw: unknown): SubjectMetadata {
  if (typeof raw !== 'object' || raw === null) {
    return {
      subjectId: '',
      subjectName: '',
      isCustom: false,
      customCategory: null,
      customCategoryDari: null,
    };
  }

  const data = raw as Record<string, unknown>;
  return {
    subjectId: String(data.subjectId ?? ''),
    subjectName: String(data.subjectName ?? ''),
    isCustom: Boolean(data.isCustom),
    customCategory: toStringOrNull(data.customCategory),
    customCategoryDari: toStringOrNull(data.customCategoryDari),
  };
}

/**
 * Maps raw teacher metadata to TeacherMetadata
 */
function mapTeacherMetadata(raw: unknown): TeacherMetadata {
  if (typeof raw !== 'object' || raw === null) {
    return {
      teacherId: '',
      teacherName: '',
      primarySubjects: [],
      maxPeriodsPerWeek: 0,
      classTeacherOf: [],
    };
  }

  const data = raw as Record<string, unknown>;
  return {
    teacherId: String(data.teacherId ?? ''),
    teacherName: String(data.teacherName ?? ''),
    primarySubjects: toStringArray(data.primarySubjects),
    maxPeriodsPerWeek: Number(data.maxPeriodsPerWeek ?? 0),
    classTeacherOf: toStringArray(data.classTeacherOf),
  };
}

/**
 * Maps raw period configuration to PeriodConfiguration
 */
function mapPeriodConfiguration(raw: unknown): PeriodConfiguration | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const periodsPerDayMap: Record<string, number> = {};

  if (typeof data.periodsPerDayMap === 'object' && data.periodsPerDayMap !== null) {
    for (const [key, value] of Object.entries(data.periodsPerDayMap as Record<string, unknown>)) {
      periodsPerDayMap[key] = Number(value ?? 0);
    }
  }

  return {
    periodsPerDayMap,
    totalPeriodsPerWeek: Number(data.totalPeriodsPerWeek ?? 0),
    daysOfWeek: toStringArray(data.daysOfWeek),
    hasVariablePeriods: Boolean(data.hasVariablePeriods),
  };
}

/**
 * Maps raw metadata to SolutionMetadata
 */
function mapMetadata(raw: unknown): SolutionMetadata | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Record<string, unknown>;
  return {
    classes: Array.isArray(data.classes) ? data.classes.map(mapClassMetadata) : [],
    subjects: Array.isArray(data.subjects) ? data.subjects.map(mapSubjectMetadata) : [],
    teachers: Array.isArray(data.teachers) ? data.teachers.map(mapTeacherMetadata) : [],
    periodConfiguration: mapPeriodConfiguration(data.periodConfiguration),
  };
}

/**
 * Maps raw statistics to SolutionStatistics
 */
function mapStatistics(raw: unknown): SolutionStatistics | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const categoryCounts: Record<string, number> = {};
  if (typeof data.categoryCounts === 'object' && data.categoryCounts !== null) {
    for (const [key, value] of Object.entries(data.categoryCounts as Record<string, unknown>)) {
      categoryCounts[key] = Number(value ?? 0);
    }
  }

  const customSubjectsByCategory: Record<string, number> = {};
  if (typeof data.customSubjectsByCategory === 'object' && data.customSubjectsByCategory !== null) {
    for (const [key, value] of Object.entries(
      data.customSubjectsByCategory as Record<string, unknown>
    )) {
      customSubjectsByCategory[key] = Number(value ?? 0);
    }
  }

  return {
    totalClasses: Number(data.totalClasses ?? 0),
    singleTeacherClasses: Number(data.singleTeacherClasses ?? 0),
    multiTeacherClasses: Number(data.multiTeacherClasses ?? 0),
    totalSubjects: Number(data.totalSubjects ?? 0),
    customSubjects: Number(data.customSubjects ?? 0),
    standardSubjects: Number(data.standardSubjects ?? 0),
    totalTeachers: Number(data.totalTeachers ?? 0),
    totalRooms: Number(data.totalRooms ?? 0),
    categoryCounts,
    customSubjectsByCategory,
    totalLessons: Number(data.totalLessons ?? 0),
    periodsPerWeek: Number(data.periodsPerWeek ?? 0),
    solveTimeSeconds: toNumberOrNull(data.solveTimeSeconds),
    strategy: toStringOrNull(data.strategy),
    numConstraintsApplied: toNumberOrNull(data.numConstraintsApplied),
    qualityScore: toNumberOrNull(data.qualityScore),
  };
}

/**
 * Normalizes an API timetable response into structured schedule data
 *
 * @param response - Raw API response containing timetable data
 * @returns Normalized schedule with lessons, metadata, and statistics
 * @throws ScheduleTransformError if the data field is malformed JSON
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export function normalizeSchedule(response: TimetableApiResponse): NormalizedSchedule {
  logger.debug('Normalizing schedule', { id: response.id, name: response.name });

  // Parse JSON data field (handle both string and already-parsed object)
  let solverOutput: RawSolverOutput;
  try {
    // If data is already an object, use it directly
    if (typeof response.data === 'object' && response.data !== null) {
      solverOutput = response.data as RawSolverOutput;
      logger.debug('Using already-parsed data object', {
        hasSchedule: Array.isArray(solverOutput.schedule),
        scheduleLength: Array.isArray(solverOutput.schedule) ? solverOutput.schedule.length : 0,
        hasMetadata: !!solverOutput.metadata,
        metadataKeys: solverOutput.metadata ? Object.keys(solverOutput.metadata) : [],
      });
    } else if (typeof response.data === 'string') {
      // If data is a string, parse it
      solverOutput = JSON.parse(response.data) as RawSolverOutput;
      logger.debug('Parsed data from JSON string', {
        hasSchedule: Array.isArray(solverOutput.schedule),
        scheduleLength: Array.isArray(solverOutput.schedule) ? solverOutput.schedule.length : 0,
        hasMetadata: !!solverOutput.metadata,
      });
    } else {
      throw new Error(`Invalid data type: ${typeof response.data}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new ScheduleTransformError(`Failed to parse schedule data: ${message}`);
  }

  // Map schedule array to ScheduledLesson objects
  const lessons: ScheduledLesson[] = [];
  if (Array.isArray(solverOutput.schedule)) {
    for (let i = 0; i < solverOutput.schedule.length; i++) {
      lessons.push(mapLesson(solverOutput.schedule[i], i));
    }
  }

  // Extract and structure metadata
  const metadata = mapMetadata(solverOutput.metadata);

  // Map statistics
  const statistics = mapStatistics(solverOutput.statistics);

  logger.debug('Schedule normalized', {
    lessonsCount: lessons.length,
    hasMetadata: metadata !== null,
    hasStatistics: statistics !== null,
  });

  return {
    lessons,
    metadata,
    statistics,
  };
}

/**
 * Serializes a NormalizedSchedule back to the format stored in API data field
 * Used for round-trip testing
 */
export function serializeSchedule(schedule: NormalizedSchedule): string {
  const output: RawSolverOutput = {
    schedule: schedule.lessons.map((lesson) => ({
      day: lesson.day,
      periodIndex: lesson.periodIndex,
      classId: lesson.classId,
      className: lesson.className,
      subjectId: lesson.subjectId,
      subjectName: lesson.subjectName,
      teacherIds: lesson.teacherIds,
      teacherNames: lesson.teacherNames,
      roomId: lesson.roomId,
      roomName: lesson.roomName,
      isFixed: lesson.isFixed,
      periodsThisDay: lesson.periodsThisDay,
    })),
    metadata: schedule.metadata
      ? {
          classes: schedule.metadata.classes.map((c) => ({
            classId: c.classId,
            className: c.className,
            gradeLevel: c.gradeLevel,
            category: c.category,
            categoryDari: c.categoryDari,
            studentCount: c.studentCount,
            singleTeacherMode: c.singleTeacherMode,
            classTeacherId: c.classTeacherId,
            classTeacherName: c.classTeacherName,
            classTeacherSubjects: c.classTeacherSubjects,
          })),
          subjects: schedule.metadata.subjects.map((s) => ({
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            isCustom: s.isCustom,
            customCategory: s.customCategory,
            customCategoryDari: s.customCategoryDari,
          })),
          teachers: schedule.metadata.teachers.map((t) => ({
            teacherId: t.teacherId,
            teacherName: t.teacherName,
            primarySubjects: t.primarySubjects,
            maxPeriodsPerWeek: t.maxPeriodsPerWeek,
            classTeacherOf: t.classTeacherOf,
          })),
          periodConfiguration: schedule.metadata.periodConfiguration
            ? {
                periodsPerDayMap: schedule.metadata.periodConfiguration.periodsPerDayMap,
                totalPeriodsPerWeek: schedule.metadata.periodConfiguration.totalPeriodsPerWeek,
                daysOfWeek: schedule.metadata.periodConfiguration.daysOfWeek,
                hasVariablePeriods: schedule.metadata.periodConfiguration.hasVariablePeriods,
              }
            : null,
        }
      : undefined,
    statistics: schedule.statistics
      ? {
          totalClasses: schedule.statistics.totalClasses,
          singleTeacherClasses: schedule.statistics.singleTeacherClasses,
          multiTeacherClasses: schedule.statistics.multiTeacherClasses,
          totalSubjects: schedule.statistics.totalSubjects,
          customSubjects: schedule.statistics.customSubjects,
          standardSubjects: schedule.statistics.standardSubjects,
          totalTeachers: schedule.statistics.totalTeachers,
          totalRooms: schedule.statistics.totalRooms,
          categoryCounts: schedule.statistics.categoryCounts,
          customSubjectsByCategory: schedule.statistics.customSubjectsByCategory,
          totalLessons: schedule.statistics.totalLessons,
          periodsPerWeek: schedule.statistics.periodsPerWeek,
          solveTimeSeconds: schedule.statistics.solveTimeSeconds,
          strategy: schedule.statistics.strategy,
          numConstraintsApplied: schedule.statistics.numConstraintsApplied,
          qualityScore: schedule.statistics.qualityScore,
        }
      : undefined,
    status: 'SUCCESS',
  };

  return JSON.stringify(output);
}
