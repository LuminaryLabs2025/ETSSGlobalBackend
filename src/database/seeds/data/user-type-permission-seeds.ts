import {
  ALL_SEEDED_PERMISSION_NAMES,
  VIEW_PERMISSION_NAMES,
} from './permission-seeds';

const V = [...VIEW_PERMISSION_NAMES];

/** Which permissions each user type may hold (invite UI + validation). Seeded only. */
export const USER_TYPE_PERMISSION_MAP: Record<string, string[]> = {
  'super-admin': [...ALL_SEEDED_PERMISSION_NAMES],
  admin: [...ALL_SEEDED_PERMISSION_NAMES],
  'customer-service': [
    ...V,
    'create_bookings',
    'edit_bookings',
    'export_bookings',
    'view_utility_tickets',
    'manage_utility_tickets',
  ],
  'operations-verifier': [
    ...V,
    'create_bookings',
    'edit_bookings',
    'cancel_bookings',
    'export_bookings',
    'manage_traffic_command',
    'view_trucks',
    'view_drivers',
  ],
  'road-marshall': [
    ...V,
    'view_traffic_command',
    'manage_traffic_command',
    'view_bookings',
    'edit_bookings',
  ],
  'bonded-terminal': [
    ...V,
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'view_terminals',
    'manage_terminals',
    'view_facilities',
    'manage_facilities',
  ],
  'truck-park': [
    ...V,
    'view_bookings',
    'create_bookings',
    'view_transit_parks',
    'manage_transit_parks',
  ],
  'fish-van-park': [
    ...V,
    'view_bookings',
    'create_bookings',
    'view_facilities',
    'manage_facilities',
  ],
  'transit-park': [
    ...V,
    'view_bookings',
    'create_bookings',
    'view_transit_parks',
    'manage_transit_parks',
  ],
  'terminal-operator': [
    ...V,
    'view_bookings',
    'create_bookings',
    'edit_bookings',
    'view_terminals',
    'manage_terminals',
    'view_teps',
    'manage_teps',
  ],
  'shipping-line': [...V, 'view_bookings', 'view_ports', 'view_terminals'],
  npa: [
    ...V,
    'view_bookings',
    'view_ports',
    'view_terminals',
    'view_penalties_fines',
    'manage_penalties_fines',
    'issue_penalties_fines',
  ],
  'enforcement-verifier': [
    ...V,
    'view_bookings',
    'view_penalties_fines',
    'issue_penalties_fines',
    'view_traffic_command',
  ],
  'gate-verification-officer': [
    ...V,
    'view_bookings',
    'view_teps',
    'manage_teps',
    'view_facilities',
  ],
  'tow-truck-company': [
    ...V,
    'view_trucks',
    'manage_trucks',
    'view_bookings',
    'create_bookings',
  ],
  pregate: [...V, 'view_bookings', 'view_facilities', 'manage_facilities'],
  ept: [...V, 'view_bookings', 'view_teps', 'manage_teps'],
};

function assertKnownPermissions(): void {
  const known = new Set(ALL_SEEDED_PERMISSION_NAMES);
  for (const [slug, names] of Object.entries(USER_TYPE_PERMISSION_MAP)) {
    for (const n of names) {
      if (!known.has(n)) {
        throw new Error(
          `USER_TYPE_PERMISSION_MAP[${slug}] references unknown permission: ${n}`,
        );
      }
    }
  }
}

assertKnownPermissions();
