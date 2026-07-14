# Sprint 3 Operations — Frontend Integration Guide

**Audience:** Frontend developer (`ETSSGlobalFrontend`)  
**Backend modules:** `src/modules/fines/`, `src/modules/dttr/`, `src/modules/bookings/`, `src/modules/utility-tickets/`  
**Auth:** All endpoints require JWT + SuperAdmin (`SuperAdminGuard`), same as Trucks / Terminals.

---

## 1. Setup

- Base URL: `NEXT_PUBLIC_API_URL` must include the `/api` prefix (e.g. `http://localhost:3000/api`).
- Response envelope (unchanged):

```json
{ "success": true, "message": "…", "data": { … } }
```

List endpoints return `data: { data: T[], meta: { total, page, limit, total_pages } }`.  
Unwrap with `res.data.data` in services.

- Swagger: `http://localhost:3000/docs` — tags: `penalties`, `issued-fines`, `disputes`, `dttr`, `bookings`, `utility-tickets`. Every endpoint has modeled request payloads and response schemas at `/docs-json`.
- Seed data: `npm run seed` (backend) loads penalty definitions, issued fines, fine disputes, DTTR rows, bookings, and utility tickets aligned with frontend mocks.

### Important: two “disputes” concepts

| UI surface | API | Data model |
|---|---|---|
| **Penalties → Manage Fine Disputes** tab | `GET /api/disputes` | `FineDispute` (issued fines disputed by transporters) |
| **Trucks → Flagged** (override penalty) | `PATCH /api/trucks/:id/override-penalty` | `TruckPenalty` on truck record |

The `api/disputes` route now serves **fine disputes** from the Fines module. It no longer maps to truck `TruckPenalty` rows.

---

## 2. Penalties & Fines — `/api/penalties`, `/api/issued-fines`, `/api/disputes`

Maps to `PenaltiesPage.tsx` (`/dashboard/penalties`) with three tabs.

### 2a. Infraction categories — `/api/penalties`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/penalties/summary` | KPI cards (total, active, inactive, archived, avg_fine_amount) |
| GET | `/api/penalties/export` | CSV export |
| GET | `/api/penalties` | Paginated list |
| GET | `/api/penalties/:id` | Single definition |
| POST | `/api/penalties` | Create category |
| PATCH | `/api/penalties/:id` | Edit category |
| PATCH | `/api/penalties/:id/archive` | Set `status: ARCHIVED` |

**List query params**

| Param | UI mapping | Values |
|---|---|---|
| `page`, `limit` | Pagination | default `page=1`, `limit=20` |
| `search` | Search bar | `name`, `penalty_code` |
| `status` | Status filter | `ACTIVE`, `INACTIVE`, `ARCHIVED` (omit or `All` for all) |
| `sort` | Column sort | `name`, `fine_amount`, `created_at` |
| `sort_dir` | Sort direction | `ASC`, `DESC` (default `DESC` on `created_at`) |

**Create payload** (`POST /api/penalties`)

```json
{
  "name": "Overstay",
  "description": "Truck remaining beyond allocated time window.",
  "fine_amount": 50000,
  "status": "ACTIVE"
}
```

Server auto-generates `penalty_code` (`PEN-001`, `PEN-002`, …) and sets `created_by` from the authenticated SuperAdmin.

**Response shape** (matches `PenaltyDefinition` in `types/penalties.types.ts`)

```json
{
  "id": "uuid",
  "penalty_code": "PEN-001",
  "name": "Overstay",
  "description": "…",
  "fine_amount": 50000,
  "status": "ACTIVE",
  "created_by": "Femi Okunlola",
  "created_at": "2026-04-10T08:00:00Z",
  "updated_by": "Femi Okunlola",
  "updated_at": "2026-04-15T10:00:00Z"
}
```

### 2b. Issued fines — `/api/issued-fines`

