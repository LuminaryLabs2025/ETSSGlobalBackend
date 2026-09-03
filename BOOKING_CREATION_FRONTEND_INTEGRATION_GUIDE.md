# Booking Creation — Frontend Integration Guide

**Audience:** Frontend engineers wiring `BookFishPage.tsx`, `BookEPTPage.tsx`, `BookBondedTerminalPage.tsx`, `BookTruckParkPage.tsx` (and `book-assist/BookAssistUi.tsx`) to real data.
**Backend:** Maritime-ETSS
**Auth:** `Authorization: Bearer <access_token>` — every endpoint below is SuperAdmin-only (same gate you already use for the rest of `/dashboard/bookings`).

## Why this doc exists

All 4 "Quick Book" forms already exist pixel-for-pixel to spec, but every dropdown, truck/driver list, fee, and the final "Proceed To Pay" action is currently backed by `lib/book-assist-mock-data.ts` / `lib/book-fish-mock-data.ts` / `lib/trucks-mock-data.ts` / `lib/drivers-mock-data.ts` — **nothing calls the API**. This doc maps every mock constant to the real endpoint that should replace it, plus the two new endpoints each form needs to actually create a booking.

**Response envelope** (same as every other endpoint in the app):

```ts
type ApiResponse<T> = { success: boolean; message: string; data: T };
type PaginatedResponse<T> = { data: T[]; meta: { total: number; page: number; limit: number; total_pages: number } };
```

List endpoints below return `ApiResponse<PaginatedResponse<T>>` unless noted otherwise (the two new `booking-options` endpoints are **not** paginated — see §2.3).

**Errors** — same `ApiError` shape you already handle elsewhere:

```ts
type ApiError = { statusCode: number; message: string; timestamp: string; path: string };
```

`400` = validation/business-rule failure (e.g. wrong facility type, truck unavailable) — show `message` as a toast, same pattern as your existing `validateStep1()` toasts. `404` = an id you sent doesn't exist. `403` = not SuperAdmin (shouldn't happen behind `SuperAdminGate`).

> The API's global `ValidationPipe` uses `forbidNonWhitelisted: true` — **do not send extra fields** the DTO doesn't declare (see §3 below for exact shapes per form), or the whole request 400s.

> **One exception to the envelope above:** `GET /api/companies` returns a **plain array** (`Company[]`), not wrapped in `{success, message, data}` — this is pre-existing behavior on that endpoint, unrelated to this feature. Confirmed live: `curl .../api/companies?search=Logistics` returns `[{...}, {...}]` directly. Every other endpoint in this doc (facilities, terminals, transit-parks, booking-categories, facility-timeslots, trucks/drivers booking-options, and all the bookings endpoints) does use the standard envelope. Don't destructure `.data` on the companies call.

---

## 1. Quick map — what to plug where

| Form | Old mock constant | New endpoint |
|---|---|---|
| All 4 | `BOOK_ASSIST_TRANSPORTERS` | `GET /api/companies?search=` |
| All 4 | `getAssistTrucks(transporterName)` | `GET /api/trucks/booking-options?transporter_company_id=&search=` |
| All 4 | `getAssistDrivers(transporterName)` | `GET /api/drivers/booking-options?transporter_company_id=&search=` |
| Bonded Terminal | `BONDED_TERMINAL_FACILITIES` | `GET /api/facilities?park_type=BONDED_TERMINAL&search=` |
| Truck Park | `TRUCK_PARK_FACILITIES` | `GET /api/facilities?park_type=TRUCK_PARK&search=` |
| Fish | `FISH_VAN_PARKS` | `GET /api/facilities?park_type=FISH_VAN_PARK&search=` |
| Bonded Terminal / Truck Park | `BONDED_TERMINAL_LOCATIONS` + `TERMINALS_BY_BONDED_LOCATION` | `GET /api/terminals?type=PORT_TERMINAL\|NON_PORT_TERMINAL&location=APAPA\|TINCAN&search=` |
| Fish | `PORT_TERMINALS_BY_ZONE` | `GET /api/terminals?type=PORT_TERMINAL&location=APAPA\|TINCAN` |
| EPT | `EPT_OPTIONS` | `GET /api/transit-parks?type=EPT&location=APAPA\|TINCAN&search=` |
| EPT | Port terminal destination | `GET /api/terminals?type=PORT_TERMINAL&location=...` |
| Bonded Terminal / Truck Park | `BONDED_BOOKING_CATEGORIES` | `GET /api/booking-categories?search=` (Fish is now in this catalog too — Fish's own form doesn't need it, see §3.3) |
| Bonded Terminal / Truck Park (+ optionally Fish) | `FACILITY_ARRIVAL_TIMESLOTS` | `GET /api/facilities/:facility_id/timeslots` (preferred — scoped to the chosen facility) or `GET /api/facility-timeslots` (flat catalog) |
| EXPORT_TYPES / EPT_OPERATION_TYPES | Fixed 3/4-option enums | **Keep as static arrays in the FE** — these are literal enums on the DTO (`AGRO_EXPORT\|MANUFACTURED_EXPORT\|OTHERS`, `LOADED_EXPORT_DELIVERY\|EMPTY_CONTAINER_DELIVERY\|VERIFIED_EXPORT_COLLECTION\|LOADED_DELIVERY_WITH_COLLECTION`), not DB-backed catalogs. Not a gap — see §3.4 for exact values. |
| `BOOK_ASSIST_FEES` / `MOCK_WALLET_BALANCE` | Flat mock fee/wallet | Fee now comes back on the **preview** response (§3.2) sourced from the `PaymentType` catalog. **There is no wallet ledger or Paystack integration in the backend yet** — see §5. |
| "Proceed To Preview Data" | client-only step | `POST /api/bookings/{type}/preview` |
| "Confirm Details" | client-only step | `POST /api/bookings/{type}` (persists) |
| "Proceed To Pay" | `setTimeout` fake success | `PATCH /api/bookings/:id/confirm-payment` |

