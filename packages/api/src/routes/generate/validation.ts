/**
 * Pre-validation logic for solver input
 * @module routes/generate/validation
 */

import { PreValidationError } from './types';

const DEFAULT_DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function getTeacherCapabilityIds(teacher: any): string[] {
  const primary = Array.isArray(teacher.primarySubjectIds) ? teacher.primarySubjectIds : [];
  const allowed = Array.isArray(teacher.allowedSubjectIds) ? teacher.allowedSubjectIds : [];
  return [...new Set([...primary, ...allowed].map((subjectId: any) => String(subjectId)))];
}

/**
 * Pre-validate data before sending to solver
 * Returns user-friendly errors for data issues that need to be fixed
 */
export const preValidateData = (data: any, schoolConfig?: any | null): PreValidationError[] => {
  const errors: PreValidationError[] = [];

  // Check teachers
  validateTeachers(data, errors);

  // Check classes
  validateClasses(data, errors);

  // Check rooms
  validateRooms(data, errors);

  // Check subjects
  validateSubjects(data, errors);

  // Check for missing room types
  validateRoomTypes(data, errors);

  // Check for qualified teachers
  validateQualifiedTeachers(data, errors);

  // Check class period allocation
  validateClassPeriods(data, schoolConfig, errors);

  // Check teacher overload
  validateTeacherLoad(data, errors);

  // Check single-teacher mode
  validateSingleTeacherMode(data, errors);

  return errors;
};

function validateTeachers(data: any, errors: PreValidationError[]): void {
  const teachers = data.teachers || [];

  if (teachers.length === 0) {
    errors.push({
      error_code: 'NO_TEACHERS',
      severity: 'error',
      message_farsi: 'هیچ استادی تعریف نشده است',
      message_english: 'No teachers have been defined',
      affected_entities: [],
      suggestion_farsi: 'لطفاً استادان را اضافه کنید',
      suggestion_english: 'Please add teachers',
    });
    return;
  }

  const teachersWithoutSubjects = teachers.filter(
    (t: any) => getTeacherCapabilityIds(t).length === 0
  );

  if (teachersWithoutSubjects.length > 0) {
    errors.push({
      error_code: 'TEACHER_NO_SUBJECTS',
      severity: 'error',
      message_farsi: `${teachersWithoutSubjects.length} استاد بدون مضمون تدریسی یافت شد`,
      message_english: `${teachersWithoutSubjects.length} teacher(s) found without any teaching subjects`,
      affected_entities: teachersWithoutSubjects.map((t: any) => ({
        entity_type: 'teacher',
        entity_id: String(t.id),
        entity_name: t.fullName || `Teacher ${t.id}`,
      })),
      suggestion_farsi: 'لطفاً برای هر استاد حداقل یک مضمون تدریسی تعیین کنید',
      suggestion_english: 'Please assign at least one teaching subject to each teacher',
    });
  }
}

function validateClasses(data: any, errors: PreValidationError[]): void {
  const classes = data.classes || [];

  if (classes.length === 0) {
    errors.push({
      error_code: 'NO_CLASSES',
      severity: 'error',
      message_farsi: 'هیچ صنفی تعریف نشده است',
      message_english: 'No classes have been defined',
      affected_entities: [],
      suggestion_farsi: 'لطفاً صنف‌ها را اضافه کنید',
      suggestion_english: 'Please add classes',
    });
    return;
  }

  const classesWithoutRequirements = classes.filter((c: any) => {
    const reqs = c.subjectRequirements;
    if (!reqs) return true;
    if (Array.isArray(reqs)) return reqs.length === 0;
    if (typeof reqs === 'object') return Object.keys(reqs).length === 0;
    return true;
  });

  if (classesWithoutRequirements.length > 0) {
    errors.push({
      error_code: 'CLASS_NO_SUBJECTS',
      severity: 'error',
      message_farsi: `${classesWithoutRequirements.length} صنف بدون مضامین درسی یافت شد`,
      message_english: `${classesWithoutRequirements.length} class(es) found without any subject requirements`,
      affected_entities: classesWithoutRequirements.map((c: any) => ({
        entity_type: 'class',
        entity_id: String(c.id),
        entity_name: c.name || `Class ${c.id}`,
      })),
      suggestion_farsi: 'لطفاً برای هر صنف مضامین درسی و ساعات هفتگی را تعیین کنید',
      suggestion_english: 'Please assign subjects and weekly periods to each class',
    });
  }
}

