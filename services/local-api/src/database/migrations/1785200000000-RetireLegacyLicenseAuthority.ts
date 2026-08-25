import { MigrationInterface, QueryRunner } from 'typeorm';

const legacyTables = [
  ['license', 'legacy_license'],
  ['device_trial', 'legacy_device_trial'],
  ['contact_request', 'legacy_contact_request'],
] as const;

/**
 * Removes legacy licensing tables from runtime ownership without deleting their rows.
 * Signed leases remain external to the timetable database and are the sole authority.
 */
export class RetireLegacyLicenseAuthority1785200000000 implements MigrationInterface {
  name = 'RetireLegacyLicenseAuthority1785200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [currentName, legacyName] of legacyTables) {
      if ((await queryRunner.hasTable(currentName)) && !(await queryRunner.hasTable(legacyName))) {
        await queryRunner.renameTable(currentName, legacyName);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [currentName, legacyName] of [...legacyTables].reverse()) {
      if ((await queryRunner.hasTable(legacyName)) && !(await queryRunner.hasTable(currentName))) {
        await queryRunner.renameTable(legacyName, currentName);
      }
    }
  }
}
