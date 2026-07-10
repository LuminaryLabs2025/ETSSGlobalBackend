# Sprint 2 Operations — Frontend Integration Guide (Trucks, Drivers, TEPs, Disputes)

**Audience:** Frontend developer (`ETSSGlobalFrontend`)  
**Backend module:** `src/modules/operations/`  
**Auth:** All endpoints require JWT + SuperAdmin (`SuperAdminGuard`), same as Terminals.

---

## 1. Setup

- Base URL: `NEXT_PUBLIC_API_URL` must include `/api` prefix (e.g. `http://localhost:3000/api`).
- Response envelope (same as Terminals / App Options):

```json
{ "success": true, "message": "…", "data": { … } }
```

List endpoints return `data: { data: T[], meta: { total, page, limit, total_pages } }`.  
Unwrap with `res.data.data` in services.

- Swagger: `http://localhost:3000/docs` — tags: `trucks`, `drivers`, `teps`, `disputes`. Every endpoint has fully modeled request payloads and response schemas (envelope included), so you can copy shapes or generate types straight from the raw spec at `/docs-json` (e.g. `TruckListResponseDto`, `DriverResponseDto`, `TepsSummaryResponseDto`, `DisputeListResponseDto`). CSV export endpoints are documented as `text/csv`.
- Seed data: `npm run seed` (backend) loads sample trucks, drivers, TEPs, and disputed penalties.

---

## 2. Trucks — `/api/trucks`

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/trucks/summary` | Dashboard KPI cards |
| GET | `/api/trucks/export` | CSV download (respects query filters) |
| GET | `/api/trucks` | Paginated list |
| GET | `/api/trucks/:id` | Single truck (detail drawer) |
| POST | `/api/trucks` | Add single truck under transporter |
| POST | `/api/trucks/bulk` | Bulk add trucks under one transporter |
| PATCH | `/api/trucks/:id/disable` | Body `{ "reason": "…" }` |
| PATCH | `/api/trucks/:id/archive` | No body |
| PATCH | `/api/trucks/:id/request-verification` | UNVERIFIED → VERIFICATION_REQUESTED |
| PATCH | `/api/trucks/:id/override-penalty` | Body `{ "reason": "…" }` |
| PATCH | `/api/trucks/:id/re-enable` | Body `{ "reason": "…" }` |

### List query params

| Param | Maps to UI | Values |
|---|---|---|
| `page`, `limit`, `search` | Pagination + search bar | `search` matches plate, chassis, company, MSS #, brand |
| `category` | Tab filter | `all`, `verified`, `unverified`, `flagged`, `disabled` |
| `registration_status` | Filter panel | `MSS_VERIFIED`, `UNVERIFIED`, etc. |
| `truck_status` | Filter panel | `AVAILABLE`, `ON_TRIP`, … |
| `truck_type` | Filter panel | `20-FOOTER`, `40-FOOTER`, … |
| `visibility` | Filter panel | `PRIVATE`, `PUBLIC` |
| `penalty_type` | Flagged tab filter | `OVERSTAY`, `ROUTE_VIOLATION`, … |
| `payment_status` | Flagged tab filter | `UNPAID`, `DISPUTED`, … |

### Tab → `category` mapping (TrucksPage)

| Tab | `category` value | Backend filter |
|---|---|---|
| All Trucks | `all` | Excludes `ARCHIVED` |
| Verified | `verified` | `registration_status = MSS_VERIFIED` |
| Unverified | `unverified` | `UNVERIFIED` + `VERIFICATION_REQUESTED` |
| Flagged | `flagged` | `registration_status = FLAGGED` |
| Disabled | `disabled` | `registration_status = DISABLED` |

### Response shape (matches `types/trucks.types.ts`)

API returns the frontend `Truck` shape directly under `data`:

```json
{
  "id": "uuid",
  "plate_number": "AAA-423-WA",
  "truck_type": "40-FOOTER",
  "color": "White",
  "registration_status": "MSS_VERIFIED",
  "registered_by": { "company_name": "ABC Logistics Ltd", "user_account": "Emeka Okafor" },
  "visibility": "PUBLIC",
  "truck_status": "AVAILABLE",
  "mss_verification_number": "MSS-2024-001234",
  "penalty": { "penalty_id": "PEN-2026-00117", "penalty_type": "OVERSTAY", … },
  "disable_info": { "disabled_by": "…", "disable_reason": "…", "disable_timestamp": "…" }
}
```

**Mapping note:** Backend `penalty_id` is sourced from `penalty_code` column — no rename needed in the response.

### Summary (`GET /api/trucks/summary`)

```json
{
  "total": 7,
  "mss_verified": 3,
  "unverified": 1,
  "verification_requested": 1,
  "flagged": 2,
  "disabled": 1,
  "archived": 0,
  "available": 1,
  "on_trip": 1
}
```

UI combines `unverified + verification_requested` for the "Unverified" card (same as mock `buildTrucksSummary()`).

### Create truck body

```json
{
  "plate_number": "NEW-001-LA",
  "truck_type": "40-FOOTER",
  "color": "White",
  "chassis_number": "CHS123",
  "brand": "Mercedes-Benz",
  "model": "Actros",
  "truck_length": "12.2m",
  "truck_capacity": "40 Tons",
  "transporter_company_id": "uuid-of-company",
  "visibility": "PRIVATE"
}
```

Defaults: `registration_status = UNVERIFIED` (pending MSS verification, not bookable).

### Bulk create

```json
{
  "transporter_company_id": "uuid",
  "trucks": [ { "plate_number": "…", "truck_type": "…", … } ]
}
```

### Action wiring (TrucksPage)

| UI action | Endpoint |
|---|---|
| Disable Truck | `PATCH /:id/disable` + reason |
| Archive Truck | `PATCH /:id/archive` |
| Request MSS Verification | `PATCH /:id/request-verification` |
| Override Penalty | `PATCH /:id/override-penalty` + reason |
| Re-enable Truck | `PATCH /:id/re-enable` + reason |

Export: `GET /api/trucks/export?category=flagged&…` returns CSV file (not JSON envelope).

---

## 3. Drivers — `/api/drivers`

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/drivers/summary` | Dashboard KPI cards |
| GET | `/api/drivers/export` | CSV download |
| GET | `/api/drivers` | Paginated list |
| GET | `/api/drivers/:id` | Single driver |
| POST | `/api/drivers` | Add driver under transporter |
| PATCH | `/api/drivers/:id/disable` | Body `{ "reason": "…" }` |
| PATCH | `/api/drivers/:id/archive` | No body |
| PATCH | `/api/drivers/:id/start-verification` | UNVERIFIED → VERIFICATION_IN_PROGRESS |
| PATCH | `/api/drivers/:id/clear-flag` | Body `{ "reason": "…" }` |
| PATCH | `/api/drivers/:id/enable` | Re-enable disabled driver |

