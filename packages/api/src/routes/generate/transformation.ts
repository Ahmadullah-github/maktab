/**
 * Data transformation helpers for solver input
 * @module routes/generate/transformation
 */

const DEFAULT_DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/**
 * Convert availability from 2D array format to Dict[DayOfWeek, List[bool]] format
 */
export const convertAvailabilityFormat = (
  availability: any,
  daysOfWeek: string[],
  defaultPeriodsPerDay: number = 7
): Record<string, boolean[]> => {
  const createDefaultAvailability = (): Record<string, boolean[]> => {
    const result: Record<string, boolean[]> = {};
    for (const day of daysOfWeek) {
      result[day] = Array(defaultPeriodsPerDay).fill(true);
    }
    return result;
  };

  if (
    !availability ||
    (typeof availability === 'object' && Object.keys(availability).length === 0)
  ) {
    return createDefaultAvailability();
  }

  if (typeof availability === 'object' && !Array.isArray(availability)) {
    const result: Record<string, boolean[]> = {};
    for (const [key, value] of Object.entries(availability)) {
      const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
      result[normalizedKey] = value as boolean[];
    }

    for (const day of daysOfWeek) {
      if (!result[day]) {
        result[day] = Array(defaultPeriodsPerDay).fill(true);
      }
    }
    return result;
  }

  if (Array.isArray(availability)) {
    const result: Record<string, boolean[]> = {};
    for (let dayIndex = 0; dayIndex < daysOfWeek.length; dayIndex++) {
      const dayName = daysOfWeek[dayIndex];
      result[dayName] = availability[dayIndex] || Array(defaultPeriodsPerDay).fill(true);
    }
    return result;
  }

  return createDefaultAvailability();
};

/**
 * Transform unavailable slots to use day names instead of indices
 */
export const transformUnavailable = (unavailable: any[], daysOfWeek: string[]): any[] => {
  if (!Array.isArray(unavailable) || unavailable.length === 0) {
    return [];
  }

  const dayIndexToName = (dayIndex: number): string => {
    return daysOfWeek[dayIndex] || daysOfWeek[0];
  };

  const byDay: Record<string, number[]> = {};

  for (const slot of unavailable) {
    let dayName: string;

    if (typeof slot.day === 'number') {
      dayName = dayIndexToName(slot.day);
    } else if (typeof slot.day === 'string') {
      dayName = slot.day.charAt(0).toUpperCase() + slot.day.slice(1).toLowerCase();
    } else {
      continue;
    }

    if (!byDay[dayName]) {
      byDay[dayName] = [];
    }

    if (typeof slot.period === 'number') {
      byDay[dayName].push(slot.period);
    } else if (Array.isArray(slot.periods)) {
      byDay[dayName].push(...slot.periods);
    }
  }

  return Object.entries(byDay).map(([day, periods]) => ({
    day,
    periods: [...new Set(periods)].sort((a, b) => a - b),
  }));
};

/**
 * Normalize time preference to valid enum value
 */
export const normalizeTimePreference = (pref: string | null | undefined): string => {
  if (!pref) return 'None';
  const lower = pref.toLowerCase();
  if (lower === 'morning') return 'Morning';
  if (lower === 'afternoon') return 'Afternoon';
  return 'None';
};

/**
 * Transform data to match solver's Pydantic model expectations
 */