function validateRooms(data: any, errors: PreValidationError[]): void {
  const rooms = data.rooms || [];
  if (rooms.length === 0) {
    errors.push({
      error_code: 'NO_ROOMS',
      severity: 'error',
      message_farsi: 'هیچ اتاقی تعریف نشده است',
      message_english: 'No rooms have been defined',
      affected_entities: [],
      suggestion_farsi: 'لطفاً حداقل یک اتاق درسی اضافه کنید',
      suggestion_english: 'Please add at least one classroom',
    });
  }
}

function validateSubjects(data: any, errors: PreValidationError[]): void {
  const subjects = data.subjects || [];
  if (subjects.length === 0) {
    errors.push({
      error_code: 'NO_SUBJECTS',
      severity: 'error',
      message_farsi: 'هیچ مضمونی تعریف نشده است',
      message_english: 'No subjects have been defined',
      affected_entities: [],
      suggestion_farsi: 'لطفاً مضامین درسی را اضافه کنید',
      suggestion_english: 'Please add subjects to the curriculum',
    });
  }
}

function validateRoomTypes(data: any, errors: PreValidationError[]): void {
  const subjects = data.subjects || [];
  const rooms = data.rooms || [];

  if (subjects.length === 0 || rooms.length === 0) return;

  const availableRoomTypes = new Set<string>();
  for (const room of rooms) {
    if (room.type) {
      availableRoomTypes.add(room.type);
    }
  }

  const missingRoomTypes: Map<string, Array<{ id: string; name: string }>> = new Map();

  for (const subject of subjects) {
    const requiredRoomType = subject.requiredRoomType || subject.roomType;
    if (requiredRoomType && !availableRoomTypes.has(requiredRoomType)) {
      if (!missingRoomTypes.has(requiredRoomType)) {
        missingRoomTypes.set(requiredRoomType, []);
      }
      missingRoomTypes.get(requiredRoomType)!.push({
        id: String(subject.id),
        name: subject.name || `Subject ${subject.id}`,
      });
    }
  }

  for (const [roomType, affectedSubjects] of missingRoomTypes) {
    const subjectNames = affectedSubjects.map((s) => s.name);
    const subjectList =
      subjectNames.length <= 3
        ? subjectNames.join('، ')
        : `${subjectNames.slice(0, 3).join('، ')} و ${subjectNames.length - 3} مضمون دیگر`;

    errors.push({
      error_code: 'MISSING_ROOM_TYPE',
      severity: 'error',
      message_farsi:
        affectedSubjects.length === 1
          ? `مضمون '${subjectNames[0]}' به اتاق نوع '${roomType}' نیاز دارد، اما هیچ اتاقی از این نوع وجود ندارد`
          : `مضامین (${subjectList}) به اتاق نوع '${roomType}' نیاز دارند، اما هیچ اتاقی از این نوع وجود ندارد`,
      message_english:
        affectedSubjects.length === 1
          ? `Subject '${subjectNames[0]}' requires room type '${roomType}', but no room of this type exists`
          : `Subjects (${subjectNames.join(', ')}) require room type '${roomType}', but no room of this type exists`,
      affected_entities: affectedSubjects.map((s) => ({
        entity_type: 'subject',
        entity_id: s.id,
        entity_name: s.name,
      })),
      suggestion_farsi: `لطفاً یک اتاق از نوع '${roomType}' اضافه کنید یا نوع اتاق مورد نیاز مضامین را تغییر دهید`,
      suggestion_english: `Please add a room of type '${roomType}' or change the required room type for these subjects`,
    });
  }
}

