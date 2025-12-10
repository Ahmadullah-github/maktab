// schema.ts
import { z } from 'zod';

export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}
// --------------------
// Primitives & helpers
// --------------------
const ID = z.string().min(1, { message: 'ID must be a non-empty string' });
const PeriodIndex = z.number().int().nonnegative();
const DayOfWeekSchema = z.nativeEnum(DayOfWeek);
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

// helper to add Zod issues
function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path,
  });
}

// --------------------
// Period & Config
// --------------------
const PeriodSchema = z.object({
  index: z.number().int().gte(0),
  startTime: z.string().regex(timeRegex, { message: 'startTime must be in HH:mm format' }).optional(),
  endTime: z.string().regex(timeRegex, { message: 'endTime must be in HH:mm format' }).optional(),
  duration: z.number().int().positive().optional(),
  isBreak: z.boolean().optional(),
});

const BreakPeriodConfigSchema = z.object({
  afterPeriod: z.number().int().min(1).max(12),
  duration: z.number().int().min(0).max(120), // 0 = no break
});

const GlobalConfigSchema = z.object({
  daysOfWeek: z.array(DayOfWeekSchema).min(1),
  periodsPerDay: z.number().int().positive(),
  schoolStartTime: z.string().regex(timeRegex).optional(),
  periodDurationMinutes: z.number().int().positive().optional(),
  periods: z.array(PeriodSchema).optional(),
  breakPeriods: z.array(BreakPeriodConfigSchema).optional(), // Variable duration breaks
  timezone: z.string().optional(),
});

// --------------------
// Global Preferences (weights)
// --------------------
// All soft prefs are numeric weights; a value of 0 disables that objective.
// Add only 1 boolean for capability toggles (e.g., allowConsecutivePeriods).
const GlobalPreferencesSchema = z.object({
  // Weights: larger => more important (defaults chosen reasonably)
  avoidTeacherGapsWeight: z.number().nonnegative().default(1.0),
  avoidClassGapsWeight: z.number().nonnegative().default(1.0),
  distributeDifficultSubjectsWeight: z.number().nonnegative().default(0.8),
  balanceTeacherLoadWeight: z.number().nonnegative().default(0.7),
  minimizeRoomChangesWeight: z.number().nonnegative().default(0.3),
  preferMorningForDifficultWeight: z.number().nonnegative().default(0.5),
  respectTeacherTimePreferenceWeight: z.number().nonnegative().default(0.5),
  respectTeacherRoomPreferenceWeight: z.number().nonnegative().default(0.2),

  // Capability toggles (not optimization weights)
  allowConsecutivePeriodsForSameSubject: z.boolean().default(true),

  // New soft objectives
  avoidFirstLastPeriodWeight: z.number().nonnegative().default(0),
  subjectSpreadWeight: z.number().nonnegative().default(0),
});

