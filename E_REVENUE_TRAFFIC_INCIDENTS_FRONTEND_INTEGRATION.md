# e-Revenue, Traffic Command & Incident Reports — Frontend Integration

Backend for MVP 081–085 (e-Revenue), MVP 086–088 (Traffic Command & Coordination) and MVP 090 (Incident Reports). It replaces the mock data in `lib/e-revenue-mock-data.ts`, `lib/traffic-command-mock-data.ts` and `lib/incidents-mock-data.ts`.

## Conventions

These are the same as for bookings and payments:

- **Auth:** `Authorization: Bearer <accessToken>`.
- **Envelope:** `{ success, message, data }`.
- **Lists:** `data` is `{ data: [...], meta: { total, page, limit, total_pages } }`, with `page` defaulting to 1 and `limit` to 20 (max 100).
- **Field names** are snake_case. The mock types are camelCase, so rename when wiring up (e.g. `amountNgn` becomes `amount_paid`).
- **Exports** are `GET …/export` with the same query params as the list. Request them with `responseType: "blob"`; the response is `text/csv`.
- **Date filter** (shared): `date_preset` = `DAILY` (today) | `WEEKLY` (last 7 days) | `MONTHLY` (last 30 days) | `YEARLY` (last 365 days) | `CUSTOM`.
  - `CUSTOM` needs `date_from` and accepts an optional `date_to` (`YYYY-MM-DD`, which covers whole days, or a full ISO timestamp).
  - Omit `date_preset` for no date bound. The OCC endpoints are the exception: they default to `WEEKLY`.
- **Access:** SuperAdmin passes every permission check. Other users need the permission named for each section.

---

## 1. e-Revenue — `/api/e-revenue`

**Tabs.** The `:module` route param takes the frontend's own ids:

| `:module` | Tab | "Amount Due" column = | Pie grouped by | Source cards |
|---|---|---|---|---|
| `etss` | Maritime-ETSS | Maritime-ETSS share | payment source | Bookings, Utility Tickets, Penalties, Tow Truck Requests, Demurrage |
| `npa` | NPA | NPA share | payment source | Bookings, Utility Tickets, Tow Truck Requests, Penalties |
| `facilities` | Facilities | facility share | facility | Bookings, Demurrage |
| `transit` | Transit Parks | transit park share | transit park | Bookings, Demurrage |
| `tow` | Tow Truck Companies | tow company share | tow company | Tow Truck Requests |

**Sub-tabs** (All / Bookings / Utility Tickets / …) map to `payment_source=BOOKING|UTILITY_TICKET|PENALTY|TOW_TRUCK_REQUEST|DEMURRAGE`. Omit it for **All**.

**Endpoints:**

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /total` | view_e_revenue | Header badge "e-Revenue: NGN…" → `{ total_amount_paid, total_etss_share, entries }` |
| `GET /:module/summary` | view_e_revenue | Revenue cards |
| `GET /:module/breakdown` | view_e_revenue | Pie chart |
| `GET /:module/transactions` | view_e_revenue | Transactions table (paginated) |
| `GET /:module/export` | export_e_revenue | CSV export, with the wireframe columns (Payment Source only on **All**) |
| `GET /transactions/:id` | view_e_revenue | "View payment details" |
| `GET /fee-schedule` | view_e_revenue | Fee schedule: amount, payer and recipient split per payment type. Params: `status`, `linked_form` |
| `POST /ledger/sync` | manage_e_revenue | Backfill the ledger from existing payments (run once after deploy) |

**Query params** (summary, breakdown, transactions and export):
- `search`: matches transaction ID, payment ref, invoice no., booking ID, payer name and plate.
- `payment_source`
- `payment_method`: `CARD|BANK_TRANSFER|USSD|WALLET|PAYSTACK`. `PAYSTACK` means the channel isn't known yet.
- `status`: `SUCCESSFUL|PENDING|FAILED|ABANDONED`. Omitting it hides abandoned checkouts.
- `date_preset`, `date_from`, `date_to`
- `amount_min`, `amount_max`: these apply to the amount the tab displays (gross on `etss`, the beneficiary share elsewhere).
- `facility_id`, `transit_park_id`, `tow_company_id`
- `sort_by`: `transacted_at|amount_paid|amount_due|payment_source|status|payer_name|transaction_id`
- `sort_order`: `ASC|DESC`
- `page`, `limit`

**Summary response:**
```json
{ "module": "etss", "title": "Maritime-ETSS", "currency": "NGN", "date_range": { "from": null, "to": null },
  "total_amount_paid": 15000, "total_amount_due": 6000, "total_entries": 1, "pending_count": 0, "failed_count": 1,
  "by_source": [{ "source": "BOOKING", "label": "Bookings", "amount_paid": 15000, "amount_due": 6000, "entries": 1 }, ...] }
