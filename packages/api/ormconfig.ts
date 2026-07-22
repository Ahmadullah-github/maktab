import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Core entities
import { ClassGroup } from './src/entity/ClassGroup';
import { ClassSubjectRequirement } from './src/entity/ClassSubjectRequirement';
import { Configuration } from './src/entity/Configuration';
import { CurriculumConfig } from './src/entity/CurriculumConfig';
import { Room } from './src/entity/Room';
import { RoomType } from './src/entity/RoomType';
import { SchoolConfig } from './src/entity/SchoolConfig';
import { SchoolProfile } from './src/entity/SchoolProfile';
import { Subject } from './src/entity/Subject';
import { Teacher } from './src/entity/Teacher';
import { TeacherClassSubjectAssignment } from './src/entity/TeacherClassSubjectAssignment';
import { TeacherSubjectCapability } from './src/entity/TeacherSubjectCapability';
import { TeachingAssignment } from './src/entity/TeachingAssignment';
import { Timetable } from './src/entity/Timetable';
import { GenerationJob } from './src/entity/GenerationJob';
import { TimetableCandidate } from './src/entity/TimetableCandidate';
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
import { BaselineSchema1730000000000 } from './src/database/migrations/1730000000000-BaselineSchema';
import { AddFixedRoomToClassGroup1730826000000 } from './src/database/migrations/1730826000000-AddFixedRoomToClassGroup';
import { AddAfghanistanFieldsToSchoolConfig1734530000000 } from './src/database/migrations/1734530000000-AddAfghanistanFieldsToSchoolConfig';
import { CreateTeacherClassSubjectAssignment1736300000000 } from './src/database/migrations/1736300000000-CreateTeacherClassSubjectAssignment';
import { AddBreakPeriodsByDayToSchoolConfig1737600000000 } from './src/database/migrations/1737600000000-AddBreakPeriodsByDayToSchoolConfig';
import { CreateCanonicalAssignmentTables1742400000000 } from './src/database/migrations/1742400000000-CreateCanonicalAssignmentTables';
import { ReconcileDatabaseIntegrity1783800000000 } from './src/database/migrations/1783800000000-ReconcileDatabaseIntegrity';
import { RepairSchoolConfigFlow1783900000000 } from './src/database/migrations/1783900000000-RepairSchoolConfigFlow';
import { HardenPeriodConfiguration1784000000000 } from './src/database/migrations/1784000000000-HardenPeriodConfiguration';
import { HardenRoomContracts1784100000000 } from './src/database/migrations/1784100000000-HardenRoomContracts';
import { HardenSubjectIdentity1784200000000 } from './src/database/migrations/1784200000000-HardenSubjectIdentity';
import { TrackTimetableStaleness1784300000000 } from './src/database/migrations/1784300000000-TrackTimetableStaleness';
import { HardenTeacherContracts1784400000000 } from './src/database/migrations/1784400000000-HardenTeacherContracts';
import { BackfillCanonicalAssignments1784500000000 } from './src/database/migrations/1784500000000-BackfillCanonicalAssignments';
import { CanonicalAssignmentCommands1784600000000 } from './src/database/migrations/1784600000000-CanonicalAssignmentCommands';
import { SchoolScopedOptimizationPreferences1784700000000 } from './src/database/migrations/1784700000000-SchoolScopedOptimizationPreferences';
import { SimplifyTeacherAvailability1784800000000 } from './src/database/migrations/1784800000000-SimplifyTeacherAvailability';
import { ClassRequirementPeriodMode1784900000000 } from './src/database/migrations/1784900000000-ClassRequirementPeriodMode';
import { HardenTimetablePersistence1785000000000 } from './src/database/migrations/1785000000000-HardenTimetablePersistence';
import { SchoolOwnedCurriculum1785100000000 } from './src/database/migrations/1785100000000-SchoolOwnedCurriculum';
import { DurableGenerationJobs1785200000000 } from './src/database/migrations/1785200000000-DurableGenerationJobs';
import { RemoveRamadanMode1785300000000 } from './src/database/migrations/1785300000000-RemoveRamadanMode';
import { SchoolProfileAndBranding1785400000000 } from './src/database/migrations/1785400000000-SchoolProfileAndBranding';

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
    GenerationJob,
    TimetableCandidate,
    Configuration,
    WizardStep,
    SchoolConfig,
    SchoolProfile,
    CurriculumConfig,
    TeacherClassSubjectAssignment,
    TeacherSubjectCapability,
    TeachingAssignment,
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
  migrations: [
    BaselineSchema1730000000000,
    AddFixedRoomToClassGroup1730826000000,
    AddAfghanistanFieldsToSchoolConfig1734530000000,
    CreateTeacherClassSubjectAssignment1736300000000,
    AddBreakPeriodsByDayToSchoolConfig1737600000000,
    CreateCanonicalAssignmentTables1742400000000,
    ReconcileDatabaseIntegrity1783800000000,
    RepairSchoolConfigFlow1783900000000,
    HardenPeriodConfiguration1784000000000,
    HardenRoomContracts1784100000000,
    HardenSubjectIdentity1784200000000,
    TrackTimetableStaleness1784300000000,
    HardenTeacherContracts1784400000000,
    BackfillCanonicalAssignments1784500000000,
    CanonicalAssignmentCommands1784600000000,
    SchoolScopedOptimizationPreferences1784700000000,
    SimplifyTeacherAvailability1784800000000,
    ClassRequirementPeriodMode1784900000000,
    HardenTimetablePersistence1785000000000,
    SchoolOwnedCurriculum1785100000000,
    DurableGenerationJobs1785200000000,
    RemoveRamadanMode1785300000000,
    SchoolProfileAndBranding1785400000000,
  ],
  subscribers: [],
  prepareDatabase: (database) => {
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
    database.pragma('synchronous = NORMAL');
    database.pragma('busy_timeout = 5000');
  },
});
