import type { ClassMetadata, TeacherMetadata } from '../types';

export function cloneTeacherMetadata(teacher: TeacherMetadata): TeacherMetadata {
  return {
    ...teacher,
    primarySubjects: [...teacher.primarySubjects],
    classTeacherOf: [...teacher.classTeacherOf],
    unavailable: teacher.unavailable?.map((slot) => ({ ...slot })),
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