```
Totals count **successful** payments only. `amount_paid` is gross; `amount_due` is this tab's share.

**Breakdown (pie) response:** `{ total, slices: [{ key, label, value, entries, percentage }] }`. Slices are sorted largest first; assign colours on the frontend.

**Transaction row:**
```json
{ "id": "uuid", "transaction_id": "TID-0000001", "payment_reference": "MTMS-…", "invoice_number": "INV-2026-000001",
  "payment_source": "BOOKING", "payment_source_label": "Bookings",
  "payer": { "type": "Transporter", "company_id": "…", "company_name": "ABC Logistics", "user_id": "…", "user_name": "Femi Okunlola", "email": "…" },
  "payer_display": "Transporter: ABC Logistics / User: Femi Okunlola",
  "amount_paid": 15000, "amount_due": 6000, "currency": "NGN", "payment_method": "CARD", "channel": "card",
  "status": "SUCCESSFUL", "paid_at": "…", "transacted_at": "…",
  "linked_reference": { "kind": "BOOKING", "id": "<booking uuid>", "reference": "BKG-2026-008421" },
  "facility": { "id": "…", "name": "Josepdam Bonded Terminal" }, "transit_park": null, "tow_company": null,
  "truck_plate_number": "AAA111AA", "terminal_name": "APM Terminals",
  "shares": { "etss": 6000, "npa": 4000, "facility": 5000, "transit_park": 0, "tow_company": 0 },
  "share_percentages": { "facility": 33.33, "transit_park": 0, "npa": 26.67, "etss": 40, "tow_company": 0 } }
