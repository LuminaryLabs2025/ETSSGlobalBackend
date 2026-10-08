import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint: e-Revenue (MVP 081–085), Traffic Command & Coordination
 * (MVP 086–088) and Incident Reports (MVP 090).
 *
 * - `payment_types` gains the revenue-recipient split (facility / transit
 *   park / NPA / Maritime-ETSS / tow company %, totalling 100; existing rows
 *   default to 100% Maritime-ETSS). The one-ACTIVE-per-(form, user type)
 *   index becomes one-ACTIVE-per-(form, user type, service) so a form can
 *   carry several fee lines (e.g. Facility Bay + Matching Fee).
 * - `revenue_transactions` — the e-Revenue ledger, one row per gateway
 *   PaymentTransaction (backfill existing rows via POST /api/e-revenue/ledger/sync).
 * - `bookings.left_facility_at` / `bookings.in_terminal_at` — the two
 *   lifecycle stages Live Truck Updates needs that had no column.
 * - `latitude` / `longitude` on terminals, transit_parks, facilities.
 * - `barrier_tag_events` — trucks tagged at barriers.
 * - `incidents`, `incident_evidence`, `incident_events`, `incident_notes`.
 */
export class ERevenueTrafficCommandIncidents1763000000000 implements MigrationInterface {
  name = 'ERevenueTrafficCommandIncidents1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── e-Revenue: fee schedule split on payment types ──
    await queryRunner.query(`
      ALTER TABLE "payment_types"
        ADD COLUMN IF NOT EXISTS "facility_percentage" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "transit_park_percentage" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "npa_percentage" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "etss_percentage" numeric(5,2) NOT NULL DEFAULT 100,
        ADD COLUMN IF NOT EXISTS "tow_company_percentage" numeric(5,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "payment_types"
          ADD CONSTRAINT "CHK_payment_types_revenue_split"
          CHECK ("facility_percentage" + "transit_park_percentage" + "npa_percentage" + "etss_percentage" + "tow_company_percentage" = 100);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_types_linked_form_user_type_active"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_types_linked_form_service_active"
      ON "payment_types" ("linked_form", "charged_to_user_type_id", "service_name")
      WHERE "status" = 'ACTIVE'
    `);

