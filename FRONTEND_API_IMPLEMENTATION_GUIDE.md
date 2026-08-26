# Frontend API Implementation Guide

**Audience:** Frontend engineers integrating Barriers, Locations, Bookings, and Handhelds  
**Backend:** Maritime-ETSS  
**Auth:** `Authorization: Bearer <access_token>` — all endpoints below require **JWT + Super Admin**  
**Base envelope:**

```json
{
  "success": true,
  "message": "…",
  "data": { }
}
```

List endpoints put rows under `data.data` and pagination under `data.meta`:

```ts
type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};
```

Use this as the contract to wire services/hooks. Fields marked **Ready** are live. Fields marked **Not yet** are safe to treat as optional/`undefined` in UI.

---

## Quick map — what to plug where

| FE screen / flow | Primary APIs |
|------------------|--------------|
| Infrastructure → Barriers | `GET/POST /api/barriers`, `GET /api/barriers/summary`, `PUT/PATCH …/disable` |
| Facility / Transit Park / Terminal forms | Same create/update bodies + `entry_barrier_ids` / `exit_barrier_ids`; lists return `entry_barriers` / `exit_barriers` |
| App Options → Handhelds | `/api/handheld-devices` with `barrier_id` |
| Manage Bookings + Flagged tab | `/api/bookings`, `/api/bookings/summary?` + `flagged=true` |
| Today’s Manifest | `/api/bookings/manifest` |

**Do not use** deprecated `/api/terminal-gates` — replaced by `/api/barriers`.

---

## 1. Barriers catalog

### 1.1 List barriers — `GET /api/barriers`

**Query params**

| Param | Type | Notes |
|-------|------|--------|
| `page`, `limit` | number | Default `1` / `20`, max `100` |
| `search` | string | Barrier ID number or service provider |
| `site_type` | `FACILITY` \| `TRANSIT_PARK` \| `TERMINAL` | Switches to **one row per barrier↔site link** |
| `park_type` | `BONDED_TERMINAL` \| `TRUCK_PARK` \| `FISH_VAN_PARK` | Implies facility links |
| `transit_park_type` | `PREGATE` \| `EPT` | Implies transit-park links |
| `terminal_type` | `PORT_TERMINAL` | Only valid terminal filter (non-port = no barriers) |
| `site_id` | uuid | One specific site |
| `barrier_type` **or** `barrier_role` | `ENTRY` \| `EXIT` | Both accepted. FE can keep sending `barrier_type` |
| `operational_status` | `ONLINE` \| `OFFLINE` | Partner/live status |
| `status` | `ACTIVE` \| `INACTIVE` | Admin enable/disable |

**When to use which mode**

- Site tabs (Facilities / Transit Parks / Terminals): always send `site_type` (+ category filter). Response rows include `barrier_type`, `linked_site`, `linked_facility`.
- Catalog-only (no site filters): one row per barrier; `barrier_type` is usually `null`.

**Example — Bonded Terminals + ENTRY only**

```http
GET /api/barriers?site_type=FACILITY&park_type=BONDED_TERMINAL&barrier_type=ENTRY&page=1&limit=20
```

**`data` shape**

```ts
{
  data: BarrierRecord[];
  meta: PaginationMeta;
}

type BarrierRole = "ENTRY" | "EXIT";
type BarrierSiteType = "FACILITY" | "TRANSIT_PARK" | "TERMINAL";

type BarrierRecord = {
  id: string;
  barrier_id_number: string;
  service_provider_name: string;
  operational_status: "ONLINE" | "OFFLINE";
  status: "ACTIVE" | "INACTIVE";
  barrier_type: BarrierRole | null; // set in link/tab mode
  linked_facility: { id: string; name: string; park_type?: string | null } | null;
  linked_site: {
    link_id: string;
    site_type: BarrierSiteType;
    site_id: string;
    barrier_role: BarrierRole;
    site: { id: string; name: string; park_type?: string | null } | null;
  } | null;
  linked_sites: Array<{
    link_id: string;
    site_type: BarrierSiteType;
    site_id: string;
    barrier_role: BarrierRole;
    site: { id: string; name: string; park_type?: string | null } | null;
  }>;
  linked_handheld: { id: string; name: string; status: string } | null;
  linked_handhelds: Array<{ id: string; name: string; status: string }>;
  created_at: string;
  updated_at: string;
};
```

