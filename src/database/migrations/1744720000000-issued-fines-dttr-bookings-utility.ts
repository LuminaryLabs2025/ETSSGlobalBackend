import { MigrationInterface, QueryRunner } from 'typeorm';

export class IssuedFinesDttrBookingsUtility1744720000000
  implements MigrationInterface
{
  name = 'IssuedFinesDttrBookingsUtility1744720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────── Issued Fines ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "penalty_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "penalty_code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text NOT NULL,
        "fine_amount" numeric(14,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_by" character varying,
        "updated_by" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_penalty_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_penalty_definitions_penalty_code" UNIQUE ("penalty_code"),
        CONSTRAINT "CHK_penalty_definitions_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "issued_fines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "issued_fine_id" character varying NOT NULL,
        "penalty_code" character varying NOT NULL,
        "penalty_name" character varying NOT NULL,
        "fine_amount" numeric(14,2) NOT NULL,
        "booking_reference" character varying NOT NULL,
        "terminal_destination" character varying NOT NULL,
        "booking_date" TIMESTAMP NOT NULL,
        "booking_category" character varying NOT NULL,
        "truck_booking_status" character varying NOT NULL,
        "truck_plate_number" character varying NOT NULL,
        "driver_name" character varying NOT NULL,
        "transporter_company_name" character varying NOT NULL,
        "transporter_user_account" character varying,
        "transporter_contact_person" character varying,
        "transporter_contact_number" character varying,
        "transporter_email" character varying,
        "date_issued" TIMESTAMP NOT NULL,
        "issued_by" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACCEPTED',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issued_fines" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_issued_fines_issued_fine_id" UNIQUE ("issued_fine_id"),
        CONSTRAINT "CHK_issued_fines_status" CHECK ("status" IN ('ACCEPTED', 'DISPUTED')),
        CONSTRAINT "CHK_issued_fines_booking_category" CHECK ("booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_issued_fines_status" ON "issued_fines" ("status");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fine_disputes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "dispute_id" character varying NOT NULL,
        "issued_fine_id" character varying NOT NULL,
        "penalty_code" character varying NOT NULL,
        "penalty_name" character varying NOT NULL,
        "fine_amount" numeric(14,2) NOT NULL,
        "booking_reference" character varying NOT NULL,
        "terminal_destination" character varying NOT NULL,
        "booking_date" TIMESTAMP NOT NULL,
        "booking_category" character varying NOT NULL,
        "truck_booking_status" character varying NOT NULL,
        "truck_plate_number" character varying NOT NULL,
        "driver_name" character varying NOT NULL,
        "transporter_company_name" character varying NOT NULL,
        "transporter_user_account" character varying,
        "transporter_contact_person" character varying,
        "transporter_contact_number" character varying,
        "transporter_email" character varying,
        "date_issued" TIMESTAMP NOT NULL,
        "date_disputed" TIMESTAMP NOT NULL,
        "dispute_reason" text NOT NULL,
        "dispute_status" character varying NOT NULL DEFAULT 'PENDING_REVIEW',
        "resolution_outcome" character varying,
        "managed_by" character varying,
        "resolution_date" TIMESTAMP,
        "adjusted_amount" numeric(14,2),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fine_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fine_disputes_dispute_id" UNIQUE ("dispute_id"),
        CONSTRAINT "CHK_fine_disputes_status" CHECK ("dispute_status" IN ('PENDING_REVIEW', 'UNDER_NPA_REVIEW', 'RESOLVED', 'REJECTED')),
        CONSTRAINT "CHK_fine_disputes_resolution_outcome" CHECK ("resolution_outcome" IS NULL OR "resolution_outcome" IN ('FINE_UPHELD', 'FINE_WAIVED', 'FINE_ADJUSTED')),
        CONSTRAINT "CHK_fine_disputes_booking_category" CHECK ("booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fine_disputes_status" ON "fine_disputes" ("dispute_status");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fine_dispute_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "dispute_id" uuid NOT NULL,
        "action" character varying NOT NULL,
        "performed_by" character varying NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fine_dispute_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fine_dispute_events_dispute" FOREIGN KEY ("dispute_id") REFERENCES "fine_disputes"("id") ON DELETE CASCADE
      );
    `);

    // ──────────────────────────────── DTTR ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dttr_terminal_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "terminal_id" uuid,
        "terminal_name" character varying NOT NULL,
        "terminal_code" character varying NOT NULL,
        "approved_daily_capacity" integer NOT NULL,
        "req_exports" integer NOT NULL DEFAULT 0,
        "req_imports" integer NOT NULL DEFAULT 0,
        "req_empties" integer NOT NULL DEFAULT 0,
        "req_gatepass" integer NOT NULL DEFAULT 0,
        "request_mode" character varying NOT NULL DEFAULT 'MANUAL',
        "auto_exports" integer,
        "auto_imports" integer,
        "auto_empties" integer,
        "auto_gatepass" integer,
        "last_updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dttr_terminal_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dttr_terminal_requests_terminal_code" UNIQUE ("terminal_code"),
        CONSTRAINT "CHK_dttr_terminal_requests_mode" CHECK ("request_mode" IN ('MANUAL', 'AUTOMATED')),
        CONSTRAINT "FK_dttr_terminal_requests_terminal" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dttr_submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "terminal_request_id" uuid NOT NULL,
        "terminal_name" character varying NOT NULL,
        "req_exports" integer NOT NULL,
        "req_imports" integer NOT NULL,
        "req_empties" integer NOT NULL,
        "req_gatepass" integer NOT NULL,
        "total_requested" integer NOT NULL,
        "approved_capacity" integer NOT NULL,
        "request_mode" character varying NOT NULL,
        "submitted_by" character varying NOT NULL,
        "submitted_by_id" character varying,
        "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dttr_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dttr_submissions_request" FOREIGN KEY ("terminal_request_id") REFERENCES "dttr_terminal_requests"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dttr_edit_audits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "terminal_request_id" uuid NOT NULL,
        "terminal_name" character varying NOT NULL,
        "edited_fields" jsonb NOT NULL,
        "performed_by" character varying NOT NULL,
        "performed_by_id" character varying,
        "justification" text NOT NULL,
        "approval_reference" character varying,
        "approval_document_name" character varying,
        "previous_values" jsonb NOT NULL,
        "new_values" jsonb NOT NULL,
        "edited_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dttr_edit_audits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dttr_edit_audits_request" FOREIGN KEY ("terminal_request_id") REFERENCES "dttr_terminal_requests"("id") ON DELETE CASCADE
      );
    `);

    // ────────────────────────────── Bookings ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" character varying NOT NULL,
        "journey_code" character varying NOT NULL,
        "truck_plate_number" character varying NOT NULL,
        "truck_color" character varying,
        "driver_name" character varying NOT NULL,
        "driver_id" character varying,
        "transporter_company" character varying NOT NULL,
        "terminal_name" character varying NOT NULL,
        "terminal_destination" character varying NOT NULL,
        "transfer_type" character varying NOT NULL,
        "booking_category" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'LIVE',
        "truck_booked_by" character varying NOT NULL,
        "truck_owned_by" character varying NOT NULL,
        "left_pregate_at" TIMESTAMP,
        "left_manifest_at" TIMESTAMP,
        "manifest_status" character varying,
        "completed_at" TIMESTAMP,
        "tow_requested_at" TIMESTAMP,
        "tow_reason" text,
        "tow_requested_by" character varying,
        "tow_company" character varying,
        "tow_status" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_booking_id" UNIQUE ("booking_id"),
        CONSTRAINT "CHK_bookings_status" CHECK ("status" IN ('LIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
        CONSTRAINT "CHK_bookings_transfer_type" CHECK ("transfer_type" IN ('INBOUND', 'OUTBOUND', 'INTER_TERMINAL', 'EMPTY_RETURN', 'LOCAL')),
        CONSTRAINT "CHK_bookings_category" CHECK ("booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY', 'DOMESTIC')),
        CONSTRAINT "CHK_bookings_manifest_status" CHECK ("manifest_status" IS NULL OR "manifest_status" IN ('IN_MANIFEST', 'LEFT_MANIFEST'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_status" ON "bookings" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_manifest_status" ON "bookings" ("manifest_status");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_timeline_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "status" character varying NOT NULL,
        "performed_by" character varying,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_timeline_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_timeline_entries_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_exceptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "description" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_exceptions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_booking_exceptions_type" CHECK ("type" IN ('PENALTY', 'DELAY', 'EXCEPTION')),
        CONSTRAINT "FK_booking_exceptions_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE
      );
    `);

    // ─────────────────────────── Utility Tickets ─────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "utility_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" character varying NOT NULL,
        "terminal_id" uuid,
        "terminal_name" character varying NOT NULL,
        "terminal_code" character varying,
        "terminal_type" character varying NOT NULL,
        "terminal_location" character varying,
        "request_type" character varying NOT NULL,
        "description" text NOT NULL,
        "full_description" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "booking_priority" character varying NOT NULL DEFAULT 'STANDARD',
        "delivery_company_name" character varying NOT NULL,
        "truck_plate_number" character varying,
        "date_raised" TIMESTAMP NOT NULL DEFAULT now(),
        "raised_by_user_id" character varying,
        "raised_by_user_name" character varying NOT NULL,
        "super_admin_approved" boolean NOT NULL DEFAULT false,
        "approved_by" character varying,
        "approved_at" TIMESTAMP,
        "e_ticket_available" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_utility_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_utility_tickets_ticket_id" UNIQUE ("ticket_id"),
        CONSTRAINT "CHK_utility_tickets_terminal_type" CHECK ("terminal_type" IN ('PORT', 'NON_PORT')),
        CONSTRAINT "CHK_utility_tickets_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
        CONSTRAINT "CHK_utility_tickets_request_type" CHECK ("request_type" IN ('POWER', 'WATER', 'MAINTENANCE', 'WASTE_MANAGEMENT', 'SECURITY', 'FUEL', 'OTHER')),
        CONSTRAINT "CHK_utility_tickets_priority" CHECK ("booking_priority" IN ('PRIORITY', 'STANDARD')),
        CONSTRAINT "FK_utility_tickets_terminal" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_utility_tickets_status" ON "utility_tickets" ("status");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "utility_ticket_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid NOT NULL,
        "status" character varying NOT NULL,
        "performed_by" character varying NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_utility_ticket_history" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_utility_ticket_history_status" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
        CONSTRAINT "FK_utility_ticket_history_ticket" FOREIGN KEY ("ticket_id") REFERENCES "utility_tickets"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "utility_assigned_personnel" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ticket_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "role" character varying NOT NULL,
        "assigned_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_utility_assigned_personnel" PRIMARY KEY ("id"),
        CONSTRAINT "FK_utility_assigned_personnel_ticket" FOREIGN KEY ("ticket_id") REFERENCES "utility_tickets"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "utility_assigned_personnel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "utility_ticket_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "utility_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_exceptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_timeline_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dttr_edit_audits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dttr_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dttr_terminal_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fine_dispute_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fine_disputes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issued_fines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "penalty_definitions"`);
  }
}
