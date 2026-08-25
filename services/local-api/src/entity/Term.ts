import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Term extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer" })
  academicYearId: number = 0;

  @Column({ type: "text" })
  name: string = ""; // e.g., "First Semester", "سمستر اول"

  @Column({ type: "integer", default: 1 })
  termNumber: number = 1; // 1, 2, 3, 4

  @Column({ type: "date" })
  startDate: Date = new Date();

  @Column({ type: "date" })
  endDate: Date = new Date();

  @Column({ type: "boolean", default: false })
  isCurrent: boolean = false;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "text", nullable: true })
  meta: string = "";

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
