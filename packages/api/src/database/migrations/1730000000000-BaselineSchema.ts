import { MigrationInterface, QueryRunner } from 'typeorm';

type TableDefinition = {
  name: string;
  sql: string;
};

const tables: TableDefinition[] = [
  {
    name: 'academic_year',
    sql: `CREATE TABLE "academic_year" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "name" text NOT NULL,
      "displayName" text,
      "startDate" date NOT NULL,
      "endDate" date NOT NULL,
      "isCurrent" boolean NOT NULL DEFAULT (0),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "meta" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'audit_log',
    sql: `CREATE TABLE "audit_log" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "userId" integer,
      "userName" text,
      "action" text NOT NULL,
      "entityType" text NOT NULL,
      "entityId" integer,
      "entityName" text,
      "oldValue" text,
      "newValue" text,
      "changedFields" text,
      "ipAddress" text,
      "userAgent" text,
      "timestamp" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'class_group',
    sql: `CREATE TABLE "class_group" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "academicYearId" integer,
      "name" text NOT NULL,
      "displayName" text,
      "section" text,
      "grade" integer,
      "sectionIndex" text,
      "studentCount" integer NOT NULL,
      "fixedRoomId" integer,
      "singleTeacherMode" boolean NOT NULL DEFAULT (0),
      "classTeacherId" integer,
      "subjectRequirements" text NOT NULL,
      "meta" text,
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'class_subject_requirement',
    sql: `CREATE TABLE "class_subject_requirement" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "class_id" integer NOT NULL,
      "subject_id" integer NOT NULL,
      "required_periods_per_week" integer NOT NULL,
      "allow_split_assignment" boolean NOT NULL DEFAULT (0),
      "is_deleted" boolean NOT NULL DEFAULT (0),
      "deleted_at" datetime,
      "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_class_subject_requirement_class_subject" UNIQUE ("class_id", "subject_id")
    )`,
  },
  {
    name: 'configuration',
    sql: `CREATE TABLE "configuration" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "key" text NOT NULL,
      "value" text NOT NULL,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_configuration_key" UNIQUE ("key")
    )`,
  },
  {
    name: 'contact_request',
    sql: `CREATE TABLE "contact_request" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolName" text NOT NULL,
      "contactName" text NOT NULL,
      "contactPhone" text NOT NULL,
      "preferredMethod" text NOT NULL,
      "requestType" text NOT NULL,
      "message" text,
      "currentLicenseKey" text,
      "isProcessed" boolean NOT NULL DEFAULT (0),
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "province" text NOT NULL DEFAULT (''),
      "machineId" text NOT NULL DEFAULT (''),
      "paymentMethod" text NOT NULL DEFAULT (''),
      "paymentReference" text NOT NULL DEFAULT (''),
      "paymentAmount" integer NOT NULL DEFAULT (0),
      "adminNotes" text NOT NULL DEFAULT ('')
    )`,
  },
  {
    name: 'curriculum_config',
    sql: `CREATE TABLE "curriculum_config" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "grade" integer NOT NULL,
      "useMinistryDefaults" boolean NOT NULL DEFAULT (1),
      "overridesJson" text NOT NULL DEFAULT ('[]'),
      "customSubjectsJson" text NOT NULL DEFAULT ('[]'),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'device_trial',
    sql: `CREATE TABLE "device_trial" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "machineId" text NOT NULL,
      "trialStartedAt" datetime NOT NULL,
      "trialExpiresAt" datetime NOT NULL,
      "trialUsed" boolean NOT NULL DEFAULT (0),
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_device_trial_machine" UNIQUE ("machineId")
    )`,
  },
  {
    name: 'license',
    sql: `CREATE TABLE "license" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "licenseKey" text NOT NULL,
      "schoolName" text NOT NULL,
      "contactName" text,
      "contactPhone" text,
      "licenseType" text NOT NULL,
      "activatedAt" datetime NOT NULL,
      "expiresAt" datetime NOT NULL,
      "gracePeriodDays" integer NOT NULL DEFAULT (7),
      "isActive" boolean NOT NULL DEFAULT (1),
      "machineId" text,
      "meta" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_license_key" UNIQUE ("licenseKey")
    )`,
  },
  {
    name: 'room',
    sql: `CREATE TABLE "room" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "name" text NOT NULL,
      "capacity" integer NOT NULL,
      "type" text NOT NULL,
      "features" text,
      "unavailable" text,
      "meta" text,
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'room_type',
    sql: `CREATE TABLE "room_type" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "value" text NOT NULL,
      "label" text NOT NULL,
      "icon" text,
      "sortOrder" integer NOT NULL DEFAULT (0),
      "isSystem" boolean NOT NULL DEFAULT (0),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_room_type_value" UNIQUE ("value")
    )`,
  },
  {
    name: 'school_config',
    sql: `CREATE TABLE "school_config" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "schoolName" text,
      "enablePrimary" boolean NOT NULL DEFAULT (1),
      "enableMiddle" boolean NOT NULL DEFAULT (1),
      "enableHigh" boolean NOT NULL DEFAULT (1),
      "daysPerWeek" integer NOT NULL DEFAULT (6),
      "periodsPerDay" integer NOT NULL DEFAULT (7),
      "breakPeriods" text,
      "enableMinistryValidation" boolean NOT NULL DEFAULT (0),
      "ministryValidationMode" text NOT NULL DEFAULT ('warn'),
      "customCurriculumMode" boolean NOT NULL DEFAULT (0),
      "autoPopulateCurriculum" boolean NOT NULL DEFAULT (1),
      "lowResourceMode" boolean NOT NULL DEFAULT (0),
      "daysOfWeekJson" text,
      "periodsPerDayMapJson" text,
      "defaultPeriodsPerDay" integer NOT NULL DEFAULT (7),
      "schoolStartTime" text NOT NULL DEFAULT ('07:30'),
      "timezone" text NOT NULL DEFAULT ('Asia/Kabul'),
      "shiftMode" text NOT NULL DEFAULT ('single'),
      "shiftsConfigJson" text,
      "periodDuration" integer NOT NULL DEFAULT (45),
      "dynamicPeriodsEnabled" boolean NOT NULL DEFAULT (0),
      "categoryPeriodsEnabled" boolean NOT NULL DEFAULT (0),
      "categoryPeriodsMapJson" text,
      "breakPeriodsByDayJson" text,
      "prayerBreaksJson" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'subject',
    sql: `CREATE TABLE "subject" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "name" text NOT NULL,
      "code" text,
      "grade" integer,
      "periodsPerWeek" integer,
      "section" text,
      "requiredRoomType" text,
      "requiredFeatures" text,
      "desiredFeatures" text,
      "isDifficult" boolean,
      "minRoomCapacity" integer,
      "meta" text,
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'teacher',
    sql: `CREATE TABLE "teacher" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "fullName" text NOT NULL,
      "primarySubjectIds" text NOT NULL,
      "allowedSubjectIds" text,
      "restrictToPrimarySubjects" boolean,
      "availability" text NOT NULL,
      "unavailable" text,
      "maxPeriodsPerWeek" integer NOT NULL,
      "maxPeriodsPerDay" integer,
      "maxConsecutivePeriods" integer,
      "timePreference" text,
      "preferredRoomIds" text,
      "preferredColleagues" text,
      "classAssignments" text,
      "meta" text,
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'teacher_class_subject_assignment',
    sql: `CREATE TABLE "teacher_class_subject_assignment" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "teacherId" integer NOT NULL,
      "classId" integer NOT NULL,
      "subjectId" integer NOT NULL,
      "periodsPerWeek" integer NOT NULL,
      "isFixed" boolean NOT NULL DEFAULT (1),
      "schoolId" integer,
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_teacher_class_subject_assignment" UNIQUE ("teacherId", "classId", "subjectId")
    )`,
  },
  {
    name: 'teacher_subject_capability',
    sql: `CREATE TABLE "teacher_subject_capability" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "teacher_id" integer NOT NULL,
      "subject_id" integer NOT NULL,
      "capability_level" text NOT NULL,
      "is_deleted" boolean NOT NULL DEFAULT (0),
      "deleted_at" datetime,
      "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_teacher_subject_capability_teacher_subject" UNIQUE ("teacher_id", "subject_id")
    )`,
  },
  {
    name: 'teaching_assignment',
    sql: `CREATE TABLE "teaching_assignment" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "class_subject_requirement_id" integer NOT NULL,
      "teacher_id" integer NOT NULL,
      "assigned_periods_per_week" integer NOT NULL,
      "is_fixed" boolean NOT NULL DEFAULT (1),
      "source" text NOT NULL DEFAULT ('manual'),
      "is_deleted" boolean NOT NULL DEFAULT (0),
      "deleted_at" datetime,
      "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_teaching_assignment_requirement_teacher" UNIQUE ("class_subject_requirement_id", "teacher_id")
    )`,
  },
  {
    name: 'term',
    sql: `CREATE TABLE "term" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "academicYearId" integer NOT NULL,
      "name" text NOT NULL,
      "termNumber" integer NOT NULL DEFAULT (1),
      "startDate" date NOT NULL,
      "endDate" date NOT NULL,
      "isCurrent" boolean NOT NULL DEFAULT (0),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "meta" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'timetable',
    sql: `CREATE TABLE "timetable" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "academicYearId" integer,
      "termId" integer,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "data" text NOT NULL,
      "revision" integer NOT NULL DEFAULT (1),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'user',
    sql: `CREATE TABLE "user" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "schoolId" integer,
      "username" text NOT NULL,
      "email" text,
      "passwordHash" text NOT NULL,
      "fullName" text NOT NULL,
      "phone" text,
      "roles" text NOT NULL DEFAULT ('[]'),
      "permissions" text NOT NULL DEFAULT ('[]'),
      "teacherId" integer,
      "preferredLanguage" text,
      "isActive" boolean NOT NULL DEFAULT (1),
      "isDeleted" boolean NOT NULL DEFAULT (0),
      "deletedAt" datetime,
      "lastLoginAt" datetime,
      "meta" text,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
  {
    name: 'wizard_step',
    sql: `CREATE TABLE "wizard_step" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "wizardId" integer NOT NULL,
      "stepKey" text NOT NULL,
      "data" text NOT NULL,
      "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`,
  },
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS "IDX_class_group_school" ON "class_group" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_class_group_fixed_room" ON "class_group" ("fixedRoomId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_class_group_name" ON "class_group" ("name")`,
  `CREATE INDEX IF NOT EXISTS "IDX_class_subject_requirement_subject_id" ON "class_subject_requirement" ("subject_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_class_subject_requirement_class_id" ON "class_subject_requirement" ("class_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_curriculum_config_school_grade" ON "curriculum_config" ("schoolId", "grade")`,
  `CREATE INDEX IF NOT EXISTS "IDX_curriculum_config_school" ON "curriculum_config" ("schoolId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_trial_machine" ON "device_trial" ("machineId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_license_active" ON "license" ("isActive")`,
  `CREATE INDEX IF NOT EXISTS "IDX_room_school" ON "room" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_room_name" ON "room" ("name")`,
  `CREATE INDEX IF NOT EXISTS "IDX_room_type_sort" ON "room_type" ("sortOrder")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_room_type_value" ON "room_type" ("value")`,
  `CREATE INDEX IF NOT EXISTS "IDX_school_config_school" ON "school_config" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_subject_school" ON "subject" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_subject_grade_code" ON "subject" ("grade", "code")`,
  `CREATE INDEX IF NOT EXISTS "IDX_subject_grade_name" ON "subject" ("grade", "name")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teacher_school" ON "teacher" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teacher_name" ON "teacher" ("fullName")`,
  `CREATE INDEX IF NOT EXISTS "IDX_tcsa_school" ON "teacher_class_subject_assignment" ("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_tcsa_subject" ON "teacher_class_subject_assignment" ("subjectId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_tcsa_teacher" ON "teacher_class_subject_assignment" ("teacherId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_tcsa_class_subject" ON "teacher_class_subject_assignment" ("classId", "subjectId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teacher_subject_capability_subject_id" ON "teacher_subject_capability" ("subject_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teacher_subject_capability_teacher_id" ON "teacher_subject_capability" ("teacher_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teaching_assignment_teacher_id" ON "teaching_assignment" ("teacher_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_teaching_assignment_requirement_id" ON "teaching_assignment" ("class_subject_requirement_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wizard_step_key" ON "wizard_step" ("wizardId", "stepKey")`,
];

