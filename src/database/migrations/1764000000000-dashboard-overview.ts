import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dashboard overview.
 *
 * - `bookings.left_terminal_at`: the "Left Terminal" lifecycle stage
 *   (terminal EXIT barrier tag or manual). Leaving the terminal completes
 *   the booking.
 * - `ops_command_orders`: Operations Command & Control orders authorised
 *   by a SuperAdmin from the overview.
 */
export class DashboardOverview1764000000000 implements MigrationInterface {
  name = 'DashboardOverview1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "left_terminal_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ops_command_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reference_id" character varying NOT NULL,
        "action" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "targets" jsonb NOT NULL DEFAULT '[]',
        "notes" text,
        "was_recommended" boolean NOT NULL DEFAULT false,
        "recommendation_reason" text,
        "congestion_index" integer,
        "authorised_by" uuid NOT NULL,
        "authorised_by_name" character varying NOT NULL,
        "authorised_at" TIMESTAMP NOT NULL,
        "notified_recipients" jsonb NOT NULL DEFAULT '[]',
        "notified_at" TIMESTAMP,
        "notification_error" text,
        "lifted_at" TIMESTAMP,
        "lifted_by" uuid,
        "lifted_by_name" character varying,
        "lift_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ops_command_orders_reference_id" UNIQUE ("reference_id"),
        CONSTRAINT "CHK_ops_command_orders_action" CHECK ("action" IN ('SUSPEND_RED_ZONE_DISPATCH', 'REROUTE_CORRIDOR_TRAFFIC', 'ACTIVATE_OVERFLOW_HOLDING', 'BROADCAST_DIVERSION_ADVISORY', 'PRIORITY_MOVEMENT')),
        CONSTRAINT "CHK_ops_command_orders_status" CHECK ("status" IN ('ACTIVE', 'LIFTED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ops_command_orders_status_action" ON "ops_command_orders" ("status", "action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ops_command_orders_authorised_at" ON "ops_command_orders" ("authorised_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ops_command_orders"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN IF EXISTS "left_terminal_at"
    `);
  }
}
