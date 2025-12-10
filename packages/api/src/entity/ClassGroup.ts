import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class ClassGroup extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "integer", nullable: true })
  academicYearId: number | null = null; // Link to academic year

  @Column({ type: "text" })
  name: string = "";

  @Column({ type: "text", nullable: true })
  displayName: string = ""; // e.g., 7-A

  @Column({ type: "text", nullable: true })
  section: string = ""; // PRIMARY | MIDDLE | HIGH

  @Column({ type: "integer", nullable: true })
  grade: number | null = null; // 1-12

  @Column({ type: "text", nullable: true })
  sectionIndex: string = ""; // A, B, C

  @Column({ type: "integer" })
  studentCount: number = 0;

  @Column({ type: "integer", nullable: true })
  fixedRoomId: number | null = null; // Lock class to specific room (hard constraint)

  @Column({ type: "boolean", default: false })
  singleTeacherMode: boolean = false; // One teacher teaches all subjects (Alpha-Primary)

  @Column({ type: "integer", nullable: true })
  classTeacherId: number | null = null; // Class teacher/supervisor (استاد نگران)

  @Column({ type: "text" })
  subjectRequirements: string = ""; // JSON string of subject requirements

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
