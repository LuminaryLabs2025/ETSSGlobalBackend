export interface PermissionModuleSeedRow {
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** `operations` | `infrastructure` | `administration` — null = top nav strip */
  nav_section: string | null;
}

/** Sidebar-aligned modules (seeded only). */
export const PERMISSION_MODULE_SEEDS: PermissionModuleSeedRow[] = [
  {
    key: 'overview',
    name: 'Overview',
    description: 'Home and operational summary',
    sort_order: 10,
    nav_section: null,
  },
  {
    key: 'traffic_command',
    name: 'Traffic Command',
    description: 'Live traffic command and control',
    sort_order: 20,
    nav_section: null,
  },
  {
    key: 'e_revenue',
    name: 'e-Revenue',
    description: 'Electronic revenue and tolling',
    sort_order: 30,
    nav_section: null,
  },
  {
    key: 'bookings',
    name: 'Bookings',
    description: 'Truck and slot bookings',
    sort_order: 10,
    nav_section: 'operations',
  },
  {
    key: 'trucks',
    name: 'Trucks',
    description: 'Fleet and truck records',
    sort_order: 20,
    nav_section: 'operations',
  },
  {
    key: 'drivers',
    name: 'Drivers',
    description: 'Driver profiles and assignments',
    sort_order: 30,
    nav_section: 'operations',
  },
  {
    key: 'companies',
    name: 'Companies',
    description: 'Organizations and tenants',
    sort_order: 40,
    nav_section: 'operations',
  },
  {
    key: 'ports',
    name: 'Ports',
    description: 'Port master data',
    sort_order: 10,
    nav_section: 'infrastructure',
  },
  {
    key: 'terminals',
    name: 'Terminals',
    description: 'Terminals and berths',
    sort_order: 20,
    nav_section: 'infrastructure',
  },
  {
    key: 'transit_parks',
    name: 'Transit Parks',
    description: 'Transit and truck parks',
    sort_order: 30,
    nav_section: 'infrastructure',
  },
  {
    key: 'facilities',
    name: 'Facilities',
    description: 'Yards, gates, and facilities',
    sort_order: 40,
    nav_section: 'infrastructure',
  },
  {
    key: 'utility_tickets',
    name: 'Utility Tickets',
    description: 'Utility and service tickets',
    sort_order: 10,
    nav_section: 'administration',
  },
  {
    key: 'teps',
    name: 'TEPs',
    description: 'Terminal entry passes',
    sort_order: 20,
    nav_section: 'administration',
  },
  {
    key: 'penalties_fines',
    name: 'Penalties & Fines',
    description: 'Violations and fines',
    sort_order: 30,
    nav_section: 'administration',
  },
  {
    key: 'users',
    name: 'Users',
    description: 'Platform user accounts',
    sort_order: 40,
    nav_section: 'administration',
  },
  {
    key: 'my_team',
    name: 'My Team',
    description: 'Team members and invites',
    sort_order: 50,
    nav_section: 'administration',
  },
  {
    key: 'activity_log',
    name: 'Activity Log',
    description: 'Audit and activity history',
    sort_order: 60,
    nav_section: 'administration',
  },
];

export interface PermissionSeedRow {
  moduleKey: string;
  name: string;
  description: string;
  sort_order: number;
}

function P(
  moduleKey: string,
  defs: Array<{ name: string; description: string }>,
): PermissionSeedRow[] {
  return defs.map((d, i) => ({
    moduleKey,
    name: d.name,
    description: d.description,
    sort_order: 10 + i * 10,
  }));
}

export const PERMISSION_SEEDS: PermissionSeedRow[] = [
  ...P('overview', [
    { name: 'view_overview', description: 'View overview home' },
    { name: 'view_dashboard', description: 'View dashboard statistics' },
  ]),
  ...P('traffic_command', [
    {
      name: 'view_traffic_command',
      description: 'View traffic command console',
    },
    {
      name: 'manage_traffic_command',
      description: 'Manage traffic command actions',
    },
  ]),
  ...P('e_revenue', [
    { name: 'view_e_revenue', description: 'View e-Revenue screens' },
    { name: 'manage_e_revenue', description: 'Manage e-Revenue records' },
    { name: 'export_e_revenue', description: 'Export e-Revenue data' },
  ]),
  ...P('bookings', [
    { name: 'view_bookings', description: 'View bookings and manifests' },
    { name: 'create_bookings', description: 'Create new bookings' },
    { name: 'edit_bookings', description: 'Edit existing bookings' },
    { name: 'cancel_bookings', description: 'Cancel active bookings' },
    { name: 'export_bookings', description: 'Export booking data' },
  ]),
  ...P('trucks', [
    { name: 'view_trucks', description: 'View truck records' },
    { name: 'manage_trucks', description: 'Create and update trucks' },
    { name: 'assign_trucks', description: 'Assign trucks to jobs' },
  ]),
  ...P('drivers', [
    { name: 'view_drivers', description: 'View driver profiles' },
    { name: 'manage_drivers', description: 'Create and update drivers' },
  ]),
  ...P('companies', [
    { name: 'view_companies', description: 'View companies' },
    { name: 'manage_companies', description: 'Create and manage companies' },
  ]),
  ...P('ports', [
    { name: 'view_ports', description: 'View ports' },
    { name: 'manage_ports', description: 'Manage port records' },
  ]),
  ...P('terminals', [
    { name: 'view_terminals', description: 'View terminals' },
    { name: 'manage_terminals', description: 'Manage terminals' },
  ]),
  ...P('transit_parks', [
    { name: 'view_transit_parks', description: 'View transit parks' },
    { name: 'manage_transit_parks', description: 'Manage transit parks' },
  ]),
  ...P('facilities', [
    { name: 'view_facilities', description: 'View facilities' },
    { name: 'manage_facilities', description: 'Manage facilities' },
  ]),
  ...P('utility_tickets', [
    { name: 'view_utility_tickets', description: 'View utility tickets' },
    { name: 'manage_utility_tickets', description: 'Manage utility tickets' },
  ]),
  ...P('teps', [
    { name: 'view_teps', description: 'View TEP records' },
    { name: 'manage_teps', description: 'Manage TEPs' },
  ]),
  ...P('penalties_fines', [
    { name: 'view_penalties_fines', description: 'View penalties and fines' },
    {
      name: 'manage_penalties_fines',
      description: 'Manage penalties and fines',
    },
    {
      name: 'issue_penalties_fines',
      description: 'Issue new penalties or fines',
    },
  ]),
  ...P('users', [
    { name: 'view_users', description: 'View user accounts' },
    { name: 'create_user', description: 'Create users and send invites' },
    { name: 'manage_users', description: 'Update, disable, and archive users' },
    { name: 'archive_users', description: 'Archive user accounts' },
  ]),
  ...P('my_team', [
    { name: 'view_my_team', description: 'View team members' },
    { name: 'manage_my_team', description: 'Manage team members' },
    {
      name: 'invite_team_members',
      description: 'Invite and configure team members',
    },
  ]),
  ...P('activity_log', [
    { name: 'view_audit_logs', description: 'View activity and audit logs' },
    {
      name: 'export_activity_log',
      description: 'Export activity log data',
    },
  ]),
];

export const ALL_SEEDED_PERMISSION_NAMES = PERMISSION_SEEDS.map((p) => p.name);

export const VIEW_PERMISSION_NAMES = PERMISSION_SEEDS.map((p) => p.name).filter(
  (n) => n.startsWith('view_'),
);
