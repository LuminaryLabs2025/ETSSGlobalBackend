import { MigrationInterface, QueryRunner } from 'typeorm';

export class TwoFactorHardening1760000000000 implements MigrationInterface {
  name = 'TwoFactorHardening1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'users_two_factor_method_enum'
        ) THEN
          CREATE TYPE "users_two_factor_method_enum" AS ENUM ('EMAIL', 'AUTHENTICATOR', 'SMS');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "two_factor_enabled" SET DEFAULT true,
        ADD COLUMN IF NOT EXISTS "two_factor_method" "users_two_factor_method_enum" NOT NULL DEFAULT 'EMAIL',
        ADD COLUMN IF NOT EXISTS "two_factor_code" character varying,
        ADD COLUMN IF NOT EXISTS "two_factor_code_expires_at" TIMESTAMP;
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET
        "two_factor_enabled" = true,
        "two_factor_method" = COALESCE("two_factor_method", 'EMAIL')
      WHERE "two_factor_enabled" = false
         OR "two_factor_method" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "two_factor_code_expires_at",
        DROP COLUMN IF EXISTS "two_factor_code",
        DROP COLUMN IF EXISTS "two_factor_method",
        ALTER COLUMN "two_factor_enabled" SET DEFAULT false;
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "users_two_factor_method_enum";
    `);
  }
}
