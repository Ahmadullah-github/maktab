import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type TeachingAssignmentSource = 'manual' | 'solver' | 'migration';

@Entity({ name: 'teaching_assignment' })
@Unique('UQ_teaching_assignment_requirement_teacher', ['classSubjectRequirementId', 'teacherId'])
@Index('IDX_teaching_assignment_requirement_id', ['classSubjectRequirementId'])
@Index('IDX_teaching_assignment_teacher_id', ['teacherId'])
export class TeachingAssignment extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'class_subject_requirement_id', type: 'integer' })
  classSubjectRequirementId: number;

  @Column({ name: 'teacher_id', type: 'integer' })
  teacherId: number;

  @Column({ name: 'assigned_periods_per_week', type: 'integer' })
  assignedPeriodsPerWeek: number;

  @Column({ name: 'is_fixed', type: 'boolean', default: true })
  isFixed: boolean = true;

  @Column({ name: 'source', type: 'text', default: 'manual' })
  source: TeachingAssignmentSource = 'manual';

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null = null;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
