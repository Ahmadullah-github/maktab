/**
 * Curriculum Helper Functions
 * 
 * Utilities for working with curriculum data, validation, and customization.
 */

import {
  MINISTRY_CURRICULUM,
  SubjectDefinition,
  GradeCategory,
  getGradeCategory,
  getExpectedTotalPeriods,
  GRADE_CATEGORIES,
} from './afghanistanCurriculum';

// ==============================================================================
// School Curriculum Override Types
// ==============================================================================

export interface SubjectOverride {
  code: string;              // Subject code to override
  periodsPerWeek?: number;   // Override periods (null = use ministry default)
  isRemoved?: boolean;       // Remove this subject from curriculum
}

export interface CustomSubject {
  name: string;
  nameEn: string;
  code: string;
  periodsPerWeek: number;
  isDifficult?: boolean;
  requiredRoomType?: string;
}

export interface GradeCurriculumConfig {
  grade: number;
  overrides: SubjectOverride[];      // Modifications to ministry subjects
  customSubjects: CustomSubject[];   // Additional school-specific subjects
}

export interface SchoolCurriculumConfig {
  schoolId?: number | null;
  useMinistryDefaults: boolean;      // If false, completely custom curriculum
  gradeConfigs: GradeCurriculumConfig[];
}

// ==============================================================================
// Curriculum Access Functions
// ==============================================================================

/**
 * Get ministry curriculum subjects for a specific grade
 */
export const getMinistrySubjectsForGrade = (grade: number): SubjectDefinition[] => {
  const gradeKey = `grade_${grade}`;
  return MINISTRY_CURRICULUM[gradeKey] || [];
};

/**
 * Get all grades (1-12)
 */
export const getAllGrades = (): number[] => {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
};

/**
 * Get total periods for a grade from ministry curriculum
 */
export const getMinistryTotalPeriods = (grade: number): number => {
  const subjects = getMinistrySubjectsForGrade(grade);
  return subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);
};

/**
 * Get subject names only for a grade (legacy compatibility)
 */
export const getSubjectNamesForGrade = (grade: number): string[] => {
  return getMinistrySubjectsForGrade(grade).map(s => s.name);
};

// ==============================================================================
// Curriculum Customization Functions
// ==============================================================================

/**
 * Apply school-specific overrides to ministry curriculum for a grade
 */
export const getEffectiveCurriculum = (
  grade: number,
  config?: GradeCurriculumConfig
): SubjectDefinition[] => {
  const ministrySubjects = getMinistrySubjectsForGrade(grade);
  
  if (!config) {
    return ministrySubjects;
  }

  // Apply overrides
  const overrideMap = new Map(config.overrides.map(o => [o.code, o]));
  
  const effectiveSubjects: SubjectDefinition[] = ministrySubjects
    .filter(s => {
      const override = overrideMap.get(s.code);
      return !override?.isRemoved;
    })
    .map(s => {
      const override = overrideMap.get(s.code);
      if (override?.periodsPerWeek !== undefined) {
        return { ...s, periodsPerWeek: override.periodsPerWeek };
      }
      return s;
    });

  // Add custom subjects
  const customSubjects: SubjectDefinition[] = config.customSubjects.map(cs => ({
    name: cs.name,
    nameEn: cs.nameEn,
    code: cs.code,
    periodsPerWeek: cs.periodsPerWeek,
    isDifficult: cs.isDifficult,
    requiredRoomType: cs.requiredRoomType,
    isCore: false, // Custom subjects are never core
  }));

  return [...effectiveSubjects, ...customSubjects];
};

/**
 * Get effective curriculum for all grades with school config
 */
export const getFullEffectiveCurriculum = (
  schoolConfig?: SchoolCurriculumConfig
): Record<number, SubjectDefinition[]> => {
  const result: Record<number, SubjectDefinition[]> = {};
  
  for (const grade of getAllGrades()) {
    const gradeConfig = schoolConfig?.gradeConfigs.find(gc => gc.grade === grade);
    result[grade] = getEffectiveCurriculum(grade, gradeConfig);
  }
  
  return result;
};

// ==============================================================================
// Validation Functions
// ==============================================================================

export interface CurriculumValidationIssue {
  type: 'error' | 'warning';
  code: string;
  grade: number;
  subjectCode?: string;
  subjectName?: string;
  messageFarsi: string;
  messageEnglish: string;
  details?: Record<string, any>;
}

export interface CurriculumValidationResult {
  isValid: boolean;
  issues: CurriculumValidationIssue[];
  summary: {
    totalGrades: number;
    gradesWithIssues: number;
    errorCount: number;
    warningCount: number;
  };
}

/**
 * Validate curriculum configuration against ministry requirements
 */
