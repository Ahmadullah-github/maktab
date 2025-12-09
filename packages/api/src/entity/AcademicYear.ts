import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class AcademicYear extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "text" })
  name: string = ""; // e.g., "1403" (Shamsi year)

  @Column({ type: "text", nullable: true })
  displayName: string = ""; // e.g., "سال تحصیلی ۱۴۰۳"

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
  meta: string = ""; // JSON for additional data

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
