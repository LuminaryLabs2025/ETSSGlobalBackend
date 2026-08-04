import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - truck_type_booking_categories join table
 * - trucks.truck_length / truck_capacity strings → truck_length_id / truck_capacity_id FKs
 */
export class TruckTypeBookingCategoriesAndTruckLengthCapacityIds1744740000000
  implements MigrationInterface
{
  name =
    'TruckTypeBookingCategoriesAndTruckLengthCapacityIds1744740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "truck_type_booking_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "truck_type_id" uuid NOT NULL,
        "booking_category_id" uuid NOT NULL,
        CONSTRAINT "PK_truck_type_booking_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_truck_type_booking_categories_unique"
          UNIQUE ("truck_type_id", "booking_category_id"),
        CONSTRAINT "FK_truck_type_booking_categories_truck_type"
          FOREIGN KEY ("truck_type_id")
          REFERENCES "truck_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_truck_type_booking_categories_booking_category"
          FOREIGN KEY ("booking_category_id")
          REFERENCES "booking_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_truck_type_booking_categories_truck_type_id"
      ON "truck_type_booking_categories" ("truck_type_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_truck_type_booking_categories_booking_category_id"
      ON "truck_type_booking_categories" ("booking_category_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_length_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_capacity_id" uuid
    `);

    // Ensure catalog rows exist for any legacy string values on trucks.
    await queryRunner.query(`
      INSERT INTO "truck_lengths" ("id", "truck_type_id", "length_value", "status")
      SELECT gen_random_uuid(), t."truck_type_id", t."truck_length", 'ACTIVE'
      FROM (
        SELECT DISTINCT "truck_type_id", "truck_length"
        FROM "trucks"
        WHERE "truck_length" IS NOT NULL
          AND trim("truck_length") <> ''
          AND "truck_type_id" IS NOT NULL
      ) t
      WHERE NOT EXISTS (
        SELECT 1 FROM "truck_lengths" tl
        WHERE tl."truck_type_id" = t."truck_type_id"
          AND lower(tl."length_value") = lower(t."truck_length")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "truck_capacities" ("id", "truck_type_id", "capacity_value", "status")
      SELECT gen_random_uuid(), t."truck_type_id", t."truck_capacity", 'ACTIVE'
      FROM (
        SELECT DISTINCT "truck_type_id", "truck_capacity"
        FROM "trucks"
        WHERE "truck_capacity" IS NOT NULL
          AND trim("truck_capacity") <> ''
          AND "truck_type_id" IS NOT NULL
      ) t
      WHERE NOT EXISTS (
        SELECT 1 FROM "truck_capacities" tc
        WHERE tc."truck_type_id" = t."truck_type_id"
          AND lower(tc."capacity_value") = lower(t."truck_capacity")
      )
    `);

    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_length_id" = tl.id
      FROM "truck_lengths" tl
      WHERE t."truck_length_id" IS NULL
        AND t."truck_length" IS NOT NULL
        AND tl."truck_type_id" = t."truck_type_id"
        AND lower(tl."length_value") = lower(t."truck_length")
    `);

    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_capacity_id" = tc.id
      FROM "truck_capacities" tc
      WHERE t."truck_capacity_id" IS NULL
        AND t."truck_capacity" IS NOT NULL
        AND tc."truck_type_id" = t."truck_type_id"
        AND lower(tc."capacity_value") = lower(t."truck_capacity")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "trucks"
          ADD CONSTRAINT "FK_trucks_truck_length"
          FOREIGN KEY ("truck_length_id")
          REFERENCES "truck_lengths"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "trucks"
          ADD CONSTRAINT "FK_trucks_truck_capacity"
          FOREIGN KEY ("truck_capacity_id")
          REFERENCES "truck_capacities"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trucks_truck_length_id"
      ON "trucks" ("truck_length_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trucks_truck_capacity_id"
      ON "trucks" ("truck_capacity_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_length"
    `);
    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_capacity"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_length" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "trucks"
      ADD COLUMN IF NOT EXISTS "truck_capacity" character varying
    `);

    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_length" = tl."length_value"
      FROM "truck_lengths" tl
      WHERE tl.id = t."truck_length_id"
    `);
    await queryRunner.query(`
      UPDATE "trucks" t
      SET "truck_capacity" = tc."capacity_value"
      FROM "truck_capacities" tc
      WHERE tc.id = t."truck_capacity_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "trucks" DROP CONSTRAINT IF EXISTS "FK_trucks_truck_length"
    `);
    await queryRunner.query(`
      ALTER TABLE "trucks" DROP CONSTRAINT IF EXISTS "FK_trucks_truck_capacity"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trucks_truck_length_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trucks_truck_capacity_id"`);
    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_length_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "trucks" DROP COLUMN IF EXISTS "truck_capacity_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "truck_type_booking_categories"
    `);
  }
}
