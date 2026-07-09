import type { ClassMetadata, DayOfWeek, TeacherMetadata } from '../types';

export function cloneTeacherAvailability(
  availability?: Partial<Record<DayOfWeek, boolean[]>>
): Partial<Record<DayOfWeek, boolean[]>> | undefined {
  if (!availability) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(availability).map(([day, periods]) => [
      day,
      Array.isArray(periods) ? [...periods] : periods,
    ])
  ) as Partial<Record<DayOfWeek, boolean[]>>;
}

export function cloneTeacherMetadata(teacher: TeacherMetadata): TeacherMetadata {
  return {
    ...teacher,
    primarySubjects: [...teacher.primarySubjects],
    classTeacherOf: [...teacher.classTeacherOf],
    availability: cloneTeacherAvailability(teacher.availability),
  };
}

export function cloneClassMetadata(classMetadata: ClassMetadata): ClassMetadata {
  return {
    ...classMetadata,
    classTeacherSubjects: classMetadata.classTeacherSubjects
      ? [...classMetadata.classTeacherSubjects]
      : null,
  };
}
