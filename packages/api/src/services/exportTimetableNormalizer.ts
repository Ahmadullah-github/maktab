const DEFAULT_DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

interface NameLookups {
  classNames?: Map<string, string>;
  teacherNames?: Map<string, string>;
  subjectNames?: Map<string, string>;
  roomNames?: Map<string, string>;
}

interface RawMetadataEntry {
  [key: string]: unknown;
}

export interface ExportPeriodConfiguration {
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number>;
  totalPeriodsPerWeek: number;
  hasVariablePeriods: boolean;
  periodTimelineByDay: Record<
    string,
    Array<{ periodIndex: number; startTime: string; endTime: string }>
  >;
  breakIntervalsByDay: Record<
    string,
    Array<{
      kind: 'regular' | 'prayer';
      name?: string;
      startTime: string;
      endTime: string;
      duration: number;
      afterPeriod?: number;
    }>
  >;
}

export interface ExportLesson {
  day: string | number;
  periodIndex: number;
  classId: string | null;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  teacherIds: string[];
  teacherNames: string[];
  roomId: string | null;
  roomName: string | null;
  isFixed: boolean;
  periodsThisDay: number | null;
}

export interface ExportTimetableData {
  lessons: ExportLesson[];
  metadata?: {
    classes?: RawMetadataEntry[];
    teachers?: RawMetadataEntry[];
    subjects?: RawMetadataEntry[];
    periodConfiguration?: RawMetadataEntry | null;
  };
  statistics?: Record<string, unknown> | null;
  periodConfiguration: ExportPeriodConfiguration;
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isCharacterMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([key, entryValue]) => /^\d+$/.test(key) && typeof entryValue === 'string');
}

function reconstructCharacterMap(value: Record<string, string>): string {
  return Object.keys(value)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => value[key])
    .join('');
}

function extractLeadingJsonValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const root = trimmed[0];
  if (root !== '{' && root !== '[') {
    return null;
  }

  const opening = root;
  const closing = root === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === opening) {
      depth++;
    } else if (char === closing) {
      depth--;
      if (depth === 0) {
        return trimmed.slice(0, index + 1);
      }
    }
  }

  return null;
}

function parseStoredTimetableData(rawData: unknown): Record<string, any> {
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    if (isCharacterMap(rawData)) {
      return parseStoredTimetableData(reconstructCharacterMap(rawData));
    }

    return rawData as Record<string, any>;
  }

  if (typeof rawData !== 'string') {
    return {};
  }

  const parsed = tryParseJson(rawData);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (isCharacterMap(parsed)) {
      return parseStoredTimetableData(reconstructCharacterMap(parsed));
    }

    return parsed as Record<string, any>;
  }

  const trimmed = rawData.trim();
  if (!trimmed) {
    return {};
  }

  const rootChar = trimmed[0];
  const lastStructuredEnd = rootChar === '[' ? trimmed.lastIndexOf(']') : trimmed.lastIndexOf('}');
  if (lastStructuredEnd > 0) {
    const trimmedParsed = tryParseJson(trimmed.slice(0, lastStructuredEnd + 1));
    if (trimmedParsed && typeof trimmedParsed === 'object' && !Array.isArray(trimmedParsed)) {
      return trimmedParsed as Record<string, any>;
    }
  }

  const extracted = extractLeadingJsonValue(trimmed);
  if (extracted) {
    const extractedParsed = tryParseJson(extracted);
    if (extractedParsed && typeof extractedParsed === 'object' && !Array.isArray(extractedParsed)) {
      return extractedParsed as Record<string, any>;
    }
  }

  return {};
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toOptionalString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function toMetadataEntries(value: unknown): RawMetadataEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is RawMetadataEntry =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  );
}

function buildMetadataLookup(
  entries: RawMetadataEntry[],
  idKeys: string[],
  nameKeys: string[]
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const entry of entries) {
    const id = idKeys.map((key) => toOptionalString(entry[key])).find(Boolean);
    const name = nameKeys.map((key) => toOptionalString(entry[key])).find(Boolean);

    if (id && name) {
      lookup.set(id, name);
    }
  }

  return lookup;
}

