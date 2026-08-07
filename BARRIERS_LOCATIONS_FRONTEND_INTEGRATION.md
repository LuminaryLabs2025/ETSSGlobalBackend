# Barriers / Locations — Frontend Integration Guide

Hand this document to the frontend team as the source of truth for the reworked Barriers flow.

**Priority used for design:** latest client requirements → new Barriers prototype → previous implementation.

---

## 1. Summary of Backend Changes

### What changed

- Barriers are now a **first-class catalog** (`barriers` table), not paired entry/exit strings on `terminal_gates`.
- A barrier can be linked to **multiple sites** (Facility, Transit Park, or Terminal) as **ENTRY** and/or **EXIT** via `barrier_site_links`.
- The same physical barrier can be ENTRY for one site and EXIT for another.
- **Restriction:** the same barrier cannot be both ENTRY and EXIT for the *same* site (e.g. one facility). The API returns `400` if the sets overlap.
- Facility / Transit Park / Terminal create & update accept `entry_barrier_ids[]` and `exit_barrier_ids[]`.
- Both list and detail endpoints for those sites now return `entry_barriers` and `exit_barriers`.
- Handheld devices preferably link to `barrier_id` (prototype “Linked Handheld”).
- User-type barrier dropdowns resolve from the new `barriers` catalog (option `value` = barrier UUID).

### What was added

| Area | Detail |
|------|--------|
| Tables | `barriers`, `barrier_site_links`; `handheld_devices.barrier_id` |
| API | Full `/api/barriers` module (CRUD, summary, disable/enable, site links) |
| Site APIs | Optional barrier assignment on create/update; barriers embedded on list and GET by id |

### What was deprecated

| Old | Replacement |
|-----|-------------|
| `POST/GET/PUT/DELETE /api/terminal-gates` | `/api/barriers` (+ site assignment) |
| Handheld create requiring only `location_id` | Prefer `barrier_id`; `location_id` optional |
| Barrier options = `entry_barrier_id` string from `terminal_gates` | Barrier UUID from `/api/barriers` / user-types options |

`locations` (type `FACILITY` + timeslots) is **unchanged** and still used for facility timeslot assignment. Do **not** confuse that table with Barriers.

### Behavioural changes

- Barrier list for the prototype “Bonded Terminals / Truck Parks / Fish-Van Parks” tabs uses **site-link rows** (filter by `site_type=FACILITY&park_type=…`).
- Pregate / EPT barriers use `transit_park_type=PREGATE` or `transit_park_type=EPT` (implies transit-park links).
- Port terminal barriers use `terminal_type=PORT_TERMINAL`. Non-port terminals do not have barriers (assignment is rejected; filter only allows `PORT_TERMINAL`).
- `operational_status` = ONLINE/OFFLINE (partner/live). `status` = ACTIVE/INACTIVE (admin disable).
- Partner access-control API is **not integrated yet**; `operational_status` is stored and updatable manually until the partner hook is added.
- `DELETE /api/barriers/:id` returns **409** while the barrier is still linked to a location or has a handheld assigned. Unlink it first, or use `PATCH /api/barriers/:id/disable`.
- Summary counts are **distinct barriers**, not links, so a barrier serving several sites is counted once per card.

---

## 2. Frontend Changes Required

### Pages / screens

1. **Infrastructure → Barriers** (new primary screen from prototype)
   - Tabs: Bonded Terminals / Truck Parks / Fish-Van Parks (and later Terminals / Transit Parks if needed)
   - KPI cards from `/api/barriers/summary`
   - Table from `/api/barriers?...`
   - Add Barrier modal → `POST /api/barriers`
   - Row actions: View → GET by id; Edit → PUT; Disable → PATCH disable

2. **Facility / Transit Park / Terminal create & edit forms**
   - Multi-select **Entry barriers** and **Exit barriers** from barrier catalog
   - Persist via `entry_barrier_ids` / `exit_barrier_ids` on create/update
   - Detail view: show linked barriers + ONLINE/OFFLINE

3. **Handheld devices**
   - Prefer assigning `barrier_id` instead of (or in addition to) `location_id`

4. **User create flows** that use `entry_barrier_id` / `exit_barrier_id`
   - Options now use **barrier UUIDs**, not legacy gate string IDs

### Components

- Replace Terminal Gates manager UI with Barriers catalog + site-link table.
- Barrier select multi-select for site forms.
- Status badges: Online (green) / Offline (red); Active vs Disabled separately.

### Types / interfaces (suggested)