export const validateCurriculumConfig = (
  schoolConfig: SchoolCurriculumConfig,
  strictMode: boolean = false
): CurriculumValidationResult => {
  const issues: CurriculumValidationIssue[] = [];
  const gradesWithIssues = new Set<number>();

  for (const grade of getAllGrades()) {
    const gradeConfig = schoolConfig.gradeConfigs.find(gc => gc.grade === grade);
    const effectiveSubjects = getEffectiveCurriculum(grade, gradeConfig);
    const ministrySubjects = getMinistrySubjectsForGrade(grade);
    const expectedTotal = getExpectedTotalPeriods(grade);
    const actualTotal = effectiveSubjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);

    // Check total periods
    if (actualTotal !== expectedTotal) {
      gradesWithIssues.add(grade);
      issues.push({
        type: strictMode ? 'error' : 'warning',
        code: 'TOTAL_PERIODS_MISMATCH',
        grade,
        messageFarsi: `صنف ${grade}: مجموع ساعات (${actualTotal}) با استندرد وزارت (${expectedTotal}) مطابقت ندارد`,
        messageEnglish: `Grade ${grade}: Total periods (${actualTotal}) doesn't match ministry standard (${expectedTotal})`,
        details: { expected: expectedTotal, actual: actualTotal, difference: expectedTotal - actualTotal }
      });
    }

    // Check core subjects in strict mode
    if (strictMode) {
      const effectiveCodes = new Set(effectiveSubjects.map(s => s.code));
      
      for (const ministrySubject of ministrySubjects) {
        if (ministrySubject.isCore && !effectiveCodes.has(ministrySubject.code)) {
          gradesWithIssues.add(grade);
          issues.push({
            type: 'error',
            code: 'MISSING_CORE_SUBJECT',
            grade,
            subjectCode: ministrySubject.code,
            subjectName: ministrySubject.name,
            messageFarsi: `صنف ${grade}: مضمون اساسی "${ministrySubject.name}" حذف شده است`,
            messageEnglish: `Grade ${grade}: Core subject "${ministrySubject.nameEn}" has been removed`,
          });
        }
      }
    }

    // Check for subjects with 0 periods
    for (const subject of effectiveSubjects) {
      if (subject.periodsPerWeek <= 0) {
        gradesWithIssues.add(grade);
        issues.push({
          type: 'warning',
          code: 'ZERO_PERIODS',
          grade,
          subjectCode: subject.code,
          subjectName: subject.name,
          messageFarsi: `صنف ${grade}: مضمون "${subject.name}" صفر ساعت دارد`,
          messageEnglish: `Grade ${grade}: Subject "${subject.nameEn}" has zero periods`,
        });
      }
    }
  }

  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;

  return {
    isValid: errorCount === 0,
    issues,
    summary: {
      totalGrades: 12,
      gradesWithIssues: gradesWithIssues.size,
      errorCount,
      warningCount,
    }
  };
};

/**
 * Check if a subject exists in ministry curriculum for a grade
 */
export const isMinistrySubject = (subjectName: string, grade?: number): boolean => {
  if (grade !== undefined) {
    const subjects = getMinistrySubjectsForGrade(grade);
    return subjects.some(s => s.name === subjectName || s.nameEn === subjectName);
  }
  
  // Check all grades
  return getAllGrades().some(g => {
    const subjects = getMinistrySubjectsForGrade(g);
    return subjects.some(s => s.name === subjectName || s.nameEn === subjectName);
  });
};

/**
 * Get required room type for a subject
 */
export const getRequiredRoomType = (subjectName: string): string | null => {
  for (const grade of getAllGrades()) {
    const subject = getMinistrySubjectsForGrade(grade).find(
      s => s.name === subjectName || s.nameEn === subjectName
    );
    if (subject?.requiredRoomType) {
      return subject.requiredRoomType;
    }
  }
  return null;
};

/**
 * Get curriculum compliance percentage
 */
export const getCurriculumCompliance = (
  configuredSubjects: string[],
  grade: number
): { percentage: number; missing: string[]; extra: string[] } => {
  const ministrySubjects = getMinistrySubjectsForGrade(grade);
  const ministryNames = new Set(ministrySubjects.map(s => s.name));
  const configuredSet = new Set(configuredSubjects);

  const matching = configuredSubjects.filter(name => ministryNames.has(name));
  const missing = ministrySubjects
    .filter(s => !configuredSet.has(s.name))
    .map(s => s.name);
  const extra = configuredSubjects.filter(name => !ministryNames.has(name));

  const percentage = ministrySubjects.length > 0
    ? Math.round((matching.length / ministrySubjects.length) * 100)
    : 100;

  return { percentage, missing, extra };
};

// ==============================================================================
// Solver Data Conversion
// ==============================================================================

/**
 * Convert curriculum config to solver-compatible format
 */
export const curriculumToSolverFormat = (
  schoolConfig?: SchoolCurriculumConfig
): Record<string, any> => {
  const curriculum: Record<string, any> = {};
  
  for (const grade of getAllGrades()) {
    const gradeConfig = schoolConfig?.gradeConfigs.find(gc => gc.grade === grade);
    const subjects = getEffectiveCurriculum(grade, gradeConfig);
    const category = getGradeCategory(grade);
    
    curriculum[`grade_${grade}`] = {
      category,
      categoryInfo: category ? GRADE_CATEGORIES[category] : null,
      subjects: subjects.map(s => ({
        name: s.name,
        nameEn: s.nameEn,
        code: s.code,
        periodsPerWeek: s.periodsPerWeek,
        isDifficult: s.isDifficult || false,
        requiredRoomType: s.requiredRoomType || null,
        isCore: s.isCore || false,
      })),
      totalPeriods: subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0),
      expectedPeriods: getExpectedTotalPeriods(grade),
    };
  }
  
  return curriculum;
};

/**
 * Create default school curriculum config (uses ministry defaults)
 */
export const createDefaultCurriculumConfig = (schoolId?: number | null): SchoolCurriculumConfig => {
  return {
    schoolId: schoolId ?? null,
    useMinistryDefaults: true,
    gradeConfigs: getAllGrades().map(grade => ({
      grade,
      overrides: [],
      customSubjects: [],
    })),
  };
};
