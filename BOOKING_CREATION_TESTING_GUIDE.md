# Booking Creation — Step-by-Step Testing Guide

Covers the new SuperAdmin booking-creation flows (Bonded Terminal, Truck Park, Fish, EPT), the priority/FIFO scheduling endpoints, and the DB keep-alive cron added in `1761800000000-booking-creation-flows.ts` and the `bookings` module.

All commands assume you're in the `Maritime-ETSS` repo root.

---

## 0. Prerequisites

```bash
npm install          # picks up the new @nestjs/schedule dependency
```

You need Docker running for the local Postgres + Redis (`docker-compose.yml`). If you already have Postgres/Redis running some other way, skip the compose step and just make sure `.env` points at them.

---

## 1. Start infra, migrate, seed

```bash
docker compose up -d db redis        # or `docker compose up -d` for everything
npm run migration:run                # applies 1761800000000-booking-creation-flows.ts (and any earlier pending ones)
npm run seed                         # seeds terminals/transit-parks/facilities/trucks/drivers/companies/super-admin, etc.
```

Sanity-check the new migration actually applied:

```bash
npm run typeorm -- query "SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name IN ('booking_type','priority_level','priority_rank','matched_at')" -d src/config/typeorm.config.ts
```

You should see all 4 column names. If you ever need to roll it back: `npm run migration:revert` (drops everything the migration added; it's fully reversible).

---

## 2. Start the API

```bash
npm run start:dev
```

Swagger UI: **http://localhost:3000/docs** — every new endpoint below is documented there under the `bookings`, `trucks`, `drivers`, and `companies` tags. Easiest way to try requests interactively is "Authorize" in Swagger with the token from step 3, then use "Try it out" on each route.

---

## 3. Get a SuperAdmin JWT

The seeded SuperAdmin is `admin@etss.com` / `password123` (or whatever `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD` are set to in your `.env`).

**Login always requires 2FA** (pre-existing platform behavior, not part of this feature) — there's no bypass:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@etss.com","password":"password123"}'
```

Returns `{ temporary_token, two_factor_method: "EMAIL", message }`. Check the inbox for the seeded admin's email (SMTP is configured via the Brevo env vars in `.env`) for the 6-digit code, then:

```bash
curl -s -X POST http://localhost:3000/api/auth/login/verify-2fa \
  -H "Content-Type: application/json" \
  -d '{"temporary_token":"<paste>","code":"<6-digit code from email>"}'
```

Returns `{ access_token, ... }`. Export it for the rest of this guide:

```bash
export TOKEN="<access_token>"
```

Every request below needs `-H "Authorization: Bearer $TOKEN"`.

---

## 4. Fetch real IDs for the dropdowns

Nothing in the create endpoints is hardcoded — you need real seeded UUIDs. Pull one of each:

```bash
# Transporter company (any company works; SuperAdmin books "on behalf of" it)
curl -s "http://localhost:3000/api/companies?search=Logistics" -H "Authorization: Bearer $TOKEN" | jq '.data[0] | {id, name}'

# Bonded Terminal facility
curl -s "http://localhost:3000/api/facilities?park_type=BONDED_TERMINAL" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name, location}'

# Truck Park facility
curl -s "http://localhost:3000/api/facilities?park_type=TRUCK_PARK" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name}'

# Fish-Van Park facility
curl -s "http://localhost:3000/api/facilities?park_type=FISH_VAN_PARK" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name}'

# EPT (a transit park)
curl -s "http://localhost:3000/api/transit-parks?type=EPT" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name, location}'

# Port Terminal (destination for Bonded Terminal / Truck Park / Fish / EPT)
curl -s "http://localhost:3000/api/terminals?type=PORT_TERMINAL" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name}'

# Booking category (Bonded Terminal / Truck Park only)
curl -s "http://localhost:3000/api/booking-categories?search=Export" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name}'

