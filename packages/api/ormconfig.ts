import { DataSource } from "typeorm";
import { Teacher } from "./src/entity/Teacher";
import { Subject } from "./src/entity/Subject";
import { Room } from "./src/entity/Room";
import { ClassGroup } from "./src/entity/ClassGroup";
import { Timetable } from "./src/entity/Timetable";
import { Configuration } from "./src/entity/Configuration";
import { WizardStep } from "./src/entity/WizardStep";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: "timetable.db",
  synchronize: true,
  logging: false,
  entities: [Teacher, Subject, Room, ClassGroup, Timetable, Configuration, WizardStep],
  migrations: ["dist/src/migration/**/*.js"],
  subscribers: ["dist/src/subscriber/**/*.js"]
});