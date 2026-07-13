import { BaseEntity, Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'class_subject_requirement' })
@Unique('UQ_class_subject_requirement_class_subject', ['classId', 'subjectId'])
@Check('CHK_class_subject_requirement_periods_positive', '"required_periods_per_week" > 0')
@Index('IDX_class_subject_requirement_class_id', ['classId'])
@Index('IDX_class_subject_requirement_subject_id', ['subjectId'])
export class ClassSubjectRequirement extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'class_id', type: 'integer' })
  classId: number;

  @Column({ name: 'subject_id', type: 'integer' })
  subjectId: number;

  @Column({ name: 'required_periods_per_week', type: 'integer' })
  requiredPeriodsPerWeek: number;

  @Column({ name: 'allow_split_assignment', type: 'boolean', default: false })
  allowSplitAssignment: boolean = false;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null = null;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