function validateQualifiedTeachers(data: any, errors: PreValidationError[]): void {
  const subjects = data.subjects || [];
  const teachers = data.teachers || [];
  const classes = data.classes || [];

  if (subjects.length === 0 || teachers.length === 0 || classes.length === 0) return;

  const subjectTeachers: Map<string, string[]> = new Map();
  for (const teacher of teachers) {
    const teacherSubjects = getTeacherCapabilityIds(teacher);
    for (const subjectId of teacherSubjects) {
      const sid = String(subjectId);
      if (!subjectTeachers.has(sid)) {
        subjectTeachers.set(sid, []);
      }
      subjectTeachers.get(sid)!.push(teacher.fullName || `Teacher ${teacher.id}`);
    }
  }

  for (const cls of classes) {
    const reqs = cls.subjectRequirements;
    if (!reqs) continue;

    const subjectIds: string[] = Array.isArray(reqs)
      ? reqs.map((r: any) => String(r.subjectId))
      : Object.keys(reqs);

    for (const subjectId of subjectIds) {
      const qualifiedTeachers = subjectTeachers.get(subjectId) || [];
      if (qualifiedTeachers.length === 0) {
        const subject = subjects.find((s: any) => String(s.id) === subjectId);
        const subjectName = subject?.name || `Subject ${subjectId}`;

        errors.push({
          error_code: 'NO_QUALIFIED_TEACHER',
          severity: 'error',
          message_farsi: `برای مضمون '${subjectName}' در صنف '${cls.name}' استاد واجد شرایط وجود ندارد`,
          message_english: `No qualified teacher exists for subject '${subjectName}' in class '${cls.name}'`,
          affected_entities: [
            {
              entity_type: 'subject',
              entity_id: subjectId,
              entity_name: subjectName,
            },
            {
              entity_type: 'class',
              entity_id: String(cls.id),
              entity_name: cls.name || `Class ${cls.id}`,
            },
          ],
          suggestion_farsi: `لطفاً یک استاد به مضمون '${subjectName}' اختصاص دهید یا استاد جدید اضافه کنید`,
          suggestion_english: `Please assign a teacher to subject '${subjectName}' or add a new teacher`,
        });
      }
    }
  }
}

function validateClassPeriods(
  data: any,
  schoolConfig: any | null,
  errors: PreValidationError[]
): void {
  const classes = data.classes || [];
  const subjects = data.subjects || [];

  if (classes.length === 0 || subjects.length === 0) return;

  const config = data.config || {};
  const daysOfWeek = config.daysOfWeek || schoolConfig?.daysOfWeek || DEFAULT_DAYS_OF_WEEK;
  const periodsPerDay = schoolConfig?.defaultPeriodsPerDay || config.periodsPerDay || 7;
  const periodsPerDayMap = config.periodsPerDayMap || schoolConfig?.periodsPerDayMap;

  let totalAvailablePeriodsPerWeek: number;
  if (
    periodsPerDayMap &&
    typeof periodsPerDayMap === 'object' &&
    Object.keys(periodsPerDayMap).length > 0
  ) {
    totalAvailablePeriodsPerWeek = Object.values(periodsPerDayMap).reduce(
      (sum: number, p: any) => sum + (typeof p === 'number' ? p : 0),
      0
    );
  } else {
    totalAvailablePeriodsPerWeek = daysOfWeek.length * periodsPerDay;
  }

  for (const cls of classes) {
    const reqs = cls.subjectRequirements;
    if (!reqs) continue;

    let totalRequiredPeriods = 0;
    if (Array.isArray(reqs)) {
      totalRequiredPeriods = reqs.reduce((sum: number, r: any) => sum + (r.periodsPerWeek || 0), 0);
    } else if (typeof reqs === 'object') {
      totalRequiredPeriods = Object.values(reqs).reduce(
        (sum: number, r: any) => sum + ((r as any).periodsPerWeek || 0),
        0
      );
    }

    const className = cls.name || `Class ${cls.id}`;

    if (totalRequiredPeriods > totalAvailablePeriodsPerWeek) {
      const excess = totalRequiredPeriods - totalAvailablePeriodsPerWeek;
      errors.push({
        error_code: 'OVER_ALLOCATION_ERROR',
        severity: 'error',
        message_farsi: `صنف '${className}' به ${totalRequiredPeriods} ساعت نیاز دارد اما فقط ${totalAvailablePeriodsPerWeek} ساعت موجود است`,
        message_english: `Class '${className}' requires ${totalRequiredPeriods} periods but only ${totalAvailablePeriodsPerWeek} are available`,
        affected_entities: [
          {
            entity_type: 'class',
            entity_id: String(cls.id),
            entity_name: className,
          },
        ],
        suggestion_farsi: `لطفاً ساعات مضامین را ${excess} ساعت کاهش دهید یا برنامه هفتگی را افزایش دهید`,
        suggestion_english: `Please reduce subject periods by ${excess} or increase the weekly schedule`,
      });
    }

    if (totalRequiredPeriods < totalAvailablePeriodsPerWeek) {
      const gap = totalAvailablePeriodsPerWeek - totalRequiredPeriods;
      if (gap > 2) {
        errors.push({
          error_code: 'EMPTY_PERIODS_ERROR',
          severity: 'error',
          message_farsi: `صنف '${className}' دارای ${gap} ساعت خالی در هفته است (${totalRequiredPeriods} ساعت نیاز در مقابل ${totalAvailablePeriodsPerWeek} ساعت موجود)`,
          message_english: `Class '${className}' has ${gap} empty period(s) per week (${totalRequiredPeriods} required vs ${totalAvailablePeriodsPerWeek} available)`,
          affected_entities: [
            {
              entity_type: 'class',
              entity_id: String(cls.id),
              entity_name: className,
            },
          ],
          suggestion_farsi: `لطفاً ${gap} ساعت بیشتر به مضامین اضافه کنید یا برنامه هفتگی را کاهش دهید`,
          suggestion_english: `Please add ${gap} more period(s) to subjects or reduce the weekly schedule`,
        });
      }
    }
  }
}

