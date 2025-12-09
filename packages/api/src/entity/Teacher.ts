import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Teacher extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "text" })
  fullName: string = "";

  @Column({ type: "text" })
  primarySubjectIds: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  allowedSubjectIds: string = ""; // JSON string array

  @Column({ type: "boolean", nullable: true })
  restrictToPrimarySubjects: boolean = true;

  @Column({ type: "text" })
  availability: string = ""; // JSON string of availability matrix

  @Column({ type: "text", nullable: true })
  unavailable: string = ""; // JSON string of unavailable slots

  @Column({ type: "integer" })
  maxPeriodsPerWeek: number = 0;

  @Column({ type: "integer", nullable: true })
  maxPeriodsPerDay: number = 0;

  @Column({ type: "integer", nullable: true })
  maxConsecutivePeriods: number = 0;

  @Column({ type: "text", nullable: true })
  timePreference: string = "";

  @Column({ type: "text", nullable: true })
  preferredRoomIds: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  preferredColleagues: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  classAssignments: string = ""; // JSON string: Array<{ subjectId: string, classIds: string[] }>

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
