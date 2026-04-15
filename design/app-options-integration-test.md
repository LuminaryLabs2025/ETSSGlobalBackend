# App Options Integration Test Guide

This guide is a step-by-step test plan for the **APP OPTIONS (Settings Engine)** module.

It covers:
- DB migration + seed verification
- auth and SuperAdmin access
- CRUD for all App Options endpoints
- key business rules (TEP mappings, facility timeslot auto-assignment, payments, RFID bulk upload)
- activity log behavior (important actions only)

---

## 1) Prerequisites

- API running locally (default `http://localhost:3000`)
- PostgreSQL reachable by the API
- Seeded SuperAdmin credentials available
  - default: `admin@etss.com` / `password123`
  - or your custom `SEED_SUPER_ADMIN_*` env values
- Optional tools: `jq`, Postman, Bruno, Insomnia

---

## 2) One-time setup check

From project root:

```bash
npm run migration:run
npm run seed
```

Expected:
- migration succeeds (including app options migration)
- seed succeeds with app options data created/updated

---

## 3) Get SuperAdmin token

```bash
curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@etss.com",
    "password": "password123"
  }'
```

Copy `access_token` from response, then:

```bash
export BASE_URL="http://localhost:3000"
export TOKEN="<PASTE_ACCESS_TOKEN>"
```

Quick auth sanity:

```bash
curl -s "$BASE_URL/api/truck-types" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- `200`
- JSON shape: `{ "success": true, "message": "...", "data": { "data": [...], "meta": {...} } }`

---

## 4) Baseline seeded-data checks

Run these and confirm non-empty expected values exist:

```bash
curl -s "$BASE_URL/api/truck-types?limit=100" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/booking-categories?limit=100" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/tep-types?limit=100" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/park-types?limit=100" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/facility-types?limit=100" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/facility-timeslots?limit=100" -H "Authorization: Bearer $TOKEN"
```

Confirm presence of:
- Truck types: Flatbed, Lowbed, Reefer, Arewa...
- Booking categories: Import/Export/Empty/FMCG variants
- TEP types: Import/Export/Empty TDO, GatePass (Port/Non-Port)
- Park types: Bonded Terminal, Truck Park, Fish-Van Park, Pregate, EPT
- Facility types: Facility, Facility-Pregate
- Timeslots: Midnight/Early Morning/.../Night Window

---

## 5) CRUD + integration tests (step-by-step)

## 5.1 Truck Types

Create:

```bash
curl -s -X POST "$BASE_URL/api/truck-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Truck Type","description":"integration-test","status":"ACTIVE"}'
```

Save returned `id` as `TRUCK_TYPE_ID`.

Update:

```bash
curl -s -X PUT "$BASE_URL/api/truck-types/$TRUCK_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"updated-desc"}'
```

Delete:

```bash
curl -s -X DELETE "$BASE_URL/api/truck-types/$TRUCK_TYPE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: create/update/delete succeed; duplicate name returns conflict.

## 5.2 Truck Capacities and Truck Lengths (FK to truck type)

Use an existing truck type id (`EXISTING_TRUCK_TYPE_ID`) from list.

Create capacity:

```bash
curl -s -X POST "$BASE_URL/api/truck-capacities" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"truck_type_id\":\"$EXISTING_TRUCK_TYPE_ID\",\"capacity_value\":\"40 Tons\",\"status\":\"ACTIVE\"}"
```

Create length:

```bash
curl -s -X POST "$BASE_URL/api/truck-lengths" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"truck_type_id\":\"$EXISTING_TRUCK_TYPE_ID\",\"length_value\":\"12m\",\"status\":\"ACTIVE\"}"
```

Negative test: invalid `truck_type_id` must fail with validation/not found.

## 5.3 Booking Categories

Create/update/delete one category and confirm list/search works:

```bash
curl -s "$BASE_URL/api/booking-categories?search=Import&limit=10" -H "Authorization: Bearer $TOKEN"
```

## 5.4 TEP Types (many-to-many with booking categories and truck types)

Pick:
- `BOOKING_CAT_1`, `BOOKING_CAT_2` from booking categories
- `TRUCK_TYPE_1`, `TRUCK_TYPE_2` from truck types

Create:

```bash
curl -s -X POST "$BASE_URL/api/tep-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Test TEP Type\",
    \"status\":\"ACTIVE\",
    \"booking_category_ids\":[\"$BOOKING_CAT_1\",\"$BOOKING_CAT_2\"],
    \"truck_type_ids\":[\"$TRUCK_TYPE_1\",\"$TRUCK_TYPE_2\"]
  }"
```

Expected:
- response includes mapped booking categories and truck types
- update should replace mappings correctly

## 5.5 Park Types and Facility Types (many-to-many)

Create park type first, then facility type linked to one or more park types.

Create park type:

```bash
curl -s -X POST "$BASE_URL/api/park-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Park Type","status":"ACTIVE"}'
```

Create facility type linked to park type IDs:

```bash
curl -s -X POST "$BASE_URL/api/facility-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Facility Type\",\"status\":\"ACTIVE\",\"park_type_ids\":[\"$PARK_TYPE_ID\"]}"
```

Expected:
- facility type response contains linked park types

## 5.6 Facility Timeslots + auto-assign on facility creation

Create a facility location:

```bash
curl -s -X POST "$BASE_URL/api/locations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Facility Location","type":"FACILITY"}'
```