function validateTeacherLoad(data: any, errors: PreValidationError[]): void {
  const teachers = data.teachers || [];
  const classes = data.classes || [];
  const subjects = data.subjects || [];

  if (teachers.length === 0 || classes.length === 0 || subjects.length === 0) return;

  const subjectTeacherMap: Map<
    string,
    Array<{ id: string; name: string; maxPeriods: number }>
  > = new Map();

  for (const teacher of teachers) {
    const teacherSubjects = getTeacherCapabilityIds(teacher);
    const maxPeriods = teacher.maxPeriodsPerWeek || 30;
    for (const subjectId of teacherSubjects) {
      const sid = String(subjectId);
      if (!subjectTeacherMap.has(sid)) {
        subjectTeacherMap.set(sid, []);
      }
      subjectTeacherMap.get(sid)!.push({
        id: String(teacher.id),
        name: teacher.fullName || `Teacher ${teacher.id}`,
        maxPeriods,
      });
    }
  }

  const teacherLoad: Map<string, { name: string; maxPeriods: number; estimatedLoad: number }> =
    new Map();
  for (const teacher of teachers) {
    teacherLoad.set(String(teacher.id), {
      name: teacher.fullName || `Teacher ${teacher.id}`,
      maxPeriods: teacher.maxPeriodsPerWeek || 30,
      estimatedLoad: 0,
    });
  }

  for (const cls of classes) {
    const reqs = cls.subjectRequirements;
    if (!reqs) continue;

    const requirements: Array<{ subjectId: string; periodsPerWeek: number }> = Array.isArray(reqs)
      ? reqs.map((r: any) => ({
          subjectId: String(r.subjectId),
          periodsPerWeek: r.periodsPerWeek || 0,
        }))
      : Object.entries(reqs).map(([subjectId, r]: [string, any]) => ({
          subjectId,
          periodsPerWeek: r.periodsPerWeek || 0,
        }));

    for (const req of requirements) {
      const qualifiedTeachers = subjectTeacherMap.get(req.subjectId) || [];
      if (qualifiedTeachers.length === 1) {
        const teacher = qualifiedTeachers[0];
        const load = teacherLoad.get(teacher.id);
        if (load) {
          load.estimatedLoad += req.periodsPerWeek;
        }
      } else if (qualifiedTeachers.length > 1) {
        const periodsPerTeacher = req.periodsPerWeek / qualifiedTeachers.length;
        for (const teacher of qualifiedTeachers) {
          const load = teacherLoad.get(teacher.id);
          if (load) {
            load.estimatedLoad += periodsPerTeacher;
          }
        }
      }
    }
  }

  for (const [teacherId, load] of teacherLoad) {
    const estimatedRounded = Math.ceil(load.estimatedLoad);
    if (estimatedRounded > load.maxPeriods) {
      errors.push({
        error_code: 'TEACHER_OVERLOAD_PREDICTED',
        severity: 'error',
        message_farsi: `استاد '${load.name}' بیشتر از ${load.maxPeriods} ساعت در هفته تدریس نمیتواند، اما ${estimatedRounded} ساعت نیاز است`,
        message_english: `Teacher '${load.name}' cannot teach more than ${load.maxPeriods} periods per week, but ${estimatedRounded} periods are required`,
        affected_entities: [
          {
            entity_type: 'teacher',
            entity_id: teacherId,
            entity_name: load.name,
          },
        ],
        suggestion_farsi: `لطفاً ساعات کاری استاد را افزایش دهید یا استاد جدید برای مضامین مشترک اضافه کنید`,
        suggestion_english: `Please increase teacher's max periods or add another teacher for shared subjects`,
      });
    }
  }
}

