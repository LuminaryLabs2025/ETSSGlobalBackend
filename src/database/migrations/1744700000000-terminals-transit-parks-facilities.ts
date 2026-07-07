import { MigrationInterface, QueryRunner } from 'typeorm';

export class TerminalsTransitParksFacilities1744700000000 implements MigrationInterface {
  name = 'TerminalsTransitParksFacilities1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terminals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "terminal_type" character varying NOT NULL,
        "terminal_code" character varying NOT NULL,
        "location" character varying NOT NULL,
        "address" text,
        "approved_daily_truck_capacity" integer NOT NULL,
        "approved_trucks_per_hour" integer,
        "hourly_truck_tat_minutes" integer,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "booking_status" character varying NOT NULL DEFAULT 'OPEN',
        "archived_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_terminals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_terminals_name" UNIQUE ("name"),
        CONSTRAINT "UQ_terminals_terminal_code" UNIQUE ("terminal_code"),
        CONSTRAINT "CHK_terminals_terminal_type" CHECK ("terminal_type" IN ('PORT_TERMINAL', 'NON_PORT_TERMINAL')),
        CONSTRAINT "CHK_terminals_location" CHECK ("location" IN ('APAPA', 'TINCAN')),
        CONSTRAINT "CHK_terminals_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT "CHK_terminals_booking_status" CHECK ("booking_status" IN ('OPEN', 'CLOSED'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_terminals_terminal_type"
      ON "terminals" ("terminal_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_terminals_location"
      ON "terminals" ("location");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transit_parks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "transit_park_type" character varying NOT NULL,
        "transit_park_code" character varying NOT NULL,
        "location" character varying NOT NULL,
        "address" text,
        "approved_truck_capacity" integer NOT NULL,
        "approved_truck_exits_per_hour" integer NOT NULL,
        "bay_capacity" integer,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "archived_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transit_parks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transit_parks_name" UNIQUE ("name"),
        CONSTRAINT "UQ_transit_parks_transit_park_code" UNIQUE ("transit_park_code"),
        CONSTRAINT "CHK_transit_parks_transit_park_type" CHECK ("transit_park_type" IN ('PREGATE', 'EPT')),
        CONSTRAINT "CHK_transit_parks_location" CHECK ("location" IN ('APAPA', 'TINCAN')),
        CONSTRAINT "CHK_transit_parks_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_parks_transit_park_type"
      ON "transit_parks" ("transit_park_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transit_parks_location"
      ON "transit_parks" ("location");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facilities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "park_type" character varying NOT NULL,
        "facility_type" character varying NOT NULL,
        "facility_code" character varying NOT NULL,
        "location" character varying NOT NULL,
        "address" text,
        "approved_truck_capacity" integer NOT NULL,
        "approved_truck_exits_per_hour" integer NOT NULL,
        "bay_capacity" integer,
        "daily_empty_evacuation_limit" integer,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "archived_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_facilities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facilities_name" UNIQUE ("name"),
        CONSTRAINT "UQ_facilities_facility_code" UNIQUE ("facility_code"),
        CONSTRAINT "CHK_facilities_park_type" CHECK ("park_type" IN ('BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK')),
        CONSTRAINT "CHK_facilities_facility_type" CHECK ("facility_type" IN ('FACILITY', 'FACILITY_PREGATE')),
        CONSTRAINT "CHK_facilities_location" CHECK ("location" IN ('APAPA', 'TINCAN', 'APAPA_TINCAN')),
        CONSTRAINT "CHK_facilities_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_facilities_park_type"
      ON "facilities" ("park_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_facilities_location"
      ON "facilities" ("location");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "facilities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transit_parks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "terminals";`);
  }
}
