import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountSettings1744689000000 implements MigrationInterface {
  name = 'AccountSettings1744689000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "address" character varying,
        ADD COLUMN IF NOT EXISTS "password_reset_token" character varying,
        ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "invite_token" character varying,
        ADD COLUMN IF NOT EXISTS "invite_token_expires_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "invite_token_used_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "two_factor_secret" text;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_password_reset_token"
      ON "users" ("password_reset_token");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_invite_token"
      ON "users" ("invite_token");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "email_notifications" boolean NOT NULL DEFAULT true,
        "sms_notifications" boolean NOT NULL DEFAULT false,
        "push_notifications" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_settings_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_notification_settings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_settings";`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_password_reset_token";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_invite_token";
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "two_factor_secret",
        DROP COLUMN IF EXISTS "two_factor_enabled",
        DROP COLUMN IF EXISTS "password_changed_at",
        DROP COLUMN IF EXISTS "invite_token_used_at",
        DROP COLUMN IF EXISTS "invite_token_expires_at",
        DROP COLUMN IF EXISTS "invite_token",
        DROP COLUMN IF EXISTS "password_reset_expires_at",
        DROP COLUMN IF EXISTS "password_reset_token",
        DROP COLUMN IF EXISTS "address";
    `);
  }
}