`{type}` is one of `bonded-terminal`, `truck-park`, `fish`, `ept`.

---

## 2. Dropdown / lookup endpoints in detail

### 2.1 Transporter — `GET /api/companies`

Replaces `BOOK_ASSIST_TRANSPORTERS`.

```
GET /api/companies?search=<free text>&user_type_id=<uuid>&user_type_slug=<slug>
```

Response: **plain `Company[]`** — no `{success, message, data}` wrapper, and not paginated (see the callout above). `search` matches `name`/`email`/`phone`. Use `id` + `name` to build your `SearchableSelect` options.

`user_type_id` / `user_type_slug` optionally narrow the list to companies of a given `UserType` (e.g. pass the id from `GET /api/user-types?search=Transporter` once such a type exists, or its `slug` directly). If both are sent, `user_type_id` wins. **Note:** as of this writing there is no seeded "Transporter" `UserType`, and companies created via the transporter seed data have `user_type_id` left `NULL` — so this filter is available but won't isolate transporters from other companies until a "Transporter" type is created and assigned.

### 2.2 Facility / Terminal / EPT pickers

All three already exist and are paginated:

```
GET /api/facilities?park_type=BONDED_TERMINAL|TRUCK_PARK|FISH_VAN_PARK&location=APAPA|TINCAN|APAPA_TINCAN&search=
GET /api/transit-parks?type=EPT|PREGATE&location=APAPA|TINCAN&search=
GET /api/terminals?type=PORT_TERMINAL|NON_PORT_TERMINAL&location=APAPA|TINCAN&search=
```

`Facility` row: `{ id, name, park_type, facility_type, facility_code, location, address, status, ... }`. `Terminal` row: `{ id, name, terminal_type, terminal_code, location, booking_status, ... }`. `TransitPark` row: `{ id, name, transit_park_type, transit_park_code, location, ... }`.

**Terminal Location dropdown mapping** — the spec's "Apapa (Port-Terminals) / Apapa (Non-Port Terminals) / TinCan (Port Terminals) / TinCan (Non-Port Terminals)" is a client-side combination of `location` + `terminal_type`, not a value the backend stores separately. Build it as 4 client-side buttons/options, each just setting `{ location, terminal_type }` state, then fetch `GET /api/terminals?type=...&location=...` for the "Terminal Destination" step. Same idea for EPT's simpler "Apapa (Port Terminals) / TinCan (Port Terminals)" toggle — `terminal_type` is always `PORT_TERMINAL` there.

### 2.3 Truck / Driver pickers — `GET /api/trucks/booking-options`, `GET /api/drivers/booking-options`

Replaces `getAssistTrucks`/`getAssistDrivers`. **Not paginated**, and shaped exactly like your `GroupedSelectOption`:

```
GET /api/trucks/booking-options?transporter_company_id=<uuid>&search=<plate text>
GET /api/drivers/booking-options?transporter_company_id=<uuid>&search=<name text>
```

