import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'school_curriculum_plan' })
@Index('IDX_school_curriculum_plan_school', ['schoolId'], { unique: true })
export class SchoolCurriculumPlan extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: true })
  schoolId: number | null = null;

  @Column({ type: 'integer', default: 0 })
  revision: number = 0;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
