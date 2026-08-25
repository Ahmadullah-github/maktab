import { BaseEntity, Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'school_curriculum_item' })
@Unique('UQ_school_curriculum_item_grade_code', ['planId', 'grade', 'normalizedCode'])
@Index('IDX_school_curriculum_item_plan_grade', ['planId', 'grade'])
@Check('CHK_school_curriculum_item_grade', '"grade" BETWEEN 1 AND 12')
@Check('CHK_school_curriculum_item_periods', '"weeklyPeriods" BETWEEN 1 AND 84')
export class SchoolCurriculumItem extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'integer' })
  planId: number;

  @Column({ type: 'integer' })
  grade: number;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  nameEn: string | null = null;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  normalizedCode: string;

  @Column({ type: 'integer' })
  weeklyPeriods: number;

  @Column({ type: 'boolean', default: false })
  isDifficult: boolean = false;

  @Column({ type: 'text', nullable: true })
  requiredRoomType: string | null = null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
