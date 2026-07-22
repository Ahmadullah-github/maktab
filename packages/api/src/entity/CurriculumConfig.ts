import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index } from "typeorm";

/** A subject row owned by the school's grade curriculum. */
export interface SchoolCurriculumSubjectData {
  itemId: string;
  name: string;
  nameEn?: string;
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
  revision: number;
  subjects: SchoolCurriculumSubjectData[];
}

/**
 * Complete, school-owned curriculum for one grade.
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

  @Column({ type: "text", default: "[]" })
  subjectsJson: string = "[]";

  @Column({ type: "integer", default: 1 })
  revision: number = 1;

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

  /** Parse the complete subject list for this grade. */
  get subjects(): SchoolCurriculumSubjectData[] {
    try {
      return JSON.parse(this.subjectsJson || "[]");
    } catch {
      return [];
    }
  }

  /** Serialize the complete subject list for this grade. */
  set subjects(data: SchoolCurriculumSubjectData[]) {
    this.subjectsJson = JSON.stringify(data || []);
  }

  /**
   * Convert to GradeCurriculumData format
   */
  toGradeCurriculumData(): GradeCurriculumData {
    return {
      grade: this.grade,
      revision: this.revision,
      subjects: this.subjects,
    };
  }
}
