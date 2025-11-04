/**
 * Timetable Data Transformation Utilities
 * 
 * Converts flat lesson arrays from the solver into structured formats
 * for class-centric and teacher-centric views.
 */

export interface Lesson {
  day: string;
  periodIndex: number;
  classId: string;
  subjectId: string;
  teacherIds: string[];
  roomId: string;
  isFixed?: boolean;
}

export interface ClassScheduleLesson {
  subjectId: string;
  subjectName: string;
  teacherIds: string[];
  teacherNames: string[];
  roomId: string;
  roomName: string;
  periodIndex: number;
  day: string;
}

export interface TeacherScheduleLesson {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  roomId: string;
  roomName: string;
  periodIndex: number;
  day: string;
}

export interface ClassSchedule {
  classId: string;
  className: string;
  schedule: {
    [day: string]: {
      [period: number]: ClassScheduleLesson;
    };
  };
}

export interface TeacherSchedule {
  teacherId: string;
  teacherName: string;
  schedule: {
    [day: string]: {
      [period: number]: TeacherScheduleLesson;
    };
  };
}

/**
 * Transform flat lesson array to class-centric schedule
 */
export function transformToClassSchedule(
  lessons: Lesson[],
  classes: Array<{ id: string; name: string }>,
  subjects: Array<{ id: string; name: string }>,
  teachers: Array<{ id: string; fullName: string }>,
  rooms: Array<{ id: string; name: string }>
): ClassSchedule[] {
  const classSchedules: Map<string, ClassSchedule> = new Map();

  // Initialize schedules for all classes
  classes.forEach((cls) => {
    classSchedules.set(cls.id, {
      classId: cls.id,
      className: cls.name,
      schedule: {},
    });
  });

  // Group lessons by class
  lessons.forEach((lesson) => {
    const schedule = classSchedules.get(lesson.classId);
    if (!schedule) return;

    // Initialize day if not exists
    if (!schedule.schedule[lesson.day]) {
      schedule.schedule[lesson.day] = {};
    }

    // Find subject, teachers, and room names
    const subject = subjects.find((s) => s.id === lesson.subjectId);
    const teacherIds = Array.isArray(lesson.teacherIds) ? lesson.teacherIds : [];
    const lessonTeachers = teacherIds
      .map((tid) => teachers.find((t) => t.id === tid))
      .filter((t) => t !== undefined);
    const room = rooms.find((r) => r.id === lesson.roomId);

    // Add lesson to schedule
    schedule.schedule[lesson.day][lesson.periodIndex] = {
      subjectId: lesson.subjectId,
      subjectName: subject?.name || "Unknown Subject",
      teacherIds: lesson.teacherIds,
      teacherNames: lessonTeachers.map((t) => t!.fullName),
      roomId: lesson.roomId,
      roomName: room?.name || "Unknown Room",
      periodIndex: lesson.periodIndex,
      day: lesson.day,
    };
  });

  return Array.from(classSchedules.values());
}

/**
 * Transform flat lesson array to teacher-centric schedule
 */
export function transformToTeacherSchedule(
  lessons: Lesson[],
  teachers: Array<{ id: string; fullName: string }>,
  classes: Array<{ id: string; name: string }>,
  subjects: Array<{ id: string; name: string }>,
  rooms: Array<{ id: string; name: string }>
): TeacherSchedule[] {
  const teacherSchedules: Map<string, TeacherSchedule> = new Map();

  // Initialize schedules for all teachers
  teachers.forEach((teacher) => {
    teacherSchedules.set(teacher.id, {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      schedule: {},
    });
  });

  // Group lessons by teacher
  lessons.forEach((lesson) => {
    // A lesson can have multiple teachers
    const teacherIds = Array.isArray(lesson.teacherIds) ? lesson.teacherIds : [];
    teacherIds.forEach((teacherId) => {
      const schedule = teacherSchedules.get(teacherId);
      if (!schedule) return;

      // Initialize day if not exists
      if (!schedule.schedule[lesson.day]) {
        schedule.schedule[lesson.day] = {};
      }

      // Find class, subject, and room names
      const cls = classes.find((c) => c.id === lesson.classId);
      const subject = subjects.find((s) => s.id === lesson.subjectId);
      const room = rooms.find((r) => r.id === lesson.roomId);

      // Add lesson to schedule
      schedule.schedule[lesson.day][lesson.periodIndex] = {
        classId: lesson.classId,
        className: cls?.name || "Unknown Class",
        subjectId: lesson.subjectId,
        subjectName: subject?.name || "Unknown Subject",
        roomId: lesson.roomId,
        roomName: room?.name || "Unknown Room",
        periodIndex: lesson.periodIndex,
        day: lesson.day,
      };
    });
  });

  return Array.from(teacherSchedules.values());
}