### List query params

| Param | Purpose |
|---|---|
| `category` | Tab: `all`, `verified`, `unverified`, `flagged`, `disabled` |
| `verification_status` | Filter panel |
| `operational_status` | Filter panel (`AVAILABLE`, `ON_TRIP`, …) |
| `visibility` | `PRIVATE` / `PUBLIC` |
| `flag_type`, `flag_status` | Flagged tab filters |

### Response shape (matches `types/drivers.types.ts`)

```json
{
  "id": "uuid",
  "first_name": "Femi",
  "last_name": "Okunlola",
  "license_number": "LAG-2024-001234",
  "verification_status": "VERIFIED",
  "registered_by": { "company_name": "…", "user_account": "…" },
  "flag": { "flag_id": "FLG-DRV-00117", "flag_type": "TRAFFIC_VIOLATION", … },
  "disable_info": { … }
}
```

**Mapping note:** `flag_id` ← backend `flag_code`.

### Summary

```json
{
  "total": 4,
  "verified": 1,
  "unverified": 1,
  "verification_in_progress": 0,
  "flagged": 1,
  "disabled": 1,
  "archived": 0,
  "available": 1,
  "on_trip": 1
}
```

### Create driver body

```json
{
  "first_name": "Femi",
  "last_name": "Okunlola",
  "mobile_number": "+2348034512290",
  "license_number": "LAG-2026-000001",
  "license_expiry_date": "2028-06-15",
  "date_of_birth": "1985-06-15",
  "sex": "MALE",
  "transporter_company_id": "uuid",
  "visibility": "PRIVATE"
}
```

Defaults: `verification_status = UNVERIFIED`.

### Action wiring (DriversPage)

| UI action | Endpoint |
|---|---|
| Disable Driver | `PATCH /:id/disable` + reason |
| Archive Driver | `PATCH /:id/archive` |
| Start Verification | `PATCH /:id/start-verification` |
| Clear Flag | `PATCH /:id/clear-flag` + reason |
| Enable Driver | `PATCH /:id/enable` |