# Facility timeslot (Bonded Terminal / Truck Park, optionally Fish)
curl -s "http://localhost:3000/api/facility-timeslots" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0] | {id, name}'
```

Now the "mine vs public" truck/driver pickers — pass the `id` from the company lookup above as `transporter_company_id`:

```bash
CID="<company id from above>"

curl -s "http://localhost:3000/api/trucks/booking-options?transporter_company_id=$CID" -H "Authorization: Bearer $TOKEN" | jq
# => { data: { mine: [{value,label,group:"mine"}, ...], public: [...] } }

curl -s "http://localhost:3000/api/drivers/booking-options?transporter_company_id=$CID" -H "Authorization: Bearer $TOKEN" | jq
```

If `mine` comes back empty, that seeded company doesn't own any trucks/drivers yet — either pick a different company or fall back to a truck/driver from the `public` array (only trucks/drivers with `visibility: PUBLIC` show up there). Grab one `value` (a truck id) and one `value` (a driver id) from either array.

Also grab a couple of plain UUIDs directly from the DB if it's faster for you than the API:

```bash
npm run typeorm -- query "SELECT id, name FROM facilities WHERE park_type='BONDED_TERMINAL' LIMIT 3" -d src/config/typeorm.config.ts
```

---

## 5. Preview each of the 4 flows (nothing persisted)

Preview validates + computes without writing anything — good for checking your test IDs are wired correctly before creating real rows.

### Bonded Terminal

```bash
curl -s -X POST http://localhost:3000/api/bookings/bonded-terminal/preview \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "facility_id": "<bonded terminal facility id>",
    "transporter_company_id": "<company id>",
    "truck_id": "<truck id>",
    "driver_id": "<driver id>",
    "terminal_id": "<port terminal id>",
    "booking_category_id": "<Export Container category id>",
    "expected_arrival_date": "2026-09-15",
    "expected_arrival_time_slot_id": "<timeslot id>"
  }'
```

Expect `priority_level: "HIGH"` if the category is Export Container/Export Non-Containerized, otherwise `"MEDIUM"`. Check `fee.fee_configured` — it'll be `false` with `total: 0` until you add `PaymentType` rows with `linked_form = "BOOK_BONDED_TERMINAL"` via the App Options → Payment Types screen/API (this is expected; fees are intentionally data-driven, not hardcoded).

### Truck Park

Same shape, `POST /api/bookings/truck-park/preview`, with a `TRUCK_PARK` facility id.

### Fish

```bash
curl -s -X POST http://localhost:3000/api/bookings/fish/preview \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "facility_id": "<fish-van park facility id>",
    "transporter_company_id": "<company id>",
    "truck_id": "<truck id>",
    "driver_id": "<driver id>",
    "terminal_id": "<port terminal id>",
    "expected_arrival_date": "2026-09-15"
  }'
```

No `booking_category_id` here — the server resolves the `Fish` category itself (seeded by the migration). Expect `priority_level: "HIGH"` always (Fish is topmost priority per the doc). `expected_arrival_time_slot_id` and `gate_pass_number` are optional on this one.

### EPT

```bash
curl -s -X POST http://localhost:3000/api/bookings/ept/preview \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "transporter_company_id": "<company id>",
    "export_type": "AGRO_EXPORT",
    "truck_id": "<truck id>",
    "driver_id": "<driver id>",
    "transit_park_id": "<EPT id>",
    "ept_operation_type": "LOADED_EXPORT_DELIVERY",
    "terminal_id": "<port terminal id>",
    "expected_arrival_date": "2026-09-15",
    "expected_arrival_time": "14:30",
    "gate_pass_number": "GP-TEST-0001"
  }'
