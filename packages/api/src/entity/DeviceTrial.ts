/**
 * DeviceTrial entity - tracks 7-day trial per machine ID
 * Prevents trial abuse by tracking device fingerprints
 *
 * Requirements: License System - Auto-trial based on machine ID
 */

import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['machineId'], { unique: true })
export class DeviceTrial extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  machineId: string = '';

  @Column({ type: 'datetime' })
  trialStartedAt: Date = new Date();

  @Column({ type: 'datetime' })
  trialExpiresAt: Date = new Date();

  @Column({ type: 'boolean', default: false })
  trialUsed: boolean = false;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
