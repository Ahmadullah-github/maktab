import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolProfileAndBranding1785400000000 implements MigrationInterface {
  name = 'SchoolProfileAndBranding1785400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('school_profile'))) {
      await queryRunner.query(`
        CREATE TABLE "school_profile" (
          "id" integer PRIMARY KEY NOT NULL CHECK ("id" = 1),
          "revision" integer NOT NULL DEFAULT (1),
          "officialName" text NOT NULL CHECK (length(trim("officialName")) BETWEEN 1 AND 255),
          "shortName" text,
          "nameFa" text,
          "namePs" text,
          "nameEn" text,
          "schoolCode" text,
          "address" text,
          "phone" text,
          "email" text,
          "website" text,
          "defaultLanguage" text NOT NULL DEFAULT ('fa') CHECK ("defaultLanguage" IN ('fa', 'en')),
          "logoFileName" text,
          "logoMimeType" text,
          "logoVersion" integer NOT NULL DEFAULT (0),
          "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )
      `);
    }

    await queryRunner.query(`
      INSERT INTO "school_profile" ("id", "revision", "officialName", "nameFa", "defaultLanguage")
      SELECT 1, 1, trim("schoolName"), trim("schoolName"), 'fa'
      FROM "school_config"
      WHERE "id" = (
        SELECT MIN("id")
        FROM "school_config"
        WHERE "schoolName" IS NOT NULL AND length(trim("schoolName")) > 0
      )
        AND NOT EXISTS (SELECT 1 FROM "school_profile" WHERE "id" = 1)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('school_profile')) {
      await queryRunner.query('DROP TABLE "school_profile"');
    }
  }
}
