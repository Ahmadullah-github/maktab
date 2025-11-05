import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add fixedRoomId column to ClassGroup table
 * This enables locking a class to a specific room as a hard constraint in timetable generation
 */
export class AddFixedRoomToClassGroup1730826000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fixedRoomId column (nullable integer)
    await queryRunner.query(
      `ALTER TABLE class_group ADD COLUMN "fixedRoomId" integer NULL`
    );
    
    // Add index for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_class_group_fixed_room" ON "class_group" ("fixedRoomId")`
    );
    
    console.log("✓ Migration applied: Added fixedRoomId to class_group table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_class_group_fixed_room"`
    );
    
    // Drop column
    await queryRunner.query(
      `ALTER TABLE class_group DROP COLUMN IF EXISTS "fixedRoomId"`
    );
    
    console.log("✓ Migration reverted: Removed fixedRoomId from class_group table");
  }
}