/**
 * Get statistics about the timetable
 */
export function getTimetableStatistics(lessons: Lesson[]) {
  const stats = {
    totalLessons: lessons.length,
    uniqueClasses: new Set(lessons.map((l) => l.classId)).size,
    uniqueTeachers: new Set(lessons.flatMap((l) => (Array.isArray(l.teacherIds) ? l.teacherIds : []))).size,
    uniqueSubjects: new Set(lessons.map((l) => l.subjectId)).size,
    uniqueRooms: new Set(lessons.map((l) => l.roomId)).size,
    lessonsByDay: {} as Record<string, number>,
  };

  lessons.forEach((lesson) => {
    stats.lessonsByDay[lesson.day] =
      (stats.lessonsByDay[lesson.day] || 0) + 1;
  });

  return stats;
}

/**
 * Check for scheduling conflicts
 */
export function findConflicts(lessons: Lesson[]): string[] {
  const conflicts: string[] = [];
  const slots: Map<string, Lesson[]> = new Map();

  // Group lessons by slot (day + period)
  lessons.forEach((lesson) => {
    const key = `${lesson.day}-${lesson.periodIndex}`;
    if (!slots.has(key)) {
      slots.set(key, []);
    }
    slots.get(key)!.push(lesson);
  });

  // Check for conflicts
  slots.forEach((lessonsInSlot, slot) => {
    // Check for teacher conflicts
    const teacherCounts = new Map<string, number>();
    lessonsInSlot.forEach((lesson) => {
      const teacherIds = Array.isArray(lesson.teacherIds) ? lesson.teacherIds : [];
      teacherIds.forEach((teacherId) => {
        teacherCounts.set(teacherId, (teacherCounts.get(teacherId) || 0) + 1);
      });
    });
    teacherCounts.forEach((count, teacherId) => {
      if (count > 1) {
        conflicts.push(
          `Teacher ${teacherId} has ${count} lessons at ${slot}`
        );
      }
    });

    // Check for class conflicts
    const classCounts = new Map<string, number>();
    lessonsInSlot.forEach((lesson) => {
      classCounts.set(
        lesson.classId,
        (classCounts.get(lesson.classId) || 0) + 1
      );
    });
    classCounts.forEach((count, classId) => {
      if (count > 1) {
        conflicts.push(`Class ${classId} has ${count} lessons at ${slot}`);
      }
    });

    // Check for room conflicts
    const roomCounts = new Map<string, number>();
    lessonsInSlot.forEach((lesson) => {
      roomCounts.set(lesson.roomId, (roomCounts.get(lesson.roomId) || 0) + 1);
    });
    roomCounts.forEach((count, roomId) => {
      if (count > 1) {
        conflicts.push(`Room ${roomId} has ${count} lessons at ${slot}`);
      }
    });
  });

  return conflicts;
}

/**
 * Validate lesson data for export
 */
