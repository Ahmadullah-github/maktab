import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index, Check } from "typeorm";

export type TeacherEmploymentType = 'full_time' | 'part_time';

/**
 * Teacher entity with database indexes for optimized queries
 * 
 * Requirements: 4.1, 4.8
 * - Index on fullName column for name-based lookups
 * - Index on schoolId column for future multi-tenancy queries
 */
@Entity()
@Index(['fullName'])
@Index(['schoolId'])
@Index(['staffCode'])
@Check('CHK_teacher_workload_nonnegative', '"maxPeriodsPerWeek" >= 0')
@Check('CHK_teacher_employment_type', `"employmentType" IN ('full_time', 'part_time')`)
export class Teacher extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "text" })
  fullName: string = "";

  /** Stable school-scoped identity. Names are display values and may be duplicated. */
  @Column({ type: "text" })
  staffCode: string = "";

  @Column({ type: "text", default: 'full_time' })
  employmentType: TeacherEmploymentType = 'full_time';

  @Column({ type: "text" })
  primarySubjectIds: string = ""; // DEPRECATED compatibility JSON mirror for teacher capability

  @Column({ type: "text", nullable: true })
  allowedSubjectIds: string = ""; // DEPRECATED compatibility JSON mirror for teacher capability

  @Column({ type: "boolean", nullable: true })
  restrictToPrimarySubjects: boolean = true;

  @Column({ type: "text", nullable: true })
  unavailable: string = ""; // JSON string of unavailable slots

  @Column({ type: "integer" })
  maxPeriodsPerWeek: number = 0;

  @Column({ type: "text", nullable: true })
  timePreference: string = "";

  @Column({ type: "text", nullable: true })
  preferredRoomIds: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  preferredColleagues: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  classAssignments: string = ""; // DEPRECATED legacy assignment mirror only

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON string of metadata

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
