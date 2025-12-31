import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index } from "typeorm";

/**
 * Subject override for school-specific curriculum customization
 */
export interface SubjectOverrideData {
  code: string;              // Subject code to override
  periodsPerWeek?: number;   // Override periods (null = use ministry default)
  isRemoved?: boolean;       // Remove this subject from curriculum
}

/**
 * Custom subject added by school
 */
export interface CustomSubjectData {
  name: string;
  nameEn: string;
  code: string;
  periodsPerWeek: number;
  isDifficult?: boolean;
  requiredRoomType?: string;
}

/**
 * Grade-specific curriculum configuration
 */
export interface GradeCurriculumData {
  grade: number;
  overrides: SubjectOverrideData[];
  customSubjects: CustomSubjectData[];
}

/**
 * CurriculumConfig entity for storing school-specific curriculum customizations
 * 
 * This allows schools to:
 * - Add custom subjects beyond ministry curriculum
 * - Modify periods for existing subjects
 * - Remove non-core subjects (in non-strict mode)
 * 
 * The frontend UI can use this to let users customize their curriculum
 * while the API validates against ministry requirements when enabled.
 */
@Entity("curriculum_config")
@Index(['schoolId'])
@Index(['schoolId', 'grade'])
export class CurriculumConfig extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "integer" })
  grade: number; // 1-12

  @Column({ type: "boolean", default: true })
  useMinistryDefaults: boolean = true; // If false, completely custom

  @Column({ type: "text", default: "[]" })
  overridesJson: string = "[]"; // JSON array of SubjectOverrideData

  @Column({ type: "text", default: "[]" })
  customSubjectsJson: string = "[]"; // JSON array of CustomSubjectData

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();

  // =========================================================================
  // Helper Methods for JSON Fields
  // =========================================================================

  /**
   * Get subject overrides as parsed array
   */
  get overrides(): SubjectOverrideData[] {
    try {
      return JSON.parse(this.overridesJson || "[]");
    } catch {
      return [];
    }
  }

  /**
   * Set subject overrides from array
   */
  set overrides(data: SubjectOverrideData[]) {
    this.overridesJson = JSON.stringify(data || []);
  }

  /**
   * Get custom subjects as parsed array
   */
  get customSubjects(): CustomSubjectData[] {
    try {
      return JSON.parse(this.customSubjectsJson || "[]");
    } catch {
      return [];
    }
  }

  /**
   * Set custom subjects from array
   */
  set customSubjects(data: CustomSubjectData[]) {
    this.customSubjectsJson = JSON.stringify(data || []);
  }

  /**
   * Convert to GradeCurriculumData format
   */
  toGradeCurriculumData(): GradeCurriculumData {
    return {
      grade: this.grade,
      overrides: this.overrides,
      customSubjects: this.customSubjects,
    };
  }
}
