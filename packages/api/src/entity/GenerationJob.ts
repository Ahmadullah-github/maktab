import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

export type GenerationJobMode = 'quick' | 'improve';
export type GenerationJobStatus =
  | 'queued'
  | 'preparing'
  | 'analyzing'
  | 'solving'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Durable record for a solver run. Large solver payloads are intentionally not stored here. */
@Entity({ name: 'generation_job' })
export class GenerationJob extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  id: string = '';

  @Column({ type: 'text', default: 'quick' })
  mode: GenerationJobMode = 'quick';

  @Column({ type: 'text', default: 'queued' })
  status: GenerationJobStatus = 'queued';

  @Column({ type: 'integer', nullable: true })
  schoolId: number | null = null;

  @Column({ type: 'integer', nullable: true })
  sourceTimetableId: number | null = null;

  @Column({ type: 'integer', nullable: true })
  resultTimetableId: number | null = null;

  @Column({ type: 'integer', nullable: true })
  resultCandidateId: number | null = null;

  @Column({ type: 'real', default: 0 })
  progress: number = 0;

  @Column({ type: 'text', nullable: true })
  phase: string | null = null;

  @Column({ type: 'text', nullable: true })
  phaseFarsi: string | null = null;

  @Column({ type: 'boolean', default: false })
  cancelRequested: boolean = false;

  @Column({ type: 'text', default: '{}' })
  requestJson: string = '{}';

  @Column({ type: 'text', default: '{}' })
  effectiveConfigJson: string = '{}';

  @Column({ type: 'text', default: '{}' })
  metricsJson: string = '{}';

  @Column({ type: 'text', default: '[]' })
  issuesJson: string = '[]';

  @Column({ type: 'text', nullable: true })
  failureCode: string | null = null;

  @Column({ type: 'text', nullable: true })
  diagnosticId: string | null = null;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null = null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt: Date | null = null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
