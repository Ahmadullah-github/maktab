import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class License extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", unique: true })
  licenseKey: string = "";

  @Column({ type: "text" })
  schoolName: string = "";

  @Column({ type: "text", nullable: true })
  contactName: string = "";

  @Column({ type: "text", nullable: true })
  contactPhone: string = "";

  @Column({ type: "text" })
  licenseType: string = ""; // "6-month" | "annual" | "trial"

  @Column({ type: "datetime" })
  activatedAt: Date = new Date();

  @Column({ type: "datetime" })
  expiresAt: Date = new Date();

  @Column({ type: "integer", default: 7 })
  gracePeriodDays: number = 7;

  @Column({ type: "boolean", default: true })
  isActive: boolean = true;

  @Column({ type: "text", nullable: true })
  machineId: string = ""; // Hardware fingerprint for offline validation

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON for additional data

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
