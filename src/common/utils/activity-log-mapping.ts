const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const MODULE_BY_SEGMENT: Record<string, string> = {
  auth: 'Authentication',
  users: 'User Management',
  companies: 'Company Management',
  'user-types': 'User Types',
  'team-members': 'Team Members',
  'roles-permissions': 'Roles & Permissions',
  dashboard: 'Dashboard',
  'activity-logs': 'Activity Log',
  'truck-types': 'App Options',
  'truck-capacities': 'App Options',
  'truck-lengths': 'App Options',
  'booking-categories': 'App Options',
  'tep-types': 'App Options',
  'park-types': 'App Options',
  'facility-types': 'App Options',
  'facility-timeslots': 'App Options',
  'facility-timeslot-assignments': 'App Options',
  locations: 'App Options',
  'payment-types': 'App Options',
  'infraction-categories': 'Compliance',
  'terminal-gates': 'Terminal Gate Management',
  'handheld-devices': 'App Options',
  'rfid-tags': 'Truck Management',
};

export type ActivityContext = {
  entitySlug: string;
  module: string;
  actionLabel: string;
  shouldLog: boolean;
};

const IMPORTANT_ROOTS = new Set([
  'auth',
  'users',
  'companies',
  'team-members',
  'roles-permissions',
  'truck-types',
  'truck-capacities',
  'truck-lengths',
  'booking-categories',
  'tep-types',
  'park-types',
  'facility-types',
  'facility-timeslots',
  'facility-timeslot-assignments',
  'locations',
  'payment-types',
  'infraction-categories',
  'terminal-gates',
  'handheld-devices',
  'rfid-tags',
]);

function titleCaseSegment(seg: string): string {
  return seg
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function parseApiSegments(pathWithoutQuery: string): string[] {
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  const apiIdx = segments.indexOf('api');
  return apiIdx >= 0 ? segments.slice(apiIdx + 1) : segments;
}

export function extractEntityIdFromPath(pathWithoutQuery: string): string | null {
  const matches = pathWithoutQuery.match(UUID_RE);
  if (!matches?.length) return null;
  return matches[matches.length - 1] ?? null;
}

export function httpMethodToAction(method: string): string {
  const map: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };
  return map[method] || method;
}

/** Human-readable action for HTTP requests from method + path. */
export function inferHttpActivityContext(
  method: string,
  pathWithoutQuery: string,
): ActivityContext {
  const seg = parseApiSegments(pathWithoutQuery);
  const root = seg[0] || 'unknown';
  const module = MODULE_BY_SEGMENT[root] || titleCaseSegment(root);

  const pathLower = pathWithoutQuery.toLowerCase();
  let actionLabel: string;
  let shouldLog = method !== 'GET' && IMPORTANT_ROOTS.has(root);

  if (root === 'auth' && pathLower.includes('/login')) {
    actionLabel = method === 'POST' ? 'User login' : `Authentication (${method})`;
    shouldLog = method === 'POST';
  } else if (root === 'users') {
    if (pathLower.includes('/resend-invite')) actionLabel = 'Resend invitation';
    else if (pathLower.includes('/disable')) actionLabel = 'Disable user';
    else if (pathLower.includes('/enable')) actionLabel = 'Enable user';
    else if (pathLower.includes('/archive')) actionLabel = 'Archive user';
    else if (pathLower.includes('/roles') && method === 'POST')
      actionLabel = 'Assign role to user';
    else if (pathLower.includes('/roles') && method === 'DELETE')
      actionLabel = 'Remove role from user';
    else if (method === 'POST' && seg.length === 1) actionLabel = 'Create user';
    else if (method === 'PUT' || method === 'PATCH') actionLabel = 'Update user';
    else if (method === 'DELETE') actionLabel = 'Delete user';
    else if (method === 'GET') actionLabel = 'View users';
    else actionLabel = `${httpMethodToAction(method)} user`;
  } else if (root === 'companies') {
    if (method === 'POST') actionLabel = 'Create company';
    else if (method === 'PUT' || method === 'PATCH') actionLabel = 'Update company';
    else if (method === 'DELETE') actionLabel = 'Delete company';
    else actionLabel = 'View companies';
  } else if (root === 'user-types') {
    actionLabel =
      method === 'GET' ? 'View user types' : `${httpMethodToAction(method)} user type`;
  } else if (root === 'team-members') {
    if (pathLower.includes('/resend-invite'))
      actionLabel = 'Resend team member invitation';
    else if (pathLower.includes('/disable')) actionLabel = 'Disable team member';
    else if (pathLower.includes('/enable')) actionLabel = 'Enable team member';
    else if (pathLower.includes('/archive')) actionLabel = 'Archive team member';
    else if (method === 'POST' && seg.length === 1)
      actionLabel = 'Create team member';
    else if (method === 'PUT' || method === 'PATCH')
      actionLabel = 'Update team member';
    else if (method === 'DELETE') actionLabel = 'Delete team member';
    else if (method === 'GET') actionLabel = 'View team members';
    else actionLabel = `${httpMethodToAction(method)} team member`;
  } else if (root === 'roles-permissions') {
    actionLabel = `${httpMethodToAction(method)} roles/permissions`;
  } else if (root === 'truck-types') {
    actionLabel = `${httpMethodToAction(method)} truck type`;
  } else if (root === 'truck-capacities') {
    actionLabel = `${httpMethodToAction(method)} truck capacity`;
  } else if (root === 'truck-lengths') {
    actionLabel = `${httpMethodToAction(method)} truck length`;
  } else if (root === 'booking-categories') {
    actionLabel = `${httpMethodToAction(method)} booking category`;
  } else if (root === 'tep-types') {
    actionLabel = `${httpMethodToAction(method)} TEP type`;
  } else if (root === 'park-types') {
    actionLabel = `${httpMethodToAction(method)} park type`;
  } else if (root === 'facility-types') {
    actionLabel = `${httpMethodToAction(method)} facility type`;
  } else if (root === 'facility-timeslots') {
    actionLabel = `${httpMethodToAction(method)} facility timeslot`;
  } else if (root === 'facility-timeslot-assignments') {
    actionLabel = 'Toggle facility timeslot status';
  } else if (root === 'locations') {
    actionLabel = `${httpMethodToAction(method)} location`;
  } else if (root === 'payment-types') {
    actionLabel = `${httpMethodToAction(method)} payment type`;
  } else if (root === 'infraction-categories') {
    actionLabel = `${httpMethodToAction(method)} infraction category`;
  } else if (root === 'terminal-gates') {
    actionLabel = `${httpMethodToAction(method)} terminal gate`;
  } else if (root === 'handheld-devices') {
    actionLabel = `${httpMethodToAction(method)} handheld device`;
  } else if (root === 'rfid-tags' && pathLower.includes('/bulk-upload')) {
    actionLabel = 'Bulk upload RFID tags';
  } else if (root === 'rfid-tags') {
    actionLabel = `${httpMethodToAction(method)} RFID tag`;
  } else if (root === 'dashboard') {
    actionLabel = 'View dashboard';
    shouldLog = false;
  } else if (root === 'activity-logs') {
    actionLabel = 'View activity logs';
    shouldLog = false;
  } else {
    actionLabel = `${httpMethodToAction(method)} ${titleCaseSegment(root)}`;
    shouldLog = false;
  }

  return { entitySlug: root, module, actionLabel, shouldLog };
}
