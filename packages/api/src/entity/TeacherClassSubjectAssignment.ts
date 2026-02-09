import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * TeacherClassSubjectAssignment entity
 *
 * Represents a teacher's assignment to teach a specific subject for a specific class.
 * Supports partial period assignments (e.g., Teacher A teaches 1 of 2 History periods).
 *
 * Key features:
 * - Unique constraint on (teacherId, classId, subjectId) to prevent duplicates
 * - isFixed flag indicates whether solver MUST use this teacher (true) or can reassign (false)
 * - periodsPerWeek can be partial (less than class's total requirement for the subject)
 *
 * Requirements: Multi-teacher subject assignment support
 */
@Entity()
@Unique(['teacherId', 'classId', 'subjectId'])
@Index(['classId', 'subjectId'])
@Index(['teacherId'])
@Index(['subjectId'])
@Index(['schoolId'])
export class TeacherClassSubjectAssignment extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  teacherId: number;

  @Column({ type: 'integer' })
  classId: number;

  @Column({ type: 'integer' })
  subjectId: number;

  /**
   * Number of periods per week this teacher teaches for this subject in this class.
   * Can be partial (e.g., 1 out of 2 total periods required).
   */
  @Column({ type: 'integer' })
  periodsPerWeek: number;

  /**
   * If true, the solver MUST use this teacher for these periods (hard constraint).
   * If false, the solver can reassign if needed (soft constraint / suggestion).
   */
  @Column({ type: 'boolean', default: true })
  isFixed: boolean = true;

  /**
   * For future multi-tenancy support
   */
  @Column({ type: 'integer', nullable: true })
  schoolId: number | null = null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null = null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();
}
