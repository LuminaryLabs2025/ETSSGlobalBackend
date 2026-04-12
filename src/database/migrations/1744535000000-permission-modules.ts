import { MigrationInterface, QueryRunner } from 'typeorm';

export class PermissionModules1744535000000 implements MigrationInterface {
  name = 'PermissionModules1744535000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permission_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permission_modules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permission_modules_key" UNIQUE ("key")
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
        ADD COLUMN IF NOT EXISTS "module_id" uuid,
        ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
    `);

    const insertResult: { id: string }[] = await queryRunner.query(`
      INSERT INTO "permission_modules" ("key", "name", "description", "sort_order")
      SELECT '__legacy', 'Unassigned', 'Temporary row for migration', 0
      WHERE NOT EXISTS (SELECT 1 FROM "permission_modules" WHERE "key" = '__legacy')
      RETURNING "id";
    `);

    let legacyId: string | undefined = insertResult[0]?.id;
    if (!legacyId) {
      const rows: { id: string }[] = await queryRunner.query(`
        SELECT "id" FROM "permission_modules" WHERE "key" = '__legacy' LIMIT 1;
      `);
      legacyId = rows[0]?.id;
    }

    if (legacyId) {
      await queryRunner.query(
        `UPDATE "permissions" SET "module_id" = $1 WHERE "module_id" IS NULL`,
        [legacyId],
      );
    }

    // Keep `module_id` nullable (matches entity) so TypeORM synchronize can add the
    // column on DBs with existing rows; run seeds to assign real modules.

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "permissions"
          ADD CONSTRAINT "FK_permissions_permission_module"
          FOREIGN KEY ("module_id") REFERENCES "permission_modules"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "FK_permissions_permission_module";
    `);
    await queryRunner.query(`
      ALTER TABLE "permissions" DROP COLUMN IF EXISTS "module_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "permissions" DROP COLUMN IF EXISTS "sort_order";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "permission_modules"`);
  }
}
