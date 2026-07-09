import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationsTrucksDriversTeps1744710000000 implements MigrationInterface {
  name = 'OperationsTrucksDriversTeps1744710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trucks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plate_number" character varying NOT NULL,
        "truck_type" character varying NOT NULL,
        "color" character varying,
        "chassis_number" character varying,
        "brand" character varying,
        "model" character varying,
        "truck_length" character varying,
        "truck_capacity" character varying,
        "registration_status" character varying NOT NULL DEFAULT 'UNVERIFIED',
        "truck_status" character varying,
        "visibility" character varying NOT NULL DEFAULT 'PRIVATE',
        "mss_verification_number" character varying,
        "verification_timestamp" TIMESTAMP,
        "rfid_tag_number" character varying,
        "transporter_company_id" uuid,
        "registered_by_company_name" character varying,
        "registered_by_user_name" character varying,
        "created_by" uuid,
        "disabled_by" character varying,
        "disable_reason" text,
        "disable_timestamp" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trucks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trucks_plate_number" UNIQUE ("plate_number"),
        CONSTRAINT "CHK_trucks_registration_status" CHECK ("registration_status" IN ('MSS_VERIFIED', 'UNVERIFIED', 'VERIFICATION_REQUESTED', 'FLAGGED', 'DISABLED', 'ARCHIVED')),
        CONSTRAINT "CHK_trucks_truck_status" CHECK ("truck_status" IS NULL OR "truck_status" IN ('AVAILABLE', 'ON_TRIP', 'IN_FACILITY', 'MATCHED', 'GTG_FACILITY', 'LEFT_FACILITY', 'IN_PREGATE', 'GTG_PREGATE', 'LEFT_PREGATE', 'IN_TERMINAL', 'LEFT_TERMINAL')),
        CONSTRAINT "CHK_trucks_visibility" CHECK ("visibility" IN ('PRIVATE', 'PUBLIC'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trucks_registration_status"
      ON "trucks" ("registration_status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "truck_penalties" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "penalty_code" character varying NOT NULL,
        "truck_id" uuid NOT NULL,
        "penalty_type" character varying NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "date_issued" TIMESTAMP NOT NULL DEFAULT now(),
        "issued_by" character varying NOT NULL,
        "payment_status" character varying NOT NULL DEFAULT 'UNPAID',
        "booked_by_company_name" character varying,
        "booked_by_user_name" character varying,
        "dispute_reason" text,
        "date_disputed" TIMESTAMP,
        "dispute_status" character varying,
        "resolution_outcome" character varying,
        "adjusted_amount" numeric(14,2),
        "managed_by" character varying,
        "resolution_date" TIMESTAMP,
        "overridden_by" character varying,
        "override_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_truck_penalties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_truck_penalties_penalty_code" UNIQUE ("penalty_code"),
        CONSTRAINT "CHK_truck_penalties_penalty_type" CHECK ("penalty_type" IN ('OVERSTAY', 'ROUTE_VIOLATION', 'UNAUTHORIZED_PARKING', 'OVERWEIGHT', 'CONTRABAND')),
        CONSTRAINT "CHK_truck_penalties_payment_status" CHECK ("payment_status" IN ('UNPAID', 'PAID', 'OVERRIDDEN', 'DISPUTED')),
        CONSTRAINT "CHK_truck_penalties_dispute_status" CHECK ("dispute_status" IS NULL OR "dispute_status" IN ('PENDING_REVIEW', 'UNDER_NPA_REVIEW', 'RESOLVED', 'REJECTED')),
        CONSTRAINT "CHK_truck_penalties_resolution_outcome" CHECK ("resolution_outcome" IS NULL OR "resolution_outcome" IN ('FINE_UPHELD', 'FINE_WAIVED', 'FINE_ADJUSTED')),
        CONSTRAINT "FK_truck_penalties_truck" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drivers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "mobile_number" character varying,
        "license_number" character varying NOT NULL,
        "license_expiry_date" date NOT NULL,
        "date_of_birth" date,
        "sex" character varying,
        "verification_status" character varying NOT NULL DEFAULT 'UNVERIFIED',
        "verification_timestamp" TIMESTAMP,
        "operational_status" character varying,
        "visibility" character varying NOT NULL DEFAULT 'PRIVATE',
        "transporter_company_id" uuid,
        "registered_by_company_name" character varying,
        "registered_by_user_name" character varying,
        "created_by" uuid,
        "disabled_by" character varying,
        "disable_reason" text,
        "disable_timestamp" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drivers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_drivers_license_number" UNIQUE ("license_number"),
        CONSTRAINT "CHK_drivers_verification_status" CHECK ("verification_status" IN ('VERIFIED', 'UNVERIFIED', 'VERIFICATION_IN_PROGRESS', 'FLAGGED', 'DISABLED', 'ARCHIVED')),
        CONSTRAINT "CHK_drivers_operational_status" CHECK ("operational_status" IS NULL OR "operational_status" IN ('AVAILABLE', 'ON_TRIP', 'IN_FACILITY', 'IN_PREGATE', 'IN_TERMINAL', 'OFF_DUTY', 'SUSPENDED')),
        CONSTRAINT "CHK_drivers_sex" CHECK ("sex" IS NULL OR "sex" IN ('MALE', 'FEMALE')),
        CONSTRAINT "CHK_drivers_visibility" CHECK ("visibility" IN ('PRIVATE', 'PUBLIC'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_drivers_verification_status"
      ON "drivers" ("verification_status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_flags" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "flag_code" character varying NOT NULL,
        "driver_id" uuid NOT NULL,
        "flag_type" character varying NOT NULL,
        "flag_details" text,
        "flagged_by" character varying NOT NULL,
        "flagged_at" TIMESTAMP NOT NULL DEFAULT now(),
        "flag_status" character varying NOT NULL DEFAULT 'ACTIVE',
        "cleared_by" character varying,
        "clear_reason" text,
        "cleared_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_driver_flags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_driver_flags_flag_code" UNIQUE ("flag_code"),
        CONSTRAINT "CHK_driver_flags_flag_type" CHECK ("flag_type" IN ('TRAFFIC_VIOLATION', 'MISCONDUCT', 'ACCIDENT', 'UNAUTHORIZED_ROUTE', 'EXPIRED_LICENSE', 'CUSTOMER_COMPLAINT')),
        CONSTRAINT "CHK_driver_flags_flag_status" CHECK ("flag_status" IN ('ACTIVE', 'CLEARED', 'UNDER_REVIEW')),
        CONSTRAINT "FK_driver_flags_driver" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reference_number" character varying NOT NULL,
        "classification" character varying NOT NULL,
        "source" character varying NOT NULL,
        "facility_name" character varying NOT NULL,
        "company_name" character varying,
        "user_account" character varying,
        "truck_plate_number" character varying,
        "match_status" character varying NOT NULL DEFAULT 'UNMATCHED',
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "expiry_date" TIMESTAMP,
        "revoked_by" character varying,
        "revoke_reason" text,
        "revoked_at" TIMESTAMP,
        "created_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teps_reference_number" UNIQUE ("reference_number"),
        CONSTRAINT "CHK_teps_classification" CHECK ("classification" IN ('EMPTY_TDO', 'IMPORT_TDO', 'EXPORT_TDO', 'GATEPASS_PORT', 'GATEPASS_NON_PORT')),
        CONSTRAINT "CHK_teps_source" CHECK ("source" IN ('SHIPPING_LINE', 'PORT_TERMINAL', 'NON_PORT_TERMINAL', 'EPT')),
        CONSTRAINT "CHK_teps_match_status" CHECK ("match_status" IN ('MATCHED', 'UNMATCHED')),
        CONSTRAINT "CHK_teps_status" CHECK ("status" IN ('ACTIVE', 'EXPIRED', 'REVOKED'))
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teps_classification"
      ON "teps" ("classification");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teps_status"
      ON "teps" ("status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tep_matched_trucks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tep_id" uuid NOT NULL,
        "plate_number" character varying NOT NULL,
        "driver_name" character varying,
        "driver_id" uuid,
        "match_timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tep_matched_trucks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tep_matched_trucks_tep" FOREIGN KEY ("tep_id") REFERENCES "teps"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tep_activity_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tep_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "performed_by" character varying NOT NULL,
        "details" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tep_activity_events" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_tep_activity_events_event_type" CHECK ("event_type" IN ('CREATED', 'UPDATED', 'VALIDATED', 'MATCHED', 'UNMATCHED', 'REVOKED', 'EXPIRED')),
        CONSTRAINT "FK_tep_activity_events_tep" FOREIGN KEY ("tep_id") REFERENCES "teps"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tep_activity_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tep_matched_trucks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drivers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "truck_penalties"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trucks"`);
  }
}