function normalizeLesson(
  rawLesson: Record<string, unknown>,
  metadataLookups: NameLookups
): ExportLesson | null {
  const subjectId = toOptionalString(rawLesson.subjectId);
  const teacherIds = toStringArray(rawLesson.teacherIds).length
    ? toStringArray(rawLesson.teacherIds)
    : toOptionalString(rawLesson.teacherId)
      ? [String(rawLesson.teacherId)]
      : [];
  const roomId = toOptionalString(rawLesson.roomId);
  const classId = toOptionalString(rawLesson.classId);
  const periodIndex = Number(rawLesson.periodIndex);

  if (!Number.isFinite(periodIndex)) {
    return null;
  }

  const singularTeacherName =
    toOptionalString(rawLesson.teacherName) ??
    (rawLesson.teacher && typeof rawLesson.teacher === 'object'
      ? toOptionalString((rawLesson.teacher as Record<string, unknown>).name)
      : null);
  const teacherNames =
    toStringArray(rawLesson.teacherNames).length > 0
      ? toStringArray(rawLesson.teacherNames)
      : singularTeacherName
        ? [singularTeacherName]
        : teacherIds
            .map((teacherId) => metadataLookups.teacherNames?.get(teacherId) ?? null)
            .filter((name): name is string => Boolean(name));

  const nestedSubjectName =
    rawLesson.subject && typeof rawLesson.subject === 'object'
      ? toOptionalString((rawLesson.subject as Record<string, unknown>).name)
      : null;
  const nestedRoomName =
    rawLesson.room && typeof rawLesson.room === 'object'
      ? toOptionalString((rawLesson.room as Record<string, unknown>).name)
      : null;

  return {
    day: typeof rawLesson.day === 'string' || typeof rawLesson.day === 'number' ? rawLesson.day : 0,
    periodIndex,
    classId,
    className:
      toOptionalString(rawLesson.className) ??
      (classId ? (metadataLookups.classNames?.get(classId) ?? null) : null),
    subjectId,
    subjectName:
      toOptionalString(rawLesson.subjectName) ??
      nestedSubjectName ??
      toOptionalString(rawLesson.subject) ??
      (subjectId ? (metadataLookups.subjectNames?.get(subjectId) ?? null) : null),
    teacherIds,
    teacherNames,
    roomId,
    roomName:
      toOptionalString(rawLesson.roomName) ??
      nestedRoomName ??
      toOptionalString(rawLesson.room) ??
      (roomId ? (metadataLookups.roomNames?.get(roomId) ?? null) : null),
    isFixed: Boolean(rawLesson.isFixed),
    periodsThisDay:
      rawLesson.periodsThisDay === undefined || rawLesson.periodsThisDay === null
        ? null
        : Number(rawLesson.periodsThisDay),
  };
}

function inferLessonsFromGrid(rawData: Record<string, any>): ExportLesson[] {
  const lessons: ExportLesson[] = [];

  for (const [dayKey, dayData] of Object.entries(rawData)) {
    if (!dayData || typeof dayData !== 'object' || Array.isArray(dayData)) {
      continue;
    }

    for (const [periodKey, cellData] of Object.entries(dayData)) {
      if (!cellData || typeof cellData !== 'object' || Array.isArray(cellData)) {
        continue;
      }

      const rawCell = cellData as Record<string, unknown>;
      lessons.push({
        day: Number.isNaN(Number(dayKey)) ? dayKey : Number(dayKey),
        periodIndex: Number(periodKey),
        classId: toOptionalString(rawCell.classId),
        className: toOptionalString(rawCell.className),
        subjectId: toOptionalString(rawCell.subjectId),
        subjectName: toOptionalString(rawCell.subjectName) ?? toOptionalString(rawCell.subject),
        teacherIds: toStringArray(rawCell.teacherIds).length
          ? toStringArray(rawCell.teacherIds)
          : toOptionalString(rawCell.teacherId)
            ? [String(rawCell.teacherId)]
            : [],
        teacherNames: (() => {
          const teacherName =
            toOptionalString(rawCell.teacherName) ?? toOptionalString(rawCell.teacher);
          if (toStringArray(rawCell.teacherNames).length) {
            return toStringArray(rawCell.teacherNames);
          }
          return teacherName ? [teacherName] : [];
        })(),
        roomId: toOptionalString(rawCell.roomId),
        roomName: toOptionalString(rawCell.roomName) ?? toOptionalString(rawCell.room),
        isFixed: Boolean(rawCell.isFixed),
        periodsThisDay: null,
      });
    }
  }

  return lessons;
}

