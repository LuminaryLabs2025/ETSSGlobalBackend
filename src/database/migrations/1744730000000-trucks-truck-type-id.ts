import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replace trucks.truck_type (hardcoded string) with trucks.truck_type_id FK
 * to the truck_types catalog table.
 */
export class TrucksTruckTypeId1744730000000 implements MigrationInterface {
  name = 'TrucksTruckTypeId1744730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_type_id" uuid
    `);

    // Ensure catalog rows exist for legacy string codes and common aliases.
    await queryRunner.query(`
      INSERT INTO "truck_types" ("id", "name", "description", "status", "created_at")
      SELECT gen_random_uuid(), v.name, v.description, 'ACTIVE', now()
      FROM (VALUES
        ('Flatbed', 'Flatbed truck'),
        ('Lowbed', 'Lowbed truck'),
        ('20-Footer', '20-footer container truck'),
        ('40-Footer', '40-footer container truck'),
        ('Tanker', 'Tanker truck'),
        ('Curtainsider', 'Curtainsider truck'),
        ('20-FOOTER', 'Legacy 20-footer code'),
        ('40-FOOTER', 'Legacy 40-footer code'),
        ('FLATBED', 'Legacy flatbed code'),
        ('LOW_LOADER', 'Legacy low loader code'),
        ('TANKER', 'Legacy tanker code'),
        ('CURTAINSIDER', 'Legacy curtainsider code')
      ) AS v(name, description)
      WHERE NOT EXISTS (
        SELECT 1 FROM "truck_types" tt WHERE lower(tt.name) = lower(v.name)
      )
    `);

    // Direct / case-insensitive match on existing type names.
    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_type_id" = tt.id
      FROM "truck_types" tt
      WHERE t."truck_type_id" IS NULL
        AND t."truck_type" IS NOT NULL
        AND lower(tt.name) = lower(t."truck_type")
    `);

    // Map legacy uppercase codes to canonical catalog names.
    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_type_id" = tt.id
      FROM "truck_types" tt
      WHERE t."truck_type_id" IS NULL
        AND (
          (t."truck_type" = 'FLATBED' AND tt.name = 'Flatbed')
          OR (t."truck_type" = 'LOW_LOADER' AND tt.name = 'Lowbed')
          OR (t."truck_type" = '20-FOOTER' AND tt.name = '20-Footer')
          OR (t."truck_type" = '40-FOOTER' AND tt.name = '40-Footer')
          OR (t."truck_type" = 'TANKER' AND tt.name = 'Tanker')
          OR (t."truck_type" = 'CURTAINSIDER' AND tt.name = 'Curtainsider')
        )
    `);

    // Any remaining unmatched values: create a type from the string, then link.
    await queryRunner.query(`
      INSERT INTO "truck_types" ("id", "name", "description", "status", "created_at")
      SELECT gen_random_uuid(), t."truck_type", 'Migrated from trucks.truck_type', 'ACTIVE', now()
      FROM (
        SELECT DISTINCT "truck_type"
        FROM "trucks"
        WHERE "truck_type_id" IS NULL
          AND "truck_type" IS NOT NULL
          AND trim("truck_type") <> ''
      ) t
      WHERE NOT EXISTS (
        SELECT 1 FROM "truck_types" tt WHERE lower(tt.name) = lower(t."truck_type")
      )
    `);

    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_type_id" = tt.id
      FROM "truck_types" tt
      WHERE t."truck_type_id" IS NULL
        AND t."truck_type" IS NOT NULL
        AND lower(tt.name) = lower(t."truck_type")
    `);

    // Safety: if somehow still null (empty truck_type), assign Flatbed or first type.
    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_type_id" = (
        SELECT id FROM "truck_types"
        ORDER BY CASE WHEN name = 'Flatbed' THEN 0 ELSE 1 END, created_at
        LIMIT 1
      )
      WHERE t."truck_type_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks"
      ALTER COLUMN "truck_type_id" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "trucks"
          ADD CONSTRAINT "FK_trucks_truck_type"
          FOREIGN KEY ("truck_type_id")
          REFERENCES "truck_types"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trucks_truck_type_id"
      ON "trucks" ("truck_type_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_type" character varying
    `);

    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_type" = tt.name
      FROM "truck_types" tt
      WHERE tt.id = t."truck_type_id"
    `);

    await queryRunner.query(`
      UPDATE "trucks"
      SET "truck_type" = 'UNKNOWN'
      WHERE "truck_type" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks"
      ALTER COLUMN "truck_type" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks" DROP CONSTRAINT IF EXISTS "FK_trucks_truck_type"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_trucks_truck_type_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_type_id"
    `);
  }
}
