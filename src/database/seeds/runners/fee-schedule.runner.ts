import { DataSource, In, Not } from 'typeorm';
import { PaymentType, UserType } from '../../entities';
import { FEE_SCHEDULE_SEEDS } from '../data/fee-schedule-seeds';

/**
 * Seeds the PO fee schedule as Payment Types. Create-only: an existing row
 * (matched by name) is left untouched so SuperAdmin edits survive re-seeds.
 * A form that already has ACTIVE payment types configured outside this
 * schedule gets the new rows as INACTIVE — activating both would add the
 * schedule's fees on top of the existing ones and overcharge bookings.
 */
export async function runFeeScheduleSeed(
  dataSource: DataSource,
  userTypeMap: Map<string, UserType>,
): Promise<void> {
  console.log('\n💰 Seeding e-Revenue fee schedule...');
  const repo = dataSource.getRepository(PaymentType);
  const seedNames = FEE_SCHEDULE_SEEDS.map((s) => s.name);
  const forms = [...new Set(FEE_SCHEDULE_SEEDS.map((s) => s.linked_form))];
  const foreignActive = await repo.find({
    where: {
      linked_form: In(forms),
      status: 'ACTIVE',
      name: Not(In(seedNames)),
    },
  });
  const formsWithOtherFees = new Set(foreignActive.map((p) => p.linked_form));

  for (const seed of FEE_SCHEDULE_SEEDS) {
    if (await repo.findOne({ where: { name: seed.name } })) {
      console.log(`  ⏭️  Kept existing payment type: ${seed.name}`);
      continue;
    }
    const payer = userTypeMap.get(seed.paid_by);
    if (!payer) {
      console.warn(
        `  ⚠️  Skipped ${seed.name}: user type ${seed.paid_by} missing`,
      );
      continue;
    }
    const status = formsWithOtherFees.has(seed.linked_form)
      ? 'INACTIVE'
      : 'ACTIVE';
    await repo.save(
      repo.create({
        name: seed.name,
        service_name: seed.service_name,
        linked_form: seed.linked_form,
        revenue_event_trigger: seed.revenue_event_trigger,
        charged_to_user_type_id: payer.id,
        amount_type: 'FIXED',
        amount: seed.amount,
        facility_percentage: (seed.facility_percentage ?? 0).toFixed(2),
        transit_park_percentage: (seed.transit_park_percentage ?? 0).toFixed(2),
        npa_percentage: (seed.npa_percentage ?? 0).toFixed(2),
        etss_percentage: (seed.etss_percentage ?? 0).toFixed(2),
        tow_company_percentage: (seed.tow_company_percentage ?? 0).toFixed(2),
        status,
      }),
    );
    console.log(
      status === 'ACTIVE'
        ? `  ✅ Created payment type: ${seed.name}`
        : `  ✅ Created payment type: ${seed.name} (INACTIVE — ${seed.linked_form} already has other active fees; activate it in App Options once reviewed)`,
    );
  }
}
