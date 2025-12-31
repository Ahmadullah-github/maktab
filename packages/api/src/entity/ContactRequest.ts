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

  // New fields for enhanced license request system
  @Column({ type: "text", default: "" })
  province: string = ""; // ولایت - Province/city of the school

  @Column({ type: "text", default: "" })
  machineId: string = ""; // Device identifier for license binding

  @Column({ type: "text", default: "" })
  paymentMethod: string = ""; // "hawala" | "ghazanfar_bank" | "hesab_pay" | "m_paisa"

  @Column({ type: "text", default: "" })
  paymentReference: string = ""; // Hawala code or transaction ID

  @Column({ type: "integer", default: 0 })
  paymentAmount: number = 0; // Amount in AFN

  @Column({ type: "text", default: "" })
  adminNotes: string = ""; // Internal notes for processing
}
