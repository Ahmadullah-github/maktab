import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Room extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  name: string = "";

  @Column({ type: "integer" })
  capacity: number = 0;

  @Column({ type: "text" })
  type: string = "";

  @Column({ type: "text", nullable: true })
  features: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  unavailable: string = ""; // JSON string of unavailable slots

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON string of metadata

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
