import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityLogAuditColumns1744419600000 implements MigrationInterface {
  name = 'ActivityLogAuditColumns1744419600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_logs"
        ADD COLUMN IF NOT EXISTS "user_agent" text,
        ADD COLUMN IF NOT EXISTS "module" character varying,
        ADD COLUMN IF NOT EXISTS "action_label" character varying,
        ADD COLUMN IF NOT EXISTS "entry_status" character varying(20) NOT NULL DEFAULT 'SUCCESS',
        ADD COLUMN IF NOT EXISTS "http_status_code" integer,
        ADD COLUMN IF NOT EXISTS "error_message" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_logs"
        DROP COLUMN IF EXISTS "error_message",
        DROP COLUMN IF EXISTS "http_status_code",
        DROP COLUMN IF EXISTS "entry_status",
        DROP COLUMN IF EXISTS "action_label",
        DROP COLUMN IF EXISTS "module",
        DROP COLUMN IF EXISTS "user_agent";
    `);
  }
}
