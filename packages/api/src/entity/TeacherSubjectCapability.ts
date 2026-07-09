import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type TeacherCapabilityLevel = 'primary' | 'allowed';

@Entity({ name: 'teacher_subject_capability' })
@Unique('UQ_teacher_subject_capability_teacher_subject', ['teacherId', 'subjectId'])
@Index('IDX_teacher_subject_capability_teacher_id', ['teacherId'])
@Index('IDX_teacher_subject_capability_subject_id', ['subjectId'])
export class TeacherSubjectCapability extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'teacher_id', type: 'integer' })
  teacherId: number;

  @Column({ name: 'subject_id', type: 'integer' })
  subjectId: number;

  @Column({ name: 'capability_level', type: 'text' })
  capabilityLevel: TeacherCapabilityLevel;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null = null;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
