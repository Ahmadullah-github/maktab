import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Core entities
import { ClassGroup } from './src/entity/ClassGroup';
import { Configuration } from './src/entity/Configuration';
import { CurriculumConfig } from './src/entity/CurriculumConfig';
import { Room } from './src/entity/Room';
import { RoomType } from './src/entity/RoomType';
import { SchoolConfig } from './src/entity/SchoolConfig';
import { Subject } from './src/entity/Subject';
import { Teacher } from './src/entity/Teacher';
import { TeacherClassSubjectAssignment } from './src/entity/TeacherClassSubjectAssignment';
import { Timetable } from './src/entity/Timetable';
import { WizardStep } from './src/entity/WizardStep';
// License entities
import { ContactRequest } from './src/entity/ContactRequest';
import { DeviceTrial } from './src/entity/DeviceTrial';
import { License } from './src/entity/License';
// Foundation entities (for future expansion)
import { AcademicYear } from './src/entity/AcademicYear';
import { AuditLog } from './src/entity/AuditLog';
import { Term } from './src/entity/Term';
import { User } from './src/entity/User';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'timetable.db',
  synchronize: true,
  logging: false,
  entities: [
    // Core timetable entities
    Teacher,
    Subject,
    Room,
    ClassGroup,
    Timetable,
    Configuration,
    WizardStep,
    SchoolConfig,
    CurriculumConfig,
    TeacherClassSubjectAssignment,
    RoomType,
    // License system
    License,
    ContactRequest,
    DeviceTrial,
    // Foundation for future (v2.0+)
    AcademicYear,
    Term,
    User,
    AuditLog,
  ],
  migrations: ['dist/src/migration/**/*.js'],
  subscribers: ['dist/src/subscriber/**/*.js'],
});