    // ── e-Revenue: ledger ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "revenue_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" character varying NOT NULL,
        "payment_transaction_id" uuid NOT NULL,
        "invoice_id" uuid NOT NULL,
        "invoice_number" character varying,
        "payment_reference" character varying NOT NULL,
        "payment_source" character varying NOT NULL,
        "payable_type" character varying NOT NULL,
        "payable_id" uuid NOT NULL,
        "service_reference" character varying,
        "payer_type" character varying,
        "payer_company_id" uuid,
        "payer_company_name" character varying,
        "payer_user_id" uuid,
        "payer_user_name" character varying,
        "payer_email" character varying,
        "amount_paid" numeric(14,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'NGN',
        "payment_method" character varying NOT NULL,
        "channel" character varying,
        "status" character varying NOT NULL,
        "gateway_response" text,
        "paid_at" TIMESTAMP,
        "transacted_at" TIMESTAMP NOT NULL,
        "etss_share" numeric(14,2) NOT NULL DEFAULT 0,
        "npa_share" numeric(14,2) NOT NULL DEFAULT 0,
        "facility_id" uuid,
        "facility_name" character varying,
        "facility_share" numeric(14,2) NOT NULL DEFAULT 0,
        "transit_park_id" uuid,
        "transit_park_name" character varying,
        "transit_park_share" numeric(14,2) NOT NULL DEFAULT 0,
        "tow_company_id" uuid,
        "tow_company_name" character varying,
        "tow_company_share" numeric(14,2) NOT NULL DEFAULT 0,
        "share_percentages" jsonb,
        "fee_lines" jsonb,
        "truck_plate_number" character varying,
        "terminal_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_revenue_transactions_transaction_id" UNIQUE ("transaction_id"),
        CONSTRAINT "UQ_revenue_transactions_payment_transaction_id" UNIQUE ("payment_transaction_id"),
        CONSTRAINT "CHK_revenue_transactions_payment_source" CHECK ("payment_source" IN ('BOOKING', 'UTILITY_TICKET', 'PENALTY', 'TOW_TRUCK_REQUEST', 'DEMURRAGE')),
        CONSTRAINT "CHK_revenue_transactions_status" CHECK ("status" IN ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED'))
      )
    `);
    for (const [name, cols] of [
      ['IDX_revenue_transactions_transacted_at', '"transacted_at"'],
      ['IDX_revenue_transactions_source_status', '"payment_source", "status"'],
      ['IDX_revenue_transactions_facility_id', '"facility_id"'],
      ['IDX_revenue_transactions_transit_park_id', '"transit_park_id"'],
      ['IDX_revenue_transactions_tow_company_id', '"tow_company_id"'],
    ]) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "revenue_transactions" (${cols})`,
      );
    }
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "revenue_transactions"
          ADD CONSTRAINT "FK_revenue_transactions_payment_transaction_id"
          FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "revenue_transactions"
          ADD CONSTRAINT "FK_revenue_transactions_invoice_id"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── Traffic Command ──
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "left_facility_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "in_terminal_at" TIMESTAMP
    `);
    for (const table of ['terminals', 'transit_parks', 'facilities']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "latitude" double precision,
          ADD COLUMN IF NOT EXISTS "longitude" double precision
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "barrier_tag_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "barrier_id" uuid NOT NULL,
        "site_type" character varying NOT NULL,
        "site_id" uuid NOT NULL,
        "barrier_role" character varying NOT NULL,
        "truck_id" uuid,
        "truck_plate_number" character varying NOT NULL,
        "rfid_tag_number" character varying,
        "booking_id" uuid,
        "booking_transition" character varying,
        "source" character varying NOT NULL DEFAULT 'BARRIER',
        "tagged_at" TIMESTAMP NOT NULL,
        "recorded_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_barrier_tag_events_site_type" CHECK ("site_type" IN ('FACILITY', 'TRANSIT_PARK', 'TERMINAL')),
        CONSTRAINT "CHK_barrier_tag_events_barrier_role" CHECK ("barrier_role" IN ('ENTRY', 'EXIT')),
        CONSTRAINT "CHK_barrier_tag_events_source" CHECK ("source" IN ('BARRIER', 'HANDHELD', 'MANUAL'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_barrier_tag_events_site_tagged_at"
      ON "barrier_tag_events" ("site_type", "site_id", "tagged_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_barrier_tag_events_plate_site"
      ON "barrier_tag_events" ("truck_plate_number", "site_type", "site_id", "tagged_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_barrier_tag_events_barrier_tagged_at"
      ON "barrier_tag_events" ("barrier_id", "tagged_at")
    `);
    for (const [name, col, ref, onDelete] of [
      ['FK_barrier_tag_events_barrier_id', 'barrier_id', 'barriers', 'CASCADE'],
      [
        'FK_barrier_tag_events_booking_id',
        'booking_id',
        'bookings',
        'SET NULL',
      ],
      ['FK_barrier_tag_events_recorded_by', 'recorded_by', 'users', 'SET NULL'],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "barrier_tag_events"
            ADD CONSTRAINT "${name}"
            FOREIGN KEY ("${col}") REFERENCES "${ref}"("id")
            ON DELETE ${onDelete} ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }

    // ── Incidents ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incidents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference_id" character varying NOT NULL,
        "type" character varying NOT NULL,
        "description" text NOT NULL,
        "severity" character varying NOT NULL DEFAULT 'MEDIUM',
        "status" character varying NOT NULL DEFAULT 'OPEN',
        "location_kind" character varying NOT NULL,
        "location_id" uuid,
        "location_name" character varying NOT NULL,
        "reported_by" uuid,
        "reporter_name" character varying,
        "reporter_email" character varying,
        "reporter_company_id" uuid,
        "reporter_company_name" character varying,
        "reported_at" TIMESTAMP NOT NULL,
        "truck_id" uuid,
        "truck_plate_number" character varying,
        "driver_ref_id" uuid,
        "driver_name" character varying,
        "booking_id" uuid,
        "booking_reference" character varying,
        "payment_reference" character varying,
        "assigned_company_id" uuid,
        "assigned_team_name" character varying,
        "assigned_user_id" uuid,
        "assigned_at" TIMESTAMP,
        "priority_deadline" TIMESTAMP,
        "escalation_level" character varying,
        "escalated_at" TIMESTAMP,
        "evidence_requested_at" TIMESTAMP,
        "emergency_action" character varying,
        "emergency_triggered_at" TIMESTAMP,
        "root_cause" text,
        "corrective_action" text,
        "resolution_notes" text,
        "resolution_submitted_at" TIMESTAMP,
        "resolved_at" TIMESTAMP,
        "resolved_by" uuid,
        "closed_at" TIMESTAMP,
        "sla_met" boolean,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_incidents_reference_id" UNIQUE ("reference_id"),
        CONSTRAINT "CHK_incidents_type" CHECK ("type" IN ('TRUCK_BREAKDOWN', 'CARGO_DAMAGE', 'ACCIDENT_INJURY', 'GATE_CONGESTION', 'SECURITY_BREACH', 'PAYMENT_DISPUTE', 'SYSTEM_DOWNTIME')),
        CONSTRAINT "CHK_incidents_severity" CHECK ("severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        CONSTRAINT "CHK_incidents_status" CHECK ("status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'PENDING_SUPERADMIN_APPROVAL', 'CLOSED', 'REJECTED_BY_SUPERADMIN', 'REOPENED')),
        CONSTRAINT "CHK_incidents_location_kind" CHECK ("location_kind" IN ('FACILITY', 'TRANSIT_PARK', 'PORT_TERMINAL')),
        CONSTRAINT "CHK_incidents_escalation_level" CHECK ("escalation_level" IS NULL OR "escalation_level" IN ('MANAGEMENT', 'NPA', 'EXECUTIVE'))
      )
    `);
    for (const [name, col] of [
      ['IDX_incidents_status', 'status'],
      ['IDX_incidents_reporter_company_id', 'reporter_company_id'],
      ['IDX_incidents_assigned_company_id', 'assigned_company_id'],
    ]) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "incidents" ("${col}")`,
      );
    }
    for (const [name, col, ref] of [
      ['FK_incidents_reported_by', 'reported_by', 'users'],
      ['FK_incidents_reporter_company_id', 'reporter_company_id', 'companies'],
      ['FK_incidents_truck_id', 'truck_id', 'trucks'],
      ['FK_incidents_driver_ref_id', 'driver_ref_id', 'drivers'],
      ['FK_incidents_booking_id', 'booking_id', 'bookings'],
      ['FK_incidents_assigned_company_id', 'assigned_company_id', 'companies'],
      ['FK_incidents_assigned_user_id', 'assigned_user_id', 'users'],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "incidents"
            ADD CONSTRAINT "${name}"
            FOREIGN KEY ("${col}") REFERENCES "${ref}"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_evidence" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "incident_id" uuid NOT NULL,
        "label" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'FILE',
        "url" text NOT NULL,
        "phase" character varying NOT NULL DEFAULT 'REPORT',
        "uploaded_by" uuid,
        "uploaded_by_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_incident_evidence_type" CHECK ("type" IN ('PHOTO', 'FILE')),
        CONSTRAINT "CHK_incident_evidence_phase" CHECK ("phase" IN ('REPORT', 'RESOLUTION'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "incident_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "detail" text,
        "is_action" boolean NOT NULL DEFAULT false,
        "actor_user_id" uuid,
        "actor_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "incident_id" uuid NOT NULL,
        "kind" character varying NOT NULL DEFAULT 'COMMENT',
        "body" text NOT NULL,
        "author_user_id" uuid,
        "author_name" character varying,
        "team" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_incident_notes_kind" CHECK ("kind" IN ('COMMENT', 'INSTRUCTION', 'REJECTION'))
      )
    `);
    for (const table of [
      'incident_evidence',
      'incident_events',
      'incident_notes',
    ]) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_incident_id" ON "${table}" ("incident_id")`,
      );
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}"
            ADD CONSTRAINT "FK_${table}_incident_id"
            FOREIGN KEY ("incident_id") REFERENCES "incidents"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incident_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "barrier_tag_events"`);
    for (const table of ['terminals', 'transit_parks', 'facilities']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "latitude",
          DROP COLUMN IF EXISTS "longitude"
      `);
    }
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN IF EXISTS "left_facility_at",
        DROP COLUMN IF EXISTS "in_terminal_at"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "revenue_transactions"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_types_linked_form_service_active"`,
    );
    // Restoring the old index fails if a form now has several ACTIVE fee
    // lines — deactivate the extras before reverting.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_types_linked_form_user_type_active"
      ON "payment_types" ("linked_form", "charged_to_user_type_id")
      WHERE "status" = 'ACTIVE'
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_types"
        DROP CONSTRAINT IF EXISTS "CHK_payment_types_revenue_split",
        DROP COLUMN IF EXISTS "facility_percentage",
        DROP COLUMN IF EXISTS "transit_park_percentage",
        DROP COLUMN IF EXISTS "npa_percentage",
        DROP COLUMN IF EXISTS "etss_percentage",
        DROP COLUMN IF EXISTS "tow_company_percentage"
    `);
  }
}