function normalizePeriodConfiguration(
  value: unknown,
  lessons: ExportLesson[]
): ExportPeriodConfiguration {
  const config =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const configuredDays = Array.isArray(config?.daysOfWeek)
    ? config?.daysOfWeek.map((entry) => String(entry))
    : [];
  const daysOfWeek = configuredDays.length > 0 ? configuredDays : DEFAULT_DAYS_OF_WEEK;

  const configuredMap =
    config?.periodsPerDayMap && typeof config.periodsPerDayMap === 'object'
      ? (config.periodsPerDayMap as Record<string, unknown>)
      : {};

  const periodOffset = detectPeriodOffset(lessons);
  const inferredMap: Record<string, number> = {};

  for (const lesson of lessons) {
    const dayKey = normalizeDayKey(lesson.day, daysOfWeek, lessons);
    if (!dayKey) {
      continue;
    }

    const periodsThisDay =
      lesson.periodsThisDay && Number.isFinite(lesson.periodsThisDay)
        ? lesson.periodsThisDay
        : lesson.periodIndex + (periodOffset === 0 ? 1 : 0);
    inferredMap[dayKey] = Math.max(inferredMap[dayKey] ?? 0, periodsThisDay);
  }

  const periodsPerDayMap: Record<string, number> = {};
  for (const day of daysOfWeek) {
    const configuredValue = Number(configuredMap[day] ?? 0);
    periodsPerDayMap[day] = configuredValue > 0 ? configuredValue : (inferredMap[day] ?? 0);
  }

  const maxPeriods = Math.max(...Object.values(periodsPerDayMap), 0);
  for (const day of daysOfWeek) {
    if (!periodsPerDayMap[day]) {
      periodsPerDayMap[day] = maxPeriods || 8;
    }
  }

  const totalPeriodsPerWeek = Object.values(periodsPerDayMap).reduce(
    (sum, count) => sum + count,
    0
  );
  const uniqueCounts = new Set(Object.values(periodsPerDayMap));

  return {
    daysOfWeek,
    periodsPerDayMap,
    totalPeriodsPerWeek,
    hasVariablePeriods: uniqueCounts.size > 1,
    periodTimelineByDay: normalizePeriodTimelineByDay(config?.periodTimelineByDay),
    breakIntervalsByDay: normalizeBreakIntervalsByDay(config?.breakIntervalsByDay),
  };
}

function normalizePeriodTimelineByDay(
  value: unknown
): ExportPeriodConfiguration['periodTimelineByDay'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ExportPeriodConfiguration['periodTimelineByDay'] = {};
  for (const [day, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    result[day] = entries.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const candidate = entry as Record<string, unknown>;
      if (
        !Number.isInteger(candidate.periodIndex) ||
        Number(candidate.periodIndex) < 0 ||
        typeof candidate.startTime !== 'string' ||
        typeof candidate.endTime !== 'string'
      ) {
        return [];
      }
      return [
        {
          periodIndex: Number(candidate.periodIndex),
          startTime: candidate.startTime,
          endTime: candidate.endTime,
        },
      ];
    });
  }
  return result;
}

function normalizeBreakIntervalsByDay(
  value: unknown
): ExportPeriodConfiguration['breakIntervalsByDay'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ExportPeriodConfiguration['breakIntervalsByDay'] = {};
  for (const [day, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    result[day] = entries.flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const candidate = entry as Record<string, unknown>;
      if (
        (candidate.kind !== 'regular' && candidate.kind !== 'prayer') ||
        typeof candidate.startTime !== 'string' ||
        typeof candidate.endTime !== 'string' ||
        !Number.isInteger(candidate.duration) ||
        Number(candidate.duration) <= 0
      ) {
        return [];
      }
      return [
        {
          kind: candidate.kind,
          name: typeof candidate.name === 'string' ? candidate.name : undefined,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          duration: Number(candidate.duration),
          afterPeriod:
            Number.isInteger(candidate.afterPeriod) && Number(candidate.afterPeriod) > 0
              ? Number(candidate.afterPeriod)
              : undefined,
        },
      ];
    });
  }
  return result;
}

function detectPeriodOffset(lessons: ExportLesson[]): 0 | 1 {
  return lessons.some((lesson) => lesson.periodIndex === 0) ? 0 : 1;
}

function detectDayOffset(lessons: ExportLesson[]): 0 | 1 {
  return lessons.some((lesson) => typeof lesson.day === 'number' && lesson.day === 0) ? 0 : 1;
}

function normalizeDayKey(
  day: string | number,
  daysOfWeek: string[],
  lessons: ExportLesson[]
): string | null {
  if (typeof day === 'string') {
    return day;
  }

  const dayOffset = detectDayOffset(lessons);
  const normalizedIndex = dayOffset === 0 ? day : day - 1;
  return daysOfWeek[normalizedIndex] ?? null;
}