Save `LOCATION_ID`.

Now check assignments were auto-created:

```bash
curl -s "$BASE_URL/api/locations/$LOCATION_ID/facility-timeslot-assignments?limit=100" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- one assignment per facility timeslot
- default `is_active: true`

Toggle one slot:

```bash
curl -s -X PATCH "$BASE_URL/api/facility-timeslot-assignments/$ASSIGNMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'
```

## 5.7 Payment Types (charged_to_user_type_id FK; fixed/dynamic)

Get a user type id:

```bash
curl -s "$BASE_URL/api/user-types" -H "Authorization: Bearer $TOKEN"
```

Create FIXED payment:

```bash
curl -s -X POST "$BASE_URL/api/payment-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Test Payment\",
    \"service_name\":\"Facility Access Request\",
    \"linked_form\":\"Book Facility Form\",
    \"revenue_event_trigger\":\"Booking Confirmation\",
    \"charged_to_user_type_id\":\"$USER_TYPE_ID\",
    \"amount_type\":\"FIXED\",
    \"amount\":5000
  }"
```

Negative test:
- `amount_type=FIXED` with no amount must fail
- invalid `charged_to_user_type_id` must fail

Create DYNAMIC payment:
- same payload but `amount_type: "DYNAMIC"` and no amount
- expect success and amount handled as null

## 5.8 Infraction Categories

Create:

```bash
curl -s -X POST "$BASE_URL/api/infraction-categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Infraction","fine_amount":25000,"status":"ACTIVE"}'
```

Verify update and delete work.

## 5.9 Terminal Gates

Create:

```bash
curl -s -X POST "$BASE_URL/api/terminal-gates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location":"TinCan Port",
    "entry_barrier_name":"Gate A Entry",
    "entry_barrier_id":"ENTRY-TEST-001",
    "exit_barrier_name":"Gate A Exit",
    "exit_barrier_id":"EXIT-TEST-001"
  }'
```

Negative test: duplicate barrier IDs must fail.

## 5.10 Locations + Handheld Devices

Create a location (or reuse one):

```bash
curl -s -X POST "$BASE_URL/api/locations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Transit Spot","type":"TRANSIT_LOCATION"}'
```

Create handheld device linked to location:

```bash
curl -s -X POST "$BASE_URL/api/handheld-devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"HH-TEST-01\",\"location_id\":\"$LOCATION_ID\",\"status\":\"ACTIVE\"}"
```

Expected:
- succeeds only when `location_id` exists
- if `user_id` provided, it must exist

## 5.11 RFID tags (single + bulk upload)

Single create:

```bash
curl -s -X POST "$BASE_URL/api/rfid-tags" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rfid_tag_number":"RFID-TEST-0001","status":"ACTIVE"}'
```

Expected:
- `etss_tag_number` auto-generated like `ETSS-000001`

Bulk upload:

Create file:

```bash
cat > /tmp/rfid-upload.csv <<'EOF'
rfid_tag_number
RFID-TEST-0002
RFID-TEST-0003
RFID-TEST-0004
EOF
```

Upload:

```bash
curl -s -X POST "$BASE_URL/api/rfid-tags/bulk-upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/rfid-upload.csv"
```

Expected:
- returns `total_input`, `created_count`, `skipped_count`

---

## 6) Pagination/filtering verification

Sample checks:

```bash
curl -s "$BASE_URL/api/truck-types?page=1&limit=2" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/payment-types?search=Facility&status=ACTIVE&page=1&limit=5" -H "Authorization: Bearer $TOKEN"
curl -s "$BASE_URL/api/locations?type=FACILITY&search=Test&page=1&limit=10" -H "Authorization: Bearer $TOKEN"
```

Expected:
- each list endpoint returns `data` + `meta` with `total`, `page`, `limit`, `total_pages`

---

## 7) Activity log verification (important actions only)

1. Perform a few important write actions above (create/update/delete in app options).
2. Fetch logs:

```bash
curl -s "$BASE_URL/api/activity-logs?module=App%20Options&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- important App Options write actions are logged with meaningful labels
- pure reads (`GET`) are not logged by the interceptor

---

## 8) Access control checks

Use a non-SuperAdmin token and hit any App Options write route:

```bash
curl -s -X POST "$BASE_URL/api/truck-types" \
  -H "Authorization: Bearer <NON_SUPERADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Fail"}'
```

Expected:
- forbidden response from `SuperAdminGuard`

---

## 9) Pass/Fail checklist

- [ ] Migrations run successfully
- [ ] Seeds run successfully
- [ ] SuperAdmin login works
- [ ] All App Options CRUD endpoints work
- [ ] TEP supports many-to-many category/truck mapping
- [ ] Facility location auto-assigns all timeslots
- [ ] Facility timeslot assignment toggle works
- [ ] Payment type FK + fixed/dynamic validations work
- [ ] Handheld device is linked via `location_id`
- [ ] RFID single + bulk upload work
- [ ] Pagination/filtering works on list endpoints
- [ ] Activity log captures important writes only
- [ ] Non-SuperAdmin blocked from App Options writes

---

## 10) Notes for Render / production

- Ensure `RUN_MIGRATIONS_ON_DEPLOY=true` to auto-run migrations on deploy.
- Keep `RUN_SEED_ON_DEPLOY=true` only if you want baseline data upserted every deploy.
- For strict production control, set seed off and run seed manually when needed.