```ts
type BarrierOperationalStatus = 'ONLINE' | 'OFFLINE';
type BarrierStatus = 'ACTIVE' | 'INACTIVE';
type BarrierRole = 'ENTRY' | 'EXIT';
type BarrierSiteType = 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL';

interface BarrierRow {
  id: string;
  barrier_id_number: string;
  service_provider_name: string;
  operational_status: BarrierOperationalStatus;
  status: BarrierStatus;
  barrier_type: BarrierRole | null; // set when list is site-scoped
  linked_facility: { id: string; name: string; park_type?: string } | null;
  linked_site: {
    link_id: string;
    site_type: BarrierSiteType;
    site_id: string;
    barrier_role: BarrierRole;
    site: { id: string; name: string; park_type?: string } | null;
  } | null;
  linked_sites: Array<{...}>;
  linked_handheld: { id: string; name: string; status: string } | null;
  linked_handhelds: Array<{ id: string; name: string; status: string }>;
  created_at: string;
  updated_at: string;
}
```

### Validation

- Create barrier: `service_provider_name` and `barrier_id_number` required.
- Site assignment: barrier UUIDs must exist; duplicates in the same role are ignored (deduped).
- Handheld: require `barrier_id` **or** `location_id`.

### Permissions

- Barriers APIs: JWT + **Super Admin** (same as other app-options / infrastructure).
- No new granular permission keys yet.

### Loading / empty / error

- Empty tab: “No barriers linked to this category yet — create barriers then assign them on Facility edit.”
- 409 on duplicate `barrier_id_number`.
- 404 on missing barrier/site.

---

## 3. Integration Flow (prototype journey)

```
1. SuperAdmin opens Infrastructure > Barriers
2. Select tab e.g. Bonded Terminals
     → GET /api/barriers/summary?site_type=FACILITY&park_type=BONDED_TERMINAL
     → GET /api/barriers?site_type=FACILITY&park_type=BONDED_TERMINAL&page=1&limit=20
3. Add New Barrier
     → POST /api/barriers { service_provider_name, barrier_id_number }
4. Link barrier to a facility as Entry/Exit
     Option A: Edit Facility → PUT /api/facilities/:id with entry_barrier_ids / exit_barrier_ids
     Option B: PUT /api/barriers/sites/FACILITY/:facilityId
     Option C: POST /api/barriers/:id/site-links
5. Assign handheld
     → POST /api/handheld-devices { name, barrier_id }
6. View facility detail
     → GET /api/facilities/:id  (includes entry_barriers / exit_barriers)
7. Disable barrier
     → PATCH /api/barriers/:id/disable
```

---

## 4. Endpoint Mapping

| Prototype / User Action | Frontend Action | API | Expected Result |
|-------------------------|-----------------|-----|-----------------|
| Open Barriers > Bonded Terminals | Load KPIs + table | `GET /api/barriers/summary?site_type=FACILITY&park_type=BONDED_TERMINAL` + `GET /api/barriers?site_type=FACILITY&park_type=BONDED_TERMINAL` | Counts + link rows |
| Switch to Truck Parks tab | Same with park_type | `...&park_type=TRUCK_PARK` | Filtered list |
| Switch to Fish-Van Parks | Same | `...&park_type=FISH_VAN_PARK` | Filtered list |
| Pregate barriers tab | Same with transit type | `GET /api/barriers?transit_park_type=PREGATE` (+ summary) | Pregate link rows |
| EPT barriers tab | Same | `GET /api/barriers?transit_park_type=EPT` | EPT link rows |
| Port terminal barriers | Same with terminal type | `GET /api/barriers?terminal_type=PORT_TERMINAL` | Port terminal link rows |
| Non-port terminals | N/A | — | Do not have barriers; linking them returns 400 |
| Search by name / barrier ID | Query param | `GET /api/barriers?...&search=` | Filtered rows |
| Add New Barrier → Create | Submit modal | `POST /api/barriers` | New barrier in catalog |
| View Barrier Details | Open detail | `GET /api/barriers/:id` | Full barrier + linked_sites + handhelds |
| Edit Barrier Information | Save form | `PUT /api/barriers/:id` | Updated barrier |
| Disable Barrier | Confirm disable | `PATCH /api/barriers/:id/disable` | `status=INACTIVE` |
| Create/Edit Facility with gates | Multi-select entry/exit | `POST/PUT /api/facilities` with `entry_barrier_ids` / `exit_barrier_ids` | Site links replaced for provided roles |
| View Facility barriers | Detail page | `GET /api/facilities/:id` or `GET /api/barriers/sites/FACILITY/:id` | Entry/exit barrier lists |
| Link handheld to barrier | Create/update device | `POST/PUT /api/handheld-devices` with `barrier_id` | Device shows under Linked Handheld |

---

## 5. Request / Response Examples

### Create barrier (Add Barrier modal)

```http
POST /api/barriers
Authorization: Bearer <token>
Content-Type: application/json

{
  "service_provider_name": "Access Control Co.",
  "barrier_id_number": "BR-049"
}
```

```json
{
  "success": true,
  "message": "Barrier created successfully",
  "data": {
    "id": "uuid",
    "barrier_id_number": "BR-049",
    "service_provider_name": "Access Control Co.",
    "operational_status": "OFFLINE",
    "status": "ACTIVE",
    "barrier_type": null,
    "linked_facility": null,
    "linked_sites": [],
    "linked_handheld": null,
    "linked_handhelds": []
  }
}
```