export class BaselineSchema1730000000000 implements MigrationInterface {
  name = 'BaselineSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      if (!(await queryRunner.hasTable(table.name))) {
        await queryRunner.query(table.sql);
      }
    }

    // A database created by a newer synchronized schema may have no migration
    // ledger. Restore the historical teacher columns long enough for the
    // managed migration chain to be adopted; the latest migration removes them
    // again after older migrations have inspected/repaired their values.
    const teacherTable = await queryRunner.getTable('teacher');
    if (teacherTable && !teacherTable.findColumnByName('availability')) {
      await queryRunner.query(
        `ALTER TABLE "teacher" ADD COLUMN "availability" text NOT NULL DEFAULT '{}'`
      );
    }
    if (teacherTable && !teacherTable.findColumnByName('maxPeriodsPerDay')) {
      await queryRunner.query(`ALTER TABLE "teacher" ADD COLUMN "maxPeriodsPerDay" integer`);
    }
    if (teacherTable && !teacherTable.findColumnByName('maxConsecutivePeriods')) {
      await queryRunner.query(`ALTER TABLE "teacher" ADD COLUMN "maxConsecutivePeriods" integer`);
    }

    for (const index of indexes) {
      await queryRunner.query(index);
    }
  }

  public async down(): Promise<void> {
    throw new Error(
      'The baseline schema is data-preserving and cannot be rolled back automatically.'
    );
  }
}
