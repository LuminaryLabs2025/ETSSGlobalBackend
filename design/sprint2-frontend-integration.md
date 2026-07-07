# Sprint 2 Frontend Integration Guide — Terminals, Transit Parks & Facilities

**Audience:** Frontend developer (ETSSGlobalFrontend)
**Goal:** Switch the Terminals, Transit Parks (Pregates/EPTs), and Facilities (Bonded Terminals / Truck Parks / Fish-Van Parks) pages from local mock data to the live backend API.
**Backend status:** Complete. All CRUD, enable/disable, archive, booking-status, and summary endpoints are implemented, seeded, and smoke-tested.

---

## 1. Setup

- Base URL: set `NEXT_PUBLIC_API_URL` to the backend origin **including the `/api` prefix**, e.g. `http://localhost:3000/api`.
- Auth: nothing new. All Sprint 2 endpoints use the same JWT bearer token + SuperAdmin guard as the existing users/team endpoints. The existing Axios client (`api/client.ts`) with its token injection and 401 handling works as-is.
- Swagger: interactive docs for every endpoint below are available at `http://localhost:3000/docs`.
- Seed data: `npm run seed` (backend) loads 6 terminals, 5 transit parks, and 5 facilities matching the design mockups, so lists render meaningful data immediately.

---

## 2. The one contract difference you must handle: response envelope

The existing frontend services (users/team) expect `{ data, meta }` at the top level. **All Sprint 2 endpoints wrap responses in an envelope** (same convention as the App Options module):

```json
{
  "success": true,
  "message": "Terminals retrieved successfully",
  "data": {
    "data": [ { "id": "…", "name": "APM Terminals", … } ],
    "meta": { "total": 6, "page": 1, "limit": 20, "total_pages": 1 }
  }
}
```

So in the new service files, unwrap one extra level:

```ts
const res = await client.get(ENDPOINTS.TERMINALS.LIST, { params });
return res.data.data;        // -> { data: Terminal[], meta: PaginationMeta }
```

Single-record endpoints (`GET /:id`, `POST`, `PUT`, all `PATCH` actions) return the record directly under `data`:

```json
{ "success": true, "message": "Terminal created successfully", "data": { "id": "…", … } }
```

Errors use the standard Nest shape: `{ statusCode, message, error }` — e.g. `409` with `"A terminal with this name already exists"` on duplicate names, `404` `"Terminal not found"`, `400` with validation messages.

---

## 3. Endpoint reference

All routes require `Authorization: Bearer <token>` and SuperAdmin role.

### Terminals — `/api/terminals`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/terminals` | Paginated list. Query: `page`, `limit`, `search`, `status`, `type`, `location`, `booking_status`, `include_archived` |
| GET | `/api/terminals/summary` | Dashboard card counts + stats (see §5) |
| GET | `/api/terminals/:id` | Single terminal |
| POST | `/api/terminals` | Create (code auto-generated: `PT-001` / `NPT-001`) |
| PUT | `/api/terminals/:id` | Update |
| PATCH | `/api/terminals/:id/enable` | Set status `ACTIVE` (no body) |
| PATCH | `/api/terminals/:id/disable` | Set status `INACTIVE` (no body) |
| PATCH | `/api/terminals/:id/status` | Body `{ "status": "ACTIVE" \| "INACTIVE" }` (equivalent alternative) |
| PATCH | `/api/terminals/:id/booking-status` | Body `{ "booking_status": "OPEN" \| "CLOSED" }` |
| PATCH | `/api/terminals/:id/archive` | Archive (hidden from lists unless `include_archived=true`) |
| PATCH | `/api/terminals/:id/unarchive` | Restore |
| DELETE | `/api/terminals/:id` | Hard delete |

Create body:

```json
{
  "name": "APM Terminals",
  "terminal_type": "PORT_TERMINAL",
  "location": "APAPA",
  "address": "Apapa Wharf Road, Lagos",
  "approved_daily_truck_capacity": 400,
  "approved_trucks_per_hour": 20,
  "hourly_truck_tat_minutes": 45
}
```

