/**
 * Demo data for the e-Revenue, Traffic Command and Incident Reports screens
 * (`npm run seed:demo`). Everything is created through the real services —
 * BookingsService (fees + invoices), the booking payment sync handler,
 * RevenueLedgerService, LiveLocationsService barrier tags and
 * IncidentsService — so the data has exactly the shape the API produces.
 *
 * Safe to re-run: each section is skipped once its marker records exist.
 * Demo records are recognisable by `MTMS-DEMO-` payment references, the
 * `demo.*@example.com` reporter accounts and the "RapidTow Nigeria" company.
 *
 * What it does:
 * 1. Activates the PO fee schedule (Facility Bay / Transit Park Bay +
 *    Matching Fee) on the booking forms, deactivating the legacy single
 *    booking fees they replace — so revenue splits across recipients.
 * 2. Sets map coordinates on locations that have none.
 * 3. Creates ~24 bookings paid over the last 30 days (mostly successful,
 *    some failed / pending / abandoned) — historical ones are completed
 *    and free their truck again; a few stay LIVE at different stages.
 * 4. Records barrier tags (entries/exits) for the map's tagged-per-hour/ATAT.
 * 5. Creates a tow truck company, demo PRIMARY reporters and ~10 incidents
 *    across the whole lifecycle.
 *
 * Runs with synchronize OFF (schema is migration-managed) and without the
 * queue / cron modules, so it never touches shared jobs.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
// Never let a local run synchronize (alter) a shared, migration-managed schema.
process.env.NODE_ENV = process.env.DEMO_NODE_ENV ?? 'production';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource, EntityManager, In, IsNull, Like } from 'typeorm';
import { getDatabaseConfig } from '../../config/database.config';
import { AccountType, UserStatus } from '../../common/enums';
import {
  BarrierSiteLink,
  Booking,
  BookingCategory,
  Company,
  Driver,
  Facility,
  FacilityTimeslot,
  Incident,
  Invoice,
  PaymentTransaction,
  PaymentType,
  Terminal,
  TransitPark,
  Truck,
  User,
  UserType,
} from '../entities';
import { PaymentsModule } from '../../modules/payments/payments.module';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { BookingsService } from '../../modules/bookings/bookings.service';
import { ERevenueModule } from '../../modules/e-revenue/e-revenue.module';
import { RevenueLedgerService } from '../../modules/e-revenue/revenue-ledger.service';
import { TrafficCommandModule } from '../../modules/traffic-command/traffic-command.module';
import {
  LiveLocationsService,
  TrafficActor,
} from '../../modules/traffic-command/live-locations.service';
import { IncidentsModule } from '../../modules/incidents/incidents.module';
import {
  IncidentActor,
  IncidentsService,
} from '../../modules/incidents/incidents.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    PaymentsModule,
    BookingsModule,
    ERevenueModule,
    TrafficCommandModule,
    IncidentsModule,
  ],
})
class DemoSeedModule {}

const DEMO_REF = 'MTMS-DEMO-';
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Deterministic pseudo-random so re-seeding a fresh DB gives the same picture. */
let seed = 20261012;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
const ago = (ms: number) => new Date(Date.now() - ms);

/** Approximate coordinates around Lagos port areas. */
const AREA_COORDS: Record<string, [number, number]> = {
  APAPA: [6.4474, 3.3646],
  TINCAN: [6.44, 3.342],
  APAPA_TINCAN: [6.4437, 3.3533],
};

