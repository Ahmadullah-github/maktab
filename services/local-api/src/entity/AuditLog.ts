import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null;

  @Column({ type: "integer", nullable: true })
  userId: number | null = null;

  @Column({ type: "text", nullable: true })
  userName: string = ""; // Denormalized for quick display

  @Column({ type: "text" })
  action: string = ""; // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT"

  @Column({ type: "text" })
  entityType: string = ""; // "Teacher", "Student", "Timetable", etc.

  @Column({ type: "integer", nullable: true })
  entityId: number | null = null;

  @Column({ type: "text", nullable: true })
  entityName: string = ""; // Denormalized: "Teacher: Ahmad Khan"

  @Column({ type: "text", nullable: true })
  oldValue: string = ""; // JSON of previous state

  @Column({ type: "text", nullable: true })
  newValue: string = ""; // JSON of new state

  @Column({ type: "text", nullable: true })
  changedFields: string = ""; // JSON: ["fullName", "phone"]

  @Column({ type: "text", nullable: true })
  ipAddress: string = "";

  @Column({ type: "text", nullable: true })
  userAgent: string = "";

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date = new Date();
}