### 1.2 Summary KPIs — `GET /api/barriers/summary`

Same site filters as list (`site_type`, `park_type`, `transit_park_type`, `terminal_type`, …). Counts are **distinct barriers**, not links.

```ts
{
  all: { active: number; inactive: number; total: number };
  entry: { active: number; inactive: number; total: number };
  exit: { active: number; inactive: number; total: number };
}
```

**Examples**

```http
GET /api/barriers/summary?site_type=FACILITY&park_type=TRUCK_PARK
GET /api/barriers/summary?site_type=TRANSIT_PARK&transit_park_type=PREGATE
GET /api/barriers/summary?site_type=TERMINAL&terminal_type=PORT_TERMINAL
```

### 1.3 Create — `POST /api/barriers`

```json
{
  "service_provider_name": "Access Control Co.",
  "barrier_id_number": "BR-049",
  "operational_status": "OFFLINE",
  "status": "ACTIVE"
}
```

- `operational_status` / `status` optional (defaults `OFFLINE` / `ACTIVE`).
- `409` if `barrier_id_number` already exists.
- Returns full `BarrierRecord` in `data`.

### 1.4 Get / Update / Disable / Enable / Delete

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/barriers/:id` | Full record + `linked_sites` |
| `PUT` | `/api/barriers/:id` | Partial-friendly fields same as create |
| `PATCH` | `/api/barriers/:id/disable` | `status → INACTIVE` (preferred over hard delete) |
| `PATCH` | `/api/barriers/:id/enable` | `status → ACTIVE` |
| `DELETE` | `/api/barriers/:id` | `409` if still linked to a site or has handhelds — unlink/disable first |

### 1.5 Assign barriers on a site (optional helper)

Prefer assigning via Facility / Transit Park / Terminal create/update (section 2). Direct helpers:

```http
PUT /api/barriers/sites/{FACILITY|TRANSIT_PARK|TERMINAL}/:siteId
GET /api/barriers/sites/{FACILITY|TRANSIT_PARK|TERMINAL}/:siteId
```

**PUT body**

```json
{
  "entry_barrier_ids": ["uuid-…"],
  "exit_barrier_ids": ["uuid-…"]
}
```

- Omit a field → leave that role unchanged; send `[]` → clear that role.
- **Rule:** same barrier UUID cannot appear in both arrays for the **same** site → `400`.
- **Rule:** non-`PORT_TERMINAL` terminals → `400` (no barriers).
- Cross-site reuse is allowed (ENTRY on facility A, EXIT on facility B).

**GET / PUT response `data`**

```ts
{
  entry_barriers: BarrierRecord[];
  exit_barriers: BarrierRecord[];
  barriers: BarrierRecord[]; // combined
}
```

---

## 2. Facilities / Transit parks / Terminals (barrier assignment)

Use your existing site APIs. Barrier fields are additive.

### Create / update body extras

```ts
{
  // …existing site fields…
  entry_barrier_ids?: string[]; // catalog barrier UUIDs
  exit_barrier_ids?: string[];
}
```

| Resource | Paths | Barrier notes |
|----------|-------|----------------|
| Facilities | `POST/PUT /api/facilities`, `GET /api/facilities`, `GET /api/facilities/:id` | All park types with barriers |
| Transit parks | `POST/PUT /api/transit-parks`, list/detail | Pregate & EPT |
| Terminals | `POST/PUT /api/terminals`, list/detail | **Only `PORT_TERMINAL`**; others ignore / reject assignment |

### List & detail response extras (**Ready**)

```ts
{
  entry_barriers: Array<{
    id: string;
    barrier_id_number: string;
    service_provider_name: string;
    operational_status: "ONLINE" | "OFFLINE";
    status: "ACTIVE" | "INACTIVE";
    barrier_type?: "ENTRY" | "EXIT" | null;
    // …other BarrierRecord fields may be present
  }>;
  exit_barriers: /* same */;
}
```

### FE validation (recommended before submit)

Mirror server: intersection of entry/exit ID sets on the **same** form must be empty (you already have `lib/barrier-assignment.ts`).

### Not yet on site detail (optional UI only)

These are **not** returned today — keep optional chaining / empty states:

- `primary_account_user`, `operational_hours`, `linked_booking_categories`
- `movement_times`, `sub_accounts`
- Terminal `trucks_in_manifest`
- Cross-link collections (`linked_transit_parks`, etc.)

---

## 3. Handheld devices

Base: `/api/handheld-devices`

### Create — `POST /api/handheld-devices`

```json
{
  "name": "HH-APAPA-01",
  "user_id": "uuid",
  "status": "ACTIVE",
  "barrier_id": "uuid",
  "location_id": "uuid"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `name`, `user_id`, `status` | Yes | |
| `barrier_id` | Preferred | Barriers module link |
| `location_id` | Optional | Legacy; provide **`barrier_id` and/or `location_id`** (at least one) |

### Update — `PUT /api/handheld-devices/:id`

Same fields (partial). Create/update responses now include nested relations:

```ts
{
  id: string;
  name: string;
  user_id: string;
  barrier_id: string | null;
  location_id: string | null;
  status: string;
  barrier?: {
    id: string;
    barrier_id_number?: string;
    service_provider_name?: string;
  } | null;
  location?: { id: string; name?: string; type?: string } | null;
  user?: { id: string; first_name?: string; last_name?: string; email?: string } | null;
}
```

List: `GET /api/handheld-devices?page=&limit=&search=&status=` (joined `barrier` / `location` / `user`).

---

## 4. Bookings

Base: `/api/bookings`  
All Super Admin.

### 4.1 Summary — `GET /api/bookings/summary`

```ts
{
  total: number;
  live: number;
  completed: number;
  cancelled: number;
  expired: number;
  flagged: number; // Ready — exceptions OR truck registration_status = FLAGGED
}
```

Wire the **Flagged Bookings** KPI to `flagged`.

### 4.2 List — `GET /api/bookings`

| Param | Ready | Notes |
|-------|-------|--------|
| `page`, `limit` | ✓ | |
| `search` | ✓ | booking_id, journey, plate, driver |
| `status` | ✓ | `LIVE` \| `COMPLETED` \| `CANCELLED` \| `EXPIRED` |
| `flagged` | ✓ | `true` for Flagged tab |
| `booking_id`, `journey_code`, `truck_plate_number`, `driver_name` | ✓ | Exact/ILIKE filters |
| `terminal_name`, `transfer_type`, `transporter_company` | ✓ | |
| `date_field` | ✓ | `created` \| `completed` |
| `date_from`, `date_to` | ✓ | `YYYY-MM-DD` |
| `sort`, `sort_dir` | ✓ | e.g. `created_at` / `desc` |

**Flagged tab**

```http
GET /api/bookings?flagged=true&page=1&limit=20
```

**`Booking` response (Ready fields)**

```ts
type Booking = {
  id: string;
  booking_id: string;
  journey_code: string;
  truck_plate_number: string;
  truck_color: string | null;
  truck?: {
    truck_type?: string;
    brand?: string;
    model?: string;
    mss_verification_number?: string;
    truck_status?: string;
  };
  current_truck_status?: string | null; // from trucks.truck_status (or "FLAGGED")
  driver_name: string;
  driver_id: string | null;
  transporter_company: string;
  terminal_name: string;
  terminal_destination: string;
  transfer_type: "INBOUND" | "OUTBOUND" | "INTER_TERMINAL" | "EMPTY_RETURN" | "LOCAL";
  booking_category: "IMPORT" | "EXPORT" | "EMPTY" | "DOMESTIC";
  status: "LIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  created_at: string;
  last_updated_at: string;
  completed_at?: string;
  truck_booked_by: string;
  truck_owned_by: string;
  left_pregate_at?: string;
  left_manifest_at?: string;
  manifest_status: "IN_MANIFEST" | "LEFT_MANIFEST" | null;
  tow_truck_request?: {
    requested_at: string;
    reason: string;
    requested_by: string;
    tow_company?: string;
    status: "PENDING" | "ASSIGNED" | "COMPLETED";
  };
  timeline: Array<{
    id: string;
    status: string;
    timestamp: string;
    performed_by?: string;
    notes?: string;
    is_latest?: boolean; // Ready
    // Not yet: from_status, location, tat_duration
  }>;
  exceptions: Array<{
    id: string;
    type: "PENALTY" | "DELAY" | "EXCEPTION";
    description: string;
    timestamp: string;
  }>;
};
```

**Not yet on booking** (keep optional; UI already falls back):

`driver_phone`, `booking_fee`, `tep_code`, `arrival_date`, `time_slot`, `facility_name` / `facility_code`, `transit_park_name` / `transit_park_code`, `truck.mss_expiry_date`, `truck.image_url`.

### 4.3 Detail — `GET /api/bookings/:id`

Same `Booking` shape (including `truck` preview when plate matches a truck).

### 4.4 Manifest — `GET /api/bookings/manifest`

| Param | Values |
|-------|--------|
| `tab` | `in` (default) \| `left` |
| `page`, `limit`, `search`, `date` | optional `YYYY-MM-DD` |

- `in` → `manifest_status = IN_MANIFEST` and `left_pregate_at` set  
- `left` → `LEFT_MANIFEST` with tow request  

### 4.5 Actions

| Method | Path | When |
|--------|------|------|
| `PATCH` | `/api/bookings/:id/remove-from-manifest` | Only `IN_MANIFEST` → sets `manifest_status` to `null` |
| `PATCH` | `/api/bookings/:id/add-to-manifest` | Only `LEFT_MANIFEST` → back to `IN_MANIFEST` |
| `PATCH` | `/api/bookings/:id/cancel` | Cancels booking |

### 4.6 Export — `GET /api/bookings/export`

Same query filters as list. Returns **CSV** (`text/csv`), not JSON envelope.

---

## 5. Suggested FE wiring checklist

### Barriers page

1. Site tab → build filters (`site_type` + `park_type` / `transit_park_type` / `terminal_type`).
2. KPI cards → `GET /api/barriers/summary` with those filters.
3. Table → `GET /api/barriers` with same filters + `barrier_type`, `operational_status`, `status`, `search`, pagination.
4. Create modal → `POST /api/barriers`.
5. Row disable → `PATCH /api/barriers/:id/disable`.
6. View drawer → `GET /api/barriers/:id`.

### Facility / Transit / Terminal forms

1. Barrier multiselect options → `GET /api/barriers?limit=100` (or site-scoped list).
2. Submit `entry_barrier_ids` / `exit_barrier_ids` with create/update.
3. Detail → render `entry_barriers` / `exit_barriers` (status badges ONLINE/OFFLINE).

### Bookings page

1. Summary cards → use `flagged` from summary.
2. Flagged tab → `flagged=true` (do **not** send a fake `status=FLAGGED`).
3. Detail truck card → use `booking.truck` / `current_truck_status` when present.
4. Journey commercial fields → keep “N/A” until backend journey schema ships.

### Handhelds

1. Prefer `barrier_id` in create/update.
2. Label column → `item.barrier?.barrier_id_number`.

---

## 6. Error codes to handle

| Status | Typical cause |
|--------|----------------|
| `400` | Overlapping entry/exit on same site; non-port terminal barriers; invalid manifest transition |
| `401` / `403` | Missing/invalid token or not Super Admin |
| `404` | Unknown id |
| `409` | Duplicate barrier ID; delete barrier still linked / has handheld |

---

## 7. Swagger

Interactive docs (when API is running): `/api/docs`  
Tags: **`barriers`**, **`bookings`**, facilities / transit-parks / terminals under the sites module, handhelds under app-options.

---

## 8. Related docs

| Doc | Purpose |
|-----|---------|
| `FRONTEND_BACKEND_GAP_ANALYSIS.md` | What was fixed vs deferred (product backlog) |
| `BARRIERS_LOCATIONS_FRONTEND_INTEGRATION.md` | Deeper Barriers domain rules |

---

**Bottom line for FE:** Barriers + site assignment + handhelds + bookings list/summary/flagged/truck preview are **ready to plug**. Treat journey enrichment and site “management drawer” fields as optional until a follow-up backend epic.