export function normalizeTimetableForExport(
  rawData: unknown,
  lookups: NameLookups = {}
): ExportTimetableData {
  const parsed = parseStoredTimetableData(rawData);
  const metadata =
    parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : undefined;

  const metadataClassLookups = buildMetadataLookup(
    toMetadataEntries(metadata?.classes),
    ['classId', 'id'],
    ['className', 'name', 'fullName']
  );
  const metadataTeacherLookups = buildMetadataLookup(
    toMetadataEntries(metadata?.teachers),
    ['teacherId', 'id'],
    ['teacherName', 'name', 'fullName']
  );
  const metadataSubjectLookups = buildMetadataLookup(
    toMetadataEntries(metadata?.subjects),
    ['subjectId', 'id'],
    ['subjectName', 'name']
  );

  const mergedLookups: NameLookups = {
    classNames: new Map([
      ...(metadataClassLookups.entries() || []),
      ...(lookups.classNames?.entries() || []),
    ]),
    teacherNames: new Map([
      ...(metadataTeacherLookups.entries() || []),
      ...(lookups.teacherNames?.entries() || []),
    ]),
    subjectNames: new Map([
      ...(metadataSubjectLookups.entries() || []),
      ...(lookups.subjectNames?.entries() || []),
    ]),
    roomNames: new Map([...(lookups.roomNames?.entries() || [])]),
  };

  let lessons: ExportLesson[] = [];
  if (Array.isArray(parsed.lessons)) {
    lessons = parsed.lessons
      .map((lesson) =>
        lesson && typeof lesson === 'object'
          ? normalizeLesson(lesson as Record<string, unknown>, mergedLookups)
          : null
      )
      .filter((lesson): lesson is ExportLesson => Boolean(lesson));
  } else if (Array.isArray(parsed.schedule)) {
    lessons = parsed.schedule
      .map((lesson) =>
        lesson && typeof lesson === 'object'
          ? normalizeLesson(lesson as Record<string, unknown>, mergedLookups)
          : null
      )
      .filter((lesson): lesson is ExportLesson => Boolean(lesson));
  } else {
    lessons = inferLessonsFromGrid(parsed);
  }

  const periodConfiguration = normalizePeriodConfiguration(
    parsed.periodConfiguration ?? metadata?.periodConfiguration,
    lessons
  );

  return {
    lessons,
    metadata: metadata
      ? {
          classes: toMetadataEntries(metadata.classes),
          teachers: toMetadataEntries(metadata.teachers),
          subjects: toMetadataEntries(metadata.subjects),
          periodConfiguration:
            metadata.periodConfiguration &&
            typeof metadata.periodConfiguration === 'object' &&
            !Array.isArray(metadata.periodConfiguration)
              ? (metadata.periodConfiguration as RawMetadataEntry)
              : null,
        }
      : undefined,
    statistics:
      parsed.statistics &&
      typeof parsed.statistics === 'object' &&
      !Array.isArray(parsed.statistics)
        ? (parsed.statistics as Record<string, unknown>)
        : null,
    periodConfiguration,
  };
}

export function getExportLessons(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined
): ExportLesson[] {
  if (!timetableData || typeof timetableData !== 'object') {
    return [];
  }

  if (Array.isArray((timetableData as ExportTimetableData).lessons)) {
    return (timetableData as ExportTimetableData).lessons;
  }

  return inferLessonsFromGrid(timetableData as Record<string, any>);
}

export function getDaysOfWeek(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined
): string[] {
  if (
    timetableData &&
    typeof timetableData === 'object' &&
    (timetableData as ExportTimetableData).periodConfiguration?.daysOfWeek?.length
  ) {
    return (timetableData as ExportTimetableData).periodConfiguration.daysOfWeek;
  }

  return DEFAULT_DAYS_OF_WEEK;
}

export function getPeriodsPerDayMap(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined
): Record<string, number> {
  if (
    timetableData &&
    typeof timetableData === 'object' &&
    (timetableData as ExportTimetableData).periodConfiguration?.periodsPerDayMap
  ) {
    return (timetableData as ExportTimetableData).periodConfiguration.periodsPerDayMap;
  }

  const lessons = getExportLessons(timetableData);
  return normalizePeriodConfiguration(null, lessons).periodsPerDayMap;
}

export function getMaxPeriods(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined
): number {
  const counts = Object.values(getPeriodsPerDayMap(timetableData));
  return Math.max(...counts, 0);
}

export function getPeriodTimeRange(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined,
  day: string,
  periodIndex: number
): { startTime: string; endTime: string } | null {
  const entries =
    timetableData && typeof timetableData === 'object'
      ? (timetableData as ExportTimetableData).periodConfiguration?.periodTimelineByDay?.[day]
      : undefined;
  const entry = Array.isArray(entries)
    ? entries.find((candidate) => candidate.periodIndex === periodIndex)
    : undefined;
  return entry ? { startTime: entry.startTime, endTime: entry.endTime } : null;
}

