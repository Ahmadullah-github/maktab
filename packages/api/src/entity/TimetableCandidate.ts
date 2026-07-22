import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TimetableCandidateStatus = 'available' | 'accepted' | 'discarded';

/** An improved or interrupted incumbent that is never allowed to overwrite a timetable. */
@Entity({ name: 'timetable_candidate' })
export class TimetableCandidate extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ type: 'text', unique: true })
  jobId: string = '';

  @Column({ type: 'integer', nullable: true })
  schoolId: number | null = null;

  @Column({ type: 'integer', nullable: true })
  sourceTimetableId: number | null = null;

  @Column({ type: 'integer', nullable: true })
  acceptedTimetableId: number | null = null;

  @Column({ type: 'text', default: 'available' })
  status: TimetableCandidateStatus = 'available';

  @Column({ type: 'text' })
  data: string = '';

  @Column({ type: 'real', nullable: true })
  sourceQualityScore: number | null = null;

  @Column({ type: 'real', nullable: true })
  qualityScore: number | null = null;

  @Column({ type: 'real', nullable: true })
  objectiveValue: number | null = null;

  @Column({ type: 'real', nullable: true })
  bestBound: number | null = null;

  @Column({ type: 'real', nullable: true })
  relativeGap: number | null = null;

  @Column({ type: 'boolean', default: false })
  interrupted: boolean = false;

  @Column({ type: 'text', default: '{}' })
  metricsJson: string = '{}';

  @Column({ type: 'datetime', nullable: true })
  acceptedAt: Date | null = null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