### Transit Parks (Pregates & EPTs) — `/api/transit-parks`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/transit-parks` | Paginated list. Query: `page`, `limit`, `search`, `status`, `type` (`PREGATE` \| `EPT`), `location`, `include_archived` |
| GET | `/api/transit-parks/summary` | Card counts + stats |
| GET | `/api/transit-parks/:id` | Single park |
| POST | `/api/transit-parks` | Create (code auto-generated: `PRE-001` / `EPT-001`) |
| PUT | `/api/transit-parks/:id` | Update |
| PATCH | `/api/transit-parks/:id/enable` | Set `ACTIVE` (no body) |
| PATCH | `/api/transit-parks/:id/disable` | Set `INACTIVE` (no body) |
| PATCH | `/api/transit-parks/:id/status` | Body `{ "status": … }` |
| PATCH | `/api/transit-parks/:id/archive` / `/unarchive` | Archive / restore |
| DELETE | `/api/transit-parks/:id` | Hard delete |

Create body:

```json
{
  "name": "Lilypond Pregate",
  "transit_park_type": "PREGATE",
  "location": "APAPA",
  "address": "Ijora, Lagos",
  "approved_truck_capacity": 250,
  "approved_truck_exits_per_hour": 20,
  "bay_capacity": 200
}
```

### Facilities (Bonded / Truck Park / Fish-Van) — `/api/facilities`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/facilities` | Paginated list. Query: `page`, `limit`, `search`, `status`, `park_type`, `facility_type`, `location`, `include_archived` |
| GET | `/api/facilities/summary` | Card counts + stats |
| GET | `/api/facilities/:id` | Single facility |
| GET | `/api/facilities/:id/timeslots` | Paginated timeslot assignments for this facility |
| POST | `/api/facilities` | Create (code auto-generated: `BDT-001` / `TRP-001` / `FVP-001`; also auto-registers a Location and assigns all facility timeslots) |
| PUT | `/api/facilities/:id` | Update |
| PATCH | `/api/facilities/:id/enable` | Set `ACTIVE` (no body) |
| PATCH | `/api/facilities/:id/disable` | Set `INACTIVE` (no body) |
| PATCH | `/api/facilities/:id/status` | Body `{ "status": … }` |
| PATCH | `/api/facilities/:id/archive` / `/unarchive` | Archive / restore |
| DELETE | `/api/facilities/:id` | Hard delete (also removes linked Location + timeslot assignments) |

Create body:

```json
{
  "name": "Lagos Bonded Terminal A",
  "park_type": "BONDED_TERMINAL",
  "facility_type": "FACILITY",
  "location": "APAPA",
  "address": "Warehouse Road, Apapa",
  "approved_truck_capacity": 150,
  "approved_truck_exits_per_hour": 15,
  "bay_capacity": 100,
  "daily_empty_evacuation_limit": 200
}
```