```ts
type BookingOption = { value: string; label: string; group: 'mine' | 'public' };
type BookingOptionsResponse = { mine: BookingOption[]; public: BookingOption[] };
```

Wire this directly into `SearchableGroupedSelect`'s existing `mineSectionLabel="My Available Trucks"` / `"My Available Drivers"` props — the `group` field already matches what that component expects, `mine` always sorts first per the spec.

Two things to know:
- **Fetch this only after a transporter is selected.** If `transporter_company_id` is omitted, `mine` comes back empty (there's no "mine" without knowing whose trucks they are) — `public` still works.
- Already-committed trucks (mid-trip, matched, in a facility/pregate, etc.) and disabled/archived trucks or drivers are filtered out server-side — you don't need to re-filter.

### 2.4 Booking category — `GET /api/booking-categories`

Bonded Terminal & Truck Park only. Replaces `BONDED_BOOKING_CATEGORIES`. The catalog now has exactly: `Import Container`, `Export Container`, `Empty Container`, `Import Non-Containerized`, `Export Non-Containerized`, `FMCG (Non-Port)`, and `Fish` (added by the new migration, but Fish's own form doesn't send this field — see §3.3). Drop the icon/"variant" grouping from `BookingCategoryBadge.tsx`'s hardcoded list and drive it off `row.name` instead, or keep a small local `name → icon` lookup purely for styling (that's presentation, not data).

### 2.5 Timeslot — `GET /api/facilities/:facility_id/timeslots` or `GET /api/facility-timeslots`

Replaces `FACILITY_ARRIVAL_TIMESLOTS`. Prefer the facility-scoped one once a facility is chosen (every facility currently gets every timeslot auto-assigned, but this is the future-proof one if that ever changes): each row has a nested `timeslot: { id, name, start_time, end_time }`. The flat `GET /api/facility-timeslots` returns the same catalog directly (`{ id, name, start_time, end_time, status }`) if you'd rather not wait on a facility selection.

---

## 3. The create flow, per form

Each form does the same 3-call sequence: **preview → create → confirm-payment**.

### 3.1 Preview — `POST /api/bookings/{type}/preview`

Call this on "Proceed To Preview Data". Same body as create (below), nothing is persisted. Use the response to render your existing "Preview Details" + "Payment Summary" panels instead of computing them client-side:

```ts
type BookingPreview = {
  booking_type: 'BONDED_TERMINAL' | 'TRUCK_PARK' | 'FISH_VAN_PARK' | 'EPT';
  facility?: { id: string; name: string; code?: string; location?: string; type?: string };
  transit_park?: { id: string; name: string; code?: string; location?: string; type?: string };
  terminal: { id: string; name: string; code?: string; location?: string; type?: string };
  truck: { id: string; plate_number: string };
  driver: { id: string; name: string };
  transporter_company: { id: string; name: string };
  booking_category_ref?: { id: string; name: string };
  export_type?: string | null;
  ept_operation_type?: string | null;
  gate_pass_number?: string | null;
  gate_pass_matched: boolean;          // true if gate_pass_number matched a real TEP record
  expected_arrival_date: string;
  expected_arrival_time?: string | null;
  expected_arrival_time_slot?: { id: string; name: string; start_time: string; end_time: string };
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_rank: number;
  fee: { fee_configured: boolean; total: number; lines: { name: string; amount: number }[] };
};
```

Drop `BookingCategoryBadge`'s client-fabricated `buildBookingReferenceNumber()` from the preview step — the real `booking_id`/`journey_code` only exist after create (§3.2), so show a "will be assigned on confirm" placeholder in preview instead, same as EPT/Fish already do for GatePass today.

**Fee note:** `fee.fee_configured: false` / `total: 0` means SuperAdmin hasn't configured a `PaymentType` for that form yet (App Options → Payment Types, `linked_form = BOOK_BONDED_TERMINAL | BOOK_TRUCK_PARK | BOOK_FISH | BOOK_EPT`). Render `total`/`lines` instead of the old hardcoded `BOOK_ASSIST_FEES` (₦5000 + ₦375 + ₦50) — if it's `0`, show "Fee not yet configured" rather than ₦0.

### 3.2 Create — `POST /api/bookings/{type}` (call on "Confirm Details")

Request bodies (**exact fields, nothing extra**):

