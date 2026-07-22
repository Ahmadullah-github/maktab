import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index, Check } from "typeorm";

/**
 * Subject entity with database indexes for optimized queries
 *
 * Requirements: 4.2, 4.3, 4.8
 * - Composite index on [grade, name] for grade+name lookups
 * - Composite index on [grade, code] for grade+code lookups
 * - Index on schoolId for future multi-tenancy queries
 */
@Entity()
@Index(['grade', 'name'])  // Requirements: 4.2 - Composite index for grade+name queries
@Index(['grade', 'code'])  // Requirements: 4.3 - Composite index for grade+code queries
@Index(['schoolId'])       // Requirements: 4.8 - Index for multi-tenancy queries
@Check('CHK_subject_grade', '"grade" IS NULL OR ("grade" >= 1 AND "grade" <= 12)')
@Check('CHK_subject_periods_valid', '"periodsPerWeek" IS NULL OR ("periodsPerWeek" >= 1 AND "periodsPerWeek" <= 84)')
@Check('CHK_subject_section', '"section" IS NULL OR "section" IN (\'\', \'PRIMARY\', \'MIDDLE\', \'HIGH\')')
export class Subject extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "text" })
  name: string = "";

  @Column({ type: "text", nullable: true })
  code: string = "";

  @Column({ type: "integer", nullable: true })
  grade: number | null = null; // Grade level (7-12 for Afghan schools)

  @Column({ type: "integer", nullable: true })
  periodsPerWeek: number | null = null; // School curriculum default for this grade

  @Column({ type: "text", nullable: true })
  section: string = ""; // PRIMARY | MIDDLE | HIGH

  @Column({ type: "text", nullable: true })
  requiredRoomType: string | null = null;

  @Column({ type: "text", nullable: true })
  requiredFeatures: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  desiredFeatures: string = ""; // JSON string array

  @Column({ type: "boolean", nullable: true })
  isDifficult: boolean = false;

  @Column({ type: "integer", nullable: true })
  minRoomCapacity: number = 0;

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON string of metadata

  @Column({ type: "boolean", default: false })
  isCustom: boolean = false;

  @Column({ type: "text", nullable: true })
  customCategory: string | null = null;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
