import type {
  GradeCurriculumData,
  SchoolCurriculumSubjectData,
} from '../entity/CurriculumConfig';
import {
  GRADE_CATEGORIES,
  AFGHANISTAN_CURRICULUM_TEMPLATE,
  type SubjectDefinition,
  getGradeCategory,
} from './afghanistanCurriculum';

export interface SchoolCurriculumConfig {
  schoolId?: number | null;
  revision: number;
  gradeConfigs: GradeCurriculumData[];
}

export const getAllGrades = (): number[] =>
  Array.from({ length: 12 }, (_, index) => index + 1);

export function getAfghanistanTemplateForGrade(grade: number): SchoolCurriculumSubjectData[] {
  return (AFGHANISTAN_CURRICULUM_TEMPLATE[`grade_${grade}`] ?? []).map((subject, index) => ({
    itemId: `af-${grade}-${index + 1}-${subject.code}`,
    name: subject.name,
    nameEn: subject.nameEn,
    code: subject.code,
    periodsPerWeek: subject.periodsPerWeek,
    isDifficult: subject.isDifficult,
    requiredRoomType: subject.requiredRoomType,
  }));
}

export function getEffectiveCurriculum(
  _grade: number,
  config?: GradeCurriculumData
): SubjectDefinition[] {
  return (config?.subjects ?? []).map((subject) => ({
    curriculumItemId: subject.itemId,
    name: subject.name,
    nameEn: subject.nameEn ?? '',
    code: subject.code,
    periodsPerWeek: subject.periodsPerWeek,
    isDifficult: subject.isDifficult,
    requiredRoomType: subject.requiredRoomType,
    isCustom: true,
  }));
}

export function createDefaultCurriculumConfig(
  schoolId?: number | null
): SchoolCurriculumConfig {
  return {
    schoolId: schoolId ?? null,
    revision: 0,
    gradeConfigs: getAllGrades().map((grade) => ({ grade, revision: 0, subjects: [] })),
  };
}

export function curriculumToSolverFormat(
  schoolConfig?: SchoolCurriculumConfig
): Record<string, unknown> {
  const curriculum: Record<string, unknown> = {};
  for (const grade of getAllGrades()) {
    const gradeConfig = schoolConfig?.gradeConfigs.find((candidate) => candidate.grade === grade);
    const subjects = getEffectiveCurriculum(grade, gradeConfig);
    const category = getGradeCategory(grade);
    curriculum[`grade_${grade}`] = {
      category,
      categoryInfo: category ? GRADE_CATEGORIES[category] : null,
      subjects,
      totalPeriods: subjects.reduce((sum, subject) => sum + subject.periodsPerWeek, 0),
    };
  }
  return curriculum;
}