```ts
// Bonded Terminal — POST /api/bookings/bonded-terminal
// Truck Park     — POST /api/bookings/truck-park (identical shape)
type CreateFacilityBookingRequest = {
  facility_id: string;                 // uuid
  transporter_company_id: string;      // uuid
  truck_id: string;                    // uuid
  driver_id: string;                   // uuid
  terminal_id: string;                 // uuid — "Terminal Destination"
  booking_category_id: string;         // uuid
  expected_arrival_date: string;       // "YYYY-MM-DD"
  expected_arrival_time_slot_id: string; // uuid
};

// Fish — POST /api/bookings/fish
type CreateFishBookingRequest = {
  facility_id: string;
  transporter_company_id: string;
  truck_id: string;
  driver_id: string;
  terminal_id: string;
  expected_arrival_date: string;
  expected_arrival_time_slot_id?: string;  // optional — current FE mock doesn't collect this; send if you add it
  gate_pass_number?: string;               // optional — matches the "Truck Entry Permit" field already in BookFishPage
};

// EPT — POST /api/bookings/ept
type CreateEptBookingRequest = {
  transporter_company_id: string;
  export_type: 'AGRO_EXPORT' | 'MANUFACTURED_EXPORT' | 'OTHERS';
  truck_id: string;
  driver_id: string;
  transit_park_id: string;             // the selected EPT
  ept_operation_type: 'LOADED_EXPORT_DELIVERY' | 'EMPTY_CONTAINER_DELIVERY' | 'VERIFIED_EXPORT_COLLECTION' | 'LOADED_DELIVERY_WITH_COLLECTION';
  terminal_id: string;                 // Port Terminal Destination — must resolve to a PORT_TERMINAL
  expected_arrival_date: string;
  expected_arrival_time: string;       // "HH:mm", 24-hour
  gate_pass_number: string;            // required on this form
};
```

Response on success: `ApiResponse<Booking>` — the full booking object exactly as returned by the existing `GET /api/bookings/:id` (your existing `Booking` type in `types/bookings.types.ts` already covers `id`, `booking_id`, `journey_code`, `status`, `timeline`, etc.), **plus** these new optional fields your types should add:

```ts
type BookingExtras = {
  booking_type?: 'BONDED_TERMINAL' | 'TRUCK_PARK' | 'FISH_VAN_PARK' | 'EPT';
  facility?: { id: string; name: string; code?: string; location?: string; type?: string };
  transit_park?: { id: string; name: string; code?: string; location?: string; type?: string };
  terminal?: { id: string; name: string; code?: string; location?: string; type?: string };
  booking_category_ref?: { id: string; name: string };
  expected_arrival_time_slot?: { id: string; name: string; start_time: string; end_time: string };
  expected_arrival_date?: string;
  expected_arrival_time?: string;
  export_type?: string;
  ept_operation_type?: string;
  gate_pass_number?: string;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
  priority_rank: number;
  payment_status: 'PENDING' | 'PAID' | 'FAILED';
  payment_method?: 'WALLET' | 'PAYSTACK';
  booking_fee?: number;
  paid_at?: string;
  confirmed_at?: string;
  terms_accepted_at?: string;
  // Only present after the ops/queue lifecycle endpoints (§5) have been used on this booking — not part of the 4 create forms:
  pregate_transit_park?: { id: string; name: string; code?: string; location?: string; type?: string };
  matched_at?: string;
  in_facility_at?: string;
  in_pregate_at?: string;
  gtg_facility_at?: string;
  gtg_pregate_at?: string;
};
```

Nothing about your existing "All Bookings" table, filters, CSV export, or manifest needs to change — these bookings show up there exactly like any other row (the backend keeps writing the legacy `terminal_name`/`transfer_type`/`booking_category` string fields too, for free).

### 3.3 Fish's booking category is automatic

Unlike Bonded Terminal/Truck Park, the Fish form doesn't send `booking_category_id` at all — the server resolves it to the seeded `Fish` category itself. Don't add a category picker to `BookFishPage.tsx`; the response's `booking_category_ref` will already say `{ name: "Fish" }`.

### 3.4 EPT's two fixed enums

`export_type` and `ept_operation_type` are **not** DB catalogs — they're fixed enums baked into the request DTO. Keep `EXPORT_TYPES`/`EPT_OPERATION_TYPES` as static arrays in the frontend (their current values already match):

```ts
const EXPORT_TYPES = ['AGRO_EXPORT', 'MANUFACTURED_EXPORT', 'OTHERS'] as const;
const EPT_OPERATION_TYPES = [
  'LOADED_EXPORT_DELIVERY',
  'EMPTY_CONTAINER_DELIVERY',
  'VERIFIED_EXPORT_COLLECTION',
  'LOADED_DELIVERY_WITH_COLLECTION',
] as const;
```