```
**Detail response** (`GET /transactions/:id`): the same fields without `amount_due` (every share is in `shares`), plus `invoice_id`, `payment_transaction_id`, `fee_lines`, `gateway_response`, `created_at` and `updated_at`.

**Fee schedule (editable amounts and splits).** This follows the PO's "e-Revenue for Maritime ETSS" sheet. Every chargeable use case is a **Payment Type** with an editable amount, a payer and a revenue-recipient split. SuperAdmin edits them in **App Options → Payment Types**, using the existing endpoints:
- `POST /api/payment-types`
- `PUT /api/payment-types/:id`

Each payment type now carries five percentage fields, which must total exactly 100 (otherwise 400):
- `facility_percentage`
- `transit_park_percentage`
- `npa_percentage`
- `etss_percentage`
- `tow_company_percentage`

On update, any you omit keep their current value. On create, omitting all five means 100% Maritime-ETSS. **PaymentTypesPanel needs these five inputs**, and the amount input it already has covers editable prices.

Seeded defaults (`npm run seed`, create-only, so the seed never overwrites a SuperAdmin edit):

| Payment type (one row per form) | Paid by | Amount | Facility | Transit Park / Pregate | NPA | Maritime ETSS | Tow Truck Co. |
|---|---|---|---|---|---|---|---|
| Payment for Facility Bay - Bonded Terminal / Truck Park / Fish-Van Park | Transporter | 5,000 | 100% | | | | |
| Payment for Transit Park Bay - EPT | Transporter | 5,000 | | 100% | | | |
| Matching Fee - Bonded Terminal / Truck Park / Fish-Van Park / EPT | Transporter | 10,000 | | | 40% | 60% | |
| Tow Truck Request | Transporter | 100,000 | | | 8% | 12% | 80% |
| Utility Ticket | Terminal Operator | 5,000 | | | 40% | 60% | |

How the schedule is applied:
- **Invoices sum the form's payment types.** A booking form's invoice is the sum of its ACTIVE payment types, one fee line each. For example, a Bonded Terminal booking is 5,000 Facility Bay + 10,000 Matching Fee = 15,000, which splits facility 5,000 / NPA 4,000 / Maritime-ETSS 6,000.
  - To stop charging the matching fee at booking, deactivate its row.
  - A form can't have two ACTIVE rows with the same `service_name` (409).
- **Splits are snapshotted per fee line** when the invoice is raised. Editing a price or split only affects payments raised after the edit.
- **Fallback to Maritime-ETSS.** A recipient the payment doesn't relate to (e.g. a facility share on a booking with no facility, or a tow share before a tow company is assigned) goes to Maritime-ETSS.
- **Overcharge guard.** If a booking form already has active payment types configured outside this schedule, the seed adds the schedule rows as **INACTIVE**, so fees are never stacked. Review and activate them in App Options.
- **Read view:** `GET /api/e-revenue/fee-schedule` returns each row with `paid_by`, `amount` and `recipients: [{ recipient, label, percentage, amount }]`, in the sheet's column order.
- **Detail view:** `GET /transactions/:id` also returns `fee_lines: [{ name, service_name, amount, split, shares }]`.

> **Annual Subscription for each Facility or Transit Park (50,000)** has no payment flow yet and no recipient split on the sheet. SuperAdmin can create it as a Payment Type now (it defaults to 100% Maritime-ETSS). Charging it needs a subscription flow, so it needs confirming with the PO.

**Live data.** The ledger updates in the same DB transaction as every Paystack status change, so polling (e.g. `refetchInterval: 15_000`) replaces `useRevenueLiveTick`.

> Today only **bookings** take payments. Utility tickets, penalties, tow requests and demurrage cards return 0 until those modules start raising invoices; their ledger rows will then appear with no frontend changes.

---

## 2. Traffic Command — `/api/traffic-command`

All `GET` endpoints require `view_traffic_command`.

### Live Truck Updates

Every **LIVE** booking is one truck. Its stage is derived from the booking's lifecycle timestamps:

`ENROUTE_FACILITY → IN_FACILITY → MATCHED → GTG_FACILITY → ENROUTE_PREGATE → IN_PREGATE → GTG_PREGATE → ENROUTE_TERMINAL → IN_TERMINAL`

The labels match the wireframe columns ("Enroute-Facility", "In-Facility", …) and are returned in the API.

- **`GET /live-trucks/summary`** returns the status cards:
  `{ total_bookings, on_trip, left_facility, left_pregate, in_terminal, by_stage: [{ stage, label, count }], last_updated }`
  - `on_trip` counts all three Enroute stages.
  - `left_facility` = Enroute Pregate; `left_pregate` = Enroute Terminal.
- **`GET /live-trucks/matrix`** returns the "Truck Real-Time Activity" grid, one row per facility or EPT:
  ```json
  { "columns": [{ "stage": "ENROUTE_FACILITY", "label": "Enroute-Facility" }, ...],
    "data": [{ "s_no": 1, "location": { "id", "type": "FACILITY|TRANSIT_PARK", "name", "code", "park_type", "park_type_label": "Bonded Terminal" },
               "total": 85,
               "stages": [{ "stage": "IN_FACILITY", "label": "In-Facility", "count": 12,
                            "trucks": [{ "booking_uuid", "booking_id", "truck_plate_number", "driver_name", "since" }], "more": 10 }] }],
    "meta": { ... } }
  ```
  - `cell_limit` (default 2) is the number of plates returned per cell. Render `more` as "+N".
  - Plates within a cell are oldest first (FIFO).
- **`GET /live-trucks`** is the flat list for the By Status / By Route tables. Each row has `stage`, `stage_label`, `stage_group` (route grouping), `current_location`, `destination`, `since` and the truck and driver.
- **Query params:**
  - `booking_type`: `BONDED_TERMINAL|TRUCK_PARK|FISH_VAN_PARK|EPT`. This drives the "Filter By: Bonded Terminals / Truck Parks / Fish-Van Parks" control.
  - `location_id`, `stage`
  - `search`: plate number, booking ID or driver
  - `page`, `limit`

### Live Location Updates (map)

**`GET /locations`** accepts `kind=FACILITY|FACILITY_PREGATE|PREGATE|EPT|TERMINAL`, `park_type`, `search` and `online=true|false`. It returns:
```json
{ "summary": { "total_locations", "visible", "online", "offline", "with_coordinates", "by_kind": { "FACILITY": 3, ... }, "avg_atat_minutes" },
  "data": [{ "id", "site_type", "kind", "kind_label", "name", "code", "park_type", "park_type_label", "address",
             "latitude": 6.4474, "longitude": 3.3903, "status", "online": true, "capacity": 480, "trucks_on_site": 12,
             "atat_minutes": 103, "atat_label": "1hr 43mins",
             "entry_gate": { "status": "ONLINE|OFFLINE|NOT_CONFIGURED", "online": true, "trucks_tagged_last_hour": 18,
                             "barriers": [{ "id", "barrier_id_number": "BR-049", "service_provider_name", "operational_status", "status", "online", "trucks_tagged_last_hour" }] },
             "exit_gate": { ... } }] }
