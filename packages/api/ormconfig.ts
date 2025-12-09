import "reflect-metadata";
import { DataSource } from "typeorm";
// Core entities
import { Teacher } from "./src/entity/Teacher";
import { Subject } from "./src/entity/Subject";
import { Room } from "./src/entity/Room";
import { ClassGroup } from "./src/entity/ClassGroup";
import { Timetable } from "./src/entity/Timetable";
import { Configuration } from "./src/entity/Configuration";
import { WizardStep } from "./src/entity/WizardStep";
import { SchoolConfig } from "./src/entity/SchoolConfig";
// License entities
import { License } from "./src/entity/License";
import { ContactRequest } from "./src/entity/ContactRequest";
// Foundation entities (for future expansion)
import { AcademicYear } from "./src/entity/AcademicYear";
import { Term } from "./src/entity/Term";
import { User } from "./src/entity/User";
import { AuditLog } from "./src/entity/AuditLog";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "timetable.db",
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
    // License system
    License,
    ContactRequest,
    // Foundation for future (v2.0+)
    AcademicYear,
    Term,
    User,
    AuditLog,
  ],
  migrations: ["dist/src/migration/**/*.js"],
  subscribers: ["dist/src/subscriber/**/*.js"],
});