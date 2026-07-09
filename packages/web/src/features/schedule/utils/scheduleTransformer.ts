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
 * Extracts the canonical solver fields from a loosely typed object.
 * This lets us preserve explicit top-level fields when repairing legacy
 * character-indexed payloads that may also contain newer overrides.
 */
function extractSolverFields(value: Record<string, unknown>): Partial<RawSolverOutput> {
  const fields: Partial<RawSolverOutput> = {};

  if ('schedule' in value) fields.schedule = value.schedule;
  if ('metadata' in value) fields.metadata = value.metadata as RawSolverOutput['metadata'];
  if ('statistics' in value) fields.statistics = value.statistics;
  if ('status' in value) {
    fields.status = typeof value.status === 'string' ? value.status : undefined;
  }
  if ('errors' in value) {
    fields.errors = Array.isArray(value.errors) ? value.errors.map(String) : undefined;
  }

  return fields;
}

/**
 * Detects legacy timetable payloads that were accidentally spread from a string,
 * producing objects like { "0": "{", "1": "\"", ... }.
 */
function getSerializedJsonFromCharacterMap(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(([key]) => /^\d+$/.test(key));
  if (entries.length === 0) {
    return null;
  }

  const isCharacterMap = entries.every(
    ([, char]) => typeof char === 'string' && char.length === 1
  );
  if (!isCharacterMap) {
    return null;
  }

  return entries
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, char]) => char)
    .join('');
}

/**
 * Coerces the persisted timetable `data` field into a usable solver output object.
 * Handles normal JSON strings, already-parsed objects, and legacy character-indexed
 * objects caused by spreading a raw JSON string.
 */
export function parseScheduleDataField(data: TimetableApiResponse['data']): RawSolverOutput {
  let current: unknown = data;
  let explicitFields: Partial<RawSolverOutput> = {};

  for (let attempt = 0; attempt < 3; attempt++) {
    const serialized = getSerializedJsonFromCharacterMap(current);
    if (serialized !== null) {
      logger.warn('Recovered legacy character-indexed timetable payload');

      if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
        explicitFields = {
          ...extractSolverFields(current as Record<string, unknown>),
          ...explicitFields,
        };
      }

      current = serialized;
      continue;
    }

    if (typeof current === 'string') {
      try {
        current = JSON.parse(current);
        continue;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        throw new ScheduleTransformError(`Failed to parse schedule data: ${message}`);
      }
    }

    if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
      return {
        ...(current as RawSolverOutput),
        ...explicitFields,
      };
    }

    throw new ScheduleTransformError(
      `Failed to parse schedule data: Invalid data type: ${typeof current}`
    );
  }

  throw new ScheduleTransformError('Failed to parse schedule data: Maximum parse depth exceeded');
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

function mapBreakPeriods(raw: unknown): Array<{ afterPeriod: number; duration: number }> {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
    .map((value) => ({
      afterPeriod: Number(value.afterPeriod ?? 0),
      duration: Number(value.duration ?? 0),
    }))
    .filter((value) => Number.isFinite(value.afterPeriod) && Number.isFinite(value.duration));
}

function mapNestedPeriodsMap(raw: unknown): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  if (typeof raw !== 'object' || raw === null) {
    return result;
  }

  for (const [category, dayMap] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof dayMap !== 'object' || dayMap === null) {
      continue;
    }

    result[category] = {};
    for (const [day, periods] of Object.entries(dayMap as Record<string, unknown>)) {
      result[category][day] = Number(periods ?? 0);
    }
  }

  return result;
}

function mapBreakPeriodsByDay(raw: unknown): Record<string, Array<{ afterPeriod: number; duration: number }>> {
  const result: Record<string, Array<{ afterPeriod: number; duration: number }>> = {};

  if (typeof raw !== 'object' || raw === null) {
    return result;
  }

  for (const [day, breakList] of Object.entries(raw as Record<string, unknown>)) {
    result[day] = mapBreakPeriods(breakList);
  }

  return result;
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
      requiredRoomType: null,
      isDifficult: false,
    };
  }

  const data = raw as Record<string, unknown>;
  return {
    subjectId: String(data.subjectId ?? ''),
    subjectName: String(data.subjectName ?? ''),
    isCustom: Boolean(data.isCustom),
    customCategory: toStringOrNull(data.customCategory),
    customCategoryDari: toStringOrNull(data.customCategoryDari),
    requiredRoomType: toStringOrNull(data.requiredRoomType),
    isDifficult: typeof data.isDifficult === 'boolean' ? data.isDifficult : false,
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
      availability: undefined,
      timePreference: 'None',
      maxConsecutivePeriods: undefined,
    };
  }

  const data = raw as Record<string, unknown>;
  const availability =
    typeof data.availability === 'object' && data.availability !== null
      ? (data.availability as Partial<Record<DayOfWeek, boolean[]>>)
      : undefined;
  const timePreference =
    data.timePreference === 'Morning' ||
    data.timePreference === 'Afternoon' ||
    data.timePreference === 'None'
      ? data.timePreference
      : 'None';

  return {
    teacherId: String(data.teacherId ?? ''),
    teacherName: String(data.teacherName ?? ''),
    primarySubjects: toStringArray(data.primarySubjects),
    maxPeriodsPerWeek: Number(data.maxPeriodsPerWeek ?? 0),
    classTeacherOf: toStringArray(data.classTeacherOf),
    availability,
    timePreference,
    maxConsecutivePeriods:
      typeof data.maxConsecutivePeriods === 'number' ? data.maxConsecutivePeriods : undefined,
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
    categoryPeriodsPerDayMap: mapNestedPeriodsMap(data.categoryPeriodsPerDayMap),
    breakPeriodsDefault: mapBreakPeriods(data.breakPeriodsDefault),
    breakPeriodsByDay: mapBreakPeriodsByDay(data.breakPeriodsByDay),
    hasVariableBreaks: Boolean(data.hasVariableBreaks),
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

  const solverOutput = parseScheduleDataField(response.data);

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
                categoryPeriodsPerDayMap:
                  schedule.metadata.periodConfiguration.categoryPeriodsPerDayMap ?? {},
                breakPeriodsDefault: schedule.metadata.periodConfiguration.breakPeriodsDefault ?? [],
                breakPeriodsByDay: schedule.metadata.periodConfiguration.breakPeriodsByDay ?? {},
                hasVariableBreaks:
                  schedule.metadata.periodConfiguration.hasVariableBreaks ?? false,
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