Enum values (identical to the frontend's existing constants):

- `terminal_type`: `PORT_TERMINAL`, `NON_PORT_TERMINAL`
- `transit_park_type`: `PREGATE`, `EPT`
- `park_type`: `BONDED_TERMINAL`, `TRUCK_PARK`, `FISH_VAN_PARK`
- `facility_type`: `FACILITY`, `FACILITY_PREGATE`
- `location`: `APAPA`, `TINCAN` (facilities also allow `APAPA_TINCAN`)
- `status`: `ACTIVE`, `INACTIVE` · `booking_status` (terminals only): `OPEN`, `CLOSED`

---

## 4. Status model: derive display status from three fields

Frontend types currently model a single `operational_status: ACTIVE | INACTIVE | ARCHIVED`. The backend stores this as separate fields:

| Backend field | Values | Meaning |
|---|---|---|
| `status` | `ACTIVE` / `INACTIVE` | Enabled / disabled |
| `archived_at` | timestamp or `null` | Archived if non-null; archived rows are excluded from lists unless `include_archived=true` |
| `booking_status` | `OPEN` / `CLOSED` (terminals only) | The "Booking Open/Closed" badge in the design |

Suggested mapping in the frontend:

```ts
const operationalStatus = row.archived_at
  ? 'ARCHIVED'
  : row.status; // 'ACTIVE' | 'INACTIVE'
```

And for list filters: map the UI's `operational_status=ARCHIVED` filter to `include_archived=true`; otherwise pass `status=ACTIVE|INACTIVE` directly.

---

## 5. Summary endpoints (dashboard cards)

Each `/summary` endpoint returns both the design-mockup card counts **and** the aggregate stats the frontend `SummaryPanel` components currently derive from mock lists, so you can drive the panels entirely from one call.

`GET /api/terminals/summary`:

```json
{
  "total": 6,
  "enabled": 6,
  "disabled": 0,
  "avg_trucks_per_hour": 16,
  "port_terminals": 3,
  "non_port_terminals": 3,
  "apapa_port_terminals": 2,
  "apapa_non_port_terminals": 2,
  "tincan_port_terminals": 1,
  "tincan_non_port_terminals": 1
}
```

`GET /api/transit-parks/summary`:

```json
{
  "total": 5,
  "enabled": 5,
  "disabled": 0,
  "avg_truck_exits_per_hour": 18,
  "total_bay_capacity": 930,
  "pregates": 3,
  "export_processing_terminals": 2
}
```

`GET /api/facilities/summary`:

```json
{
  "total": 5,
  "enabled": 5,
  "disabled": 0,
  "avg_truck_exits_per_hour": 19,
  "total_daily_empty_evacuation_limit": 680,
  "bonded_terminals": 2,
  "truck_parks": 2,
  "fish_van_parks": 1
}
```

Counts and averages exclude archived records. Summaries are global (not per-tab); if a tab needs per-type stats (e.g. Pregates only), derive them from the filtered list response.

---

## 6. Field mapping: frontend types → backend columns

Update the three type files to the backend names (recommended), or map in the service layer.

### Terminal (`terminals.types.ts` → `terminals` table)

| Frontend field | Backend field | Action |
|---|---|---|
| `terminal_name` | `name` | rename |
| `terminal_code` | `terminal_code` | same — real values are `PT-…` / `NPT-…` |
| `port_zone` | `location` | rename; always set (`APAPA` \| `TINCAN`) |
| `location` (address string) | `address` | rename |
| `approved_daily_truck_capacity` | `approved_daily_truck_capacity` | same |
| `hourly_truck_handling_capacity` | `approved_trucks_per_hour` | rename |
| `operational_status` | `status` + `archived_at` | derive (see §4) |
| — missing — | `booking_status` | **add** — design shows the Booking Open/Closed badge |
| — missing — | `hourly_truck_tat_minutes` | **add** — design shows an Hourly Truck TAT column |

### Transit Park (`transit-parks.types.ts` → `transit_parks` table)

| Frontend field | Backend field | Action |
|---|---|---|
| `name` | `name` | same |
| `facility_type` (`PREGATE`\|`EPT`) | `transit_park_type` | rename |
| `code` | `transit_park_code` | rename — real values `PRE-…` / `EPT-…` |
| `address` | `address` | same |
| `hourly_truck_handling_capacity` | `approved_truck_exits_per_hour` | rename — design column "Approved Truck Exits Rate/Hour" |
| `approved_bays` | `bay_capacity` | rename |
| — missing — | `approved_truck_capacity` | **add** — design shows an Approved Truck Capacity column |
| — missing — | `location` | **add** — design filter uses Apapa / TinCan |
| `operational_status` | `status` + `archived_at` | derive |

### Facility (`facilities.types.ts` → `facilities` table)

| Frontend field | Backend field | Action |
|---|---|---|
| `name` | `name` | same |
| `facility_id` | `facility_code` | rename — real values `BDT-…` / `TRP-…` / `FVP-…` |
| `category` | `park_type` | rename; same enum values |
| `facility_type` | `facility_type` | same |
| `address` | `address` | same |
| `hourly_handling_capacity` | `approved_truck_exits_per_hour` | rename |
| `approved_capacity` | `approved_truck_capacity` | rename |
| `daily_evacuation_limit` | `daily_empty_evacuation_limit` | rename |
| — missing — | `location` (`APAPA`\|`TINCAN`\|`APAPA_TINCAN`) | **add** — design filter includes "Apapa + Tincan" |
| — missing — | `bay_capacity` | optional add |
| `operational_status` | `status` + `archived_at` | derive |

All records also carry `id` (UUID), `created_at`, `updated_at`.

### Query params: frontend names → backend names

| Frontend list param | Backend query param | Note |
|---|---|---|
| tab type (`terminal_type` / pregate-vs-EPT) | `type` | terminals + transit-parks |
| facility category tab | `park_type` | facilities |
| `facility_type` filter | `facility_type` | same |
| `operational_status` | `status` (+ `include_archived`) | map `ARCHIVED` → `include_archived=true` |
| `sort_by` / `sort_dir` | — not supported — | backend sorts by name ascending; keep client-side sort |
| `page` / `limit` / `search` | `page` / `limit` / `search` | same; `search` matches name and code, case-insensitive |
| — new — | `location`, `booking_status` | available for the design's Filter panel |

---

## 7. Migration checklist

1. **`api/endpoints.ts`** — add `TERMINALS`, `TRANSIT_PARKS`, `FACILITIES` blocks with `LIST`, `SUMMARY`, `BY_ID(id)`, `ENABLE(id)`, `DISABLE(id)`, `ARCHIVE(id)`, `UNARCHIVE(id)`, plus `BOOKING_STATUS(id)` (terminals) and `TIMESLOTS(id)` (facilities).
2. **Service files** — create `terminals.service.ts`, `transit-parks.service.ts`, `facilities.service.ts` following the `users.service.ts` pattern, but unwrap the envelope (`res.data.data`, see §2).
3. **Type files** — apply the renames/additions in §6.
4. **Pages** — in `TerminalsPage`, `TransitParksPage`, `FacilitiesPage`, replace `useState(MOCK_*)` with fetches of the list + summary endpoints; keep client-side sorting.
5. **Action menus** — wire Enable → `PATCH /:id/enable`, Disable → `PATCH /:id/disable`, Archive/Unarchive → their endpoints, Edit → `PUT /:id`, Delete → `DELETE /:id`. Terminal booking toggle → `PATCH /:id/booking-status`. Refetch list + summary after each action.
6. **Create forms** — replace the "coming soon" toasts with modals posting the §3 create bodies. Do **not** send a code field; codes are generated server-side.
7. **Env** — point `NEXT_PUBLIC_API_URL` at the backend with the `/api` prefix.

---

## 8. What stays mocked (depends on future sprints)

- **Charts** (Daily Truck Turnaround Rate, live booking/utilization graphs) — need the Bookings module; keep mock chart data. Capacity columns can show real capacity values now, with 0/blank utilization.
- **Export Data button** — no backend export endpoint yet; keep as a stub or export the fetched list client-side as CSV.
- **Per-tab summary stats** — the `/summary` endpoints are global; derive per-tab numbers from filtered list responses if needed.

## 9. Backend gaps found during this integration review — now closed

These were identified as mismatches with existing frontend conventions and have been fixed on the backend (nothing to work around):

1. **Enable/disable endpoints** — the frontend's users/team modules use `PATCH /:id/enable` and `/:id/disable`, but Sprint 2 originally only had `PATCH /:id/status`. Both `/enable` and `/disable` now exist on all three resources (the `/status` body variant also remains).
2. **Summary stats** — the `/summary` endpoints originally returned only the design-mockup card counts. They now also include `total`, `enabled`, `disabled`, and the average/total capacity figures the frontend `SummaryPanel` components display, so no client-side aggregation over the full dataset is needed.

Known remaining limitations (deliberate, low impact):

- **No server-side sorting** (`sort_by`/`sort_dir`) — lists are sorted by name; the frontend already sorts client-side.
- **No export endpoint** — see §8.

---

*Backend source: `Maritime-ETSS` — `src/modules/terminals-parks-facilities/` (controller/service/DTOs), entities in `src/database/entities/terminals-parks-facilities.entities.ts`, migration `1744700000000-terminals-transit-parks-facilities.ts`, seeds in `src/database/seeds/`. Verified against seeded data on Jul 7, 2026.*
