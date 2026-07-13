import { MigrationInterface, QueryRunner, TableCheck, TableForeignKey } from 'typeorm';

type IntegrityRule = {
  name: string;
  query: string;
};

const integrityRules: IntegrityRule[] = [
  {
    name: 'class groups referencing missing academic years',
    query: `SELECT COUNT(*) AS count FROM class_group c LEFT JOIN academic_year a ON a.id = c.academicYearId WHERE c.academicYearId IS NOT NULL AND a.id IS NULL`,
  },
  {
    name: 'class groups referencing missing rooms',
    query: `SELECT COUNT(*) AS count FROM class_group c LEFT JOIN room r ON r.id = c.fixedRoomId WHERE c.fixedRoomId IS NOT NULL AND r.id IS NULL`,
  },
  {
    name: 'class groups referencing missing teachers',
    query: `SELECT COUNT(*) AS count FROM class_group c LEFT JOIN teacher t ON t.id = c.classTeacherId WHERE c.classTeacherId IS NOT NULL AND t.id IS NULL`,
  },
  {
    name: 'requirements referencing missing classes',
    query: `SELECT COUNT(*) AS count FROM class_subject_requirement r LEFT JOIN class_group c ON c.id = r.class_id WHERE c.id IS NULL`,
  },
  {
    name: 'requirements referencing missing subjects',
    query: `SELECT COUNT(*) AS count FROM class_subject_requirement r LEFT JOIN subject s ON s.id = r.subject_id WHERE s.id IS NULL`,
  },
  {
    name: 'capabilities referencing missing teachers',
    query: `SELECT COUNT(*) AS count FROM teacher_subject_capability c LEFT JOIN teacher t ON t.id = c.teacher_id WHERE t.id IS NULL`,
  },
  {
    name: 'capabilities referencing missing subjects',
    query: `SELECT COUNT(*) AS count FROM teacher_subject_capability c LEFT JOIN subject s ON s.id = c.subject_id WHERE s.id IS NULL`,
  },
  {
    name: 'assignments referencing missing requirements',
    query: `SELECT COUNT(*) AS count FROM teaching_assignment a LEFT JOIN class_subject_requirement r ON r.id = a.class_subject_requirement_id WHERE r.id IS NULL`,
  },
  {
    name: 'assignments referencing missing teachers',
    query: `SELECT COUNT(*) AS count FROM teaching_assignment a LEFT JOIN teacher t ON t.id = a.teacher_id WHERE t.id IS NULL`,
  },
  {
    name: 'legacy assignments referencing missing teachers',
    query: `SELECT COUNT(*) AS count FROM teacher_class_subject_assignment a LEFT JOIN teacher t ON t.id = a.teacherId WHERE t.id IS NULL`,
  },
  {
    name: 'legacy assignments referencing missing classes',
    query: `SELECT COUNT(*) AS count FROM teacher_class_subject_assignment a LEFT JOIN class_group c ON c.id = a.classId WHERE c.id IS NULL`,
  },
  {
    name: 'legacy assignments referencing missing subjects',
    query: `SELECT COUNT(*) AS count FROM teacher_class_subject_assignment a LEFT JOIN subject s ON s.id = a.subjectId WHERE s.id IS NULL`,
  },
  {
    name: 'terms referencing missing academic years',
    query: `SELECT COUNT(*) AS count FROM term t LEFT JOIN academic_year a ON a.id = t.academicYearId WHERE a.id IS NULL`,
  },
  {
    name: 'timetables referencing missing academic years',
    query: `SELECT COUNT(*) AS count FROM timetable t LEFT JOIN academic_year a ON a.id = t.academicYearId WHERE t.academicYearId IS NOT NULL AND a.id IS NULL`,
  },
  {
    name: 'timetables referencing missing terms',
    query: `SELECT COUNT(*) AS count FROM timetable t LEFT JOIN term x ON x.id = t.termId WHERE t.termId IS NOT NULL AND x.id IS NULL`,
  },
  {
    name: 'users referencing missing teachers',
    query: `SELECT COUNT(*) AS count FROM user u LEFT JOIN teacher t ON t.id = u.teacherId WHERE u.teacherId IS NOT NULL AND t.id IS NULL`,
  },
  {
    name: 'non-positive requirement periods',
    query: `SELECT COUNT(*) AS count FROM class_subject_requirement WHERE required_periods_per_week <= 0`,
  },
  {
    name: 'invalid capability levels',
    query: `SELECT COUNT(*) AS count FROM teacher_subject_capability WHERE capability_level NOT IN ('primary', 'allowed')`,
  },
  {
    name: 'non-positive assignment periods',
    query: `SELECT COUNT(*) AS count FROM teaching_assignment WHERE assigned_periods_per_week <= 0`,
  },
  {
    name: 'invalid assignment sources',
    query: `SELECT COUNT(*) AS count FROM teaching_assignment WHERE source NOT IN ('manual', 'solver', 'migration')`,
  },
  {
    name: 'non-positive legacy assignment periods',
    query: `SELECT COUNT(*) AS count FROM teacher_class_subject_assignment WHERE periodsPerWeek <= 0`,
  },
  {
    name: 'negative room capacities',
    query: `SELECT COUNT(*) AS count FROM room WHERE capacity < 0`,
  },
  {
    name: 'invalid subject grades',
    query: `SELECT COUNT(*) AS count FROM subject WHERE grade IS NOT NULL AND (grade < 1 OR grade > 12)`,
  },
  {
    name: 'negative subject periods',
    query: `SELECT COUNT(*) AS count FROM subject WHERE periodsPerWeek IS NOT NULL AND periodsPerWeek < 0`,
  },
  {
    name: 'negative teacher workload limits',
    query: `SELECT COUNT(*) AS count FROM teacher WHERE maxPeriodsPerWeek < 0 OR (maxPeriodsPerDay IS NOT NULL AND maxPeriodsPerDay < 0) OR (maxConsecutivePeriods IS NOT NULL AND maxConsecutivePeriods < 0)`,
  },
  {
    name: 'duplicate default school configurations',
    query: `SELECT COUNT(*) AS count FROM (SELECT 1 FROM school_config WHERE schoolId IS NULL GROUP BY schoolId HAVING COUNT(*) > 1)`,
  },
  {
    name: 'duplicate school configurations',
    query: `SELECT COUNT(*) AS count FROM (SELECT schoolId FROM school_config WHERE schoolId IS NOT NULL GROUP BY schoolId HAVING COUNT(*) > 1)`,
  },
  {
    name: 'duplicate active default curriculum configurations',
    query: `SELECT COUNT(*) AS count FROM (SELECT grade FROM curriculum_config WHERE schoolId IS NULL AND isDeleted = 0 GROUP BY grade HAVING COUNT(*) > 1)`,
  },
  {
    name: 'duplicate active curriculum configurations',
    query: `SELECT COUNT(*) AS count FROM (SELECT schoolId, grade FROM curriculum_config WHERE schoolId IS NOT NULL AND isDeleted = 0 GROUP BY schoolId, grade HAVING COUNT(*) > 1)`,
  },
];

