# Dashboard Overview — Frontend Integration

This is the backend for the `/dashboard` overview page (`components/dashboard/DashboardOverview.tsx` and the header in `DashboardLayout.tsx`). It replaces the mock data in `lib/mock-data.ts` and the constants defined inside `DashboardOverview.tsx`.

## Conventions

- **Auth:** send `Authorization: Bearer <accessToken>`.
- **Response envelope:** `{ success, message, data }`.
- **Field names:** snake_case.
- **Access:** SuperAdmin or a SYSTEM user type (Admin, Customer Service, Operations Verifier, Road Marshall) that holds `view_overview`.
  - External user types get `403`, even if they hold `view_overview`.
  - Hide the overview, or send them to another landing page, when `!user.is_super_admin` and the user type is external.
  - Authorising or lifting an Ops Command order is SuperAdmin only.
- **One endpoint per section:** each card loads, polls and fails on its own. Suggested polling with TanStack `refetchInterval`:
  - 30s for the corridor, lifecycle, incident and ops sections.
  - 60s for the charts and revenue.
- **Trends:** the KPI tiles and revenue cards compare the **last 7 days with the 7 days before**.
  - `trend_percentage` is the absolute % change. It is `null` when the previous window was 0, so show "—" or "New".
  - `trend_direction` is `UP`, `DOWN` or `FLAT`.
  - `higher_is_better` tells you how to colour the arrow. For a TAT or exceptions tile, `DOWN` is good news.
- **Chart period filter (optional):** `date_preset` = `DAILY` | `WEEKLY` | `MONTHLY` | `YEARLY` | `CUSTOM`. `CUSTOM` takes `date_from` and, optionally, `date_to`. Omit the filter for all time.

Base path: **`/api/dashboard/overview`**

| Section on the page | Endpoint |
|---|---|
| Header pill "e-Revenue: ₦…" + e-Revenue Breakdown cards | `GET /revenue` |
| Corridor status banner | `GET /corridor` |
| Red-Zone button (drill-down) | `GET /red-zone` |
| Executive Intelligence Dashboard | `GET /executive` |
| Booking → Manifest Lifecycle | `GET /lifecycle` |
| Live Bookings by Terminal | `GET /bookings-by-terminal` |
| Live Matchings by Facility | `GET /matchings-by-facility` |
| Recent Bookings / Recent Matchings tabs | `GET /recent-activity?type=bookings\|matchings&limit=5` |
| Bookings by transfer types (donut) | `GET /bookings-by-category` |
| Incident notification board + tow banner | `GET /incident-board?limit=5` |
| Operations Command & Control | `GET /ops-command`, `GET/POST /ops-command/orders`, `PATCH /ops-command/orders/:id/lift` |

### Frontend checklist

1. **Endpoints:** add `DASHBOARD_OVERVIEW` endpoints to `api/endpoints.ts`, a `dashboard-overview.service.ts`, and one TanStack hook per section, following the `useBookingsSummary` pattern.
2. **Remove mocks:** replace `totalRevenue`, `dashboardStats`, `revenueCards`, `bookingsByTerminal`, `matchingsByTerminal`, `recentBookings` and `recentMatchings` (in `lib/mock-data.ts`). Also replace these constants inside `DashboardOverview.tsx`: `corridorLive`, `manifestLifecycleGroups`, `BOOKINGS_BY_CATEGORY_MOCK_VALUES`, `incidentNotifications` and `opsCommandActions`.
3. **Access:** only render the overview for SuperAdmin and system staff, and handle `403` gracefully.
4. **Labels:**
   - Relabel "Active terminals" to "Active sites".
   - Rename "Live Matchings by Terminal" to "… by Facility".
   - Drive the congestion styling from `in_red_zone`.
5. **Trend arrows:** use `trend_direction` and `higher_is_better`, including on the revenue cards.
6. **Wire up the dead buttons:**
   - Red-Zone opens a drawer.
   - The "View All" buttons link to the bookings page.
   - Tow "Dispatch" opens the manifest page.
   - The Ops cards authorise and lift orders (SuperAdmin only).
7. **Loading and empty states:** handle these per card. Show the TAT tiles' `display: null` as "—".

---

## `GET /revenue`

