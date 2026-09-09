import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payments module: `invoices` (what's owed, generic payable_type/payable_id),
 * `payment_transactions` (one Paystack gateway attempt per invoice — at most
 * one PENDING at a time, enforced by a partial unique index), and
 * `payment_webhook_events` (append-only audit log). Adds `bookings.invoice_id`
 * so a booking can point at the Invoice raised for its fee. Replaces the old
 * trust-the-client `PATCH /:id/confirm-payment` stub — the
 * CHK_bookings_payment_method constraint (added by BookingCreationFlows) is
 * left untouched so historical 'WALLET'-tagged rows from before this
 * migration remain valid; new payments only ever write 'PAYSTACK'.
 */
export class PaymentsModule1762000000000 implements MigrationInterface {
  name = 'PaymentsModule1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_number" character varying NOT NULL,
        "payable_type" character varying NOT NULL,
        "payable_id" uuid NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'NGN',
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "description" text,
        "fee_breakdown" jsonb,
        "issued_by" uuid,
        "paid_at" TIMESTAMP,
        "cancelled_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_invoices_invoice_number" UNIQUE ("invoice_number"),
        CONSTRAINT "CHK_invoices_payable_type" CHECK ("payable_type" IN ('BOOKING')),
        CONSTRAINT "CHK_invoices_status" CHECK ("status" IN ('PENDING', 'PAID', 'CANCELLED'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_payable_id" ON "invoices" ("payable_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "invoices"
          ADD CONSTRAINT "FK_invoices_issued_by"
          FOREIGN KEY ("issued_by") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference" character varying NOT NULL,
        "invoice_id" uuid NOT NULL,
        "gateway" character varying NOT NULL DEFAULT 'PAYSTACK',
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "amount" numeric(14,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'NGN',
        "customer_email" character varying,
        "paystack_authorization_url" text,
        "paystack_access_code" character varying,
        "channel" character varying,
        "gateway_response" text,
        "raw_response" jsonb,
        "paid_at" TIMESTAMP,
        "initiated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_transactions_reference" UNIQUE ("reference"),
        CONSTRAINT "CHK_payment_transactions_gateway" CHECK ("gateway" IN ('PAYSTACK')),
        CONSTRAINT "CHK_payment_transactions_status" CHECK ("status" IN ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED'))
      )
    `);
    // At most one PENDING transaction per invoice — the DB-level idempotency
    // guarantee for double-click/retry on initialize (see PaymentsService).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_transactions_invoice_pending"
      ON "payment_transactions" ("invoice_id")
      WHERE "status" = 'PENDING'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "payment_transactions"
          ADD CONSTRAINT "FK_payment_transactions_invoice"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "payment_transactions"
          ADD CONSTRAINT "FK_payment_transactions_initiated_by"
          FOREIGN KEY ("initiated_by") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" character varying NOT NULL DEFAULT 'PAYSTACK',
        "event_type" character varying NOT NULL,
        "reference" character varying,
        "signature_valid" boolean NOT NULL DEFAULT false,
        "payload" jsonb NOT NULL,
        "processed" boolean NOT NULL DEFAULT false,
        "processing_error" text,
        "received_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_webhook_events_reference" ON "payment_webhook_events" ("reference")
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "invoice_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
          ADD CONSTRAINT "FK_bookings_invoice"
          FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_invoice_id" ON "bookings" ("invoice_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_invoice"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bookings_invoice_id"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "invoice_id"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
  }
}
