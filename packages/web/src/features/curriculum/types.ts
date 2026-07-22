export interface SchoolCurriculumSubject {
  itemId: string;
  name: string;
  nameEn?: string;
  code: string;
  periodsPerWeek: number;
  isDifficult?: boolean;
  requiredRoomType?: string;
}

export interface GradeCurriculum {
  grade: number;
  revision: number;
  subjects: SchoolCurriculumSubject[];
}

export interface SchoolCurriculum {
  schoolId: number | null;
  revision: number;
  gradeConfigs: GradeCurriculum[];
}

export interface CurriculumTemplate {
  name: string;
  gradeConfigs: Array<{ grade: number; subjects: SchoolCurriculumSubject[] }>;
}

export interface CurriculumClassProposal {
  name: string;
  displayName?: string;
  grade: number;
  section?: 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';
  sectionIndex?: string;
  studentCount: number;
  classTeacherId?: number | null;
}

export interface CurriculumPlanInput {
  schoolId: number | null;
  schoolConfigRevision: number;
  gradeConfigs: GradeCurriculum[];
  classes: CurriculumClassProposal[];
}

export interface CurriculumGradeImpact {
  grade: number;
  demand: number;
  capacity: number;
  remaining: number;
  blocker: boolean;
  subjects: {
    added: SchoolCurriculumSubject[];
    updated: SchoolCurriculumSubject[];
    removed: SchoolCurriculumSubject[];
  };
  existingClasses: number;
}

export interface CurriculumPlanPreview {
  previewToken: string;
  changedGrades: CurriculumGradeImpact[];
  classes: { create: CurriculumClassProposal[]; totalExistingAffected: number };
  assignmentRemovals: Array<{ id: number; teacherId: number; classId: number; subjectId: number }>;
  warnings: string[];
  blockers: string[];
  canApply: boolean;
}
