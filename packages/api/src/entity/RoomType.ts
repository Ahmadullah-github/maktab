import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * RoomType entity for configurable room types
 *
 * Stores room type definitions that can be customized per school.
 * System types (isSystem=true) are seeded on first run and cannot be deleted.
 */
@Entity()
@Index(['value'], { unique: true })
@Index(['sortOrder'])
export class RoomType extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  value: string = ''; // e.g., 'computer_lab', 'gym'

  @Column({ type: 'text' })
  label: string = ''; // e.g., 'لابراتوار کمپیوتر'

  @Column({ type: 'text', nullable: true })
  icon: string | null = null; // Icon name (e.g., 'Beaker', 'Building')

  @Column({ type: 'integer', default: 0 })
  sortOrder: number = 0;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean = false; // System types cannot be deleted

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