export function getBreakIntervals(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined,
  day: string
): ExportPeriodConfiguration['breakIntervalsByDay'][string] {
  if (!timetableData || typeof timetableData !== 'object') return [];
  const intervals = (timetableData as ExportTimetableData).periodConfiguration
    ?.breakIntervalsByDay?.[day];
  return Array.isArray(intervals) ? intervals : [];
}

function dayMatches(
  lessonDay: string | number,
  requestedDayIndex: number,
  daysOfWeek: string[],
  lessons: ExportLesson[]
): boolean {
  if (typeof lessonDay === 'string') {
    return daysOfWeek[requestedDayIndex] === lessonDay;
  }

  const dayOffset = detectDayOffset(lessons);
  const normalizedDay = dayOffset === 0 ? lessonDay : lessonDay - 1;
  return normalizedDay === requestedDayIndex;
}

function periodMatches(
  lessonPeriodIndex: number,
  requestedPeriodNumber: number,
  lessons: ExportLesson[]
): boolean {
  const periodOffset = detectPeriodOffset(lessons);
  const normalizedPeriod = periodOffset === 0 ? lessonPeriodIndex + 1 : lessonPeriodIndex;
  return normalizedPeriod === requestedPeriodNumber;
}

export function getLessonForSlot(
  timetableData: ExportTimetableData | Record<string, any> | null | undefined,
  dayIndex: number,
  periodNumber: number
): ExportLesson | null {
  const lessons = getExportLessons(timetableData);
  if (lessons.length > 0) {
    const daysOfWeek = getDaysOfWeek(timetableData);
    return (
      lessons.find(
        (lesson) =>
          dayMatches(lesson.day, dayIndex, daysOfWeek, lessons) &&
          periodMatches(lesson.periodIndex, periodNumber, lessons)
      ) ?? null
    );
  }

  if (!timetableData || typeof timetableData !== 'object') {
    return null;
  }

  const dayKey = String(dayIndex);
  const periodKey = String(periodNumber);
  const rawCell = (timetableData as Record<string, any>)[dayKey]?.[periodKey];

  if (!rawCell || typeof rawCell !== 'object') {
    return null;
  }

  return {
    day: dayIndex,
    periodIndex: periodNumber,
    classId: toOptionalString(rawCell.classId),
    className: toOptionalString(rawCell.className),
    subjectId: toOptionalString(rawCell.subjectId),
    subjectName: toOptionalString(rawCell.subjectName) ?? toOptionalString(rawCell.subject),
    teacherIds: toStringArray(rawCell.teacherIds).length
      ? toStringArray(rawCell.teacherIds)
      : toOptionalString(rawCell.teacherId)
        ? [String(rawCell.teacherId)]
        : [],
    teacherNames: toStringArray(rawCell.teacherNames).length
      ? toStringArray(rawCell.teacherNames)
      : (toOptionalString(rawCell.teacherName) ?? toOptionalString(rawCell.teacher))
        ? [String(rawCell.teacherName ?? rawCell.teacher)]
        : [],
    roomId: toOptionalString(rawCell.roomId),
    roomName: toOptionalString(rawCell.roomName) ?? toOptionalString(rawCell.room),
    isFixed: Boolean(rawCell.isFixed),
    periodsThisDay: null,
  };
}

export function filterTimetableForTarget(
  timetableData: ExportTimetableData,
  targetType: 'class' | 'teacher',
  targetId: string
): ExportTimetableData {
  const normalizedTargetId = String(targetId);

  return {
    ...timetableData,
    lessons: timetableData.lessons.filter((lesson) =>
      targetType === 'class'
        ? lesson.classId === normalizedTargetId
        : lesson.teacherIds.includes(normalizedTargetId)
    ),
  };
}

export function resolveTargetName(
  timetableData: ExportTimetableData,
  targetType: 'class' | 'teacher',
  targetId: string,
  fallbackName: string
): string {
  const normalizedTargetId = String(targetId);
  const entries =
    targetType === 'class' ? timetableData.metadata?.classes : timetableData.metadata?.teachers;
  const idKey = targetType === 'class' ? 'classId' : 'teacherId';
  const nameKey = targetType === 'class' ? 'className' : 'teacherName';

  const match = entries?.find((entry) => String(entry[idKey] ?? '') === normalizedTargetId);
  const resolvedName = toOptionalString(match?.[nameKey]);

  return resolvedName ?? fallbackName;
}
