import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces at most one ACTIVE PaymentType per (linked_form,
 * charged_to_user_type_id) — previously nothing stopped creating multiple
 * active rows for the same booking type/audience, and BookingsService's
 * computeFee() sums every active match rather than picking one, so
 * duplicates silently double-charged (or worse) rather than erroring.
 * A partial unique index (not a plain unique constraint) so INACTIVE rows
 * — e.g. a superseded price history — can coexist freely; only ACTIVE ones
 * are constrained.
 */
export class PaymentTypesOneActivePerForm1762100000000 implements MigrationInterface {
  name = 'PaymentTypesOneActivePerForm1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_types_linked_form_user_type_active"
      ON "payment_types" ("linked_form", "charged_to_user_type_id")
      WHERE "status" = 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payment_types_linked_form_user_type_active"
    `);
  }
}
