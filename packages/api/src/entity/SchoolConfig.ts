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
  breakPeriods: string = "[]"; // JSON string: [{afterPeriod: number, duration: number}]

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}


