import { MigrationInterface, QueryRunner, TableCheck, TableColumn } from 'typeorm';
import { logger } from '../../utils/logger';

export class CanonicalAssignmentCommands1784600000000 implements MigrationInterface {
  name = 'CanonicalAssignmentCommands1784600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const requirementTable = await queryRunner.getTable('class_subject_requirement');
    if (!requirementTable) throw new Error('class_subject_requirement table is required');
    if (!requirementTable.findColumnByName('assignment_version')) {
      await queryRunner.addColumn(
        'class_subject_requirement',
        new TableColumn({
          name: 'assignment_version',
          type: 'integer',
          isNullable: false,
          default: 0,
        })
      );
    }

    await queryRunner.query(
      `UPDATE "teaching_assignment" SET "source" = 'manual' WHERE "source" = 'solver'`
    );
    const assignmentTable = await queryRunner.getTable('teaching_assignment');
    if (!assignmentTable) throw new Error('teaching_assignment table is required');
    const oldCheck = assignmentTable.checks.find(
      (check) => check.name === 'CHK_teaching_assignment_source'
    );
    if (oldCheck) {
      await queryRunner.dropCheckConstraint('teaching_assignment', oldCheck);
    }
    await queryRunner.createCheckConstraint(
      'teaching_assignment',
      new TableCheck({
        name: 'CHK_teaching_assignment_source',
        expression: `"source" IN ('manual', 'single_teacher', 'migration')`,
      })
    );

    logger.info('Migration applied: Added canonical assignment versioning and sources');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "teaching_assignment" SET "source" = 'manual' WHERE "source" = 'single_teacher'`
    );
    const assignmentTable = await queryRunner.getTable('teaching_assignment');
    const sourceCheck = assignmentTable?.checks.find(
      (check) => check.name === 'CHK_teaching_assignment_source'
    );
    if (sourceCheck) await queryRunner.dropCheckConstraint('teaching_assignment', sourceCheck);
    await queryRunner.createCheckConstraint(
      'teaching_assignment',
      new TableCheck({
        name: 'CHK_teaching_assignment_source',
        expression: `"source" IN ('manual', 'solver', 'migration')`,
      })
    );
    const requirementTable = await queryRunner.getTable('class_subject_requirement');
    if (requirementTable?.findColumnByName('assignment_version')) {
      await queryRunner.dropColumn('class_subject_requirement', 'assignment_version');
    }
  }
}