---

## 4. TEPs — `/api/teps`

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/teps/summary` | KPI cards + classification/source breakdown |
| GET | `/api/teps/export` | CSV download |
| GET | `/api/teps` | Paginated list |
| GET | `/api/teps/:id` | Single TEP with `matched_trucks` + `activity_log` |
| POST | `/api/teps` | Manual add single TEP |
| POST | `/api/teps/bulk` | Bulk upload (JSON array) |
| PATCH | `/api/teps/:id/revoke` | Body `{ "reason": "…" }` |

### List query params

| Param | Purpose |
|---|---|
| `category` | Tab: `all`, `empty_tdo`, `import_tdo`, `export_tdo`, `gatepass_port`, `gatepass_non_port` |
| `classification` | Filter (same enum values as tab mapping) |
| `source` | `SHIPPING_LINE`, `PORT_TERMINAL`, `NON_PORT_TERMINAL`, `EPT` |
| `status` | `ACTIVE`, `EXPIRED`, `REVOKED` |
| `match_status` | `MATCHED`, `UNMATCHED` |

### Response shape (matches `types/teps.types.ts`)

```json
{
  "id": "uuid",
  "reference_number": "ETDO-2026-00001",
  "classification": "EMPTY_TDO",
  "source": "SHIPPING_LINE",
  "facility_name": "Maersk Line Apapa",
  "company_name": "Maersk Nigeria",
  "user_account": "SuperAdmin",
  "match_status": "MATCHED",
  "status": "ACTIVE",
  "matched_trucks": [{ "plate_number": "AAA-423-WA", "driver_name": "Femi Okunlola", "driver_id": "", "match_timestamp": "…" }],
  "activity_log": [{ "event_type": "CREATED", "performed_by": "SuperAdmin", "timestamp": "…", "details": "…" }]
}
```

**Mapping note:** Backend relation `activity_events` is mapped to frontend `activity_log` with `timestamp` ← `created_at`.

### Summary

```json
{
  "total": 5,
  "active": 3,
  "expired": 1,
  "revoked": 1,
  "matched": 2,
  "unmatched": 3,
  "by_classification": { "EMPTY_TDO": 1, "IMPORT_TDO": 1, … },
  "by_source": { "SHIPPING_LINE": 1, "PORT_TERMINAL": 2, … }
}
```

### Create TEP body

```json
{
  "reference_number": "ETDO-2026-00099",
  "classification": "EMPTY_TDO",
  "facility_name": "Maersk Line Apapa",
  "company_name": "Maersk Nigeria",
  "truck_plate_number": "AAA-423-WA",
  "expiry_date": "2026-12-31"
}
```

`source` is **auto-derived** from classification (do not send):

| Classification | Source |
|---|---|
| `EMPTY_TDO` | `SHIPPING_LINE` |
| `IMPORT_TDO` | `PORT_TERMINAL` |
| `EXPORT_TDO` | `EPT` |
| `GATEPASS_PORT` | `PORT_TERMINAL` |
| `GATEPASS_NON_PORT` | `NON_PORT_TERMINAL` |

### Action wiring (TEPsPage)

| UI action | Endpoint |
|---|---|
| Revoke TEP | `PATCH /:id/revoke` + reason |

Bulk Upload button → `POST /api/teps/bulk` with `{ teps: CreateTepDto[] }`.

---

## 5. Disputes (Manage Disputes) — `/api/disputes`

Used by **PenaltiesPage** disputes tab (`types/penalties.types.ts` → `FineDispute`).

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/disputes/summary` | Disputes dashboard cards |
| GET | `/api/disputes/export` | CSV download |
| GET | `/api/disputes` | Paginated disputed penalties |
| GET | `/api/disputes/:id` | Single dispute |
| PATCH | `/api/disputes/:id/resolve` | SuperAdmin resolution |

### List query params

| Param | Purpose |
|---|---|
| `dispute_status` | `PENDING_REVIEW`, `UNDER_NPA_REVIEW`, `RESOLVED`, `REJECTED` |
| `resolution_outcome` | `FINE_UPHELD`, `FINE_WAIVED`, `FINE_ADJUSTED` |
| `search` | Penalty code, truck plate, transporter name |

### Response shape (maps to `FineDispute`)