async function assertValidExistingData(queryRunner: QueryRunner): Promise<void> {
  const failures: string[] = [];

  for (const rule of integrityRules) {
    const rows = (await queryRunner.query(rule.query)) as Array<{ count: number | string }>;
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) failures.push(`${rule.name}: ${count}`);
  }

  if (failures.length > 0) {
    throw new Error(
      `Database integrity migration stopped before modifying data. Repair these records first: ${failures.join('; ')}`
    );
  }
}

async function addForeignKeys(
  queryRunner: QueryRunner,
  tableName: string,
  definitions: TableForeignKey[]
): Promise<void> {
  const table = await queryRunner.getTable(tableName);
  if (!table) throw new Error(`Required table is missing: ${tableName}`);

  const missing = definitions.filter(
    (definition) => !table.foreignKeys.some((foreignKey) => foreignKey.name === definition.name)
  );
  if (missing.length > 0) await queryRunner.createForeignKeys(tableName, missing);
}

async function addChecks(
  queryRunner: QueryRunner,
  tableName: string,
  definitions: TableCheck[]
): Promise<void> {
  const table = await queryRunner.getTable(tableName);
  if (!table) throw new Error(`Required table is missing: ${tableName}`);

  const missing = definitions.filter(
    (definition) => !table.checks.some((check) => check.name === definition.name)
  );
  if (missing.length > 0) await queryRunner.createCheckConstraints(tableName, missing);
}

export class ReconcileDatabaseIntegrity1783800000000 implements MigrationInterface {
  name = 'ReconcileDatabaseIntegrity1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertValidExistingData(queryRunner);