function validateSingleTeacherMode(data: any, errors: PreValidationError[]): void {
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  const classes = data.classes || [];

  for (const cls of classes) {
    if (!cls.singleTeacherMode || !cls.classTeacherId) continue;

    const classTeacher = teachers.find((t: any) => String(t.id) === String(cls.classTeacherId));
    const className = cls.name || `Class ${cls.id}`;

    if (!classTeacher) {
      errors.push({
        error_code: 'SINGLE_TEACHER_UNKNOWN_TEACHER',
        severity: 'error',
        message_farsi: `صنف '${className}' به شناسه استاد ناشناخته '${cls.classTeacherId}' ارجاع داده است`,
        message_english: `Class '${className}' references unknown teacher ID '${cls.classTeacherId}'`,
        affected_entities: [
          {
            entity_type: 'class',
            entity_id: String(cls.id),
            entity_name: className,
          },
        ],
        suggestion_farsi: 'لطفاً یک استاد معتبر برای این صنف تعیین کنید',
        suggestion_english: 'Please assign a valid teacher to this class',
      });
      continue;
    }

    const teacherName = classTeacher.fullName || `Teacher ${classTeacher.id}`;
    const teacherSubjects = new Set(getTeacherCapabilityIds(classTeacher));

    const reqs = cls.subjectRequirements;
    if (!reqs) continue;

    const classSubjectIds: string[] = Array.isArray(reqs)
      ? reqs.map((r: any) => String(r.subjectId))
      : Object.keys(reqs);

    const missingSubjects: string[] = [];
    for (const subjectId of classSubjectIds) {
      if (!teacherSubjects.has(subjectId)) {
        const subject = subjects.find((s: any) => String(s.id) === subjectId);
        missingSubjects.push(subject?.name || `Subject ${subjectId}`);
      }
    }

    if (missingSubjects.length > 0) {
      errors.push({
        error_code: 'SINGLE_TEACHER_MISSING_SUBJECTS',
        severity: 'error',
        message_farsi: `استاد '${teacherName}' به صنف '${className}' تعیین شده اما نمیتواند تدریس کند: ${missingSubjects.join('، ')}`,
        message_english: `Teacher '${teacherName}' is assigned to class '${className}' but cannot teach: ${missingSubjects.join(', ')}`,
        affected_entities: [
          {
            entity_type: 'teacher',
            entity_id: String(classTeacher.id),
            entity_name: teacherName,
          },
          {
            entity_type: 'class',
            entity_id: String(cls.id),
            entity_name: className,
          },
        ],
        suggestion_farsi: 'لطفاً صلاحیت‌های مضمون استاد را به‌روز کنید یا استاد دیگری تعیین کنید',
        suggestion_english:
          "Please update teacher's subject qualifications or assign a different teacher",
      });
    }

    const totalClassPeriods = Array.isArray(reqs)
      ? reqs.reduce((sum: number, r: any) => sum + (r.periodsPerWeek || 0), 0)
      : Object.values(reqs).reduce(
          (sum: number, r: any) => sum + ((r as any).periodsPerWeek || 0),
          0
        );

    const teacherMaxPeriods = classTeacher.maxPeriodsPerWeek || 30;
    if (totalClassPeriods > teacherMaxPeriods) {
      errors.push({
        error_code: 'SINGLE_TEACHER_MAX_PERIODS',
        severity: 'error',
        message_farsi: `استاد '${teacherName}' دارای حداکثر ${teacherMaxPeriods} ساعت است اما صنف '${className}' به ${totalClassPeriods} ساعت نیاز دارد`,
        message_english: `Teacher '${teacherName}' has max ${teacherMaxPeriods} periods but class '${className}' needs ${totalClassPeriods} periods`,
        affected_entities: [
          {
            entity_type: 'teacher',
            entity_id: String(classTeacher.id),
            entity_name: teacherName,
          },
          {
            entity_type: 'class',
            entity_id: String(cls.id),
            entity_name: className,
          },
        ],
        suggestion_farsi: 'لطفاً حداکثر ساعات استاد را افزایش دهید یا نیازهای صنف را کاهش دهید',
        suggestion_english: "Please increase teacher's max periods or reduce class requirements",
      });
    }
  }
}