// --------------------
// Rooms, Subjects
// --------------------
const RoomSchema = z.object({
  id: ID,
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  type: z.string(),
  features: z.array(z.string()).optional(),
  unavailable: z
    .array(
      z.object({
        day: z.union([DayOfWeekSchema, z.string()]), // weekday or ISO date
        periods: z.array(PeriodIndex),
      })
    )
    .optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const SubjectSchema = z.object({
  id: ID,
  name: z.string().min(1),
  code: z.string().optional(),
  requiredRoomType: z.union([z.string(), z.null()]).optional(),
  requiredFeatures: z.array(z.string()).optional(),
  desiredFeatures: z.array(z.string()).optional(),
  isDifficult: z.boolean().optional(),
  minRoomCapacity: z.number().int().positive().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// --------------------
// Teachers & Classes
// --------------------
const TeacherSchema = z.object({
  id: ID,
  fullName: z.string().min(1),

  primarySubjectIds: z.array(ID).min(1, { message: 'Teacher must have at least one primary subject' }),
  allowedSubjectIds: z.array(ID).optional(),
  restrictToPrimarySubjects: z.boolean().optional(),

  // Availability: boolean[] per weekday. Length validated in superRefine
  availability: z.record(DayOfWeekSchema, z.array(z.boolean())),

  unavailable: z
    .array(
      z.object({
        day: z.union([DayOfWeekSchema, z.string()]),
        periods: z.array(PeriodIndex),
      })
    )
    .optional(),

  maxPeriodsPerWeek: z.number().int().nonnegative(),
  maxPeriodsPerDay: z.number().int().nonnegative().optional(),
  maxConsecutivePeriods: z.number().int().nonnegative().optional(),
  timePreference: z.enum(['Morning', 'Afternoon', 'None']).optional(),
  preferredRoomIds: z.array(ID).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const SubjectRequirementSchema = z.object({
  periodsPerWeek: z.number().int().nonnegative(),
  minConsecutive: z.number().int().positive().optional(),
  maxConsecutive: z.number().int().positive().optional(),
  minDaysPerWeek: z.number().int().positive().optional(),
  maxDaysPerWeek: z.number().int().positive().optional(),
});

const ClassGroupSchema = z.object({
  id: ID,
  name: z.string().min(1),
  studentCount: z.number().int().nonnegative(),
  subjectRequirements: z.record(ID, SubjectRequirementSchema),
  singleTeacherMode: z.boolean().optional(), // One teacher teaches all subjects (Alpha-Primary)
  classTeacherId: ID.optional(), // Class teacher/supervisor (استاد نگران)
  meta: z.record(z.string(), z.unknown()).optional(),
});

// --------------------
// Events & Lessons
// --------------------
// SchoolEvent simplified: 'day' is either a weekday (recurring weekly) or a specific ISO date.
const SchoolEventSchema = z.object({
  id: ID.optional(),
  name: z.string().min(1),
  day: z.union([DayOfWeekSchema, z.string().regex(isoDateRegex, { message: 'Date must be YYYY-MM-DD' })]),
  periods: z.array(PeriodIndex),
  // Optional date-range bounds for weekly events (if provided, weekly event only applies between these dates)
  startDate: z.string().regex(isoDateRegex).optional(),
  endDate: z.string().regex(isoDateRegex).optional(),
  appliesToClassIds: z.array(ID).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const BaseLessonSchema = z.object({
  day: DayOfWeekSchema,
  periodIndex: PeriodIndex,
  classId: ID,
  subjectId: ID,
  teacherIds: z.array(ID).min(1),
  roomId: ID.optional(),
});

const FixedLessonSchema = BaseLessonSchema.extend({
  id: ID.optional(),
  createdBy: z.string().optional(),
  note: z.string().optional(),
});

// --------------------
// Output-types: diagnostics & scheduled lessons
// --------------------
const ConstraintViolationSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const TeacherAssignmentSchema = z.object({
  teacherId: ID,
  role: z.enum(['lead', 'assistant', 'substitute']).optional(),
});

export const ScheduledLessonSchema = BaseLessonSchema.extend({
  id: ID.optional(),
  teacherAssignments: z.array(TeacherAssignmentSchema).optional(),
  isFixed: z.boolean().optional(),
  solverScoreDelta: z.number().optional(),
  conflicts: z.array(ConstraintViolationSchema).optional(),
});

// --------------------
// TimetableData schema + modular superRefine validations
// --------------------
export const TimetableDataSchema = z
  .object({
    meta: z
      .object({
        academicYear: z.string().optional(),
        term: z.string().optional(),
        createdAt: z.string().datetime({ offset: true }).optional(),
        version: z.string().optional(),
      })
      .optional(),
    config: GlobalConfigSchema,
    preferences: GlobalPreferencesSchema.optional(),
    rooms: z.array(RoomSchema).min(1),
    subjects: z.array(SubjectSchema).min(1),
    teachers: z.array(TeacherSchema).min(1),
    classes: z.array(ClassGroupSchema).min(1),
    fixedLessons: z.array(FixedLessonSchema).optional(),
    schoolEvents: z.array(SchoolEventSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Compute effective periods per day
    const effectivePeriodsPerDay = (data.config.periods && data.config.periods.length) ?? data.config.periodsPerDay;
    const validDays = new Set(Object.values(DayOfWeek));

    // Helper validators separated for readability and easier unit testing
    const validateConfigPeriods = () => {
      if (!data.config.periods) return;
      const seen = new Set<number>();
      for (let i = 0; i < data.config.periods.length; i++) {
        const p = data.config.periods[i];
        if (p.index < 0 || p.index >= data.config.periods.length) {
          addIssue(ctx, ['config', 'periods', i], `period index ${p.index} out of range 0..${data.config.periods.length - 1}`);
        }
        if (seen.has(p.index)) {
          addIssue(ctx, ['config', 'periods', i], `duplicate period.index ${p.index}`);
        } else {
          seen.add(p.index);
        }
      }
    };

    const validateTeacherAvailabilityAndUnavailable = () => {
      for (let tIdx = 0; tIdx < data.teachers.length; tIdx++) {
        const teacher = data.teachers[tIdx];

        // Ensure keys are only configured weekdays and that each day has a boolean[] of correct length
        for (const day of data.config.daysOfWeek) {
          const arr = (teacher.availability as Record<string, boolean[]>)[day];
          if (!arr) {
            addIssue(ctx, ['teachers', tIdx, 'availability', day], `Missing availability for teacher "${teacher.id}" on "${day}"`);
            continue;
          }
          if (!Array.isArray(arr)) {
            addIssue(ctx, ['teachers', tIdx, 'availability', day], `availability[${day}] for teacher "${teacher.id}" must be an array of booleans`);
            continue;
          }
          if (arr.length !== effectivePeriodsPerDay) {
            addIssue(ctx, ['teachers', tIdx, 'availability', day], `availability[${day}] length (${arr.length}) must equal effective periodsPerDay (${effectivePeriodsPerDay})`);
          }
          for (let p = 0; p < arr.length; p++) {
            if (typeof arr[p] !== 'boolean') {
              addIssue(ctx, ['teachers', tIdx, 'availability', day, p], `availability[${day}][${p}] must be boolean for teacher "${teacher.id}"`);
            }
          }
        }

        // Validate teacher.unavailable indices
        if (teacher.unavailable) {
          for (let uIdx = 0; uIdx < teacher.unavailable.length; uIdx++) {
            const u = teacher.unavailable[uIdx];
            const dayVal = typeof u.day === 'string' ? u.day : (u.day as any);
            if (!validDays.has(dayVal) && !isoDateRegex.test(String(dayVal))) {
              addIssue(ctx, ['teachers', tIdx, 'unavailable', uIdx, 'day'], `teacher.unavailable[${uIdx}].day must be weekday or ISO date`);
            }
            for (const p of u.periods) {
              if (p < 0 || p >= effectivePeriodsPerDay) {
                addIssue(ctx, ['teachers', tIdx, 'unavailable', uIdx, 'periods'], `teacher.unavailable[${uIdx}] period ${p} out of range`);
              }
            }
          }
        }
      }
    };

    const validateRoomsUnavailable = () => {
      for (let rIdx = 0; rIdx < data.rooms.length; rIdx++) {
        const room = data.rooms[rIdx];
        if (!room.unavailable) continue;
        for (let uIdx = 0; uIdx < room.unavailable.length; uIdx++) {
          const u = room.unavailable[uIdx];
          for (const p of u.periods) {
            if (p < 0 || p >= effectivePeriodsPerDay) {
              addIssue(ctx, ['rooms', rIdx, 'unavailable', uIdx, 'periods'], `rooms[${room.id}].unavailable[${uIdx}] period ${p} out of range`);
            }
          }
        }
      }
    };

    const validateSchoolEvents = () => {
      if (!data.schoolEvents) return;
      for (let evIdx = 0; evIdx < data.schoolEvents.length; evIdx++) {
        const ev = data.schoolEvents[evIdx];
        // day can be weekday or ISO date string: check ISO date format when string and not a weekday
        if (typeof ev.day === 'string' && !validDays.has(ev.day as DayOfWeek) && !isoDateRegex.test(ev.day)) {
          addIssue(ctx, ['schoolEvents', evIdx, 'day'], `schoolEvents[${evIdx}].day must be a weekday or ISO date YYYY-MM-DD`);
        }
        for (const p of ev.periods) {
          if (p < 0 || p >= effectivePeriodsPerDay) {
            addIssue(ctx, ['schoolEvents', evIdx, 'periods'], `schoolEvents[${evIdx}].periods contains ${p} out of range`);
          }
        }
        if (ev.startDate && !isoDateRegex.test(ev.startDate)) {
          addIssue(ctx, ['schoolEvents', evIdx, 'startDate'], `startDate must be YYYY-MM-DD`);
        }
        if (ev.endDate && !isoDateRegex.test(ev.endDate)) {
          addIssue(ctx, ['schoolEvents', evIdx, 'endDate'], `endDate must be YYYY-MM-DD`);
        }
      }
    };

    const validateFixedLessons = () => {
      if (!data.fixedLessons) return;
      for (let fIdx = 0; fIdx < data.fixedLessons.length; fIdx++) {
        const f = data.fixedLessons[fIdx];
        if (!validDays.has(f.day)) {
          addIssue(ctx, ['fixedLessons', fIdx, 'day'], `fixedLessons[${fIdx}].day "${f.day}" must be a weekday`);
        }
        if (f.periodIndex < 0 || f.periodIndex >= effectivePeriodsPerDay) {
          addIssue(ctx, ['fixedLessons', fIdx, 'periodIndex'], `fixedLessons[${fIdx}].periodIndex ${f.periodIndex} out of range`);
        }
      }
    };

    const validateUniqueIds = () => {
      const checkUnique = (arr: { id?: string }[] | undefined, basePath: string[]) => {
        if (!arr) return;
        const s = new Set<string>();
        arr.forEach((it, idx) => {
          if (!it.id) return;
          if (s.has(it.id)) {
            addIssue(ctx, [...basePath, idx, 'id'], `Duplicate id "${it.id}" in ${basePath.join('.')}`);
          } else {
            s.add(it.id);
          }
        });
      };
      checkUnique(data.rooms, ['rooms']);
      checkUnique(data.subjects, ['subjects']);
      checkUnique(data.teachers, ['teachers']);
      checkUnique(data.classes, ['classes']);
      checkUnique(data.fixedLessons as any, ['fixedLessons']);
      checkUnique(data.schoolEvents as any, ['schoolEvents']);
    };

    const validateReferentialIntegrity = () => {
      const subjectIds = new Set(data.subjects.map((s) => s.id));
      const teacherIds = new Set(data.teachers.map((t) => t.id));
      const roomIds = new Set(data.rooms.map((r) => r.id));
      const classIds = new Set(data.classes.map((c) => c.id));

      // Helper function to check if a teacher can teach a subject (mirrors Python solver's can_teach function)
      const canTeach = (teacher: any, subjectId: string): boolean => {
        // Check primary subjects
        if (teacher.primarySubjectIds.includes(subjectId)) {
          return true;
        }
        
        // If restrictToPrimarySubjects is true or not set (defaults to true in Python), only primary subjects are allowed
        const restrictToPrimary = teacher.restrictToPrimarySubjects !== undefined ? teacher.restrictToPrimarySubjects : true;
        if (restrictToPrimary) {
          return false;
        }
        
        // If restrictToPrimarySubjects is false, check allowed subjects
        if (teacher.allowedSubjectIds && teacher.allowedSubjectIds.includes(subjectId)) {
          return true;
        }
        
        return false;
      };

      // teacher subject references
      for (let tIdx = 0; tIdx < data.teachers.length; tIdx++) {
        const t = data.teachers[tIdx];
        for (const sid of t.primarySubjectIds) {
          if (!subjectIds.has(sid)) {
            addIssue(ctx, ['teachers', tIdx, 'primarySubjectIds'], `teachers[${tIdx}].primarySubjectIds references unknown subject id "${sid}"`);
          }
        }
        if (t.allowedSubjectIds) {
          for (const sid of t.allowedSubjectIds) {
            if (!subjectIds.has(sid)) {
              addIssue(ctx, ['teachers', tIdx, 'allowedSubjectIds'], `teachers[${tIdx}].allowedSubjectIds references unknown subject id "${sid}"`);
            }
          }
        }
        
        // Validate restrictToPrimarySubjects logic (aligns with Python solver's can_teach function)
        if (t.restrictToPrimarySubjects !== undefined && t.restrictToPrimarySubjects === true) {
          // When restrictToPrimarySubjects is true, allowedSubjectIds should not be used
          // This is a warning, not an error, as the Python solver handles this gracefully
          if (t.allowedSubjectIds && t.allowedSubjectIds.length > 0) {
            addIssue(ctx, ['teachers', tIdx], `teachers[${tIdx}] has restrictToPrimarySubjects=true but also has allowedSubjectIds defined. Only primarySubjectIds will be considered.`);
          }
        }
      }

      // class subjectRequirements keys and classTeacherId validation
      for (let cIdx = 0; cIdx < data.classes.length; cIdx++) {
        const cls = data.classes[cIdx];
        const keys = Object.keys(cls.subjectRequirements);
        for (const k of keys) {
          if (!subjectIds.has(k)) {
            addIssue(ctx, ['classes', cIdx, 'subjectRequirements', k], `classes[${cIdx}].subjectRequirements references unknown subject id "${k}"`);
          }
        }
        // sanity check: total weekly periods <= max available slots
        const totalRequired = keys.reduce((acc, k) => acc + (cls.subjectRequirements[k].periodsPerWeek ?? 0), 0);
        const maxSlots = (data.config.daysOfWeek?.length ?? 0) * effectivePeriodsPerDay;
        if (totalRequired > maxSlots) {
          addIssue(ctx, ['classes', cIdx, 'subjectRequirements'], `classes[${cIdx}] requires ${totalRequired} periods/week but only ${maxSlots} slots available (days * periodsPerDay)`);
        }
        
        // Validate that there is at least one teacher who can teach each required subject
        for (const subjectId of keys) {
          const canBeTaught = data.teachers.some(teacher => canTeach(teacher, subjectId));
          if (!canBeTaught) {
            addIssue(ctx, ['classes', cIdx, 'subjectRequirements', subjectId], `classes[${cIdx}] requires subject "${subjectId}" but no teacher can teach it based on their primarySubjectIds/allowedSubjectIds and restrictToPrimarySubjects setting`);
          }
        }
        
        // Validate classTeacherId references a valid teacher
        if (cls.classTeacherId && !teacherIds.has(cls.classTeacherId)) {
          addIssue(ctx, ['classes', cIdx, 'classTeacherId'], `classes[${cIdx}].classTeacherId "${cls.classTeacherId}" does not exist`);
        }
        
        // Validate class teacher can teach at least one subject (when not in singleTeacherMode)
        if (cls.classTeacherId && !cls.singleTeacherMode) {
          const classTeacher = data.teachers.find(t => t.id === cls.classTeacherId);
          if (classTeacher) {
            const canTeachAny = keys.some(subjectId => canTeach(classTeacher, subjectId));
            if (!canTeachAny) {
              addIssue(ctx, ['classes', cIdx, 'classTeacherId'], `classes[${cIdx}].classTeacherId "${cls.classTeacherId}" cannot teach any of the class's required subjects`);
            }
          }
        }
      }

      // validate fixedLessons reference ids
      if (data.fixedLessons) {
        for (let fIdx = 0; fIdx < data.fixedLessons.length; fIdx++) {
          const f = data.fixedLessons[fIdx];
          if (!classIds.has(f.classId)) addIssue(ctx, ['fixedLessons', fIdx, 'classId'], `fixedLessons[${fIdx}].classId "${f.classId}" does not exist`);
          if (!subjectIds.has(f.subjectId)) addIssue(ctx, ['fixedLessons', fIdx, 'subjectId'], `fixedLessons[${fIdx}].subjectId "${f.subjectId}" does not exist`);
          for (let i = 0; i < f.teacherIds.length; i++) {
            const tid = f.teacherIds[i];
            if (!teacherIds.has(tid)) addIssue(ctx, ['fixedLessons', fIdx, 'teacherIds', i], `fixedLessons[${fIdx}].teacherIds[${i}] "${tid}" does not exist`);
          }
          if (f.roomId && !roomIds.has(f.roomId)) addIssue(ctx, ['fixedLessons', fIdx, 'roomId'], `fixedLessons[${fIdx}].roomId "${f.roomId}" does not exist`);
        }
      }

      // schoolEvents appliesToClassIds
      if (data.schoolEvents) {
        for (let eIdx = 0; eIdx < data.schoolEvents.length; eIdx++) {
          const ev = data.schoolEvents[eIdx];
          if (ev.appliesToClassIds) {
            for (let ci = 0; ci < ev.appliesToClassIds.length; ci++) {
              const cid = ev.appliesToClassIds[ci];
              if (!classIds.has(cid)) addIssue(ctx, ['schoolEvents', eIdx, 'appliesToClassIds', ci], `schoolEvents[${eIdx}].appliesToClassIds[${ci}] "${cid}" does not exist`);
            }
          }
        }
      }

      // subjects require room types that may not exist (warning)
      const roomTypeSet = new Set(data.rooms.map((r) => r.type));
      data.subjects.forEach((s, sIdx) => {
        if (s.requiredRoomType && !roomTypeSet.has(s.requiredRoomType)) {
          addIssue(ctx, ['subjects', sIdx, 'requiredRoomType'], `subjects[${sIdx}].requiredRoomType="${s.requiredRoomType}" but no room of that type exists`);
        }
      });
    };

    // Execute validators (keeps superRefine readable)
    validateConfigPeriods();
    validateTeacherAvailabilityAndUnavailable();
    validateRoomsUnavailable();
    validateSchoolEvents();
    validateFixedLessons();
    validateUniqueIds();
    validateReferentialIntegrity();
  });

// Export types and parser
export type TimetableData = z.infer<typeof TimetableDataSchema>;

/**
 * parseTimetableData
 * Validates & returns typed TimetableData or throws ZodError with issues
 */
export function parseTimetableData(payload: unknown): TimetableData {
  return TimetableDataSchema.parse(payload);
}