function validateLessonsForExport(
  lessons: Lesson[],
  type: "class" | "teacher",
  lookups?: {
    classes?: Array<{ id: string; name: string }>;
    subjects?: Array<{ id: string; name: string }>;
    teachers?: Array<{ id: string; fullName: string }>;
    rooms?: Array<{ id: string; name: string }>;
  }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  lessons.forEach((lesson, index) => {
    // Check if subject exists in lookups
    if (lookups?.subjects && !lookups.subjects.find(s => s.id === lesson.subjectId)) {
      errors.push(`Lesson ${index + 1}: Subject with ID "${lesson.subjectId}" not found. Please check the "Subjects" section.`);
    }
    
    // Check if class exists in lookups
    if (lookups?.classes && !lookups.classes.find(c => c.id === lesson.classId)) {
      errors.push(`Lesson ${index + 1}: Class with ID "${lesson.classId}" not found. Please check the "Classes" section.`);
    }
    
    // Check if teachers exist in lookups
    if (lookups?.teachers && Array.isArray(lesson.teacherIds)) {
      lesson.teacherIds.forEach(teacherId => {
        if (!lookups.teachers!.find(t => t.id === teacherId)) {
          errors.push(`Lesson ${index + 1}: Teacher with ID "${teacherId}" not found. Please check the "Teachers" section.`);
        }
      });
    }
    
    // Check if room exists in lookups
    if (lookups?.rooms && !lookups.rooms.find(r => r.id === lesson.roomId)) {
      errors.push(`Lesson ${index + 1}: Room with ID "${lesson.roomId}" not found. Please check the "Rooms" section.`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Export timetable to CSV format
 */
export function exportToCSV(
  lessons: Lesson[],
  type: "class" | "teacher",
  lookups?: {
    classes?: Array<{ id: string; name: string }>;
    subjects?: Array<{ id: string; name: string }>;
    teachers?: Array<{ id: string; fullName: string }>;
    rooms?: Array<{ id: string; name: string }>;
  }
): string {
  // Validate data before exporting
  if (lookups) {
    const validation = validateLessonsForExport(lessons, type, lookups);
    if (!validation.isValid && validation.errors.length > 0) {
      const uniqueErrors = Array.from(new Set(validation.errors));
      const errorMessage = 
        `Cannot export CSV due to missing data:\n\n` +
        uniqueErrors.slice(0, 10).join('\n') +
        (uniqueErrors.length > 10 ? `\n\n...and ${uniqueErrors.length - 10} more issue(s).\n\n` : '\n\n') +
        `Please ensure all subjects, teachers, classes, and rooms are properly configured before exporting.`;
      throw new Error(errorMessage);
    }
  }
  const headers =
    type === "class"
      ? ["Class", "Day", "Period", "Subject", "Teacher", "Room"]
      : ["Teacher", "Day", "Period", "Class", "Subject", "Room"];

  const rows = lessons.map((lesson) => {
    // Helper functions to get names from IDs
    const getClassName = (id: string) => {
      return lookups?.classes?.find((c) => c.id === id)?.name || id;
    };

    const getSubjectName = (id: string) => {
      return lookups?.subjects?.find((s) => s.id === id)?.name || id;
    };

    const getTeacherNames = (ids: string[]) => {
      if (!lookups?.teachers) return ids.join(";");
      return ids
        .map((id) => lookups.teachers?.find((t) => t.id === id)?.fullName || id)
        .join(";");
    };

    const getRoomName = (id: string) => {
      return lookups?.rooms?.find((r) => r.id === id)?.name || id;
    };

    if (type === "class") {
      return [
        getClassName(lesson.classId),
        lesson.day,
        lesson.periodIndex.toString(),
        getSubjectName(lesson.subjectId),
        getTeacherNames(Array.isArray(lesson.teacherIds) ? lesson.teacherIds : []),
        getRoomName(lesson.roomId),
      ];
    } else {
      return [
        getTeacherNames(Array.isArray(lesson.teacherIds) ? lesson.teacherIds : []),
        lesson.day,
        lesson.periodIndex.toString(),
        getClassName(lesson.classId),
        getSubjectName(lesson.subjectId),
        getRoomName(lesson.roomId),
      ];
    }
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return csvContent;
}

