import type { Subject } from '../types';

export interface SubjectCoverageStat {
  totalRequiredPeriods: number;
  totalAssignedPeriods: number;
}

export interface GradeSubjectStatistics {
  grade: number;
  subjectCount: number;
  totalPeriods: number;
  configuredSubjectCount: number;
  difficultCount: number;
  specialRoomCount: number;
  averagePeriods: number;
}

export interface SectionSubjectStatistics {
  subjectCount: number;
  totalPeriods: number;
}

export interface SubjectStatistics {
  totalSubjects: number;
  totalPeriods: number;
  configuredPeriodCount: number;
  averagePeriods: number;
  difficultCount: number;
  specialRoomCount: number;
  customCount: number;
  missingGradeCount: number;
  missingPeriodsCount: number;
  selectedCount: number;
  selectedPeriods: number;
  totalRequiredPeriods: number;
  totalAssignedPeriods: number;
  coveredPeriods: number;
  coveragePercentage: number;
  byGrade: GradeSubjectStatistics[];
  bySection: Record<'PRIMARY' | 'MIDDLE' | 'HIGH', SectionSubjectStatistics>;
}

function hasConfiguredPeriods(subject: Subject): subject is Subject & { periodsPerWeek: number } {
  return typeof subject.periodsPerWeek === 'number' && Number.isFinite(subject.periodsPerWeek);
}

function requiresSpecialRoom(subject: Subject): boolean {
  const roomType = subject.requiredRoomType?.trim().toLowerCase();
  return Boolean(roomType && roomType !== 'normal' && roomType !== 'classroom');
}

export function calculateSubjectStatistics(
  subjects: readonly Subject[],
  coverageBySubjectId: ReadonlyMap<number, SubjectCoverageStat> = new Map(),
  selectedSubjects: readonly Subject[] = []
): SubjectStatistics {
  const gradeMap = new Map<number, Omit<GradeSubjectStatistics, 'averagePeriods'>>();
  const bySection: SubjectStatistics['bySection'] = {
    PRIMARY: { subjectCount: 0, totalPeriods: 0 },
    MIDDLE: { subjectCount: 0, totalPeriods: 0 },
    HIGH: { subjectCount: 0, totalPeriods: 0 },
  };

  let totalPeriods = 0;
  let configuredPeriodCount = 0;
  let difficultCount = 0;
  let specialRoomCount = 0;
  let customCount = 0;
  let missingGradeCount = 0;
  let missingPeriodsCount = 0;
  let totalRequiredPeriods = 0;
  let totalAssignedPeriods = 0;
  let coveredPeriods = 0;

  for (const subject of subjects) {
    const periods = hasConfiguredPeriods(subject) ? subject.periodsPerWeek : 0;
    const grade =
      typeof subject.grade === 'number' && subject.grade >= 1 && subject.grade <= 12
        ? subject.grade
        : null;
    const specialRoom = requiresSpecialRoom(subject);

    if (hasConfiguredPeriods(subject)) {
      totalPeriods += periods;
      configuredPeriodCount += 1;
    } else {
      missingPeriodsCount += 1;
    }
    if (grade === null) missingGradeCount += 1;
    if (subject.isDifficult) difficultCount += 1;
    if (specialRoom) specialRoomCount += 1;
    if (subject.isCustom) customCount += 1;

    const section = subject.section?.toUpperCase();
    if (section === 'PRIMARY' || section === 'MIDDLE' || section === 'HIGH') {
      bySection[section].subjectCount += 1;
      bySection[section].totalPeriods += periods;
    }

    if (grade !== null) {
      const current = gradeMap.get(grade) ?? {
        grade,
        subjectCount: 0,
        totalPeriods: 0,
        configuredSubjectCount: 0,
        difficultCount: 0,
        specialRoomCount: 0,
      };
      current.subjectCount += 1;
      current.totalPeriods += periods;
      if (hasConfiguredPeriods(subject)) current.configuredSubjectCount += 1;
      if (subject.isDifficult) current.difficultCount += 1;
      if (specialRoom) current.specialRoomCount += 1;
      gradeMap.set(grade, current);
    }

    const coverage = coverageBySubjectId.get(subject.id);
    if (coverage) {
      const required = Math.max(0, coverage.totalRequiredPeriods);
      const assigned = Math.max(0, coverage.totalAssignedPeriods);
      totalRequiredPeriods += required;
      totalAssignedPeriods += assigned;
      coveredPeriods += Math.min(required, assigned);
    }
  }

  const selectedPeriods = selectedSubjects.reduce(
    (sum, subject) => sum + (hasConfiguredPeriods(subject) ? subject.periodsPerWeek : 0),
    0
  );

  return {
    totalSubjects: subjects.length,
    totalPeriods,
    configuredPeriodCount,
    averagePeriods:
      configuredPeriodCount > 0 ? Math.round((totalPeriods / configuredPeriodCount) * 10) / 10 : 0,
    difficultCount,
    specialRoomCount,
    customCount,
    missingGradeCount,
    missingPeriodsCount,
    selectedCount: selectedSubjects.length,
    selectedPeriods,
    totalRequiredPeriods,
    totalAssignedPeriods,
    coveredPeriods,
    coveragePercentage:
      totalRequiredPeriods > 0 ? Math.round((coveredPeriods / totalRequiredPeriods) * 100) : 0,
    byGrade: [...gradeMap.values()]
      .map((grade) => ({
        ...grade,
        averagePeriods:
          grade.configuredSubjectCount > 0
            ? Math.round((grade.totalPeriods / grade.configuredSubjectCount) * 10) / 10
            : 0,
      }))
      .sort((left, right) => left.grade - right.grade),
    bySection,
  };
}