```

Expect `priority_level: "HIGH"` (EPT is always top-tier). Try swapping `terminal_id` for a `NON_PORT_TERMINAL` id — it should 400 with "EPT bookings require a Port Terminal destination".

**Error cases worth trying** (each should 400/404, not 500):
- A `facility_id` that belongs to the wrong `park_type` (e.g. pass a Truck Park facility to the Bonded Terminal endpoint).
- A `transit_park_id` that's a `PREGATE`, not `EPT`, on the EPT endpoint.
- A truck/driver id that doesn't exist → 404.
- A truck whose `truck_status` is e.g. `ON_TRIP` (update one via `PATCH /api/trucks/:id` tooling or directly in DB for the test) → 400 "not currently available".

---

## 6. Create a real booking

Same payloads, drop `/preview`:

```bash
curl -s -X POST http://localhost:3000/api/bookings/bonded-terminal \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ ... same body as the preview above ... }' | jq
```

Note the returned `data.id` (uuid) and `data.booking_id` (e.g. `BKG-2026-000001`) — you'll need the uuid for the rest of this guide. Confirm it shows up in the existing list endpoint unchanged:

```bash
curl -s "http://localhost:3000/api/bookings?search=BKG-2026" -H "Authorization: Bearer $TOKEN" | jq '.data.data[0]'
```

You should see `booking_type`, `priority_level`, `priority_rank`, `payment_status: "PENDING"`, plus the resolved `facility`/`terminal`/`booking_category_ref` objects, alongside all the pre-existing fields (`terminal_name`, `transfer_type`, `booking_category` legacy value, etc. — unchanged behavior).

Repeat for `truck-park`, `fish`, `ept` so you have one LIVE booking of each type to play with below.

---

## 7. Payment confirmation

```bash
curl -s -X PATCH http://localhost:3000/api/bookings/<booking uuid>/confirm-payment \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"payment_method":"WALLET","terms_accepted":true}' | jq '.data | {payment_status, payment_method, paid_at, confirmed_at, terms_accepted_at}'
```

`terms_accepted` must be `true` (the "I AGREE TO MARITIME-ETSS TERMS & CONDITIONS" checkbox) or this 400s. Expect `payment_status: "PAID"` with all three timestamps populated. Calling it again on the same booking should 400 "Payment already confirmed".

---

## 8. FIFO / GTG-Facility flow

This is the part worth testing carefully — it's new scheduling logic, not just CRUD.

1. Create **two** Bonded Terminal (or Truck Park/Fish) bookings against the **same facility** (reuse the same `facility_id`, different trucks/drivers). Call the first one **A**, the second **B**.
2. Mark **B** matched first, then **A**:
   ```bash
   curl -s -X PATCH http://localhost:3000/api/bookings/$B/mark-matched -H "Authorization: Bearer $TOKEN"
   curl -s -X PATCH http://localhost:3000/api/bookings/$A/mark-matched -H "Authorization: Bearer $TOKEN"
   ```
3. Check the facility queue:
   ```bash
   curl -s "http://localhost:3000/api/bookings/queue/facility?facility_id=<facility id>" -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id, queue_position, matched_at}'
   ```
   **B** should be `queue_position: 1` (it matched first), **A** should be `2` — this is the doc's "first to match is first to be batched" rule.
4. Try releasing **A** out of turn:
   ```bash
   curl -s -X PATCH http://localhost:3000/api/bookings/$A/mark-gtg-facility -H "Authorization: Bearer $TOKEN"
   ```
   Expect a 400: *"Another truck has priority for this facility — release it first"*.
5. Release **B** (should succeed, sets `truck_status = GTG_FACILITY` on B's truck):
   ```bash
   curl -s -X PATCH http://localhost:3000/api/bookings/$B/mark-gtg-facility -H "Authorization: Bearer $TOKEN"
   ```
6. Now **A** should be first in the queue and `mark-gtg-facility` on it should succeed.
7. Also try `mark-in-facility` on a booking that hasn't been matched yet — expect 400.

### Pregate cross-facility FIFO

1. Pick a Pregate transit park id: `curl -s "http://localhost:3000/api/transit-parks?type=PREGATE" ...`
2. On booking **A** (already GTG-Facility from above), mark it in-pregate:
   ```bash
   curl -s -X PATCH http://localhost:3000/api/bookings/$A/mark-in-pregate \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"pregate_transit_park_id":"<pregate id>"}'
   ```
3. Check the terminal-scoped pregate queue (uses `terminal_id` from the booking, i.e. its destination terminal):
   ```bash
   curl -s "http://localhost:3000/api/bookings/queue/pregate?terminal_id=<terminal id>" -H "Authorization: Bearer $TOKEN" | jq
   ```
4. `mark-gtg-pregate` on A should succeed if it's first in that queue; test the same "second truck blocked" behavior as step 8.4 above with a second booking destined for the same terminal (optionally through a *different* Pregate — the queue is FIFO by `in_pregate_at` across all Pregates feeding that terminal, exactly matching the doc).

---

## 9. Booking priority sanity check

Quick spot-check that priority is actually computed, not defaulted:

| Booking type | Category / context | Expected `priority_level` / `priority_rank` |
|---|---|---|
| Fish | (always) | `HIGH` / `1` |
| EPT | (always) | `HIGH` / `1` |
| Bonded Terminal / Truck Park | `Export Container` or `Export Non-Containerized` category | `HIGH` / `1` |
| Bonded Terminal / Truck Park | any other category, `terminal_id` → a `PORT_TERMINAL` | `MEDIUM` / `2` |
| Bonded Terminal / Truck Park | any other category, `terminal_id` → a `NON_PORT_TERMINAL` | `MEDIUM` / `3` |

---

## 10. Keep-alive cron

Temporarily tighten the schedule so you don't have to wait 6 hours:

```bash
# .env
DB_KEEPALIVE_CRON=*/1 * * * *
```

Restart `npm run start:dev` and watch the console — you should see a `Database keep-alive ping succeeded` log line every minute. Revert the env var (or remove it — it defaults to every 6 hours) once confirmed.

---

## 11. Regression check

Confirm nothing existing broke:

```bash
curl -s http://localhost:3000/api/bookings/summary -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/api/bookings/export" -H "Authorization: Bearer $TOKEN" | head -5
curl -s "http://localhost:3000/api/bookings/manifest?tab=in" -H "Authorization: Bearer $TOKEN" | jq '.data.meta'
```

All three should work exactly as before, now also reflecting the new bookings you created above.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 403 `SuperAdmin access is required` on any of the above | Your JWT's user isn't `is_super_admin: true` — use the seeded admin account. |
| 400 `Facility not found` / `Terminal not found` / etc. | The id you passed doesn't exist or belongs to the wrong table — re-fetch from the matching list endpoint in step 4. |
| `fee.fee_configured: false` | Expected until `PaymentType` rows exist for that `linked_form`. Not a bug. |
| 2FA email never arrives | Check `.env` SMTP (Brevo) credentials and that Redis is up (the 2FA email is queued via BullMQ). |
| `npm run migration:run` says nothing to run | You already ran it — check `SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 3;` to confirm `BookingCreationFlows1761800000000` is present. **Also check `NODE_ENV`** — if it's `development`, TypeORM's `synchronize: true` auto-applies schema changes from the entities on every boot, independent of migrations, so the columns/constraints may already exist even if the migration was never formally run. Data-only steps inside a migration (like seeding the `Fish` booking category) do **not** happen via `synchronize` — run the migration for real, or insert the row directly, to get those. |
| `trucks/booking-options` / `drivers/booking-options` `mine` is always `[]` no matter which `transporter_company_id` you pass | A truck/driver only gets a `transporter_company_id` when created via `POST /api/trucks` / `POST /api/drivers` (it's a required field there) — there's no endpoint to reassign it after the fact. If your trucks/drivers were inserted by the seed script directly, they likely all have `transporter_company_id = NULL` (check with `SELECT count(*), count(transporter_company_id) FROM trucks;`) — `mine` will be empty for every company until you create one via the API. |
