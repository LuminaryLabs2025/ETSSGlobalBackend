import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Barriers module: first-class barrier catalog + site entry/exit links.
 * Migrates legacy terminal_gates paired barriers into the new catalog.
 * Handheld devices can link to a barrier (location_id becomes optional).
 */
export class BarriersModule1744750000000 implements MigrationInterface {
  name = 'BarriersModule1744750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "barriers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "barrier_id_number" character varying NOT NULL,
        "service_provider_name" character varying NOT NULL,
        "operational_status" character varying NOT NULL DEFAULT 'OFFLINE',
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_barriers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_barriers_barrier_id_number" UNIQUE ("barrier_id_number"),
        CONSTRAINT "CHK_barriers_operational_status"
          CHECK ("operational_status" IN ('ONLINE', 'OFFLINE')),
        CONSTRAINT "CHK_barriers_status"
          CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "barrier_site_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "barrier_id" uuid NOT NULL,
        "site_type" character varying NOT NULL,
        "site_id" uuid NOT NULL,
        "barrier_role" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_barrier_site_links" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_barrier_site_links_unique"
          UNIQUE ("barrier_id", "site_type", "site_id", "barrier_role"),
        CONSTRAINT "CHK_barrier_site_links_site_type"
          CHECK ("site_type" IN ('FACILITY', 'TRANSIT_PARK', 'TERMINAL')),
        CONSTRAINT "CHK_barrier_site_links_barrier_role"
          CHECK ("barrier_role" IN ('ENTRY', 'EXIT')),
        CONSTRAINT "FK_barrier_site_links_barrier"
          FOREIGN KEY ("barrier_id")
          REFERENCES "barriers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_barrier_site_links_site"
      ON "barrier_site_links" ("site_type", "site_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_barrier_site_links_barrier_id"
      ON "barrier_site_links" ("barrier_id")
    `);

    // Migrate legacy terminal_gates into individual barrier rows.
    await queryRunner.query(`
      INSERT INTO "barriers" (
        "id", "barrier_id_number", "service_provider_name",
        "operational_status", "status", "created_at", "updated_at"
      )
      SELECT gen_random_uuid(), tg."entry_barrier_id",
             COALESCE(NULLIF(trim(tg."entry_barrier_name"), ''), 'Unknown Provider'),
             'OFFLINE', 'ACTIVE', tg."created_at", now()
      FROM "terminal_gates" tg
      WHERE tg."entry_barrier_id" IS NOT NULL
        AND trim(tg."entry_barrier_id") <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "barriers" b
          WHERE lower(b."barrier_id_number") = lower(tg."entry_barrier_id")
        )
    `);

    await queryRunner.query(`
      INSERT INTO "barriers" (
        "id", "barrier_id_number", "service_provider_name",
        "operational_status", "status", "created_at", "updated_at"
      )
      SELECT gen_random_uuid(), tg."exit_barrier_id",
             COALESCE(NULLIF(trim(tg."exit_barrier_name"), ''), 'Unknown Provider'),
             'OFFLINE', 'ACTIVE', tg."created_at", now()
      FROM "terminal_gates" tg
      WHERE tg."exit_barrier_id" IS NOT NULL
        AND trim(tg."exit_barrier_id") <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "barriers" b
          WHERE lower(b."barrier_id_number") = lower(tg."exit_barrier_id")
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "handheld_devices"
      ADD COLUMN IF NOT EXISTS "barrier_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "handheld_devices"
      ALTER COLUMN "location_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "handheld_devices"
          ADD CONSTRAINT "FK_handheld_devices_barrier"
          FOREIGN KEY ("barrier_id")
          REFERENCES "barriers"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_handheld_devices_barrier_id"
      ON "handheld_devices" ("barrier_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "handheld_devices" DROP CONSTRAINT IF EXISTS "FK_handheld_devices_barrier"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_handheld_devices_barrier_id"`);
    await queryRunner.query(`
      ALTER TABLE "handheld_devices" DROP COLUMN IF EXISTS "barrier_id"
    `);

    // Restore NOT NULL only if no null location_ids remain.
    await queryRunner.query(`
      UPDATE "handheld_devices" SET "location_id" = (
        SELECT id FROM "locations" LIMIT 1
      )
      WHERE "location_id" IS NULL
        AND EXISTS (SELECT 1 FROM "locations" LIMIT 1)
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "barrier_site_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "barriers"`);
  }
}
