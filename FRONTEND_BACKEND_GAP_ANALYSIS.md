# Frontend ↔ Backend Gap Analysis

**Date:** 2026-08-26  
**Frontend source:** `ETSSGlobalFrontend` staging pull (`0fb5249` — Barriers refactor + related dashboard changes)  
**Backend:** `Maritime-ETSS`

This document records contract gaps found after reviewing the frontend Barriers / Locations / Bookings / Handheld / Trucks changes against the current NestJS APIs, what was fixed on the backend, and what remains deferred.

---

## 1. Executive summary

| Area | Severity | Status |
|------|----------|--------|
| Barriers list filter `barrier_type` vs `barrier_role` | **Critical** | **Fixed** — backend accepts `barrier_type` as alias |
| Bookings summary / Flagged tab (`flagged`) | **High** | **Fixed** — summary + list filter |
| Booking detail truck preview / `current_truck_status` | **High** | **Fixed** — enriched from `trucks` by plate |
| Handheld create/update missing nested `barrier` | **Medium** | **Fixed** — responses reload with relations |
| Booking journey fields (fee, facility, timeslot, phone, TAT) | Medium | **Deferred** — needs schema / product model |
| Site detail enrichments (primary account, hours, sub-accounts, etc.) | Medium | **Deferred** — UI already optional-null safe |
| Timeline `from_status` / `location` / `tat_duration` | Low | **Deferred** — partial: `is_latest` added |
| Manifest remove → null vs LEFT_MANIFEST | Low | **Documented** — intentional domain split |

---

## 2. Barriers / Locations

### 2.1 Aligned (no change needed)

Frontend already matches backend for:

- Catalog CRUD: `GET/POST /api/barriers`, `GET /api/barriers/:id`, `PUT`, `PATCH .../disable`
- Summary shape: `{ all, entry, exit }` with `{ active, inactive, total }`
- Site tabs: `site_type`, `park_type`, `transit_park_type`, `terminal_type=PORT_TERMINAL`
- Response fields: `barrier_type`, `linked_site(s)`, `linked_facility`, `linked_handheld(s)`, `operational_status`, `status`
- Facility / Transit Park / Terminal: `entry_barrier_ids` / `exit_barrier_ids` on write; `entry_barriers` / `exit_barriers` on read
- Client-side overlap validation (`lib/barrier-assignment.ts`) matches server rule (no ENTRY+EXIT same barrier on same site)
- Non-port terminals: FE only assigns on port; BE rejects others with `400`

### 2.2 Gap fixed — query param naming

| Frontend | Backend (before) | Backend (after) |
|----------|------------------|-----------------|
| `barrier_type=ENTRY\|EXIT` on Barriers page list | Only `barrier_role` | Accepts **`barrier_type` as alias**; canonical remains `barrier_role` |

Without this, ENTRY/EXIT filters on Infrastructure → Barriers were silently ignored (ValidationPipe strips unknown query keys depending on config, or the filter never applied).

**Files:** `QueryBarriersDto`, `ApiBarrierListQuery`, `BarriersService.normalizeBarrierQuery`.

### 2.3 Deferred — site detail “management” widgets

FE detail drawers for Facility / Transit Park / Terminal optionally render:

- `primary_account_user`
- `operational_hours`
- `linked_booking_categories`
- `linked_transit_parks` / `linked_facilities` / `linked_terminal_operators`
- `movement_times`
- `sub_accounts`
- Terminal: `trucks_in_manifest`

These are **not** part of the barriers PR contract; UIs degrade safely when absent. Implementing them needs dedicated product APIs (user linkage, hours, M2M categories, live manifest widgets) — out of scope for this alignment pass.

---

## 3. Bookings

### 3.1 Aligned routes

| FE service | Backend |
|------------|---------|
| `GET /api/bookings` | ✓ |
| `GET /api/bookings/summary` | ✓ (+ `flagged` now) |
| `GET /api/bookings/export` | ✓ |
| `GET /api/bookings/manifest` | ✓ |
| `GET /api/bookings/:id` | ✓ |
| `PATCH .../remove-from-manifest` | ✓ |
| `PATCH .../add-to-manifest` | ✓ |
| `PATCH .../cancel` | ✓ |

Filters already supported: `search`, `status`, `terminal_name`, `transfer_type`, `transporter_company`, `date_field` / `date_from` / `date_to`.

### 3.2 Gaps fixed

1. **`flagged` on summary** — FE KPI “Flagged Bookings” used `summary.flagged` (always `0`). Backend now counts bookings with exceptions **or** a truck (`plate_number` match) with `registration_status = 'FLAGGED'`.
2. **`flagged=true` list filter** — FE Flagged tab sends `flagged: true`. Backend now applies the same EXISTS logic.
3. **Exact-ish filters** — `booking_id`, `journey_code`, `truck_plate_number`, `driver_name` accepted (FE types already defined them).
4. **Truck preview enrichment** — list/detail/manifest responses may include:
   - `truck: { truck_type, brand, model, mss_verification_number, truck_status }`
   - `current_truck_status` from truck operational status (or `'FLAGGED'` when registration is flagged and status is null)