export const transformForSolver = (
  data: any,
  daysOfWeek: string[] = DEFAULT_DAYS_OF_WEEK,
  defaultPeriodsPerDay: number = 7
): any => {
  const teachers = (data.teachers || []).map((t: any) => ({
    id: String(t.id),
    fullName: t.fullName,
    primarySubjectIds: (t.primarySubjectIds || t.subjects || []).map((id: any) => String(id)),
    allowedSubjectIds: t.allowedSubjectIds?.map((id: any) => String(id)) || [],
    restrictToPrimarySubjects: t.restrictToPrimarySubjects ?? true,
    availability: convertAvailabilityFormat(t.availability, daysOfWeek, defaultPeriodsPerDay),
    unavailable: transformUnavailable(t.unavailable || [], daysOfWeek),
    maxPeriodsPerWeek: t.maxPeriodsPerWeek || 30,
    maxPeriodsPerDay: t.maxPeriodsPerDay,
    maxConsecutivePeriods: t.maxConsecutivePeriods,
    timePreference: normalizeTimePreference(t.timePreference),
    preferredRoomIds: (t.preferredRoomIds || []).map((id: any) => String(id)),
    gender: t.gender,
  }));

  const subjects = (data.subjects || []).map((s: any) => ({
    id: String(s.id),
    name: s.name,
    code: s.code,
    requiredRoomType: s.requiredRoomType || s.roomType,
    requiredFeatures: s.requiredFeatures || [],
    desiredFeatures: s.desiredFeatures || [],
    isDifficult: s.isDifficult || false,
    minRoomCapacity: s.minRoomCapacity,
    isCustom: s.isCustom || false,
    customCategory: s.customCategory,
  }));

  const rooms = (data.rooms || []).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    capacity: r.capacity || 0,
    type: r.type || 'classroom',
    features: r.features || [],
    unavailable: transformUnavailable(r.unavailable || [], daysOfWeek),
  }));

  const classes = (data.classes || []).map((c: any) => ({
    id: String(c.id),
    name: c.name,
    studentCount: c.studentCount || 0,
    gradeLevel: c.gradeLevel,
    category: c.category,
    singleTeacherMode: c.singleTeacherMode || false,
    classTeacherId: c.classTeacherId != null ? String(c.classTeacherId) : undefined,
    fixedRoomId: c.fixedRoomId != null ? String(c.fixedRoomId) : undefined,
    gender: c.gender,
    subjectRequirements: Array.isArray(c.subjectRequirements)
      ? c.subjectRequirements.length === 0
        ? {}
        : c.subjectRequirements.reduce((acc: any, req: any) => {
            acc[String(req.subjectId)] = {
              periodsPerWeek: req.periodsPerWeek || 0,
              minConsecutive: req.minConsecutive,
              maxConsecutive: req.maxConsecutive,
              minDaysPerWeek: req.minDaysPerWeek,
              maxDaysPerWeek: req.maxDaysPerWeek,
            };
            return acc;
          }, {})
      : c.subjectRequirements || {},
  }));

  return {
    ...data,
    teachers,
    subjects,
    rooms,
    classes,
  };
};

/**
 * Merge SchoolConfig into solver input data
 */
export const mergeSchoolConfig = (data: any, schoolConfig: any | null): any => {
  const daysOfWeek = schoolConfig?.daysOfWeek ?? DEFAULT_DAYS_OF_WEEK;
  const defaultPeriodsPerDay = schoolConfig?.defaultPeriodsPerDay ?? 7;

  let periodsPerDayMap = data.config?.periodsPerDayMap ?? schoolConfig?.periodsPerDayMap;
  if (!periodsPerDayMap) {
    periodsPerDayMap = Object.fromEntries(
      daysOfWeek.map((day: string) => [day, defaultPeriodsPerDay])
    );
  }

  const mergedConfig = {
    daysOfWeek: data.config?.daysOfWeek ?? daysOfWeek,
    periodsPerDay: data.config?.periodsPerDay ?? defaultPeriodsPerDay,
    periodsPerDayMap: periodsPerDayMap,
    schoolStartTime: data.config?.schoolStartTime ?? schoolConfig?.schoolStartTime ?? '07:30',
    periodDurationMinutes: data.config?.periodDurationMinutes ?? schoolConfig?.periodDuration ?? 45,
    timezone: data.config?.timezone ?? schoolConfig?.timezone ?? 'Asia/Kabul',
    ramadanModeEnabled: schoolConfig?.ramadanModeEnabled ?? false,
    ramadanPeriodDuration: schoolConfig?.ramadanPeriodDuration,
    ramadanBreakConfig: schoolConfig?.ramadanBreakConfig,
    enableMinistryValidation: schoolConfig?.enableMinistryValidation ?? false,
    ministryValidationMode: schoolConfig?.ministryValidationMode,
    customCurriculumMode: schoolConfig?.customCurriculumMode ?? false,
    lowResourceMode: schoolConfig?.lowResourceMode ?? false,
    categoryPeriodsPerDayMap: schoolConfig?.categoryPeriodsEnabled
      ? schoolConfig?.categoryPeriodsMap
      : null,
    prayerBreaks: schoolConfig?.prayerBreaks,
    shifts: schoolConfig?.shiftsConfig ? [schoolConfig.shiftsConfig] : null,
    ...data.config,
  };

  return {
    ...data,
    config: mergedConfig,
  };
};