```
- **Coordinates:** `latitude` and `longitude` are new optional fields on the create/update payloads for **terminals, transit parks and facilities** (and come back in their responses). Locations without coordinates come back with `null` and can't be pinned until an admin sets them, so the Terminals / Transit Parks / Facilities forms need these inputs.
- **Legend colours:** Facilities, Facility-Pregates, Pregates, EPTs, plus Terminals, all keyed on `kind`.
- **`trucks_tagged_last_hour` and ATAT** come from barrier tag events, described next. Facilities and EPTs fall back to booking timestamps for ATAT.

### Barrier tag events

**`POST /barrier-events`** records a truck tagged at a barrier. It's intended for barrier, ANPR or handheld integrations.
- **Who can call it:** SuperAdmin, holders of `manage_traffic_command`, or the user assigned an ACTIVE handheld device on that barrier.
- **Body:**
  ```json
  { "barrier_id_number": "BR-049", "truck_plate_number": "AAA111AA", "tagged_at": "optional ISO", "source": "BARRIER|HANDHELD|MANUAL" }
  ```
  - Instead of the barrier number you can send `barrier_id`, and instead of the plate, `rfid_tag_number`.
  - If the barrier serves several sites or roles, also send `site_type`, `site_id` and `barrier_role`.
- **Booking transitions:** the tag is matched to the truck's LIVE booking and advances it automatically:

  | Tag | Booking condition | Result |
  |---|---|---|
  | EXIT at the booked facility or EPT | after GTG-Facility | **left-facility** |
  | EXIT at a Pregate or Facility-Pregate | after GTG-Pregate | **left-pregate**; also adds the booking to Today's Manifest |
  | ENTRY at the destination terminal | — | **in-terminal** |

- **Response:** includes `booking: { booking_id, transition, transition_error }`.

**`GET /barrier-events`** is the tag log. It takes `barrier_id`, `site_type`, `site_id`, `barrier_role`, `search` (plate) and the date filter.

New manual booking actions are also available, like the existing mark-in-facility: `PATCH /api/bookings/:id/mark-left-facility`, `/mark-left-pregate` and `/mark-in-terminal`. Booking responses now include `left_facility_at` and `in_terminal_at`.

### OCC dashboard

- **`GET /occ/overview?date_preset=WEEKLY`** returns:
  - `trucks`: same shape as the live-truck summary
  - `facility_capacity`, `transit_park_capacity`: `[{ id, name, code, kind, park_type, park_type_label, capacity, occupied, utilisation_percentage }]`
  - `facility_tat_by_category`: `[{ category, minutes, label, trucks }]`
  - `truck_destinations`: `[{ name, value }]`
  - `terminals`: `[{ id, name, code, approved_daily_truck_capacity, trucks_arrived, trucks_in_terminal, atat_minutes, atat_label }]`
  - `terminal_hourly_arrivals`: `[{ hour, terminal_id, terminal_name, trucks }]` over the last 24 hours. Pivot it by terminal for the chart; terminal names are no longer hard-coded keys.
  - `emergencies`: `{ active_tow_requests, active_breakdowns, active_accidents }`
  - `cancelled_bookings`: `{ total }`
- **`GET /occ/emergencies`** takes `emergency_type=TOW_TRUCK|BREAKDOWN|ACCIDENT`, `active=true|false`, `search` and the date filter.
  - Rows: `{ id, source: "BOOKING_TOW_REQUEST|INCIDENT", emergency_type, reference, booking_id, truck_plate_number, driver_name, driver_id, current_location, timestamp, status, active, details, tow_company }`
  - The response also carries `summary: { total, active, by_type }`.
- **`GET /occ/cancelled-bookings`** takes `search` (booking ID, plate or driver) and the date filter, and has a matching `/export`.
  - Rows: `{ id, booking_id, truck_plate_number, driver_name, category, booking_type, location_name, reason, cancelled_by, cancelled_at }`
- **Not served by the backend:**
  - **Terminal downtime** has no data source yet. Downtime reports can be filed as incidents of type `SYSTEM_DOWNTIME`.
  - **AI command actions** stay static UI.

---

## 3. Incident Reports

### SuperAdmin — `/api/incidents`

Permissions: `view_incident_reports` for reads, `manage_incident_reports` for actions.

| Method & path | Body | Effect |
|---|---|---|
| `GET /summary` | — | `{ open, pending_approval, resolved, total, overdue, by_status[], open_by_severity[] }`. "Live/Open" card = `open`, "Resolved" card = `resolved` (RESOLVED + CLOSED) |
| `GET /` | — | List. Params: `search` (reference ID, also plate / location / reporter company), `type`, `severity`, `status`, `status_group=OPEN\|PENDING_APPROVAL\|RESOLVED` (the "All" tabs), `location_kind`, `assigned_company_id`, date filter, `page`, `limit` |
| `GET /export` | — | CSV |
| `GET /:id` | — | Full details (shape below) |
| `GET /assignees/companies?search=` | — | Teams (companies) for the reassign picker → `[{ id, name, user_type }]` |
| `GET /assignees/users?company_id=` | — | Users in that team → `[{ id, name, email, account_type }]` |
| `PATCH /:id/assign` | `{ assigned_company_id?, assigned_user_id?, note? }` | Assign or reassign. A user alone defaults the team to the user's company |
| `PATCH /:id/severity` | `{ severity, reason? }` | Change severity level |
| `PATCH /:id/deadline` | `{ priority_deadline: ISO }` | Set priority deadline (must be in the future) |
| `POST /:id/comments` | `{ body, kind: "COMMENT"\|"INSTRUCTION" }` | Add instructions or comments |
| `POST /:id/escalate` | `{ level: "MANAGEMENT"\|"NPA"\|"EXECUTIVE", notes? }` | Escalate to management / regulatory agency (NPA) |
| `POST /:id/request-evidence` | `{ message }` | Request more evidence (`evidence_requested: true` until the reporter uploads) |
| `POST /:id/emergency-response` | `{ action: "DISPATCH_TOW_TRUCK"\|"NOTIFY_EMERGENCY_SERVICES"\|"DISPATCH_SECURITY"\|"ALERT_TRAFFIC_CONTROL"\|"LOCKDOWN_GATE"\|"OTHER", notes? }` | Trigger emergency response |
| `PATCH /:id/approve-resolution` | `{ notes? }` | PENDING_SUPERADMIN_APPROVAL → CLOSED; computes `sla_met` against the deadline |
| `PATCH /:id/reject-resolution` | `{ reason }` | → REOPENED and adds a REJECTION note |
| `PATCH /:id/resolve` | `{ resolution_notes, root_cause?, corrective_action? }` | SuperAdmin resolves directly (→ RESOLVED) |
| `PATCH /:id/reopen` | `{ reason }` | RESOLVED or CLOSED → REOPENED |

**Lifecycle:** `OPEN → ASSIGNED → IN_PROGRESS → PENDING_SUPERADMIN_APPROVAL → CLOSED`.
- A rejected resolution goes back to `REOPENED`.
- RESOLVED and CLOSED incidents are locked until reopened.
- Every action returns the full incident detail, so the drawer can re-render from the response.

**Detail shape** (list rows are the first block, without `related` onwards):
```json
{ "id", "reference_id": "INC-2026-000001", "type", "type_label", "description", "severity", "status", "status_label",
  "location": { "kind", "kind_label", "id", "name" }, "reported_at",
  "reporter": { "id", "name", "email", "company_id", "company", "is_primary_account_user": true },
  "assigned_team", "assigned_company_id", "assigned_user": { "id", "name", "email" }, "assigned_at",
  "priority_deadline", "overdue", "escalation_level", "evidence_requested", "emergency_action",
  "related": { "truck_id", "truck_plate", "driver_id", "driver_name", "booking_uuid", "booking_id" },
  "payment_reference", "escalated_at", "evidence_requested_at", "emergency_triggered_at",
  "evidence": [{ "id", "label", "type": "PHOTO|FILE", "url", "phase", "uploaded_by", "created_at" }],
  "timeline": [{ "id", "event_type", "title", "detail", "actor", "timestamp" }],
  "notes": [{ "id", "kind": "COMMENT|INSTRUCTION|REJECTION", "author", "team", "body", "timestamp" }],
  "actions_taken": ["Assigned to RapidTow Nigeria / Tunde Tow", "Escalated to Regulatory Agency (NPA)", ...],
  "resolution": { "root_cause", "corrective_action", "resolution_notes", "submitted_at", "resolved_at", "closed_at", "sla_met", "post_resolution_evidence": [...] } }