async function main() {
  const app = await NestFactory.createApplicationContext(DemoSeedModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const bookings = app.get(BookingsService);
  const ledger = app.get(RevenueLedgerService);
  const locations = app.get(LiveLocationsService);
  const incidents = app.get(IncidentsService);

  try {
    const admin = await ds.getRepository(User).findOneOrFail({
      where: { is_super_admin: true, status: UserStatus.ACTIVE },
      order: { created_at: 'ASC' },
    });
    const adminActor = {
      id: admin.id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      is_super_admin: true,
      permissions: [] as string[],
    };
    console.log(`🌱 Demo data — acting as SuperAdmin ${admin.email}`);

    await activateFeeSchedule(ds);
    await setCoordinates(ds);
    const demoBookings = await seedRevenue(ds, bookings, ledger, adminActor);
    await seedBarrierTags(ds, locations, adminActor);
    await seedIncidents(ds, incidents, adminActor, demoBookings);
    console.log('\n🎉 Demo data ready.');
  } finally {
    await app.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Fee schedule
// ─────────────────────────────────────────────────────────────────────────

const BOOKING_FORMS = [
  'BOOK_BONDED_TERMINAL',
  'BOOK_TRUCK_PARK',
  'BOOK_FISH',
  'BOOK_EPT',
];
const PO_SERVICES = ['Facility Bay', 'Transit Park Bay', 'Matching Fee'];

async function activateFeeSchedule(ds: DataSource) {
  console.log('\n💰 Fee schedule');
  const repo = ds.getRepository(PaymentType);
  const rows = await repo.find({
    where: { linked_form: In(BOOKING_FORMS) },
  });
  const po = rows.filter((r) => PO_SERVICES.includes(r.service_name));
  if (!po.length) {
    console.log(
      '  ⚠️  PO fee schedule rows missing — run `npm run seed` first',
    );
    return;
  }
  await ds.transaction(async (m) => {
    const legacy = rows.filter(
      (r) => r.status === 'ACTIVE' && !PO_SERVICES.includes(r.service_name),
    );
    for (const row of legacy) {
      await m.getRepository(PaymentType).update(row.id, { status: 'INACTIVE' });
      console.log(`  ⏸️  Deactivated legacy fee: ${row.name}`);
    }
    for (const row of po.filter((r) => r.status !== 'ACTIVE')) {
      await m.getRepository(PaymentType).update(row.id, { status: 'ACTIVE' });
      console.log(`  ✅ Activated: ${row.name}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Map coordinates
// ─────────────────────────────────────────────────────────────────────────

async function setCoordinates(ds: DataSource) {
  console.log('\n🗺️  Map coordinates');
  let updated = 0;
  for (const entity of [Facility, TransitPark, Terminal]) {
    const repo = ds.getRepository<{
      id: string;
      location: string;
      latitude: number | null;
    }>(entity);
    const rows = await repo.find({ where: { latitude: IsNull() } });
    for (const row of rows) {
      const [lat, lng] = AREA_COORDS[row.location] ?? AREA_COORDS.APAPA;
      await repo.update(row.id, {
        latitude: +(lat + (rand() - 0.5) * 0.04).toFixed(6),
        longitude: +(lng + (rand() - 0.5) * 0.06).toFixed(6),
      } as never);
      updated += 1;
    }
  }
  console.log(`  ✅ Coordinates set on ${updated} location(s)`);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Bookings + payments → e-Revenue ledger, live truck board
// ─────────────────────────────────────────────────────────────────────────

type Outcome = 'SUCCESSFUL' | 'FAILED' | 'PENDING' | 'ABANDONED';
const OUTCOMES: Outcome[] = [
  ...Array<Outcome>(14).fill('SUCCESSFUL'),
  'FAILED',
  'FAILED',
  'FAILED',
  'PENDING',
  'PENDING',
  'ABANDONED',
];
const CHANNELS = ['card', 'card', 'card', 'bank_transfer', 'ussd'];
/** Stage each LIVE demo booking is left at. */
const LIVE_STAGES = [
  'IN_FACILITY',
  'MATCHED',
  'GTG_FACILITY',
  'LEFT_FACILITY',
  'IN_PREGATE',
] as const;
const HISTORICAL_COUNT = 20;

async function seedRevenue(
  ds: DataSource,
  bookings: BookingsService,
  ledger: RevenueLedgerService,
  admin: { id: string; first_name: string; last_name: string; email: string },
): Promise<Booking[]> {
  console.log('\n🧾 Bookings & payments');
  const existing = await ds
    .getRepository(PaymentTransaction)
    .count({ where: { reference: Like(`${DEMO_REF}%`) } });
  if (existing) {
    console.log(`  ⏭️  ${existing} demo payment(s) already exist — skipped`);
    const invoiceIds = (
      await ds
        .getRepository(PaymentTransaction)
        .find({ where: { reference: Like(`${DEMO_REF}%`) } })
    ).map((t) => t.invoice_id);
    const invoices = await ds
      .getRepository(Invoice)
      .find({ where: { id: In(invoiceIds) } });
    return ds
      .getRepository(Booking)
      .find({ where: { id: In(invoices.map((i) => i.payable_id)) } });
  }

  const facilities = await ds
    .getRepository(Facility)
    .find({ where: { status: 'ACTIVE', archived_at: IsNull() } });
  const epts = await ds.getRepository(TransitPark).find({
    where: {
      transit_park_type: 'EPT',
      status: 'ACTIVE',
      archived_at: IsNull(),
    },
  });
  const portTerminals = await ds.getRepository(Terminal).find({
    where: {
      terminal_type: 'PORT_TERMINAL',
      status: 'ACTIVE',
      archived_at: IsNull(),
    },
  });
  const categories = await ds.getRepository(BookingCategory).find();
  const busyFacilities = new Set(
    (
      await ds.query<{ facility_id: string }[]>(
        `SELECT DISTINCT facility_id FROM bookings
          WHERE status = 'LIVE' AND facility_id IS NOT NULL
            AND matched_at IS NOT NULL AND gtg_facility_at IS NULL`,
      )
    ).map((r) => r.facility_id),
  );
  const timeslots = await ds.getRepository(FacilityTimeslot).find();
  const transporters = await transporterCompanies(ds);
  if (!portTerminals.length || !timeslots.length || !transporters.length) {
    throw new Error(
      'Need port terminals, facility timeslots and transporter companies',
    );
  }

  const plan: {
    type: 'BONDED_TERMINAL' | 'TRUCK_PARK' | 'FISH_VAN_PARK' | 'EPT';
    live?: (typeof LIVE_STAGES)[number];
    outcome: Outcome;
    daysAgo: number;
  }[] = [];
  // Fish bookings need the "Fish" booking category (added by a migration).
  const hasFish = categories.some((c) => c.name.toLowerCase() === 'fish');
  const types = (
    ['BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK', 'EPT'] as const
  ).filter((t) => hasFish || t !== 'FISH_VAN_PARK');
  for (let i = 0; i < HISTORICAL_COUNT; i++) {
    plan.push({
      type: types[i % types.length],
      outcome: OUTCOMES[i % OUTCOMES.length],
      daysAgo: Math.floor(rand() * 29) + 1,
    });
  }
  LIVE_STAGES.forEach((stage, i) =>
    plan.push({
      type:
        i === 4 ? 'EPT' : (['BONDED_TERMINAL', 'TRUCK_PARK'] as const)[i % 2],
      live: stage,
      outcome: 'SUCCESSFUL',
      daysAgo: 0,
    }),
  );

  const created: Booking[] = [];
  let n = 0;
  for (const item of plan) {
    const { truck, driver } = await freeTruckAndDriver(ds);
    if (!truck || !driver) {
      console.log(
        '  ⚠️  No free truck/driver left — stopping booking creation',
      );
      break;
    }
    const transporter = pick(transporters);
    const terminal = pick(portTerminals);
    const facility =
      item.type === 'EPT'
        ? null
        : pick(
            (() => {
              const ofType = facilities.filter(
                (f) => f.park_type === item.type,
              );
              // Live demo trucks go where nobody else is waiting for GTG.
              const free = ofType.filter((f) => !busyFacilities.has(f.id));
              return item.live && free.length ? free : ofType;
            })(),
          );
    if (item.type !== 'EPT' && !facility) continue;
    const common = {
      transporter_company_id: transporter.id,
      truck_id: truck.id,
      driver_id: driver.id,
      terminal_id: terminal.id,
      expected_arrival_date: new Date(Date.now() + 2 * DAY)
        .toISOString()
        .slice(0, 10),
    };
    const slot = pick(timeslots).id;
    let response: { id: string };
    if (item.type === 'EPT') {
      response = (await bookings.createEptBooking(
        {
          ...common,
          transit_park_id: pick(epts).id,
          export_type: pick(['AGRO_EXPORT', 'MANUFACTURED_EXPORT'] as const),
          ept_operation_type: 'LOADED_EXPORT_DELIVERY',
          expected_arrival_time: '10:30',
          gate_pass_number: `GP-DEMO-${1000 + n}`,
        },
        admin,
        admin.id,
      )) as { id: string };
    } else if (item.type === 'FISH_VAN_PARK') {
      response = (await bookings.createFishBooking(
        {
          ...common,
          facility_id: facility!.id,
          expected_arrival_time_slot_id: slot,
        },
        admin,
        admin.id,
      )) as { id: string };
    } else {
      const dto = {
        ...common,
        facility_id: facility!.id,
        booking_category_id: pick(categories).id,
        expected_arrival_time_slot_id: slot,
      };
      response = (await (item.type === 'BONDED_TERMINAL'
        ? bookings.createBondedTerminalBooking(dto, admin, admin.id)
        : bookings.createTruckParkBooking(dto, admin, admin.id))) as {
        id: string;
      };
    }
    n += 1;

    const when = ago(item.daysAgo * DAY + Math.floor(rand() * 10) * HOUR);
    await pay(
      ds,
      bookings,
      ledger,
      response.id,
      item.outcome,
      when,
      transporter,
    );

    if (item.live) {
      await advanceLive(bookings, response.id, item.live, admin);
    } else {
      await completeHistorical(ds, response.id, when);
    }
    created.push(
      await ds.getRepository(Booking).findOneByOrFail({ id: response.id }),
    );
  }
  console.log(`  ✅ ${created.length} bookings with payments created`);
  return created;
}

async function transporterCompanies(ds: DataSource): Promise<Company[]> {
  const typed = await ds
    .getRepository(Company)
    .createQueryBuilder('c')
    .leftJoin('c.user_type', 'ut')
    .where("ut.slug = 'transporter' OR c.user_type_id IS NULL")
    .andWhere("c.name <> 'Maritime ETSS'")
    .getMany();
  return typed;
}

async function freeTruckAndDriver(ds: DataSource) {
  const truck = await ds
    .getRepository(Truck)
    .createQueryBuilder('t')
    .where("t.registration_status NOT IN ('DISABLED', 'ARCHIVED', 'FLAGGED')")
    .andWhere(
      "(t.truck_status IS NULL OR t.truck_status IN ('AVAILABLE', 'LEFT_TERMINAL'))",
    )
    .andWhere(
      "NOT EXISTS (SELECT 1 FROM bookings b WHERE b.truck_id = t.id AND b.status = 'LIVE')",
    )
    .orderBy('t.plate_number', 'ASC')
    .getOne();
  const driver = await ds
    .getRepository(Driver)
    .createQueryBuilder('d')
    .where("d.verification_status NOT IN ('DISABLED', 'ARCHIVED', 'FLAGGED')")
    .andWhere(
      "(d.operational_status IS NULL OR d.operational_status = 'AVAILABLE')",
    )
    .andWhere(
      "NOT EXISTS (SELECT 1 FROM bookings b WHERE b.driver_ref_id = d.id AND b.status = 'LIVE')",
    )
    .orderBy('d.last_name', 'ASC')
    .getOne();
  return { truck, driver };
}

/**
 * Emulates a Paystack checkout landing: the gateway attempt is recorded and
 * then finalized exactly as PaymentsService.finalizeTransaction does (invoice
 * PAID, booking payment sync handler, e-Revenue ledger) — minus the Paystack
 * verify call. Pending demo attempts carry no checkout URL so the
 * reconciliation cron never tries to verify them with Paystack.
 */
async function pay(
  ds: DataSource,
  bookings: BookingsService,
  ledger: RevenueLedgerService,
  bookingId: string,
  outcome: Outcome,
  when: Date,
  transporter: Company,
) {
  await ds.transaction(async (m: EntityManager) => {
    const invoice = await m.getRepository(Invoice).findOneOrFail({
      where: { payable_type: 'BOOKING', payable_id: bookingId },
    });
    if (Number(invoice.amount) <= 0) return;
    const txRepo = m.getRepository(PaymentTransaction);
    const tx = await txRepo.save(
      txRepo.create({
        reference: `${DEMO_REF}${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        invoice_id: invoice.id,
        gateway: 'PAYSTACK',
        status: outcome,
        amount: invoice.amount,
        currency: invoice.currency,
        customer_email:
          transporter.email ??
          `accounts@${transporter.name.toLowerCase().replace(/[^a-z]+/g, '')}.ng`,
        channel:
          outcome === 'PENDING' || outcome === 'ABANDONED'
            ? null
            : pick(CHANNELS),
        gateway_response:
          outcome === 'SUCCESSFUL'
            ? 'Approved'
            : outcome === 'FAILED'
              ? pick([
                  'Declined',
                  'Insufficient Funds',
                  'Transaction not completed',
                ])
              : null,
        paid_at: outcome === 'SUCCESSFUL' ? when : null,
      }),
    );
    // Backdate the attempt itself so date filters have a spread.
    await txRepo.update(tx.id, { created_at: when } as never);
    tx.created_at = when;

    if (outcome === 'SUCCESSFUL') {
      invoice.status = 'PAID';
      invoice.paid_at = when;
      await m.getRepository(Invoice).save(invoice);
      await bookings.onPaymentFinalized({
        manager: m,
        invoice,
        transaction: tx,
        outcome: 'PAID',
      });
      await m.getRepository(Booking).update(bookingId, { paid_at: when });
    } else if (outcome === 'FAILED') {
      await bookings.onPaymentFinalized({
        manager: m,
        invoice,
        transaction: tx,
        outcome: 'FAILED',
      });
    }
    await ledger.record(m, invoice, tx);
  });
}

async function advanceLive(
  bookings: BookingsService,
  id: string,
  stage: (typeof LIVE_STAGES)[number],
  admin: { first_name: string; last_name: string },
) {
  const order = [
    'IN_FACILITY',
    'MATCHED',
    'GTG_FACILITY',
    'LEFT_FACILITY',
    'IN_PREGATE',
  ];
  const booking = (await bookings.findBooking(id)) as unknown as {
    facility?: { id: string };
    transit_park?: { id: string };
  };
  for (const step of order.slice(0, order.indexOf(stage) + 1)) {
    if (step === 'IN_FACILITY') await bookings.markInFacility(id, admin);
    if (step === 'MATCHED') await bookings.markMatched(id, admin);
    if (step === 'GTG_FACILITY') {
      // GTG is FIFO per facility. Never release other people's bookings —
      // if ours isn't at the head, leave it at MATCHED.
      const scope = booking.facility?.id
        ? { facility_id: booking.facility.id }
        : { transit_park_id: booking.transit_park?.id };
      const queue = (await bookings.facilityQueue({
        ...scope,
        page: 1,
        limit: 1,
      })) as { data: { id: string }[] };
      if (queue.data[0]?.id !== id) {
        console.log(`  ↪︎ ${id} left at MATCHED (other trucks queued first)`);
        return;
      }
      await bookings.markGtgFacility(id, admin);
    }
    if (step === 'LEFT_FACILITY') await bookings.markLeftFacility(id, admin);
    if (step === 'IN_PREGATE') await bookings.markInPregate(id, admin);
  }
}

/** Historical trips: full lifecycle timestamps relative to payment, then completed so the truck is free again. */
async function completeHistorical(ds: DataSource, id: string, paidAt: Date) {
  const t = (h: number) => new Date(paidAt.getTime() + h * HOUR);
  const booking = await ds.getRepository(Booking).findOneByOrFail({ id });
  const fromFacility = Boolean(booking.facility_id || booking.transit_park_id);
  await ds.getRepository(Booking).update(id, {
    in_facility_at: fromFacility ? t(2) : null,
    matched_at: fromFacility ? t(2.5) : null,
    gtg_facility_at: fromFacility ? t(3 + rand() * 2) : null,
    left_facility_at: fromFacility ? t(5.2) : null,
    in_pregate_at: t(6),
    gtg_pregate_at: t(7 + rand()),
    left_pregate_at: t(8.2),
    in_terminal_at: t(9),
    completed_at: t(11),
    status: 'COMPLETED',
  });
  if (booking.truck_id) {
    await ds
      .getRepository(Truck)
      .update(booking.truck_id, { truck_status: 'AVAILABLE' });
  }
  if (booking.driver_ref_id) {
    await ds
      .getRepository(Driver)
      .update(booking.driver_ref_id, { operational_status: 'AVAILABLE' });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Barrier tags (map: trucks tagged per hour, ATAT)
// ─────────────────────────────────────────────────────────────────────────

async function seedBarrierTags(
  ds: DataSource,
  locations: LiveLocationsService,
  admin: TrafficActor,
) {
  console.log('\n🚧 Barrier tags');
  const already = await ds.query<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM barrier_tag_events WHERE truck_plate_number LIKE 'DMO%'`,
  );
  if (already[0].n) {
    console.log(`  ⏭️  ${already[0].n} demo tag(s) already exist — skipped`);
    return;
  }
  const links = await ds.getRepository(BarrierSiteLink).find({
    relations: ['barrier'],
  });
  const active = links.filter((l) => l.barrier?.status === 'ACTIVE');
  if (!active.length) {
    console.log('  ⚠️  No barriers linked to sites — skipped');
    return;
  }
  let count = 0;
  // Pair ENTRY/EXIT per site so ATAT can be computed; plates are synthetic.
  const sites = new Map<string, BarrierSiteLink[]>();
  for (const l of active) {
    const key = `${l.site_type}:${l.site_id}`;
    sites.set(key, [...(sites.get(key) ?? []), l]);
  }
  for (const siteLinks of sites.values()) {
    const entry = siteLinks.find((l) => l.barrier_role === 'ENTRY');
    const exit = siteLinks.find((l) => l.barrier_role === 'EXIT');
    for (let i = 0; i < 12; i++) {
      const plate = `DMO${String(100 + i).padStart(3, '0')}${pick(['LG', 'AP', 'KJ', 'TC'])}`;
      const inAt = ago(Math.floor(rand() * 20 * 60) * 60_000 + 30 * 60_000);
      const outAt = new Date(
        inAt.getTime() + (45 + Math.floor(rand() * 150)) * 60_000,
      );
      for (const [link, at] of [
        [entry, inAt],
        [exit, outAt],
      ] as const) {
        if (!link || at.getTime() > Date.now()) continue;
        await locations.recordTagEvent(
          {
            barrier_id: link.barrier_id,
            site_type: link.site_type,
            site_id: link.site_id,
            barrier_role: link.barrier_role,
            truck_plate_number: plate,
            tagged_at: at.toISOString(),
            source: 'BARRIER',
          },
          admin,
        );
        count += 1;
      }
    }
  }
  console.log(`  ✅ ${count} barrier tag(s) recorded`);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Incidents
// ─────────────────────────────────────────────────────────────────────────

async function seedIncidents(
  ds: DataSource,
  incidents: IncidentsService,
  admin: IncidentActor,
  demoBookings: Booking[],
) {
  console.log('\n🚨 Incidents');
  const already = await ds
    .getRepository(Incident)
    .count({ where: { reporter_email: Like('demo.%@example.com') } });
  if (already) {
    console.log(`  ⏭️  ${already} demo incident(s) already exist — skipped`);
    return;
  }

  const userTypes = await ds.getRepository(UserType).find();
  const typeId = (slug: string) => userTypes.find((u) => u.slug === slug)?.id;
  const towCompany = await ensureCompany(
    ds,
    'RapidTow Nigeria',
    typeId('tow-truck-company'),
    {
      email: 'ops@rapidtow.example.com',
      address: 'Mile 2, Apapa-Oshodi Expressway, Lagos',
    },
  );
  const transporters = await transporterCompanies(ds);
  // Demo PRIMARY account holders — random unusable passwords, example.com
  // addresses (nothing is ever emailed), so they cannot sign in.
  const reporters = [
    await ensurePrimaryUser(
      ds,
      transporters[0],
      'Chidi',
      'Okafor',
      'demo.chidi@example.com',
    ),
    await ensurePrimaryUser(
      ds,
      transporters[1] ?? transporters[0],
      'Aisha',
      'Bello',
      'demo.aisha@example.com',
    ),
  ];
  const towUser = await ensurePrimaryUser(
    ds,
    towCompany,
    'Tunde',
    'Adeyemi',
    'demo.tunde@example.com',
  );
  const actor = (u: User): IncidentActor => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    company_id: u.company_id,
  });
  const tow = actor(towUser);

  const facilities = await ds
    .getRepository(Facility)
    .find({ where: { archived_at: IsNull() } });
  const parks = await ds
    .getRepository(TransitPark)
    .find({ where: { archived_at: IsNull() } });
  const terminals = await ds
    .getRepository(Terminal)
    .find({ where: { archived_at: IsNull() } });
  const breakdownBooking =
    demoBookings.find((b) => b.status === 'LIVE') ?? demoBookings[0];
  const photo = (k: string) => ({
    label: `Photo — ${k}`,
    type: 'PHOTO' as const,
    url: `https://picsum.photos/seed/etss-${k}/800/600`,
  });
  const file = (k: string) => ({
    label: `${k}.pdf`,
    type: 'FILE' as const,
    url: `https://files.example.com/etss/${k}.pdf`,
  });

  type Step = (id: string) => Promise<unknown>;
  const scenarios: {
    by: IncidentActor;
    hoursAgo: number;
    dto: Parameters<IncidentsService['create']>[0];
    steps: Step[];
  }[] = [
    {
      by: actor(reporters[0]),
      hoursAgo: 2,
      dto: {
        type: 'TRUCK_BREAKDOWN',
        description:
          'Truck lost brake pressure at the facility exit lane and is blocking outbound traffic.',
        severity: 'CRITICAL',
        location_kind: 'FACILITY',
        location_id: breakdownBooking?.facility_id ?? facilities[0]?.id,
        booking_id: breakdownBooking?.id,
        evidence: [photo('brake-failure')],
      },
      steps: [
        (id) =>
          incidents.assign(
            id,
            {
              assigned_company_id: towCompany.id,
              assigned_user_id: towUser.id,
              note: 'Nearest tow unit, dispatch immediately',
            },
            admin,
          ),
        (id) =>
          incidents.triggerEmergency(
            id,
            { action: 'DISPATCH_TOW_TRUCK', notes: 'Exit lane blocked' },
            admin,
          ),
        (id) =>
          incidents.setDeadline(
            id,
            {
              priority_deadline: new Date(Date.now() + 4 * HOUR).toISOString(),
            },
            admin,
          ),
        (id) => incidents.startWork(id, tow),
      ],
    },
    {
      by: actor(reporters[1]),
      hoursAgo: 30,
      dto: {
        type: 'GATE_CONGESTION',
        description:
          'Queue at the pregate entry gate has exceeded 2km since 6am; barrier cycling slowly.',
        severity: 'HIGH',
        location_kind: 'TRANSIT_PARK',
        location_id: parks[0]?.id,
        evidence: [photo('pregate-queue')],
      },
      steps: [
        (id) =>
          incidents.escalate(
            id,
            {
              level: 'NPA',
              notes:
                'Recurring congestion — regulator to review gate throughput',
            },
            admin,
          ),
        (id) =>
          incidents.commentAsAdmin(
            id,
            {
              body: 'Open the secondary lane and meter entries every 2 minutes.',
              kind: 'INSTRUCTION',
            },
            admin,
          ),
      ],
    },
    {
      by: actor(reporters[0]),
      hoursAgo: 72,
      dto: {
        type: 'CARGO_DAMAGE',
        description:
          'Container dented during offloading; seal intact but doors misaligned.',
        severity: 'MEDIUM',
        location_kind: 'PORT_TERMINAL',
        location_id: terminals[0]?.id,
        payment_reference: 'MTMS-DEMO-CLAIM-001',
        evidence: [photo('container-dent'), file('offload-report')],
      },
      steps: [
        (id) =>
          incidents.requestEvidence(
            id,
            { message: 'Please upload the equipment interchange receipt.' },
            admin,
          ),
      ],
    },
    {
      by: actor(reporters[1]),
      hoursAgo: 120,
      dto: {
        type: 'SECURITY_BREACH',
        description:
          'Unregistered truck attempted entry using a cloned RFID tag.',
        severity: 'HIGH',
        location_kind: 'FACILITY',
        location_id: facilities[1]?.id ?? facilities[0]?.id,
        evidence: [file('gate-camera-log')],
      },
      steps: [
        (id) =>
          incidents.assign(
            id,
            {
              assigned_company_id: towCompany.id,
              note: 'Coordinate with facility security',
            },
            admin,
          ),
        (id) => incidents.startWork(id, tow),
        (id) =>
          incidents.submitResolution(
            id,
            {
              root_cause: 'Cloned tag from a decommissioned truck',
              corrective_action: 'Tag blacklisted; gate rules updated',
              resolution_notes: 'Tag revoked and incident logged with police.',
              evidence: [file('tag-revocation')],
            },
            tow,
          ),
      ],
    },
    {
      by: actor(reporters[0]),
      hoursAgo: 200,
      dto: {
        type: 'ACCIDENT_INJURY',
        description:
          'Minor collision between two trucks in the holding bay; one driver treated for a hand injury.',
        severity: 'HIGH',
        location_kind: 'FACILITY',
        location_id: facilities[2]?.id ?? facilities[0]?.id,
        evidence: [photo('bay-collision')],
      },
      steps: [
        (id) =>
          incidents.assign(
            id,
            {
              assigned_company_id: towCompany.id,
              assigned_user_id: towUser.id,
            },
            admin,
          ),
        (id) =>
          incidents.setDeadline(
            id,
            { priority_deadline: new Date(Date.now() + 2 * DAY).toISOString() },
            admin,
          ),
        (id) => incidents.startWork(id, tow),
        (id) =>
          incidents.submitResolution(
            id,
            {
              root_cause: 'Reversing without a banksman',
              corrective_action: 'Banksman now mandatory in bays',
              resolution_notes:
                'Vehicles towed, driver discharged from clinic.',
            },
            tow,
          ),
        (id) =>
          incidents.approveResolution(id, { notes: 'Good turnaround.' }, admin),
      ],
    },
    {
      by: actor(reporters[1]),
      hoursAgo: 260,
      dto: {
        type: 'PAYMENT_DISPUTE',
        description: 'Transporter charged twice for the same booking slot.',
        severity: 'LOW',
        location_kind: 'TRANSIT_PARK',
        location_id: parks[1]?.id ?? parks[0]?.id,
        payment_reference: 'MTMS-DEMO-DUP-778',
      },
      steps: [
        (id) =>
          incidents.resolve(
            id,
            {
              root_cause: 'Double click during checkout',
              corrective_action: 'Duplicate refunded',
              resolution_notes:
                'Refund of the duplicate charge processed manually.',
            },
            admin,
          ),
      ],
    },
    {
      by: actor(reporters[0]),
      hoursAgo: 320,
      dto: {
        type: 'SYSTEM_DOWNTIME',
        description:
          'Access control system offline for 40 minutes; trucks processed manually.',
        severity: 'MEDIUM',
        location_kind: 'PORT_TERMINAL',
        location_id: terminals[1]?.id ?? terminals[0]?.id,
      },
      steps: [
        (id) =>
          incidents.assign(id, { assigned_company_id: towCompany.id }, admin),
        (id) => incidents.startWork(id, tow),
        (id) =>
          incidents.submitResolution(
            id,
            { resolution_notes: 'Power supply restored.' },
            tow,
          ),
        (id) =>
          incidents.rejectResolution(
            id,
            { reason: 'Root cause and preventive action are missing.' },
            admin,
          ),
      ],
    },
    {
      by: actor(reporters[1]),
      hoursAgo: 6,
      dto: {
        type: 'TRUCK_BREAKDOWN',
        description: 'Flat tyre on the access road just before the EPT gate.',
        severity: 'MEDIUM',
        location_kind: 'TRANSIT_PARK',
        location_id:
          parks.find((p) => p.transit_park_type === 'EPT')?.id ?? parks[0]?.id,
        truck_plate_number: demoBookings[1]?.truck_plate_number,
      },
      steps: [],
    },
  ];

  let created = 0;
  for (const s of scenarios) {
    if (!s.dto.location_id) delete s.dto.location_id;
    if (!s.dto.location_id) s.dto.location_name = 'Apapa Port Access Road';
    const incident = await incidents.create(s.dto, s.by);
    for (const step of s.steps) await step(incident.id);
    // Spread report times so date filters / "reported" columns vary.
    const shift = s.hoursAgo * HOUR;
    await ds.query(
      `UPDATE incidents SET reported_at = reported_at - ($2 || ' milliseconds')::interval,
         created_at = created_at - ($2 || ' milliseconds')::interval
       WHERE id = $1`,
      [incident.id, String(shift)],
    );
    for (const table of [
      'incident_events',
      'incident_notes',
      'incident_evidence',
    ]) {
      await ds.query(
        `UPDATE ${table} SET created_at = created_at - ($2 || ' milliseconds')::interval * 0.9 WHERE incident_id = $1`,
        [incident.id, String(shift)],
      );
    }
    created += 1;
  }
  console.log(`  ✅ ${created} incidents across the lifecycle`);
}

async function ensureCompany(
  ds: DataSource,
  name: string,
  userTypeId: string | undefined,
  extra: Partial<Company>,
): Promise<Company> {
  const repo = ds.getRepository(Company);
  const existing = await repo.findOne({ where: { name } });
  if (existing) return existing;
  const company = await repo.save(
    repo.create({ name, user_type_id: userTypeId, is_active: true, ...extra }),
  );
  console.log(`  ✅ Created company: ${name}`);
  return company;
}

async function ensurePrimaryUser(
  ds: DataSource,
  company: Company,
  first: string,
  last: string,
  email: string,
): Promise<User> {
  const repo = ds.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  if (existing) return existing;
  const user = await repo.save(
    repo.create({
      first_name: first,
      last_name: last,
      email,
      password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
      account_type: AccountType.PRIMARY,
      status: UserStatus.ACTIVE,
      company_id: company.id,
      user_type_id: company.user_type_id ?? null,
      two_factor_enabled: true,
    }),
  );
  console.log(`  ✅ Created demo PRIMARY user: ${email} (${company.name})`);
  return user;
}

main().catch((error) => {
  console.error('❌ Demo seed failed:', error);
  process.exit(1);
});
