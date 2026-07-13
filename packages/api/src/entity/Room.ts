import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, Index, Check } from "typeorm";

/**
 * Room entity with database indexes for optimized queries
 * 
 * Requirements: 4.4, 4.8
 * - Index on name column for room lookups by name
 * - Index on schoolId column for future multi-tenancy queries
 */
@Entity()
@Index(['name'])
@Index(['schoolId'])
@Check('CHK_room_capacity_nonnegative', '"capacity" >= 0')
export class Room extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "integer", nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

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

  @Column({ type: "boolean", default: false })
  isDeleted: boolean = false;

  @Column({ type: "datetime", nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date = new Date();

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt: Date = new Date();
}