5. **Timeline `is_latest`** — last timeline entry marked `is_latest: true`.

### 3.3 Deferred booking fields (FE types / detail UI)

| Field | FE usage | Backend today |
|-------|----------|---------------|
| `driver_phone` | Detail | Not on `bookings` entity |
| `booking_fee`, `tep_code` | Detail / e-ticket | Not on entity |
| `arrival_date`, `time_slot` | Detail | Not on entity |
| `facility_name` / `facility_code` | Detail fallback to `terminal_name` | Not on entity |
| `transit_park_name` / `transit_park_code` | Detail | Not on entity |
| `truck.mss_expiry_date`, `truck.image_url` | Truck preview card | Not on `trucks` entity |
| Timeline `from_status`, `location`, `tat_duration` | Journey timeline UI | Not stored; FE hides when missing |

**Recommendation:** introduce a booking journey / assignment model (facility + transit park FKs, fee, slot) before inventing denormalized columns. Until then FE already falls back (e.g. facility → `terminal_name`).

### 3.4 Manifest remove semantics (documented, not changed)

- **Remove from manifest** sets `manifest_status = null` (delist from both tabs).
- **Add to manifest** only accepts `LEFT_MANIFEST` (tow-truck path).

This matches the entity design comment (LEFT_MANIFEST = tow). FE “Add to Manifest” only appears on LEFT_MANIFEST rows — consistent. Do **not** treat SuperAdmin remove as LEFT_MANIFEST unless product changes the rule.

### 3.5 Dashboard overview bookings chart

Recent FE commit categorizes dashboard bookings by bonded booking categories / transfer type using **client mock/static series** in `DashboardOverview.tsx` in several places. No new backend analytics endpoint was required for this pull; if live charts are needed later, add something like `GET /api/bookings/analytics/by-category`.

---

## 4. Handheld devices

### 4.1 Aligned

- Payload: `barrier_id` preferred; `location_id` optional
- List/get join `barrier` for label (`barrier_id_number`)

### 4.2 Gap fixed

Create/update previously returned the raw entity **without** reloading `barrier` / `location` / `user` relations, so the FE could miss nested `barrier` immediately after save. Create/update now return `findHandheldDevice(id)`.

---

## 5. Trucks

Frontend `types/trucks.types.ts` expects FK refs (`truck_type_id`, `TruckTypeRef`, length/capacity refs) — already aligned with the earlier truck-type backend work. No additional gaps introduced by this Barriers pull beyond booking truck preview (above).

Note: FE still allows `truck_type` as a legacy string union **or** `TruckTypeRef`; backend returns structured type objects from truck APIs.

---

## 6. What the frontend team should know

1. Prefer documenting `barrier_type` **or** migrate FE to `barrier_role` for consistency with link payloads (`barrier_role` on `BarrierLinkedSite`). Backend supports both list filters.
2. Flagged bookings = exceptions **or** FLAGGED truck registration (not a booking `status` value).
3. Booking journey commercial/ops fields are still mock-ready on FE; ask for a booking enrichment epic before expecting those columns.
4. Terminal Gates panel is gone on FE — continue using `/api/barriers` only; legacy `/api/terminal-gates` remains deprecated.

---

## 7. Files touched in this alignment pass

| Path | Change |
|------|--------|
| `src/modules/app-options/dto/barriers.dto.ts` | `barrier_type` query alias |
| `src/modules/app-options/dto/api-barrier-query.decorator.ts` | Swagger for alias |
| `src/modules/app-options/barriers.service.ts` | Normalize query |
| `src/modules/app-options/barriers.controller.ts` | Docs mention `barrier_type` |
| `src/modules/app-options/app-options.service.ts` | Handheld create/update reload relations |
| `src/modules/bookings/dto/bookings.dto.ts` | `flagged` + exact filters |
| `src/modules/bookings/dto/bookings-response.dto.ts` | `flagged`, truck preview, `is_latest` |
| `src/modules/bookings/bookings.service.ts` | Flagged logic + truck enrichment |
| `src/modules/bookings/bookings.module.ts` | Register `Truck` entity |
| `FRONTEND_BACKEND_GAP_ANALYSIS.md` | This document |

---

## 8. Suggested follow-up backlog

1. Booking journey schema (facility / transit park / fee / slot / driver phone) + response mapping.
2. Site “management drawer” enrichment APIs (primary account, hours, sub-accounts, linked categories).
3. Timeline TAT / location events from barrier scan pipeline.
4. Partner access-control sync for barrier `operational_status`.
5. Optional FE cleanup: send `barrier_role` instead of (or in addition to) `barrier_type`.