Just make sure whatever label strings you show ("Loaded Export Container Delivery to EPT", etc.) map to these exact enum values on submit, not the display label.

### 3.5 Payment — `PATCH /api/bookings/:id/confirm-payment` (call on "Proceed To Pay")

```ts
type ConfirmPaymentRequest = {
  payment_method: 'WALLET' | 'PAYSTACK';
  terms_accepted: true;   // the "I AGREE TO MARITIME-ETSS TERMS & CONDITIONS" checkbox — must be true or this 400s
};
```

Per the spec, the T&C checkbox appears alongside the payment section (after "Confirm Details"), not at create time — that's why it's enforced here rather than on the create DTOs in §3.2. Gate your "Proceed To Pay" button on the checkbox being checked, and send `terms_accepted: true` only once it is.

Returns the updated `Booking` with `payment_status: 'PAID'`, plus `paid_at`, `confirmed_at`, and `terms_accepted_at` timestamps. **Read §5 before wiring this** — there's no real wallet or Paystack integration behind it yet.

---

## 4. Validation error → toast mapping

Keep your existing `validateStep1()` client-side checks (required fields, T&Cs checkbox) exactly as they are — they're still your first line of defense and give faster feedback. The API is a second line that also catches things the client can't know about, e.g.:

| Backend 400 message | When it happens | Suggested toast |
|---|---|---|
| `Selected facility is not a Bonded Terminal` / `...Truck Park` / `...Fish-Van Park` | Facility id/park_type mismatch — shouldn't happen if your facility dropdown is scoped by `park_type` correctly | "This facility isn't available for this booking type — please re-select." |
| `Selected transit park is not an EPT` | Same idea for the EPT picker | "Please select a valid EPT." |
| `EPT bookings require a Port Terminal destination` | Terminal picker for EPT wasn't scoped to `type=PORT_TERMINAL` | "EPT bookings require a Port Terminal destination." |
| `Selected truck is disabled or archived` / `Selected truck is not currently available` | Truck picker showed a truck whose status changed between fetch and submit (rare race) | "That truck is no longer available — please pick another." |
| `Selected driver is disabled or archived` | Same idea for drivers | "That driver is no longer available — please pick another." |
| `Fish booking category is not configured...` | Only if migrations weren't run — a backend/ops issue, not a user error | Generic "Something went wrong, contact support." |

---

## 5. What's intentionally NOT built yet

- **No real payment gateway.** `confirm-payment` is a manual SuperAdmin confirmation, not a Paystack charge or a wallet debit — there's no wallet ledger anywhere in the backend. Keep your existing Paystack/wallet UI as a visual step if you like, but the actual "it's paid" state only becomes true once you call `confirm-payment`. Flag this clearly to product before this ships to real transporters.
- **No automatic truck/driver status progression.** The `mark-matched` / `mark-in-facility` / `mark-in-pregate` / `mark-gtg-facility` / `mark-gtg-pregate` endpoints exist (used for the FIFO/priority queue logic) but nothing in the 4 booking forms calls them — that's an ops/ops-dashboard concern, not part of this creation flow. Not required for this integration pass.
- **No frontend queue/FIFO UI.** `GET /api/bookings/queue/facility` and `GET /api/bookings/queue/pregate` exist and are tested (see the testing guide) but there's no product spec yet for surfacing them in the UI — out of scope until asked for.

---

## 6. Full status lifecycle (booking, truck, driver)

This is the ops/dashboard side of things (not part of the 4 creation forms per §5, but useful context for any status badges/timelines you build elsewhere).

### 6.1 `Booking.status`

| Value | Set by | Notes |
|---|---|---|
| `LIVE` | Booking creation (default) | Every booking starts here. |
| `CANCELLED` | `PATCH /api/bookings/:id/cancel` | Reachable any time except from an already-`CANCELLED` booking. Clears `manifest_status`. |
| `COMPLETED` | — | **Exists in the schema and is counted in `GET /api/bookings/summary`, but no endpoint currently transitions a booking into it.** Only present on old static seed rows. Don't build UI that expects a live booking to reach this yet. |
| `EXPIRED` | — | Same caveat as `COMPLETED` — schema/summary only, not reachable via any implemented mutation today. |

### 6.2 The post-payment ops flow (per booking)

