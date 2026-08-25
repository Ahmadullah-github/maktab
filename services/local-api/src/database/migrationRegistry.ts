import type { MigrationInterface } from 'typeorm';
import { BaselineSchema1730000000000 } from './migrations/1730000000000-BaselineSchema';
import { AddFixedRoomToClassGroup1730826000000 } from './migrations/1730826000000-AddFixedRoomToClassGroup';
import { AddAfghanistanFieldsToSchoolConfig1734530000000 } from './migrations/1734530000000-AddAfghanistanFieldsToSchoolConfig';
import { CreateTeacherClassSubjectAssignment1736300000000 } from './migrations/1736300000000-CreateTeacherClassSubjectAssignment';
import { AddBreakPeriodsByDayToSchoolConfig1737600000000 } from './migrations/1737600000000-AddBreakPeriodsByDayToSchoolConfig';
import { CreateCanonicalAssignmentTables1742400000000 } from './migrations/1742400000000-CreateCanonicalAssignmentTables';
import { ReconcileDatabaseIntegrity1783800000000 } from './migrations/1783800000000-ReconcileDatabaseIntegrity';
import { RepairSchoolConfigFlow1783900000000 } from './migrations/1783900000000-RepairSchoolConfigFlow';
import { HardenPeriodConfiguration1784000000000 } from './migrations/1784000000000-HardenPeriodConfiguration';
import { HardenRoomContracts1784100000000 } from './migrations/1784100000000-HardenRoomContracts';
import { HardenSubjectIdentity1784200000000 } from './migrations/1784200000000-HardenSubjectIdentity';
import { TrackTimetableStaleness1784300000000 } from './migrations/1784300000000-TrackTimetableStaleness';
import { HardenTeacherContracts1784400000000 } from './migrations/1784400000000-HardenTeacherContracts';
import { BackfillCanonicalAssignments1784500000000 } from './migrations/1784500000000-BackfillCanonicalAssignments';
import { CanonicalAssignmentCommands1784600000000 } from './migrations/1784600000000-CanonicalAssignmentCommands';
import { SchoolScopedOptimizationPreferences1784700000000 } from './migrations/1784700000000-SchoolScopedOptimizationPreferences';
import { SimplifyTeacherAvailability1784800000000 } from './migrations/1784800000000-SimplifyTeacherAvailability';
import { ClassRequirementPeriodMode1784900000000 } from './migrations/1784900000000-ClassRequirementPeriodMode';
import { HardenTimetablePersistence1785000000000 } from './migrations/1785000000000-HardenTimetablePersistence';
import { SchoolOwnedCurriculumPlan1785100000000 } from './migrations/1785100000000-SchoolOwnedCurriculumPlan';
import { RetireLegacyLicenseAuthority1785200000000 } from './migrations/1785200000000-RetireLegacyLicenseAuthority';
import { CompleteCanonicalAssignmentCutover1785300000000 } from './migrations/1785300000000-CompleteCanonicalAssignmentCutover';

type MigrationConstructor = new () => MigrationInterface;

export interface MigrationDescriptor {
  id: number;
  name: string;
  ordinal: number;
  migration: MigrationConstructor;
}

const migrationConstructors: MigrationConstructor[] = [
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
  SchoolOwnedCurriculumPlan1785100000000,
  RetireLegacyLicenseAuthority1785200000000,
  CompleteCanonicalAssignmentCutover1785300000000,
];

function migrationId(name: string): number {
  const match = name.match(/(\d{13})$/);
  if (!match) throw new Error(`Migration name does not end with a 13-digit ID: ${name}`);
  return Number(match[1]);
}

export const MIGRATION_REGISTRY: readonly MigrationDescriptor[] = Object.freeze(
  migrationConstructors.map((migration, index) => {
    const instance = new migration();
    const name = typeof instance.name === 'string' ? instance.name : migration.name;
    return Object.freeze({ id: migrationId(name), name, ordinal: index + 1, migration });
  })
);

export const TYPEORM_MIGRATIONS = MIGRATION_REGISTRY.map((entry) => entry.migration);
export const LATEST_DATABASE_MIGRATION = MIGRATION_REGISTRY.at(-1)!;

export function migrationByOrdinal(ordinal: number): MigrationDescriptor | null {
  return MIGRATION_REGISTRY[ordinal - 1] ?? null;
}

export function migrationByName(name: string): MigrationDescriptor | null {
  return MIGRATION_REGISTRY.find((entry) => entry.name === name) ?? null;
}
