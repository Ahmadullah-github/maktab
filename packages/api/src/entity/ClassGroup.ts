import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class ClassGroup extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ type: "text" })
  subjectRequirements: string = ""; // JSON string of subject requirements

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON string of metadata

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
