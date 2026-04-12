import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRolesUserTypePermissions1744542000000
  implements MigrationInterface
{
  name = 'RemoveRolesUserTypePermissions1744542000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_type_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_type_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_type_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_type_permissions_pair" UNIQUE ("user_type_id", "permission_id"),
        CONSTRAINT "FK_utp_user_type" FOREIGN KEY ("user_type_id") REFERENCES "user_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_utp_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_type_permissions_user_type_id" ON "user_type_permissions" ("user_type_id");
    `);

    await queryRunner.query(`
      ALTER TABLE "permission_modules"
        ADD COLUMN IF NOT EXISTS "nav_section" character varying(64);
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_member_roles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "permission_modules" DROP COLUMN IF EXISTS "nav_section";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_type_permissions";`);
    // Recreating roles schema in down is omitted; restore from backup if needed.
  }
}
