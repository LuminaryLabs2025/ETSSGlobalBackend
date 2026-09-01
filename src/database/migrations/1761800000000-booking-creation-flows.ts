import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds SuperAdmin booking-creation support to `bookings` for the 4 Quick
 * Book flows (Bonded Terminal, Truck Park, Fish, EPT): FK columns resolving
 * the facility/transit-park/terminal/truck/driver/transporter/category, EPT-
 * only fields, arrival date/timeslot/time, priority + FIFO scheduling
 * timestamps, and payment tracking. All new columns are nullable/defaulted
 * and additive — no existing column, constraint, or data is altered, so
 * every pre-existing list/filter/CSV/manifest query keeps working unchanged.
 */
export class BookingCreationFlows1761800000000 implements MigrationInterface {
  name = 'BookingCreationFlows1761800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "booking_type" character varying,
      ADD COLUMN IF NOT EXISTS "facility_id" uuid,
      ADD COLUMN IF NOT EXISTS "transit_park_id" uuid,
      ADD COLUMN IF NOT EXISTS "pregate_transit_park_id" uuid,
      ADD COLUMN IF NOT EXISTS "terminal_id" uuid,
      ADD COLUMN IF NOT EXISTS "truck_id" uuid,
      ADD COLUMN IF NOT EXISTS "driver_ref_id" uuid,
      ADD COLUMN IF NOT EXISTS "transporter_company_id" uuid,
      ADD COLUMN IF NOT EXISTS "booking_category_id" uuid,
      ADD COLUMN IF NOT EXISTS "export_type" character varying,
      ADD COLUMN IF NOT EXISTS "ept_operation_type" character varying,
      ADD COLUMN IF NOT EXISTS "gate_pass_number" character varying,
      ADD COLUMN IF NOT EXISTS "tep_id" uuid,
      ADD COLUMN IF NOT EXISTS "expected_arrival_date" date,
      ADD COLUMN IF NOT EXISTS "expected_arrival_time_slot_id" uuid,
      ADD COLUMN IF NOT EXISTS "expected_arrival_time" time without time zone,
      ADD COLUMN IF NOT EXISTS "priority_level" character varying NOT NULL DEFAULT 'MEDIUM',
      ADD COLUMN IF NOT EXISTS "priority_rank" smallint NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS "matched_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "in_facility_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "in_pregate_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "gtg_facility_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "gtg_pregate_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "payment_status" character varying NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "payment_method" character varying,
      ADD COLUMN IF NOT EXISTS "booking_fee" numeric(14,2),
      ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "created_by" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_booking_type"
          CHECK ("booking_type" IS NULL OR "booking_type" IN
            ('BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK', 'EPT'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_export_type"
          CHECK ("export_type" IS NULL OR "export_type" IN
            ('AGRO_EXPORT', 'MANUFACTURED_EXPORT', 'OTHERS'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_ept_operation_type"
          CHECK ("ept_operation_type" IS NULL OR "ept_operation_type" IN
            ('LOADED_EXPORT_DELIVERY', 'EMPTY_CONTAINER_DELIVERY',
             'VERIFIED_EXPORT_COLLECTION', 'LOADED_DELIVERY_WITH_COLLECTION'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_priority_level"
          CHECK ("priority_level" IN ('HIGH', 'MEDIUM', 'LOW'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_payment_status"
          CHECK ("payment_status" IN ('PENDING', 'PAID', 'FAILED'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "CHK_bookings_payment_method"
          CHECK ("payment_method" IS NULL OR "payment_method" IN ('WALLET', 'PAYSTACK'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    const fk = async (constraint: string, column: string, refTable: string) => {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "bookings"
            ADD CONSTRAINT "${constraint}"
            FOREIGN KEY ("${column}")
            REFERENCES "${refTable}"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    };

    await fk('FK_bookings_facility', 'facility_id', 'facilities');
    await fk('FK_bookings_transit_park', 'transit_park_id', 'transit_parks');
    await fk(
      'FK_bookings_pregate_transit_park',
      'pregate_transit_park_id',
      'transit_parks',
    );
    await fk('FK_bookings_terminal', 'terminal_id', 'terminals');
    await fk('FK_bookings_truck', 'truck_id', 'trucks');
    await fk('FK_bookings_driver_ref', 'driver_ref_id', 'drivers');
    await fk(
      'FK_bookings_transporter_company',
      'transporter_company_id',
      'companies',
    );
    await fk(
      'FK_bookings_booking_category',
      'booking_category_id',
      'booking_categories',
    );
    await fk('FK_bookings_tep', 'tep_id', 'teps');
    await fk(
      'FK_bookings_expected_arrival_time_slot',
      'expected_arrival_time_slot_id',
      'facility_timeslots',
    );
    await fk('FK_bookings_created_by', 'created_by', 'users');

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_booking_type" ON "bookings" ("booking_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_facility_id" ON "bookings" ("facility_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_transit_park_id" ON "bookings" ("transit_park_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_terminal_id" ON "bookings" ("terminal_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_truck_id" ON "bookings" ("truck_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_transporter_company_id" ON "bookings" ("transporter_company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_priority_rank" ON "bookings" ("priority_rank")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_matched_at" ON "bookings" ("matched_at")
    `);

    // The Bonded Terminal / Truck Park category catalog already has the
    // spec's other 6 names (see app-options-seeds.ts) — Fish is new.
    await queryRunner.query(`
      INSERT INTO "booking_categories" ("id", "name", "status")
      SELECT gen_random_uuid(), 'Fish', 'ACTIVE'
      WHERE NOT EXISTS (
        SELECT 1 FROM "booking_categories" WHERE lower("name") = 'fish'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dropFk = async (constraint: string) => {
      await queryRunner.query(`
        ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "${constraint}"
      `);
    };

    await dropFk('FK_bookings_facility');
    await dropFk('FK_bookings_transit_park');
    await dropFk('FK_bookings_pregate_transit_park');
    await dropFk('FK_bookings_terminal');
    await dropFk('FK_bookings_truck');
    await dropFk('FK_bookings_driver_ref');
    await dropFk('FK_bookings_transporter_company');
    await dropFk('FK_bookings_booking_category');
    await dropFk('FK_bookings_tep');
    await dropFk('FK_bookings_expected_arrival_time_slot');
    await dropFk('FK_bookings_created_by');

    await dropFk('CHK_bookings_booking_type');
    await dropFk('CHK_bookings_export_type');
    await dropFk('CHK_bookings_ept_operation_type');
    await dropFk('CHK_bookings_priority_level');
    await dropFk('CHK_bookings_payment_status');
    await dropFk('CHK_bookings_payment_method');

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_booking_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_facility_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_transit_park_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_terminal_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_truck_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_transporter_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bookings_priority_rank"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_matched_at"`);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "booking_type",
      DROP COLUMN IF EXISTS "facility_id",
      DROP COLUMN IF EXISTS "transit_park_id",
      DROP COLUMN IF EXISTS "pregate_transit_park_id",
      DROP COLUMN IF EXISTS "terminal_id",
      DROP COLUMN IF EXISTS "truck_id",
      DROP COLUMN IF EXISTS "driver_ref_id",
      DROP COLUMN IF EXISTS "transporter_company_id",
      DROP COLUMN IF EXISTS "booking_category_id",
      DROP COLUMN IF EXISTS "export_type",
      DROP COLUMN IF EXISTS "ept_operation_type",
      DROP COLUMN IF EXISTS "gate_pass_number",
      DROP COLUMN IF EXISTS "tep_id",
      DROP COLUMN IF EXISTS "expected_arrival_date",
      DROP COLUMN IF EXISTS "expected_arrival_time_slot_id",
      DROP COLUMN IF EXISTS "expected_arrival_time",
      DROP COLUMN IF EXISTS "priority_level",
      DROP COLUMN IF EXISTS "priority_rank",
      DROP COLUMN IF EXISTS "matched_at",
      DROP COLUMN IF EXISTS "in_facility_at",
      DROP COLUMN IF EXISTS "in_pregate_at",
      DROP COLUMN IF EXISTS "gtg_facility_at",
      DROP COLUMN IF EXISTS "gtg_pregate_at",
      DROP COLUMN IF EXISTS "payment_status",
      DROP COLUMN IF EXISTS "payment_method",
      DROP COLUMN IF EXISTS "booking_fee",
      DROP COLUMN IF EXISTS "terms_accepted_at",
      DROP COLUMN IF EXISTS "confirmed_at",
      DROP COLUMN IF EXISTS "paid_at",
      DROP COLUMN IF EXISTS "created_by"
    `);

    // Intentionally leave the 'Fish' booking_categories row in place on
    // rollback — other data may reference it by the time down() runs.
  }
}