```json
{
  "currency": "NGN",
  "total_amount": 5440000,
  "cards": [
    { "source": "BOOKING", "label": "From Bookings", "amount": 2535000, "last_7_days": 410000, "previous_7_days": 346000, "trend_percentage": 18.5, "trend_direction": "UP" },
    { "source": "PENALTY", "label": "From Penalties", "amount": 0, "...": "..." },
    { "source": "UTILITY_TICKET", "label": "From Utility Tickets", "amount": 0, "...": "..." },
    { "source": "TOW_TRUCK_REQUEST", "label": "From Tow Truck Requests", "amount": 0, "...": "..." }
  ]
}
```

- `total_amount` feeds the header pill. It is all-time successful revenue from the e-Revenue ledger.
- Only bookings take payments today, so Penalties, Utility Tickets and Tow Requests read **₦0** until those payment flows are built. This is expected.
- `RevenueStrip` always shows the trend as `+x%` in green. Use `trend_direction` instead.

## `GET /corridor`

```json
{
  "live_movements": 54,
  "live_bookings": 120,
  "active_sites": { "total": 16, "terminals": 6, "facilities": 5, "transit_parks": 5 },
  "verified_trucks_on_corridor": 47,
  "verified_drivers_on_corridor": 40,
  "congestion": { "index": 78, "threshold": 70, "level": "RED_ZONE", "in_red_zone": true, "red_zone_site_count": 3 },
  "last_updated": "…"
}
```

| Tile | Field |
|---|---|
| Live movements ("Trucks in active transit") | `live_movements`: LIVE trucks en route to a facility, pregate or terminal |
| Active terminals | `active_sites.total`. Suggest relabelling to "Active sites" and showing the breakdown in a tooltip |
| Verified trucks ("On corridor now") | `verified_trucks_on_corridor` |
| Footer "N verified drivers active across the corridor" | `verified_drivers_on_corridor` |
| Congestion index `/100` | `congestion.index`. Use red styling when `congestion.in_red_zone`, instead of the hardcoded `>= 70` |

**Congestion index:** trucks currently on site ÷ holding capacity, across active facilities, transit parks and terminals.

- A terminal's holding capacity is `approved_trucks_per_hour × hourly_truck_tat_minutes ÷ 60`.
- The threshold is set on the server and defaults to 70. Always read it from `congestion.threshold` instead of hardcoding it.
- `level`:
  - `NORMAL` below 70% of the threshold
  - `ELEVATED` from 70% of the threshold up to the threshold
  - `RED_ZONE` at or above the threshold

## `GET /red-zone`

The **Red-Zone** button has no handler today. Open a drawer or modal with this data:

```json
{
  "index": 78, "threshold": 70, "level": "RED_ZONE", "in_red_zone": true,
  "total_capacity": 3840, "total_occupied": 2995, "red_zone_site_count": 3,
  "sites": [
    { "site_type": "TRANSIT_PARK", "id": "…", "name": "Lilypond Transit Park", "code": "TP-001", "kind": "PREGATE", "kind_label": "Pregate", "park_type_label": "Pregate", "capacity": 300, "occupied": 288, "utilisation_percentage": 96, "in_red_zone": true }
  ]
}
```

- `sites` is sorted from most to least congested.

## `GET /executive`

Each tile has this shape:

```json
{ "value": 1284, "previous": 1126, "trend_percentage": 14, "trend_direction": "UP", "higher_is_better": true }
```

The six tiles are `live_bookings`, `verified_trucks`, `verified_drivers`, `avg_tat_apapa`, `avg_tat_tincan` and `exceptions`. Notes per tile:

