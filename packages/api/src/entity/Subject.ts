import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Subject extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  name: string = "";

  @Column({ type: "text", nullable: true })
  code: string = "";

  @Column({ type: "text", nullable: true })
  requiredRoomType: string = "";

  @Column({ type: "text", nullable: true })
  requiredFeatures: string = ""; // JSON string array

  @Column({ type: "text", nullable: true })
  desiredFeatures: string = ""; // JSON string array

  @Column({ type: "boolean", nullable: true })
  isDifficult: boolean = false;

  @Column({ type: "integer", nullable: true })
  minRoomCapacity: number = 0;

  @Column({ type: "text", nullable: true })
  meta: string = ""; // JSON string of metadata

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
