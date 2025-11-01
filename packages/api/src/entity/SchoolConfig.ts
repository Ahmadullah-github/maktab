import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity("school_config")
export class SchoolConfig extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", nullable: true })
  schoolName: string | null = null;

  @Column({ type: "boolean", default: true })
  enablePrimary: boolean = true; // Grades 1–6

  @Column({ type: "boolean", default: true })
  enableMiddle: boolean = true; // Grades 7–9

  @Column({ type: "boolean", default: true })
  enableHigh: boolean = true; // Grades 10–12

  @Column({ type: "integer", default: 6 })
  daysPerWeek: number = 6;

  @Column({ type: "integer", default: 7 })
  periodsPerDay: number = 7;

  @Column({ type: "text", nullable: true })
  breakPeriods: string = "[]"; // JSON string array of period numbers

  // Section-specific schedule configuration
  // PRIMARY (Grades 1-6)
  @Column({ type: "integer", nullable: true })
  primaryPeriodsPerDay: number | null = null;

  @Column({ type: "integer", nullable: true })
  primaryPeriodDuration: number | null = null; // minutes

  @Column({ type: "text", nullable: true })
  primaryStartTime: string | null = null; // HH:mm

  @Column({ type: "text", nullable: true })
  primaryBreakPeriods: string | null = null; // JSON array

  // MIDDLE (Grades 7-9)
  @Column({ type: "integer", nullable: true })
  middlePeriodsPerDay: number | null = null;

  @Column({ type: "integer", nullable: true })
  middlePeriodDuration: number | null = null; // minutes

  @Column({ type: "text", nullable: true })
  middleStartTime: string | null = null; // HH:mm

  @Column({ type: "text", nullable: true })
  middleBreakPeriods: string | null = null; // JSON array

  // HIGH (Grades 10-12)
  @Column({ type: "integer", nullable: true })
  highPeriodsPerDay: number | null = null;

  @Column({ type: "integer", nullable: true })
  highPeriodDuration: number | null = null; // minutes

  @Column({ type: "text", nullable: true })
  highStartTime: string | null = null; // HH:mm

  @Column({ type: "text", nullable: true })
  highBreakPeriods: string | null = null; // JSON array

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}


