import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: "text" })
  username: string = "";

  @Column({ type: "text", nullable: true })
  email: string = "";

  @Column({ type: "text" })
  passwordHash: string = "";

  @Column({ type: "text" })
  fullName: string = "";

  @Column({ type: "text", nullable: true })
  phone: string = "";

  @Column({ type: "text", default: "[]" })
  roles: string = "[]"; // JSON: ["admin", "teacher", "accountant"]

  @Column({ type: "text", default: "[]" })
  permissions: string = "[]"; // JSON: ["timetable.create", "teachers.edit"]

  @Column({ type: "integer", nullable: true })
  teacherId: number | null = null; // Link to Teacher entity if user is a teacher

  @Column({ type: "text", nullable: true })
  preferredLanguage: string = "fa"; // "fa" | "ps" | "en"

  @Column({ type: "boolean", default: true })
  isActive: boolean = true;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", nullable: true })
  lastLoginAt: Date | null = null;

  @Column({ type: "text", nullable: true })
  meta: string = "";

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
