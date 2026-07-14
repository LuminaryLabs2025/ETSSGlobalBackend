/**
 * Full Sprint 3 endpoint smoke test (GET + mutations).
 * Run inside the app container:
 *   docker compose exec app npx ts-node -r tsconfig-paths/register scripts/tmp-e2e-sprint3.ts
 */
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { FineDispute } from '../src/database/entities/fines.entities';
import { DttrTerminalRequest } from '../src/database/entities/dttr.entities';
import { Booking } from '../src/database/entities/bookings.entities';
import { UtilityTicket } from '../src/database/entities/utility-tickets.entities';

type CheckResult = { name: string; ok: boolean; detail?: string };

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const jwt = moduleRef.get(JwtService);
  const userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
  const disputeRepo = moduleRef.get<Repository<FineDispute>>(
    getRepositoryToken(FineDispute),
  );
  const dttrRepo = moduleRef.get<Repository<DttrTerminalRequest>>(
    getRepositoryToken(DttrTerminalRequest),
  );
  const bookingRepo = moduleRef.get<Repository<Booking>>(
    getRepositoryToken(Booking),
  );
  const ticketRepo = moduleRef.get<Repository<UtilityTicket>>(
    getRepositoryToken(UtilityTicket),
  );

  const admin = await userRepo.findOne({ where: { is_super_admin: true } });
  if (!admin) throw new Error('SuperAdmin not found — run npm run seed');

  const token = jwt.sign({
    sub: admin.id,
    email: admin.email,
    is_super_admin: true,
  });
  const auth = { Authorization: `Bearer ${token}` };
  const server = app.getHttpServer();

  const results: CheckResult[] = [];

  const assertOk = (
    name: string,
    res: request.Response,
    expectStatus: number | number[] = [200, 201],
  ) => {
    const allowed = Array.isArray(expectStatus)
      ? expectStatus
      : [expectStatus];
    const statusOk = allowed.includes(res.status);
    const bodyOk = res.status >= 300 || res.body?.success === true;
    const ok = statusOk && bodyOk;
    results.push({
      name,
      ok,
      detail: ok
        ? undefined
        : `status=${res.status} body=${JSON.stringify(res.body)?.slice(0, 240)}`,
    });
    console.log(
      ok ? `✅ ${name}` : `❌ ${name} — ${results[results.length - 1].detail}`,
    );
    return res;
  };

  const assertCsv = (name: string, res: request.Response) => {
    const ok =
      res.status === 200 &&
      typeof res.text === 'string' &&
      res.text.length > 0 &&
      (res.headers['content-type'] || '').includes('text/csv');
    results.push({
      name,
      ok,
      detail: ok ? undefined : `status=${res.status} type=${res.headers['content-type']}`,
    });
    console.log(ok ? `✅ ${name}` : `❌ ${name} — ${results[results.length - 1].detail}`);
    return res;
  };

  // ═══════════════════════════════════════
  // 1. PENALTIES
  // ═══════════════════════════════════════
  console.log('\n── Penalties ──');
  assertOk(
    'GET /api/penalties/summary',
    await request(server).get('/api/penalties/summary').set(auth),
  );
  assertOk(
    'GET /api/penalties',
    await request(server).get('/api/penalties?page=1&limit=5').set(auth),
  );
  assertCsv(
    'GET /api/penalties/export',
    await request(server).get('/api/penalties/export').set(auth),
  );

  const createPenalty = await request(server)
    .post('/api/penalties')
    .set(auth)
    .send({
      name: `E2E Test Penalty ${Date.now()}`,
      description: 'Temporary penalty created by e2e smoke test',
      fine_amount: 12000,
      status: 'ACTIVE',
    });
  assertOk('POST /api/penalties', createPenalty);
  const penaltyId = createPenalty.body?.data?.id as string | undefined;

  if (penaltyId) {
    assertOk(
      'GET /api/penalties/:id',
      await request(server).get(`/api/penalties/${penaltyId}`).set(auth),
    );
    assertOk(
      'PATCH /api/penalties/:id',
      await request(server)
        .patch(`/api/penalties/${penaltyId}`)
        .set(auth)
        .send({ fine_amount: 15000, status: 'INACTIVE' }),
    );
    assertOk(
      'PATCH /api/penalties/:id/archive',
      await request(server)
        .patch(`/api/penalties/${penaltyId}/archive`)
        .set(auth),
    );
  } else {
    results.push({ name: 'penalty mutations (skipped — no id)', ok: false });
    console.log('❌ penalty mutations (skipped — no id)');
  }

  // ═══════════════════════════════════════
  // 2. ISSUED FINES
  // ═══════════════════════════════════════
  console.log('\n── Issued Fines ──');
  assertOk(
    'GET /api/issued-fines/summary',
    await request(server).get('/api/issued-fines/summary').set(auth),
  );
  const issuedList = assertOk(
    'GET /api/issued-fines',
    await request(server).get('/api/issued-fines?page=1&limit=5').set(auth),
  );
  assertCsv(
    'GET /api/issued-fines/export',
    await request(server).get('/api/issued-fines/export').set(auth),
  );
  const issuedId = issuedList.body?.data?.data?.[0]?.id as string | undefined;
  if (issuedId) {
    assertOk(
      'GET /api/issued-fines/:id',
      await request(server).get(`/api/issued-fines/${issuedId}`).set(auth),
    );
  } else {
    results.push({ name: 'GET /api/issued-fines/:id', ok: false, detail: 'no seeded issued fine' });
    console.log('❌ GET /api/issued-fines/:id — no seeded issued fine');
  }

  // ═══════════════════════════════════════
  // 3. DISPUTES
  // ═══════════════════════════════════════
  console.log('\n── Fine Disputes ──');
  assertOk(
    'GET /api/disputes/summary',
    await request(server).get('/api/disputes/summary').set(auth),
  );
  assertOk(
    'GET /api/disputes',
    await request(server).get('/api/disputes?page=1&limit=5').set(auth),
  );
  assertCsv(
    'GET /api/disputes/export',
    await request(server).get('/api/disputes/export').set(auth),
  );

  // Prefer a PENDING_REVIEW dispute so resolve is allowed
  let pendingDispute = await disputeRepo.findOne({
    where: { dispute_status: 'PENDING_REVIEW' },
  });
  if (!pendingDispute) {
    // create an isolated fixture dispute for resolve testing
    pendingDispute = await disputeRepo.save(
      disputeRepo.create({
        dispute_id: `DSP-E2E-${Date.now()}`,
        issued_fine_id: 'PNL-E2E-000001',
        penalty_code: 'PEN-001',
        penalty_name: 'Overstay',
        fine_amount: '50000',
        booking_reference: 'BKG-E2E-000001',
        terminal_destination: 'APM Terminals Apapa',
        booking_date: new Date(),
        booking_category: 'IMPORT',
        truck_booking_status: 'FLAGGED',
        truck_plate_number: 'E2E-111-XX',
        driver_name: 'E2E Driver',
        transporter_company_name: 'E2E Logistics',
        transporter_user_account: 'E2E User',
        transporter_contact_person: 'E2E User',
        transporter_contact_number: '+2340000000000',
        transporter_email: 'e2e@test.ng',
        date_issued: new Date(),
        date_disputed: new Date(),
        dispute_reason: 'E2E resolve fixture',
        dispute_status: 'PENDING_REVIEW',
      }),
    );
  }

  assertOk(
    'GET /api/disputes/:id',
    await request(server).get(`/api/disputes/${pendingDispute.id}`).set(auth),
  );
  assertOk(
    'PATCH /api/disputes/:id/resolve',
    await request(server)
      .patch(`/api/disputes/${pendingDispute.id}/resolve`)
      .set(auth)
      .send({
        dispute_status: 'RESOLVED',
        resolution_outcome: 'FINE_ADJUSTED',
        adjusted_amount: 10000,
        notes: 'E2E resolution',
      }),
  );

  // ═══════════════════════════════════════
  // 4. DTTR
  // ═══════════════════════════════════════
  console.log('\n── DTTR ──');
  assertOk(
    'GET /api/dttr/summary',
    await request(server).get('/api/dttr/summary').set(auth),
  );
  assertOk(
    'GET /api/dttr',
    await request(server).get('/api/dttr?page=1&limit=5').set(auth),
  );
  assertOk(
    'GET /api/dttr/edit-audit',
    await request(server).get('/api/dttr/edit-audit').set(auth),
  );

  let dttr = await dttrRepo.findOne({ where: { terminal_code: 'WRI-BT' } });
  if (!dttr) {
    dttr = await dttrRepo.findOne({ where: {} });
  }
  if (!dttr) throw new Error('No DTTR rows — run npm run seed');

  assertOk(
    'GET /api/dttr/:id',
    await request(server).get(`/api/dttr/${dttr.id}`).set(auth),
  );

  // Submit a safe breakdown under capacity
  const capacity = dttr.approved_daily_capacity;
  const submitBody = {
    exports: 1,
    imports: 1,
    empties: 1,
    gatepass: 1,
  };
  if (1 + 1 + 1 + 1 > capacity) {
    results.push({
      name: 'POST /api/dttr/:id/submit',
      ok: false,
      detail: 'capacity too low for fixture',
    });
    console.log('❌ POST /api/dttr/:id/submit — capacity too low');
  } else {
    assertOk(
      'POST /api/dttr/:id/submit',
      await request(server)
        .post(`/api/dttr/${dttr.id}/submit`)
        .set(auth)
        .send(submitBody),
    );
  }

  assertOk(
    'GET /api/dttr/:id/submissions',
    await request(server).get(`/api/dttr/${dttr.id}/submissions`).set(auth),
  );

  assertOk(
    'PATCH /api/dttr/:id (SuperAdmin edit)',
    await request(server)
      .patch(`/api/dttr/${dttr.id}`)
      .set(auth)
      .send({
        breakdown: { exports: 2, imports: 2, empties: 2, gatepass: 2 },
        justification: 'E2E SuperAdmin edit',
        approval_reference: 'E2E/REF/001',
      }),
  );

  assertOk(
    'PATCH /api/dttr/:id/configure-mode AUTOMATED',
    await request(server)
      .patch(`/api/dttr/${dttr.id}/configure-mode`)
      .set(auth)
      .send({
        request_mode: 'AUTOMATED',
        automated_template: {
          exports: 1,
          imports: 1,
          empties: 1,
          gatepass: 1,
        },
      }),
  );
  assertOk(
    'PATCH /api/dttr/:id/configure-mode MANUAL',
    await request(server)
      .patch(`/api/dttr/${dttr.id}/configure-mode`)
      .set(auth)
      .send({ request_mode: 'MANUAL' }),
  );

  // ═══════════════════════════════════════
  // 5. BOOKINGS + MANIFEST
  // ═══════════════════════════════════════
  console.log('\n── Bookings ──');
  assertOk(
    'GET /api/bookings/summary',
    await request(server).get('/api/bookings/summary').set(auth),
  );
  assertOk(
    'GET /api/bookings',
    await request(server).get('/api/bookings?page=1&limit=5').set(auth),
  );
  assertCsv(
    'GET /api/bookings/export',
    await request(server).get('/api/bookings/export').set(auth),
  );
  assertOk(
    'GET /api/bookings/manifest?tab=in',
    await request(server).get('/api/bookings/manifest?tab=in').set(auth),
  );
  assertOk(
    'GET /api/bookings/manifest?tab=left',
    await request(server).get('/api/bookings/manifest?tab=left').set(auth),
  );

  // Isolated booking fixtures for mutations so we don't corrupt seed demo state permanently
  const suffix = Date.now();
  const inManifest = await bookingRepo.save(
    bookingRepo.create({
      booking_id: `BKG-E2E-IN-${suffix}`,
      journey_code: `JRN-E2E-IN-${suffix}`,
      truck_plate_number: `E2E-IN-${suffix % 10000}`,
      truck_color: 'White',
      driver_name: 'E2E Driver In',
      driver_id: 'DRV-E2E-1',
      transporter_company: 'E2E Logistics',
      terminal_name: 'Apapa Port Terminal A',
      terminal_destination: 'APM Terminals T1',
      transfer_type: 'INBOUND',
      booking_category: 'IMPORT',
      status: 'LIVE',
      truck_booked_by: 'E2E Logistics',
      truck_owned_by: 'E2E Logistics',
      left_pregate_at: new Date(),
      manifest_status: 'IN_MANIFEST',
    }),
  );
  const leftManifest = await bookingRepo.save(
    bookingRepo.create({
      booking_id: `BKG-E2E-LEFT-${suffix}`,
      journey_code: `JRN-E2E-LEFT-${suffix}`,
      truck_plate_number: `E2E-LF-${suffix % 10000}`,
      truck_color: 'Blue',
      driver_name: 'E2E Driver Left',
      driver_id: 'DRV-E2E-2',
      transporter_company: 'E2E Logistics',
      terminal_name: 'Tincan Island Terminal',
      terminal_destination: 'Tincan Island Terminal',
      transfer_type: 'OUTBOUND',
      booking_category: 'EXPORT',
      status: 'LIVE',
      truck_booked_by: 'E2E Logistics',
      truck_owned_by: 'E2E Logistics',
      left_pregate_at: new Date(),
      left_manifest_at: new Date(),
      manifest_status: 'LEFT_MANIFEST',
      tow_requested_at: new Date(),
      tow_reason: 'E2E tow',
      tow_requested_by: 'E2E Driver Left',
      tow_company: 'E2E Tow',
      tow_status: 'PENDING',
    }),
  );
  const cancelTarget = await bookingRepo.save(
    bookingRepo.create({
      booking_id: `BKG-E2E-CXL-${suffix}`,
      journey_code: `JRN-E2E-CXL-${suffix}`,
      truck_plate_number: `E2E-CX-${suffix % 10000}`,
      truck_color: 'Red',
      driver_name: 'E2E Driver Cancel',
      driver_id: 'DRV-E2E-3',
      transporter_company: 'E2E Logistics',
      terminal_name: 'Onne Port Terminal',
      terminal_destination: 'Onne Port Terminal',
      transfer_type: 'INBOUND',
      booking_category: 'IMPORT',
      status: 'LIVE',
      truck_booked_by: 'E2E Logistics',
      truck_owned_by: 'E2E Logistics',
      left_pregate_at: new Date(),
      manifest_status: 'IN_MANIFEST',
    }),
  );

  assertOk(
    'GET /api/bookings/:id',
    await request(server).get(`/api/bookings/${inManifest.id}`).set(auth),
  );
  assertOk(
    'PATCH /api/bookings/:id/remove-from-manifest',
    await request(server)
      .patch(`/api/bookings/${inManifest.id}/remove-from-manifest`)
      .set(auth),
  );
  assertOk(
    'PATCH /api/bookings/:id/add-to-manifest',
    await request(server)
      .patch(`/api/bookings/${leftManifest.id}/add-to-manifest`)
      .set(auth),
  );
  assertOk(
    'PATCH /api/bookings/:id/cancel',
    await request(server)
      .patch(`/api/bookings/${cancelTarget.id}/cancel`)
      .set(auth),
  );

  // Cleanup booking fixtures
  await bookingRepo.delete([inManifest.id, leftManifest.id, cancelTarget.id]);

  // ═══════════════════════════════════════
  // 6. UTILITY TICKETS
  // ═══════════════════════════════════════
  console.log('\n── Utility Tickets ──');
  assertOk(
    'GET /api/utility-tickets/summary',
    await request(server).get('/api/utility-tickets/summary').set(auth),
  );
  assertOk(
    'GET /api/utility-tickets',
    await request(server).get('/api/utility-tickets?page=1&limit=5').set(auth),
  );
  assertCsv(
    'GET /api/utility-tickets/export',
    await request(server).get('/api/utility-tickets/export').set(auth),
  );

  const generated = await request(server)
    .post('/api/utility-tickets/generate')
    .set(auth)
    .send({
      terminal_name: 'Apapa Port Terminal A',
      terminal_type: 'PORT',
      terminal_code: 'APT-A',
      terminal_location: 'Apapa, Lagos',
      request_type: 'POWER',
      delivery_company_name: 'E2E Power Co',
      description: 'E2E generated utility ticket for smoke testing.',
      truck_plate_number: 'E2E-UT-1',
    });
  assertOk('POST /api/utility-tickets/generate', generated);
  const ticketId = generated.body?.data?.id as string | undefined;

  if (ticketId) {
    assertOk(
      'GET /api/utility-tickets/:id',
      await request(server).get(`/api/utility-tickets/${ticketId}`).set(auth),
    );
    assertOk(
      'PATCH /api/utility-tickets/:id (edit)',
      await request(server)
        .patch(`/api/utility-tickets/${ticketId}`)
        .set(auth)
        .send({
          delivery_company_name: 'E2E Power Co Updated',
          full_description: 'Updated by e2e smoke test.',
        }),
    );
    assertOk(
      'PATCH /api/utility-tickets/:id/approve',
      await request(server)
        .patch(`/api/utility-tickets/${ticketId}/approve`)
        .set(auth),
    );
    assertOk(
      'GET /api/utility-tickets/:id/e-ticket',
      await request(server)
        .get(`/api/utility-tickets/${ticketId}/e-ticket`)
        .set(auth),
    );

    // Separate ticket for cancel (approve blocks some edit paths; cancel after approve is allowed)
    const toCancel = await request(server)
      .post('/api/utility-tickets/generate')
      .set(auth)
      .send({
        terminal_name: 'Calabar Non-Port Terminal',
        terminal_type: 'NON_PORT',
        terminal_code: 'CBR-NPT',
        request_type: 'WATER',
        delivery_company_name: 'E2E Water Co',
        description: 'E2E cancel fixture ticket.',
      });
    assertOk('POST /api/utility-tickets/generate (cancel fixture)', toCancel);
    const cancelId = toCancel.body?.data?.id as string | undefined;
    if (cancelId) {
      assertOk(
        'PATCH /api/utility-tickets/:id/cancel',
        await request(server)
          .patch(`/api/utility-tickets/${cancelId}/cancel`)
          .set(auth),
      );
      await ticketRepo.delete(cancelId);
    }
    await ticketRepo.delete(ticketId);
  } else {
    results.push({
      name: 'utility ticket mutations',
      ok: false,
      detail: 'generate returned no id',
    });
    console.log('❌ utility ticket mutations — generate returned no id');
  }

  // Cleanup e2e penalty if created
  // (archived is fine to leave; delete if repository exposes soft data — keep for audit)

  await app.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(` - ${r.name}: ${r.detail ?? 'unknown'}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
