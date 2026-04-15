import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppOptionsSettingsEngine1744695000000
  implements MigrationInterface
{
  name = 'AppOptionsSettingsEngine1744695000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "truck_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_truck_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_truck_types_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "truck_capacities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "truck_type_id" uuid NOT NULL,
        "capacity_value" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_truck_capacities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_truck_capacities_type_value" UNIQUE ("truck_type_id", "capacity_value"),
        CONSTRAINT "FK_truck_capacities_truck_type" FOREIGN KEY ("truck_type_id")
          REFERENCES "truck_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_truck_capacities_truck_type_id"
      ON "truck_capacities" ("truck_type_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "truck_lengths" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "truck_type_id" uuid NOT NULL,
        "length_value" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_truck_lengths" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_truck_lengths_type_value" UNIQUE ("truck_type_id", "length_value"),
        CONSTRAINT "FK_truck_lengths_truck_type" FOREIGN KEY ("truck_type_id")
          REFERENCES "truck_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_truck_lengths_truck_type_id"
      ON "truck_lengths" ("truck_type_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_booking_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_categories_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tep_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_tep_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tep_types_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tep_type_booking_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tep_type_id" uuid NOT NULL,
        "booking_category_id" uuid NOT NULL,
        CONSTRAINT "PK_tep_type_booking_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tep_type_booking_categories_unique" UNIQUE ("tep_type_id", "booking_category_id"),
        CONSTRAINT "FK_tep_type_booking_categories_tep_type" FOREIGN KEY ("tep_type_id")
          REFERENCES "tep_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tep_type_booking_categories_booking_category" FOREIGN KEY ("booking_category_id")
          REFERENCES "booking_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tep_type_truck_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tep_type_id" uuid NOT NULL,
        "truck_type_id" uuid NOT NULL,
        CONSTRAINT "PK_tep_type_truck_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tep_type_truck_types_unique" UNIQUE ("tep_type_id", "truck_type_id"),
        CONSTRAINT "FK_tep_type_truck_types_tep_type" FOREIGN KEY ("tep_type_id")
          REFERENCES "tep_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tep_type_truck_types_truck_type" FOREIGN KEY ("truck_type_id")
          REFERENCES "truck_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "park_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_park_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_park_types_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facility_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_facility_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facility_types_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facility_type_park_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "facility_type_id" uuid NOT NULL,
        "park_type_id" uuid NOT NULL,
        CONSTRAINT "PK_facility_type_park_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facility_type_park_types_unique" UNIQUE ("facility_type_id", "park_type_id"),
        CONSTRAINT "FK_facility_type_park_types_facility_type" FOREIGN KEY ("facility_type_id")
          REFERENCES "facility_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_facility_type_park_types_park_type" FOREIGN KEY ("park_type_id")
          REFERENCES "park_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facility_timeslots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_facility_timeslots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facility_timeslots_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "locations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "type" character varying NOT NULL,
        "reference_id" uuid,
        CONSTRAINT "PK_locations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_locations_name_type" UNIQUE ("name", "type")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facility_timeslot_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "facility_id" uuid NOT NULL,
        "timeslot_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_facility_timeslot_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facility_timeslot_assignments_unique" UNIQUE ("facility_id", "timeslot_id"),
        CONSTRAINT "FK_facility_timeslot_assignments_location" FOREIGN KEY ("facility_id")
          REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_facility_timeslot_assignments_timeslot" FOREIGN KEY ("timeslot_id")
          REFERENCES "facility_timeslots"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "service_name" character varying NOT NULL,
        "linked_form" character varying NOT NULL,
        "revenue_event_trigger" character varying NOT NULL,
        "charged_to_user_type_id" uuid NOT NULL,
        "amount_type" character varying NOT NULL DEFAULT 'FIXED',
        "amount" numeric(14,2),
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_types_name" UNIQUE ("name"),
        CONSTRAINT "CHK_payment_types_amount_type" CHECK ("amount_type" IN ('FIXED', 'DYNAMIC')),
        CONSTRAINT "FK_payment_types_user_type" FOREIGN KEY ("charged_to_user_type_id")
          REFERENCES "user_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "infraction_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "fine_amount" numeric(14,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_infraction_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_infraction_categories_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terminal_gates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "location" character varying NOT NULL,
        "entry_barrier_name" character varying NOT NULL,
        "entry_barrier_id" character varying NOT NULL,
        "exit_barrier_name" character varying NOT NULL,
        "exit_barrier_id" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_terminal_gates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_terminal_gates_entry_barrier_id" UNIQUE ("entry_barrier_id"),
        CONSTRAINT "UQ_terminal_gates_exit_barrier_id" UNIQUE ("exit_barrier_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "handheld_devices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "user_id" uuid,
        "location_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_handheld_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_handheld_devices_name" UNIQUE ("name"),
        CONSTRAINT "FK_handheld_devices_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_handheld_devices_location" FOREIGN KEY ("location_id")
          REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rfid_tags" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "rfid_tag_number" character varying NOT NULL,
        "etss_tag_number" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "truck_id" uuid,
        "transporter_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rfid_tags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rfid_tags_rfid_tag_number" UNIQUE ("rfid_tag_number"),
        CONSTRAINT "UQ_rfid_tags_etss_tag_number" UNIQUE ("etss_tag_number")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rfid_tags";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "handheld_devices";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "terminal_gates";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "infraction_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "facility_timeslot_assignments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "facility_timeslots";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "facility_type_park_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "facility_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "park_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tep_type_truck_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tep_type_booking_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tep_types";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "truck_lengths";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "truck_capacities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "truck_types";`);
  }
}
