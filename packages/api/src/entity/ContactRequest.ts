import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class ContactRequest extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  schoolName: string = "";

  @Column({ type: "text" })
  contactName: string = "";

  @Column({ type: "text" })
  contactPhone: string = "";

  @Column({ type: "text" })
  preferredMethod: string = ""; // "whatsapp" | "telegram" | "call" | "sms"

  @Column({ type: "text" })
  requestType: string = ""; // "renewal" | "new_license" | "support" | "upgrade"

  @Column({ type: "text", nullable: true })
  message: string = "";

  @Column({ type: "text", nullable: true })
  currentLicenseKey: string = "";

  @Column({ type: "boolean", default: false })
  isProcessed: boolean = false;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();
}
