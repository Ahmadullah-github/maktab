import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
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
  periodsPerWeek: number | null = null; // Default periods per week from Ministry curriculum

  @Column({ type: "text", nullable: true })
  section: string = ""; // PRIMARY | MIDDLE | HIGH

  @Column({ type: "text", nullable: true })
  requiredRoomType: string = "";

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
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