Read-only list for the **Issued Fines** tab (fines are issued by enforcement officers in a separate flow).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/issued-fines/summary` | KPI cards |
| GET | `/api/issued-fines/export` | CSV export |
| GET | `/api/issued-fines` | Paginated list |
| GET | `/api/issued-fines/:id` | Detail drawer |

**List query params**

| Param | UI mapping |
|---|---|
| `search` | `issued_fine_id`, `penalty_code`, `booking_reference`, `truck_plate_number`, `transporter_company_name` |
| `penalty_name` | Penalty name dropdown |
| `terminal` | `booking.terminal_destination` filter |
| `sort` | `penalty_name`, `fine_amount`, `date_issued` |

**Response shape** (matches `IssuedFine`)

```json
{
  "id": "uuid",
  "issued_fine_id": "PNL-2026-001001",
  "penalty_code": "PEN-001",
  "penalty_name": "Overstay",
  "fine_amount": 50000,
  "booking": {
    "booking_reference": "BKG-2026-010001",
    "terminal_destination": "APM Terminals Apapa",
    "booking_date": "2026-04-10T06:00:00Z",
    "category": "IMPORT",
    "truck_booking_status": "FLAGGED"
  },
  "truck_plate_number": "TRP-221-LG",
  "driver_name": "Yakubu Hassan",
  "transporter": {
    "company_name": "ABC Logistics Ltd",
    "user_account": "Emeka Okafor",
    "contact_person": "Emeka Okafor",
    "contact_number": "+234 803 451 2290",
    "email": "emeka@abclogistics.ng"
  },
  "date_issued": "2026-04-10T14:30:00Z",
  "issued_by": "Okonkwo Samuel (EO-001)",
  "status": "DISPUTED"
}
```

### 2c. Fine disputes — `/api/disputes`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/disputes/summary` | Dispute KPI cards |
| GET | `/api/disputes/export` | CSV export |
| GET | `/api/disputes` | Paginated list |
| GET | `/api/disputes/:id` | Detail with `resolution_history` |
| PATCH | `/api/disputes/:id/resolve` | Update status / resolve |

**List query params**

| Param | Values |
|---|---|
| `search` | `dispute_id`, `penalty_code`, `booking_reference`, `truck_plate_number`, `transporter_company_name` |
| `dispute_status` | `PENDING_REVIEW`, `UNDER_NPA_REVIEW`, `RESOLVED`, `REJECTED` |
| `resolution_outcome` | `FINE_UPHELD`, `FINE_WAIVED`, `FINE_ADJUSTED` |
| `sort` | `penalty_name`, `fine_amount`, `date_disputed` |

**Resolve payload** (`PATCH /api/disputes/:id/resolve`)

```json
{
  "dispute_status": "RESOLVED",
  "resolution_outcome": "FINE_ADJUSTED",
  "adjusted_amount": 25000,
  "notes": "Fine reduced after NPA calibration review."
}
```

- `resolution_outcome` required when `dispute_status` is `RESOLVED` or `REJECTED`.
- `adjusted_amount` required when `resolution_outcome` is `FINE_ADJUSTED`.
- Returns 400 if dispute is already `RESOLVED` or `REJECTED`.

**Summary fields** (match `DisputesSummary` in `types/penalties.types.ts`)

- `total_amount_in_dispute` — sum of `fine_amount` where status ∉ `{RESOLVED, REJECTED}`
- `total_amount_waived_adjusted` — waived amounts + `(fine_amount - adjusted_amount)` for adjusted outcomes

---

## 3. DTTR — `/api/dttr`