```
`related` and `resolution` are `null` when they don't apply. The hard-coded `INCIDENT_ASSIGNTEAMS` list is replaced by `/assignees/*`.

### Account users — `/api/incident-reports`

Any logged-in user can call these, subject to the access rules in each row.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /` | PRIMARY account holders | Report an incident (see body below) |
| `GET /?scope=REPORTED\|ASSIGNED` | REPORTED: PRIMARY users of the reporting company. ASSIGNED: the assigned user or users of the assigned company | List incidents |
| `GET /:id` | Reporter company or assignee | Incident details |
| `POST /:id/evidence` | Reporter company or assignee | `{ evidence: [...] }`. Clears a SuperAdmin evidence request |
| `POST /:id/comments` | Reporter company or assignee | `{ body }` |
| `PATCH /:id/start` | Assignee | → IN_PROGRESS |
| `PATCH /:id/submit-resolution` | Assignee | `{ resolution_notes, root_cause?, corrective_action?, evidence? }` → PENDING_SUPERADMIN_APPROVAL |

**Report body:**
```json
{ "type": "TRUCK_BREAKDOWN|CARGO_DAMAGE|ACCIDENT_INJURY|GATE_CONGESTION|SECURITY_BREACH|PAYMENT_DISPUTE|SYSTEM_DOWNTIME",
  "description": "…", "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "location_kind": "FACILITY|TRANSIT_PARK|PORT_TERMINAL", "location_id": "<facility/park/terminal uuid>", "location_name": "required if no location_id",
  "truck_id | truck_plate_number": "…", "driver_id": "…", "booking_id": "…",
  "payment_reference": "…",
  "evidence": [{ "label": "Photo of truck", "type": "PHOTO", "url": "https://…" }] }
```
- `severity` is optional and defaults to MEDIUM.
- `truck_id` / `truck_plate_number`, `driver_id` and `booking_id` are accepted **only for TRUCK_BREAKDOWN**. Other types get a 400.
- `evidence` items are file **URLs**; the backend has no file-upload endpoint yet (max 10 per request).

---

## Rollout notes

- **Migration:** `1763000000000-e-revenue-traffic-command-incidents` creates the new tables and columns, adds the recipient split to `payment_types` (existing rows default to 100% Maritime-ETSS), and lets a form carry several active fee lines.
- **After deploy:** run `npm run seed` to add the `incident_reports` permissions and the PO fee schedule, then call `POST /api/e-revenue/ledger/sync` once to backfill revenue from past payments.