```
created (status=LIVE, payment_status=PENDING)
   │
   ▼
PATCH /confirm-payment          → payment_status: PENDING → PAID
   │
   ▼
PATCH /mark-in-facility         → in_facility_at set, truck_status → IN_FACILITY, driver operational_status → IN_FACILITY
   │   (or, independently: PATCH /mark-in-pregate → in_pregate_at set, truck_status → IN_PREGATE)
   ▼
PATCH /mark-matched             → matched_at set, truck_status → MATCHED
   │   (requires in_facility_at already set — this order was flipped 2026-09-03; matching now happens after check-in, not before)
   ▼
PATCH /mark-gtg-facility        → gtg_facility_at set, truck_status → GTG_FACILITY
   │   (only succeeds if this booking is #1 in GET /queue/facility — ordered by priority_rank, then in_facility_at, then matched_at)
   │   (or, independently: PATCH /mark-gtg-pregate → gtg_pregate_at set, truck_status → GTG_PREGATE, gated by GET /queue/pregate)
   ▼
(end of currently-implemented flow — no further transition exists yet)
```

Each `mark-*` call validates the previous step happened and 400s if you call it out of order or twice — see `BOOKING_CREATION_TESTING_GUIDE.md` §8 for exact request/response examples. None of these are called by the 4 creation forms; they're a separate ops-dashboard concern per §5.

### 6.3 `Truck.truck_status`

Full enum (DB constraint): `AVAILABLE | ON_TRIP | IN_FACILITY | MATCHED | GTG_FACILITY | LEFT_FACILITY | IN_PREGATE | GTG_PREGATE | LEFT_PREGATE | IN_TERMINAL | LEFT_TERMINAL`.

**Only these are actually reachable via the API today:**
- `MATCHED`, `IN_FACILITY`, `IN_PREGATE`, `GTG_FACILITY`, `GTG_PREGATE` — set by the `mark-*` booking endpoints above.
- `AVAILABLE` — set only when re-enabling a previously-disabled truck (`PATCH /api/trucks/:id/re-enable`); new trucks are created with `truck_status: null`, which the backend treats as available for booking-eligibility purposes (`null` and `'AVAILABLE'` are equivalent for that check).
- `null` — set when a truck is disabled.

**Not reachable via any current endpoint** (schema-only / seed-only): `ON_TRIP`, `LEFT_FACILITY`, `LEFT_PREGATE`, `IN_TERMINAL`, `LEFT_TERMINAL`. Don't build UI flows that expect the API to ever produce these right now — if you see them, it's on an old seeded demo row, not live data.

### 6.4 `Driver.operational_status`

Full enum: `AVAILABLE | ON_TRIP | IN_FACILITY | IN_PREGATE | IN_TERMINAL | OFF_DUTY | SUSPENDED`.

**Only `IN_FACILITY` is currently set** (alongside the truck's `IN_FACILITY`, via `mark-in-facility`). Everything else in that enum is not written by any endpoint today — same "seed-only" caveat as above.

### 6.5 `Booking.payment_status`

`PENDING` (default) → `PAID` (via `confirm-payment`, §3.5). `FAILED` exists in the schema's check constraint but nothing in the API sets it.

### 6.6 Manifest / tow-truck fields — not live-wired yet

`manifest_status` (`IN_MANIFEST`/`LEFT_MANIFEST`) can be toggled between the two values via `add-to-manifest`/`remove-from-manifest`, but nothing currently sets the *initial* value, `left_pregate_at`, or any of the `tow_*` fields — those only exist on static seed rows today. Treat "Today's Manifest" and tow-truck-request UI as display-only against seed data for now, not a live flow.

---

## 7. Suggested integration order

1. Companies search (`services/companies.service.ts`, trivial — just add a `search` param).
2. Truck/driver `booking-options` service + hook, swap into `SearchableGroupedSelect` for all 4 forms.
3. Facility/Terminal/TransitPark/BookingCategory/Timeslot lookups (all pre-existing endpoints, just new services/hooks) — swap out the corresponding mock constant per form using the table in §1.
4. Wire `preview` into "Proceed To Preview Data", replacing the client-computed preview fields with the response from §3.1.
5. Wire `create` into "Confirm Details".
6. Wire `confirm-payment` into "Proceed To Pay".
7. Delete the now-unused mock files (`lib/book-assist-mock-data.ts`, `lib/book-fish-mock-data.ts`) once all 4 forms are off them — but leave `lib/trucks-mock-data.ts`/`lib/drivers-mock-data.ts` alone if anything else in the app still uses them.