### List for Bonded Terminals tab

```http
GET /api/barriers?site_type=FACILITY&park_type=BONDED_TERMINAL&page=1&limit=20&search=EMOG
```

Response `data.data[]` rows include:

- `barrier_id_number`
- `barrier_type` (`ENTRY` | `EXIT`)
- `operational_status` (`ONLINE` | `OFFLINE`)
- `linked_facility.name`
- `linked_handheld.name`

### Summary KPI cards

```http
GET /api/barriers/summary?site_type=FACILITY&park_type=BONDED_TERMINAL
```

```json
{
  "success": true,
  "data": {
    "all": { "active": 115, "inactive": 5, "total": 120 },
    "entry": { "active": 57, "inactive": 3, "total": 60 },
    "exit": { "active": 58, "inactive": 2, "total": 60 }
  }
}
```

### Assign barriers on facility edit

```http
PUT /api/facilities/:id
{
  "name": "EMOG Bonded Terminal",
  "entry_barrier_ids": ["barrier-uuid-1", "barrier-uuid-2"],
  "exit_barrier_ids": ["barrier-uuid-3"]
}
```

Or:

```http
PUT /api/barriers/sites/FACILITY/:facilityId
{
  "entry_barrier_ids": ["barrier-uuid-1"],
  "exit_barrier_ids": ["barrier-uuid-3"]
}
```

Omitting a field leaves that role unchanged. Sending `[]` clears that role.

### Facility detail with barriers

```http
GET /api/facilities/:id
```

```json
{
  "id": "...",
  "name": "EMOG Bonded Terminal",
  "entry_barriers": [ { "id": "...", "barrier_id_number": "BR-049", "barrier_type": "ENTRY", "operational_status": "ONLINE" } ],
  "exit_barriers": [ { "id": "...", "barrier_id_number": "BR-012", "barrier_type": "EXIT", "operational_status": "OFFLINE" } ]
}
```

### Create handheld on a barrier

```http
POST /api/handheld-devices
{
  "name": "HH-001",
  "barrier_id": "barrier-uuid",
  "status": "ACTIVE"
}
```

---

## 6. Breaking Changes / Migration Notes

| Stop using | Use instead |
|------------|-------------|
| `/api/terminal-gates` for new UI | `/api/barriers` |
| Treating “location” as the barrier entity | Barrier = gate; Facility/Park/Terminal = site |
| Handheld **required** `location_id` only | Prefer `barrier_id` |
| User-type barrier option values as legacy gate strings | Barrier **UUID** (`options[].value`) |
| Expecting entry/exit only as free-text on sites | `entry_barrier_ids` / `exit_barrier_ids` |

Legacy `terminal_gates` rows are migrated into individual `barriers` on migration `1744750000000`. Site links are **not** auto-created from free-text `terminal_gates.location` — re-link via facility/park/terminal edit.

`locations` with `type=FACILITY` remains for **timeslots only**.

---

## 7. Frontend Integration Checklist

- [ ] Add Infrastructure → **Barriers** route/page
- [ ] Implement category tabs → `park_type` query mapping
- [ ] Wire summary KPI cards → `/api/barriers/summary`
- [ ] Wire barriers table → `/api/barriers` with search/filters
- [ ] Implement Add Barrier modal (`service_provider_name`, `barrier_id_number`)
- [ ] Implement View / Edit / Disable actions
- [ ] Add multi-select Entry/Exit barriers on Facility create/edit
- [ ] Same multi-select on Transit Park + Terminal create/edit
- [ ] Show entry/exit barriers + ONLINE/OFFLINE on site detail pages
- [ ] Update handheld forms to send `barrier_id`
- [ ] Update user-type barrier fields to store barrier UUIDs from hydrated options
- [ ] Remove or hide Terminal Gates UI; leave API only if needed for temporary compat
- [ ] Handle 409 duplicate barrier ID and 404 missing barrier/site
- [ ] Confirm Super Admin auth on all Barriers calls
- [ ] QA against prototype: Bonded Terminal table columns match (Barrier ID, Type, Status, Linked Facility, Linked Handheld)

---

## Assumptions

1. Prototype “Barrier Type” is the **role on a site link** (ENTRY/EXIT), not a fixed property of the barrier itself — required so one barrier can be entry for site A and exit for site B.
2. Prototype “Active vs Inactive” maps to admin `status` (ACTIVE/INACTIVE). “Online/Offline” maps to `operational_status`.
3. Partner access-control API will later refresh `operational_status`; until then it is manually updatable via `PUT /api/barriers/:id`.
4. Facility Barrier Management tabs in the prototype cover facility park types; Terminals/Transit Parks use the same link model via `site_type`.
5. Super Admin only for Barriers management (matches existing infrastructure guards).

## Outstanding risks

- Partner ONLINE/OFFLINE sync is not implemented yet.
- Legacy terminal-gates free-text locations were not auto-linked to facilities; FE/ops must re-assign.
- User profiles that stored old string barrier IDs need re-selection against the new UUID options.
