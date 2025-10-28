import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  Index,
} from "typeorm";

@Entity()
@Index(["wizardId", "stepKey"], { unique: true })
export class WizardStep extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer" })
  wizardId: number = 0;

  @Column({ type: "text" })
  stepKey: string = "";

  @Column({ type: "text" })
  data: string = ""; // JSON string of the step data

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
