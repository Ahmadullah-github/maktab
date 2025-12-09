import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Timetable extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "integer", nullable: true })
  academicYearId: number | null = null; // Link to academic year

  @Column({ type: "integer", nullable: true })
  termId: number | null = null; // Link to term/semester

  @Column({ type: "text" })
  name: string = "";

  @Column({ type: "text" })
  description: string = "";

  @Column({ type: "text" })
  data: string = ""; // JSON string of the timetable data

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
