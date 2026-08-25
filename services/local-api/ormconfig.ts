import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Core entities
import { ClassGroup } from './src/entity/ClassGroup';
import { ClassSubjectRequirement } from './src/entity/ClassSubjectRequirement';
import { Configuration } from './src/entity/Configuration';
import { SchoolCurriculumItem } from './src/entity/SchoolCurriculumItem';
import { SchoolCurriculumPlan } from './src/entity/SchoolCurriculumPlan';
import { Room } from './src/entity/Room';
import { RoomType } from './src/entity/RoomType';
import { SchoolConfig } from './src/entity/SchoolConfig';
import { Subject } from './src/entity/Subject';
import { Teacher } from './src/entity/Teacher';
import { TeacherSubjectCapability } from './src/entity/TeacherSubjectCapability';
import { TeachingAssignment } from './src/entity/TeachingAssignment';
import { Timetable } from './src/entity/Timetable';
import { WizardStep } from './src/entity/WizardStep';
// Foundation entities (for future expansion)
import { AcademicYear } from './src/entity/AcademicYear';
import { AuditLog } from './src/entity/AuditLog';
import { Term } from './src/entity/Term';
import { User } from './src/entity/User';
import { TYPEORM_MIGRATIONS } from './src/database/migrationRegistry';

export const databasePath = process.env.DATABASE_PATH || 'timetable.db';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: databasePath,
  synchronize: false,
  migrationsRun: true,
  migrationsTransactionMode: 'all',
  logging: false,
  invalidWhereValuesBehavior: {
    null: 'throw',
    undefined: 'throw',
  },
  entities: [
    // Core timetable entities
    Teacher,
    Subject,
    Room,
    ClassGroup,
    ClassSubjectRequirement,
    Timetable,
    Configuration,
    WizardStep,
    SchoolConfig,
    SchoolCurriculumPlan,
    SchoolCurriculumItem,
    TeacherSubjectCapability,
    TeachingAssignment,
    RoomType,
    // Foundation for future (v2.0+)
    AcademicYear,
    Term,
    User,
    AuditLog,
  ],
  migrations: TYPEORM_MIGRATIONS,
  subscribers: [],
  prepareDatabase: (database) => {
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
    database.pragma('busy_timeout = 5000');
  },
});