```json
{
  "id": "uuid",
  "dispute_id": "PEN-2026-00118",
  "issued_fine_id": "PEN-2026-00118",
  "penalty_code": "ROUTE_VIOLATION",
  "penalty_name": "ROUTE VIOLATION",
  "fine_amount": 30000,
  "truck_plate_number": "BDG-335-KJ",
  "transporter": { "company_name": "…", "user_account": "…", "contact_person": "…", "contact_number": "", "email": "" },
  "date_issued": "…",
  "date_disputed": "…",
  "dispute_reason": "…",
  "dispute_status": "PENDING_REVIEW",
  "resolution_outcome": null,
  "managed_by": null,
  "resolution_date": null,
  "adjusted_amount": null,
  "resolution_history": []
}
```

**Gaps (documented):** `booking` info, `driver_name`, and full `transporter` contact fields are not yet populated — they depend on the future Bookings module. Empty strings / omitted fields should be handled gracefully in the UI.

### Resolve dispute body

```json
{
  "dispute_status": "RESOLVED",
  "resolution_outcome": "FINE_WAIVED",
  "adjusted_amount": 15000,
  "notes": "Waived after NPA review"
}
```

---

## 6. Frontend integration checklist

### `api/endpoints.ts`

```ts
TRUCKS = {
  LIST: '/trucks',
  SUMMARY: '/trucks/summary',
  EXPORT: '/trucks/export',
  BY_ID: (id) => `/trucks/${id}`,
  CREATE: '/trucks',
  BULK: '/trucks/bulk',
  DISABLE: (id) => `/trucks/${id}/disable`,
  ARCHIVE: (id) => `/trucks/${id}/archive`,
  REQUEST_VERIFICATION: (id) => `/trucks/${id}/request-verification`,
  OVERRIDE_PENALTY: (id) => `/trucks/${id}/override-penalty`,
  RE_ENABLE: (id) => `/trucks/${id}/re-enable`,
},
DRIVERS = { … },
TEPS = { … },
DISPUTES = { … },
```

### Services + hooks

Follow the Terminals pattern:
- `services/trucks.service.ts`, `hooks/trucks/useTrucks.ts`, `useTrucksSummary.ts`, mutation hooks per action
- Same for drivers, teps, disputes
- Unwrap envelope: `const { data } = await client.get(…); return data.data;`

### Pages to wire

| Page | Replace | With |
|---|---|---|
| `TrucksPage.tsx` | `useState(MOCK_TRUCKS)` | `useTrucks` + `useTrucksSummary` |
| `DriversPage.tsx` | `useState(MOCK_DRIVERS)` | `useDrivers` + `useDriversSummary` |
| `TEPsPage.tsx` | `useState(MOCK_TEPS)` | `useTeps` + `useTepsSummary` |
| `PenaltiesPage.tsx` (disputes tab) | `MOCK_DISPUTES` | `useDisputes` + `useDisputesSummary` |

### Export buttons

Change from `toast.info` stubs to:
```ts
window.open(`${API_URL}/trucks/export?${queryString}`, '_blank');
// or axios with responseType: 'blob' for authenticated download
```

Pass the same `category`, `search`, and filter params as the active list view.

### Add / Bulk Upload buttons

Wire to `POST /trucks`, `POST /trucks/bulk`, `POST /drivers`, `POST /teps/bulk`.  
`transporter_company_id` comes from a company picker (use existing `GET /api/companies`).

---

## 7. Known gaps & future work

| Feature | Status | Notes |
|---|---|---|
| Truck/Driver images | Not in API | UI uses color-based avatar placeholders — no `image_url` field |
| PDF export | Not implemented | CSV only; PDF export buttons can stay stubbed or use client-side CSV→PDF |
| Penalties master list + Issued Fines tabs | Not in operations module | `PenaltiesPage` penalties/issued tabs still mock — separate from truck `penalty` embed |
| Booking info on disputes | Deferred | Needs Bookings module |
| TEP Excel template download | Not implemented | Bulk upload accepts JSON; Excel template endpoint can be added later |
| Server-side sort | Not supported | Lists sort by `created_at DESC`; keep client-side sort if needed |
| Live booking/truck_status updates | Deferred | `truck_status` / `operational_status` are stored but not auto-updated from bookings yet |

---

## 8. Enum reference (frontend ↔ backend — identical)

All enum strings in `types/trucks.types.ts`, `types/drivers.types.ts`, `types/teps.types.ts` match backend `CHECK` constraints exactly. No mapping layer needed for enum values.

---

*Verified against seeded data · Maritime-ETSS `src/modules/operations/` · Jul 9, 2026*