| Tile | `value` | Trend |
|---|---|---|
| `live_bookings` | Bookings currently LIVE | Bookings created this week vs last week |
| `verified_trucks` | All MSS-verified trucks | Growth over the week |
| `verified_drivers` | All verified drivers | Growth over the week |
| `avg_tat_apapa`, `avg_tat_tincan` | Hours (1 dp). Also carries `display` (`"4.2h"`, or `null` when there's no data), `minutes` and `unit: "HOURS"` | `higher_is_better: false` |
| `exceptions` | LIVE flagged bookings (booking exceptions or a FLAGGED truck) | Exceptions raised this week vs last week. `higher_is_better: false` |

- **TAT** is the average time from booking to entering the terminal, for bookings that reached an Apapa or Tincan terminal in the window. The location comes from `terminals.location`.

## `GET /lifecycle`

```json
{
  "total_live": 120,
  "groups": [
    { "key": "BOOKING_TRANSIT", "label": "Booking & Transit", "items": [
      { "key": "AVAILABLE", "label": "Available", "description": "Verified truck ready for booking", "count": 48 },
      { "key": "ON_TRIP", "label": "On Trip", "description": "Booked and on the road — to facility, pregate or terminal", "count": 31 } ] },
    { "key": "FACILITY", "label": "Facility", "items": [ "IN_FACILITY", "MATCHED", "GTG_FACILITY", "LEFT_FACILITY" ] },
    { "key": "PREGATE", "label": "Pregate", "items": [ "IN_PREGATE", "GTG_PREGATE", "LEFT_PREGATE" ] },
    { "key": "TERMINAL", "label": "Terminal", "items": [ "IN_TERMINAL", "LEFT_TERMINAL" ] }
  ]
}
```

- The shape matches `manifestLifecycleGroups` (`label`, `items[].stage` → `label`, `count`, `description`), so it can replace that constant directly.
- **Left Terminal** counts trucks that exited the terminal **today**.

**Left Terminal is a new stage on bookings:**

- **Trigger:** a terminal EXIT barrier tag, or `PATCH /api/bookings/:id/mark-left-terminal` (SuperAdmin).
- **Effect:** sets `left_terminal_at` and completes the booking (`status: COMPLETED`, `completed_at`), and frees the truck and driver.
- **Response:** booking responses now include `left_terminal_at`.

## `GET /bookings-by-terminal` *(period filter)*

```json
{ "period": { "from": null, "to": null },
  "data": [ { "terminal_id": "…", "terminal": "PTML", "live": 1, "completed": 9, "cancelled": 0, "expired": 0, "total": 10 } ] }
```

- Bookings are grouped by destination terminal and sorted by `total`.
- The Recharts keys `live`, `completed` and `cancelled` match the existing chart.
- `expired` is also returned.
- "View All" can link to `/dashboard/bookings`.

## `GET /matchings-by-facility` *(period filter)*

```json
{ "data": [ { "facility": "APM Terminals Apapa", "truck_entry_permits": 4200, "matched": 3800, "unmatched": 400 } ] }
```

- Truck Entry Permits are grouped by the facility they were issued for, which matches the card subtitle.
- Rename the chart title to "Live Matchings by Facility".
- Use `facility` as the x-axis key and rename `truckEntry` to `truck_entry_permits`.

## `GET /recent-activity`

`?type=bookings` merges truck bookings and utility tickets, newest first:

```json
{ "type": "bookings", "data": [
  { "kind": "BOOKING", "id": "…", "reference": "BKG-2026-008447", "title": "Truck Booking", "plate_number": "AAA123XY", "party": "ABC Logistics", "destination": "APM Terminals", "status": "ON_TRIP", "status_label": "On Trip", "occurred_at": "…" },
  { "kind": "UTILITY_TICKET", "id": "…", "reference": "UT-0012", "title": "Utility Ticket", "plate_number": "MN1440D", "party": "APM Terminals Apapa", "destination": "APM Terminals Apapa", "status": "PENDING", "status_label": "Pending", "occurred_at": "…" } ] }
```

- For a LIVE booking, `status_label` is its current stage, worded as on the lifecycle cards: On Trip, In Facility, Matched, GTG Facility, Left Facility, In Pregate, GTG Pregate, Left Pregate or In Terminal.
- Otherwise it is Completed, Cancelled or Expired.

`?type=matchings`:

```json
{ "type": "matchings", "data": [ { "id": "…", "booking_id": "BKG-…", "facility": "BNSC Bonded Terminal", "plate_number": "AAA123XY", "category": "Empty Container", "destination": "APM Terminals", "booked_by": "ABC Logistics", "matched_at": "…" } ] }
```

## `GET /bookings-by-category` *(period filter)*

```json
{ "total": 156, "data": [ { "category_id": "…", "name": "Import Container", "count": 34, "percentage": 21.8 } ] }
```

- Results are grouped by the admin-defined booking category.
- Older bookings without one fall back to the legacy category (`Import`, `Export`, …), and `category_id` is `null` for those.
- Map colours by `name` rather than relying on a fixed list.

## `GET /incident-board`

```json
{
  "open_total": 5,
  "data": [ { "id": "…", "reference_id": "INC-2026-000031", "title": "Truck Breakdown · Apapa Corridor", "type": "TRUCK_BREAKDOWN", "type_label": "Truck Breakdown", "location_name": "Apapa Corridor", "severity": "CRITICAL", "severity_label": "Critical", "status": "IN_PROGRESS", "status_label": "In Progress", "reported_at": "…", "reported_by": "LASTMA Patrol" } ],
  "tow_requests": { "pending_left_manifest": 1 }
}
```

- Only open incidents are returned, most severe first and then newest.
- `OPEN` is labelled "New".
- Build "reported 3d ago" from `reported_at`.
- Each row can link to `/dashboard/incidents`. There is no per-incident route yet.
- **Tow banner:** show it when `tow_requests.pending_left_manifest > 0`. "Dispatch" should go to the manifest page (`/dashboard/bookings/manifest`), Left-Manifest tab.

---

## Operations Command & Control

The "AI-Powered" recommendations are **rule-based** for now.

- The SuperAdmin authorises an action.
- The order is logged and emailed to LASTMA / Ops Control. Until their addresses are configured on the server, the email goes to every active SuperAdmin.
- It stays **ACTIVE** until it is lifted.
- **Authorising does not block bookings or releases.** It is an instruction to the field teams.

### `GET /ops-command`

```json
{
  "congestion": { "index": 78, "threshold": 70, "level": "RED_ZONE" },
  "actions": [
    {
      "action": "SUSPEND_RED_ZONE_DISPATCH",
      "title": "Suspend dispatch into Red Zone",
      "description": "Halt new releases toward the congested corridor",
      "recommended": true,
      "reason": "2 site(s) at or above 70% capacity: Lilypond Transit Park (96%), MOB (81%)",
      "targets": [ { "type": "TRANSIT_PARK", "id": "…", "name": "Lilypond Transit Park" } ],
      "active_orders": []
    }
  ],
  "notification": { "source": "CONFIGURED", "recipient_count": 2 }
}
```

When each action is recommended, and what it targets:

| `action` | Recommended when | `targets` |
|---|---|---|
| `SUSPEND_RED_ZONE_DISPATCH` | Any site is at or above the threshold | The red-zone sites |
| `REROUTE_CORRIDOR_TRAFFIC` | The corridor index is in the red zone, or there is an open HIGH/CRITICAL gate-congestion incident | The red-zone sites |
| `ACTIVATE_OVERFLOW_HOLDING` | A facility or park is in the red zone **and** another is below 50% | The sites with spare capacity |
| `BROADCAST_DIVERSION_ADVISORY` | There is an open HIGH/CRITICAL congestion, breakdown or accident incident, or the corridor is in the red zone | none |
| `PRIORITY_MOVEMENT` | Fish or EPT (priority 1) trucks have waited more than 60 minutes at GTG-Facility or GTG-Pregate | The waiting bookings |

**UI suggestions:**

- Highlight cards where `recommended` is true and show `reason`.
- Show an "Active" badge when `active_orders` is non-empty, with a **Lift** action.
- Only render the authorise buttons for `user.is_super_admin`.

### `POST /ops-command/orders` (SuperAdmin)

```json
{ "action": "SUSPEND_RED_ZONE_DISPATCH", "targets": [ { "type": "TRANSIT_PARK", "id": "…", "name": "Lilypond Transit Park" } ], "notes": "Hold Apapa releases" }
```

- `targets` is optional. It defaults to the current recommendation's targets.
- `SUSPEND_RED_ZONE_DISPATCH` and `PRIORITY_MOVEMENT` need at least one target, or the API returns `400`.
- Returns `409` if the same action is already active. The exception is `PRIORITY_MOVEMENT`, where several convoys can be active at once.

Response:

```json
{
  "id": "…", "reference_id": "OPS-2026-000001", "action": "…", "title": "…", "status": "ACTIVE",
  "targets": [ … ], "notes": "…", "was_recommended": true, "recommendation_reason": "…", "congestion_index": 78,
  "authorised_by": { "id": "…", "name": "Super Admin" }, "authorised_at": "…",
  "notified_recipients": [ "…" ], "notified_at": "…", "notification_error": null,
  "lifted_at": null, "lifted_by": null, "lift_reason": null
}
```

- When `notification_error` is set, the order was saved but the email failed or there were no recipients. Show a warning.
- `notification.source` on `GET /ops-command` is `CONFIGURED` (LASTMA / Ops Control addresses) or `SUPER_ADMINS` (the fallback). You can show it as a hint in the authorise dialog.

### `PATCH /ops-command/orders/:id/lift` (SuperAdmin)

- Body: `{ "reason": "Congestion cleared" }`. Returns the order with `status: LIFTED`.
- The recipients are emailed.

### `GET /ops-command/orders`

- Paginated order log. Filters: `status` (`ACTIVE` or `LIFTED`), `action`, `page` and `limit`.

---

## Not covered by this work

- **Notifications bell:** there is no in-app notifications feed yet, so leave the badge hidden or static.
- **Header quick links and the profile chip:** unchanged.