Maps to `DTTRPage.tsx` (`/dashboard/dttr`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dttr/summary` | Dashboard KPI cards |
| GET | `/api/dttr/edit-audit` | SuperAdmin edit audit log (all terminals) |
| GET | `/api/dttr` | Paginated terminal request list |
| GET | `/api/dttr/:id` | Single terminal request |
| GET | `/api/dttr/:id/submissions` | Submission history for terminal |
| POST | `/api/dttr/:id/submit` | Submit daily request breakdown |
| PATCH | `/api/dttr/:id` | SuperAdmin edit with audit trail |
| PATCH | `/api/dttr/:id/configure-mode` | Toggle MANUAL / AUTOMATED |

**List query params**

| Param | UI mapping |
|---|---|
| `search` | `terminal_name`, `terminal_code` |
| `date` | Filter by `last_updated_at` date (`YYYY-MM-DD`) |
| `request_mode` | `MANUAL`, `AUTOMATED` |
| `sort` | `terminal_name`, `last_updated_at`, `request_mode`, `total_requested` |

**Terminal response shape** (matches `DTTRTerminalRequest`)

```json
{
  "id": "uuid",
  "terminal_name": "Apapa Port Terminal A",
  "terminal_code": "APT-A",
  "approved_daily_capacity": 120,
  "requested": { "exports": 35, "imports": 42, "empties": 18, "gatepass": 12 },
  "last_updated_at": "2026-07-11T06:30:00.000Z",
  "request_mode": "MANUAL",
  "automated_template": { "exports": 22, "imports": 30, "empties": 15, "gatepass": 8 }
}
```

`automated_template` is only present when `request_mode === "AUTOMATED"`.

**Submit daily request** (`POST /api/dttr/:id/submit`)

```json
{ "exports": 35, "imports": 42, "empties": 18, "gatepass": 12 }
```

- Sum of all four fields must be ≤ `approved_daily_capacity` (400 if exceeded).
- Creates a `DTTRSubmissionRecord` and updates the terminal's current `requested` values.

**SuperAdmin edit** (`PATCH /api/dttr/:id`)

```json
{
  "breakdown": { "exports": 30, "imports": 40, "empties": 20, "gatepass": 10 },
  "justification": "NPA approved capacity reallocation.",
  "approval_reference": "NPA/DTTR/2026/0142",
  "approval_document_name": "npa-approval.pdf"
}
```

Requires `justification` and either `approval_reference` or `approval_document_name`.

**Configure mode** (`PATCH /api/dttr/:id/configure-mode`)

```json
{
  "request_mode": "AUTOMATED",
  "automated_template": { "exports": 22, "imports": 30, "empties": 15, "gatepass": 8 }
}
```

When switching to `AUTOMATED`, template is required and its sum must be ≤ capacity. Template is applied to current `requested` values.

---

## 4. Bookings + Today's Manifest — `/api/bookings`

Maps to `BookingsPage.tsx`:
- `/dashboard/bookings/all` — All Bookings section
- `/dashboard/bookings/manifest` — Today's Manifest (IN-MANIFEST / LEFT-MANIFEST tabs)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bookings/summary` | Status KPI cards |
| GET | `/api/bookings/export` | CSV export |
| GET | `/api/bookings/manifest` | Manifest list (`tab=in` or `tab=left`) |
| GET | `/api/bookings` | All bookings list |
| GET | `/api/bookings/:id` | Detail with `timeline` + `exceptions` |
| PATCH | `/api/bookings/:id/remove-from-manifest` | Remove from IN-MANIFEST |
| PATCH | `/api/bookings/:id/add-to-manifest` | Re-add from LEFT-MANIFEST |
| PATCH | `/api/bookings/:id/cancel` | Cancel booking |

**All bookings query params**

| Param | UI mapping |
|---|---|
| `search` | `booking_id`, `journey_code`, `truck_plate_number`, `driver_name` |
| `status` | `LIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED` |
| `terminal_name` | Terminal filter |
| `transfer_type` | `INBOUND`, `OUTBOUND`, `INTER_TERMINAL`, `EMPTY_RETURN`, `LOCAL` |
| `transporter_company` | Transporter filter |
| `date_field` | `created` or `completed` |
| `date_from`, `date_to` | Date range (`YYYY-MM-DD`) |
| `sort` | `created_at`, `status`, `terminal_name`, `last_updated_at` |

**Manifest query params** (`GET /api/bookings/manifest`)

| Param | Values |
|---|---|
| `tab` | `in` (default) or `left` |
| `search` | `booking_id`, `truck_plate_number` |
| `page`, `limit` | Pagination |

**Manifest filter rules**

| Tab | Backend filter |
|---|---|
| `in` | `manifest_status = IN_MANIFEST` AND `left_pregate_at IS NOT NULL` |
| `left` | `manifest_status = LEFT_MANIFEST` AND `tow_requested_at IS NOT NULL` |

**Booking response shape** (matches `Booking` in `types/bookings.types.ts`)

```json
{
  "id": "uuid",
  "booking_id": "BKG-2026-008421",
  "journey_code": "JRN-APT-4421",
  "truck_plate_number": "LAG-887-KJA",
  "truck_color": "White",
  "driver_name": "Chukwudi Nwosu",
  "driver_id": "DRV-003456",
  "transporter_company": "ABC Logistics Ltd",
  "terminal_name": "Apapa Port Terminal A",
  "terminal_destination": "APM Terminals T1",
  "transfer_type": "INBOUND",
  "booking_category": "IMPORT",
  "status": "LIVE",
  "created_at": "2026-07-11T06:30:00.000Z",
  "last_updated_at": "2026-07-11T10:15:00.000Z",
  "truck_booked_by": "ABC Logistics Ltd",
  "truck_owned_by": "ABC Logistics Ltd",
  "left_pregate_at": "2026-07-11T09:45:00.000Z",
  "manifest_status": "IN_MANIFEST",
  "timeline": [
    { "id": "uuid", "status": "LEFT_PREGATE", "timestamp": "2026-07-11T09:45:00.000Z", "performed_by": "System", "notes": "…" }
  ],
  "exceptions": []
}
```

`tow_truck_request` is included only when tow fields are set:

```json
"tow_truck_request": {
  "requested_at": "2026-07-11T10:30:00.000Z",
  "reason": "Engine failure…",
  "requested_by": "Amina Suleiman",
  "tow_company": "RapidTow Nigeria",
  "status": "PENDING"
}
```

**Manifest actions**

| UI action | Endpoint | Effect |
|---|---|---|
| Remove from Manifest | `PATCH …/remove-from-manifest` | `manifest_status → null`, timeline `REMOVED_FROM_MANIFEST` |
| Add to Manifest | `PATCH …/add-to-manifest` | `manifest_status → IN_MANIFEST`, clears tow fields, timeline `ADDED_TO_MANIFEST` |
| Cancel Booking | `PATCH …/cancel` | `status → CANCELLED`, clears manifest, timeline `CANCELLED` |

---

## 5. Utility Tickets — `/api/utility-tickets`

Maps to `UtilityTicketsPage.tsx` (`/dashboard/utility-tickets`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/utility-tickets/summary` | KPI cards |
| GET | `/api/utility-tickets/export` | CSV export |
| GET | `/api/utility-tickets` | Paginated list |
| GET | `/api/utility-tickets/:id` | Detail with history + personnel |
| POST | `/api/utility-tickets/generate` | SuperAdmin creates ticket on behalf of terminal |
| PATCH | `/api/utility-tickets/:id` | Edit (blocked if approved or closed) |
| PATCH | `/api/utility-tickets/:id/approve` | Approve ticket |
| PATCH | `/api/utility-tickets/:id/cancel` | Close / cancel ticket |
| GET | `/api/utility-tickets/:id/e-ticket` | Download e-ticket payload |

**List query params**

| Param | UI mapping |
|---|---|
| `search` | `terminal_name`, `ticket_id` |
| `terminal_type` | `PORT`, `NON_PORT` |
| `status` | `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `raised_by` | `raised_by.user_name` filter |
| `date_from`, `date_to` | Filter on `date_raised` |
| `sort` | `date_raised`, `status`, `terminal_name` |

**Generate payload** (`POST /api/utility-tickets/generate`)

```json
{
  "terminal_name": "Apapa Port Terminal A",
  "terminal_type": "PORT",
  "terminal_code": "APT-A",
  "terminal_location": "Apapa, Lagos",
  "terminal_id": "uuid-optional",
  "request_type": "POWER",
  "delivery_company_name": "PowerServe Nigeria Ltd",
  "description": "Emergency generator fuel supply required for cold storage unit.",
  "truck_plate_number": "LAG-887-KJA"
}
```

Server sets:
- `booking_priority`: `PORT → PRIORITY`, `NON_PORT → STANDARD`
- `status`: `PENDING`
- `super_admin_approved`: `false`
- `e_ticket_available`: `false`
- `ticket_id`: `UT-YYYY-######` (sequential per year)

**Edit payload** (`PATCH /api/utility-tickets/:id`) — only when `!super_admin_approved && status !== CLOSED`

```json
{
  "request_type": "WATER",
  "delivery_company_name": "AquaFlow Services",
  "truck_plate_number": "LAG-442-BND",
  "status": "IN_PROGRESS",
  "full_description": "Updated description text."
}
```

**Response shape** (matches `UtilityTicket`)

```json
{
  "id": "uuid",
  "ticket_id": "UT-2026-004821",
  "terminal": {
    "id": "",
    "name": "Apapa Port Terminal A",
    "code": "APT-A",
    "type": "PORT",
    "location": "Apapa, Lagos"
  },
  "request_type": "POWER",
  "description": "Emergency generator fuel supply required for cold storage unit.",
  "full_description": "…",
  "status": "PENDING",
  "booking_priority": "PRIORITY",
  "delivery_company_name": "PowerServe Nigeria Ltd",
  "truck_plate_number": "LAG-887-KJA",
  "date_raised": "2026-07-11T08:15:00.000Z",
  "last_updated_at": "2026-07-11T08:15:00.000Z",
  "raised_by": { "user_id": "uuid", "user_name": "Emeka Okafor" },
  "super_admin_approved": false,
  "request_history": [
    { "id": "uuid", "status": "PENDING", "timestamp": "…", "performed_by": "…", "notes": "…" }
  ],
  "e_ticket_available": false
}
```

---

## 6. Frontend wiring checklist

### Add to `api/endpoints.ts`

```ts
export const PENALTIES = {
  LIST: '/penalties',
  SUMMARY: '/penalties/summary',
  EXPORT: '/penalties/export',
  BY_ID: (id: string) => `/penalties/${id}`,
  ARCHIVE: (id: string) => `/penalties/${id}/archive`,
};

export const ISSUED_FINES = {
  LIST: '/issued-fines',
  SUMMARY: '/issued-fines/summary',
  EXPORT: '/issued-fines/export',
  BY_ID: (id: string) => `/issued-fines/${id}`,
};

export const FINE_DISPUTES = {
  LIST: '/disputes',
  SUMMARY: '/disputes/summary',
  EXPORT: '/disputes/export',
  BY_ID: (id: string) => `/disputes/${id}`,
  RESOLVE: (id: string) => `/disputes/${id}/resolve`,
};

export const DTTR = {
  LIST: '/dttr',
  SUMMARY: '/dttr/summary',
  EDIT_AUDIT: '/dttr/edit-audit',
  BY_ID: (id: string) => `/dttr/${id}`,
  SUBMIT: (id: string) => `/dttr/${id}/submit`,
  SUBMISSIONS: (id: string) => `/dttr/${id}/submissions`,
  CONFIGURE_MODE: (id: string) => `/dttr/${id}/configure-mode`,
};

export const BOOKINGS = {
  LIST: '/bookings',
  SUMMARY: '/bookings/summary',
  EXPORT: '/bookings/export',
  MANIFEST: '/bookings/manifest',
  BY_ID: (id: string) => `/bookings/${id}`,
  REMOVE_FROM_MANIFEST: (id: string) => `/bookings/${id}/remove-from-manifest`,
  ADD_TO_MANIFEST: (id: string) => `/bookings/${id}/add-to-manifest`,
  CANCEL: (id: string) => `/bookings/${id}/cancel`,
};

export const UTILITY_TICKETS = {
  LIST: '/utility-tickets',
  SUMMARY: '/utility-tickets/summary',
  EXPORT: '/utility-tickets/export',
  BY_ID: (id: string) => `/utility-tickets/${id}`,
  GENERATE: '/utility-tickets/generate',
  APPROVE: (id: string) => `/utility-tickets/${id}/approve`,
  CANCEL: (id: string) => `/utility-tickets/${id}/cancel`,
  E_TICKET: (id: string) => `/utility-tickets/${id}/e-ticket`,
};
```

### Suggested service/hook files (mirror trucks pattern)

| Module | Service | Hooks |
|---|---|---|
| Penalties | `services/penalties.service.ts` | `usePenalties`, `usePenaltiesSummary`, `usePenaltyActions` |
| Issued fines | same file or `issued-fines.service.ts` | `useIssuedFines`, `useIssuedFinesSummary` |
| Disputes | `services/disputes.service.ts` | `useDisputes`, `useDisputesSummary`, `useResolveDispute` |
| DTTR | `services/dttr.service.ts` | `useDttr`, `useDttrSummary`, `useDttrActions` |
| Bookings | `services/bookings.service.ts` | `useBookings`, `useBookingsSummary`, `useManifest`, `useBookingActions` |
| Utility tickets | `services/utility-tickets.service.ts` | `useUtilityTickets`, `useUtilityTicketActions` |

### Replace mock imports

| Page | Remove | Wire to |
|---|---|---|
| `PenaltiesPage.tsx` | `penalties-mock-data.ts` | `/api/penalties`, `/api/issued-fines`, `/api/disputes` |
| `DTTRPage.tsx` | `dttr-mock-data.ts` | `/api/dttr` |
| `BookingsPage.tsx` | `bookings-mock-data.ts` | `/api/bookings`, `/api/bookings/manifest` |
| `UtilityTicketsPage.tsx` | `utility-tickets-mock-data.ts` | `/api/utility-tickets` |

---

## 7. Documented gaps / follow-ups

| Area | Gap | Notes |
|---|---|---|
| **Penalties bulk upload** | No `POST /api/penalties/bulk` | UI shows CSV/PDF export toasts only; bulk upload not wired in FE yet |
| **Issue fine (enforcement)** | No `POST /api/issued-fines` | Fines are seeded/read-only; enforcement officer issuance is a future sprint |
| **App Options infraction categories** | Parallel `InfractionCategory` in app-options | Penalties UI uses `PenaltyDefinition` (`/api/penalties`). Do not mix with `/api/infraction-categories` unless product confirms consolidation |
| **DTTR shipping-line breakdown** | Not in API | PM wireframe shows per-shipping-line EMPTY quantities; current FE/backend use aggregate `empties` only |
| **DTTR axis-level summary** | Not in API | Wireframe NPA Approved Capacity by Axis cards need a separate aggregation endpoint |
| **DTTR file upload** | `approval_document_name` string only | SuperAdmin edit accepts document name, not multipart upload |
| **Bookings create** | No `POST /api/bookings` | SuperAdmin page is view/manage only; transporter booking flow is separate |
| **Booking detail page** | No dedicated enriched detail endpoint | `GET /api/bookings/:id` returns timeline; E-Ticket download / truck status update not implemented |
| **Auto manifest removal on gate-in** | Not automated | Gated-into-terminal → remove from IN-MANIFEST requires gate integration (future) |
| **Utility ticket wireframe fields** | Driver name, phone, timeslot, arrival date | Current FE types + API use `delivery_company_name`, `request_type`, `description`; extend DTO when FE form is updated |
| **Utility e-ticket PDF** | JSON payload only | `GET …/e-ticket` returns ticket data; PDF generation is frontend or future service |
| **Truck penalty disputes (Sprint 2)** | Still on truck records | `TruckPenalty` disputes remain under flagged trucks (`override-penalty`), separate from fine disputes |

---

## 8. Quick smoke test

After `npm run seed` and logging in as SuperAdmin:

```bash
# Penalties summary
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/penalties/summary

# DTTR list
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/dttr?page=1&limit=10"

# Bookings manifest (IN)
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/bookings/manifest?tab=in"

# Utility tickets
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/utility-tickets/summary
```

All should return `{ "success": true, … }`.
