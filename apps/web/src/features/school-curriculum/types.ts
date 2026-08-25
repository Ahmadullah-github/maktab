export interface CurriculumItem {
  id: string;
  name: string;
  nameEn: string | null;
  code: string;
  normalizedCode: string;
  weeklyPeriods: number;
  isDifficult: boolean;
  requiredRoomType: string | null;
}

export interface CurriculumCapacity {
  grade: number;
  totalPeriods: number;
  weeklyCapacity: number;
  freePeriods: number;
  withinCapacity: boolean;
}

export interface CurriculumPlan {
  schoolId: number | null;
  revision: number;
  activeGrades: number[];
  grades: Array<{
    grade: number;
    items: CurriculumItem[];
    capacity: CurriculumCapacity;
    affectedClassCount: number;
  }>;
}

export interface ProposedCurriculumClass {
  name: string;
  displayName?: string;
  grade: number;
  section?: 'PRIMARY' | 'MIDDLE' | 'HIGH' | '';
  sectionIndex?: string;
  studentCount?: number;
  fixedRoomId?: number | null;
  homeRoomId?: number | null;
  singleTeacherMode?: boolean;
  classTeacherId?: number | null;
  academicYearId?: number | null;
}

export interface CurriculumPreviewRequest {
  schoolId?: number | null;
  revision: number;
  changedGrades: Array<{ grade: number; items: Omit<CurriculumItem, 'normalizedCode'>[] }>;
  synchronizeClassIds: number[];
  proposedClasses: ProposedCurriculumClass[];
}

export interface CurriculumPreview {
  revision: number;
  normalizedDrafts: Array<{ grade: number; items: CurriculumItem[] }>;
  capacities: CurriculumCapacity[];
  subjectActions: Array<{
    action: 'create' | 'link' | 'update' | 'restore' | 'archive';
    curriculumItemId: string;
    subjectId: number | null;
    grade: number;
    name: string;
    code: string;
  }>;
  affectedClasses: Array<{ id: number; name: string; grade: number }>;
  affectedRequirements: Array<{
    classId: number;
    subjectId: number | null;
    curriculumItemId: string;
    action: 'create' | 'update' | 'remove' | 'preserve_override';
    currentPeriods: number | null;
    proposedPeriods: number | null;
  }>;
  proposedClasses: ProposedCurriculumClass[];
  assignmentImpacts: Array<{
    classId: number;
    subjectId: number;
    teacherIds: number[];
    assignmentCount: number;
  }>;
  capabilityImpacts: Array<{
    subjectId: number;
    teacherIds: number[];
    capabilityCount: number;
  }>;
  warnings: Array<{ code: string; message: string }>;
  blockers: Array<{ code: string; message: string; grade?: number; row?: number }>;
  resultFingerprint: string;
  previewToken: string;
  expiresAt: string;
}

export interface CurriculumApplyResult {
  revision: number;
  changedGrades: number[];
  synchronizedClassIds: number[];
  createdClassIds: number[];
}