    await addForeignKeys(queryRunner, 'term', [
      new TableForeignKey({
        name: 'FK_term_academic_year',
        columnNames: ['academicYearId'],
        referencedTableName: 'academic_year',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await addForeignKeys(queryRunner, 'class_group', [
      new TableForeignKey({
        name: 'FK_class_group_academic_year',
        columnNames: ['academicYearId'],
        referencedTableName: 'academic_year',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_class_group_fixed_room',
        columnNames: ['fixedRoomId'],
        referencedTableName: 'room',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_class_group_class_teacher',
        columnNames: ['classTeacherId'],
        referencedTableName: 'teacher',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await addForeignKeys(queryRunner, 'class_subject_requirement', [
      new TableForeignKey({
        name: 'FK_class_subject_requirement_class',
        columnNames: ['class_id'],
        referencedTableName: 'class_group',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_class_subject_requirement_subject',
        columnNames: ['subject_id'],
        referencedTableName: 'subject',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
    await addChecks(queryRunner, 'class_subject_requirement', [
      new TableCheck({
        name: 'CHK_class_subject_requirement_periods_positive',
        expression: '"required_periods_per_week" > 0',
      }),
    ]);

    await addForeignKeys(queryRunner, 'teacher_subject_capability', [
      new TableForeignKey({
        name: 'FK_teacher_subject_capability_teacher',
        columnNames: ['teacher_id'],
        referencedTableName: 'teacher',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_teacher_subject_capability_subject',
        columnNames: ['subject_id'],
        referencedTableName: 'subject',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
    await addChecks(queryRunner, 'teacher_subject_capability', [
      new TableCheck({
        name: 'CHK_teacher_subject_capability_level',
        expression: `"capability_level" IN ('primary', 'allowed')`,
      }),
    ]);

    await addForeignKeys(queryRunner, 'teaching_assignment', [
      new TableForeignKey({
        name: 'FK_teaching_assignment_requirement',
        columnNames: ['class_subject_requirement_id'],
        referencedTableName: 'class_subject_requirement',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_teaching_assignment_teacher',
        columnNames: ['teacher_id'],
        referencedTableName: 'teacher',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
    await addChecks(queryRunner, 'teaching_assignment', [
      new TableCheck({
        name: 'CHK_teaching_assignment_periods_positive',
        expression: '"assigned_periods_per_week" > 0',
      }),
      new TableCheck({
        name: 'CHK_teaching_assignment_source',
        expression: `"source" IN ('manual', 'solver', 'migration')`,
      }),
    ]);

    await addForeignKeys(queryRunner, 'teacher_class_subject_assignment', [
      new TableForeignKey({
        name: 'FK_tcsa_teacher',
        columnNames: ['teacherId'],
        referencedTableName: 'teacher',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_tcsa_class',
        columnNames: ['classId'],
        referencedTableName: 'class_group',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_tcsa_subject',
        columnNames: ['subjectId'],
        referencedTableName: 'subject',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
    await addChecks(queryRunner, 'teacher_class_subject_assignment', [
      new TableCheck({
        name: 'CHK_tcsa_periods_positive',
        expression: '"periodsPerWeek" > 0',
      }),
    ]);

    await addForeignKeys(queryRunner, 'timetable', [
      new TableForeignKey({
        name: 'FK_timetable_academic_year',
        columnNames: ['academicYearId'],
        referencedTableName: 'academic_year',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_timetable_term',
        columnNames: ['termId'],
        referencedTableName: 'term',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await addForeignKeys(queryRunner, 'user', [
      new TableForeignKey({
        name: 'FK_user_teacher',
        columnNames: ['teacherId'],
        referencedTableName: 'teacher',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await addChecks(queryRunner, 'room', [
      new TableCheck({ name: 'CHK_room_capacity_nonnegative', expression: '"capacity" >= 0' }),
    ]);
    await addChecks(queryRunner, 'subject', [
      new TableCheck({
        name: 'CHK_subject_grade',
        expression: '"grade" IS NULL OR ("grade" >= 1 AND "grade" <= 12)',
      }),
      new TableCheck({
        name: 'CHK_subject_periods_nonnegative',
        expression: '"periodsPerWeek" IS NULL OR "periodsPerWeek" >= 0',
      }),
    ]);
    await addChecks(queryRunner, 'teacher', [
      new TableCheck({
        name: 'CHK_teacher_workload_nonnegative',
        expression:
          '"maxPeriodsPerWeek" >= 0 AND ("maxPeriodsPerDay" IS NULL OR "maxPeriodsPerDay" >= 0) AND ("maxConsecutivePeriods" IS NULL OR "maxConsecutivePeriods" >= 0)',
      }),
    ]);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_school_config_default" ON "school_config" ((1)) WHERE "schoolId" IS NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_school_config_school" ON "school_config" ("schoolId") WHERE "schoolId" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_curriculum_config_default_grade" ON "curriculum_config" ("grade") WHERE "schoolId" IS NULL AND "isDeleted" = 0`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_curriculum_config_school_grade" ON "curriculum_config" ("schoolId", "grade") WHERE "schoolId" IS NOT NULL AND "isDeleted" = 0`
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Integrity constraints protect persisted user data and cannot be rolled back automatically.'
    );
  }
}
