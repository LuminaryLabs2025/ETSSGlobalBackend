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
};

export type ActivityContext = {
  entitySlug: string;
  module: string;
  actionLabel: string;
};

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

  if (root === 'auth' && pathLower.includes('/login')) {
    actionLabel = method === 'POST' ? 'User login' : `Authentication (${method})`;
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
  } else if (root === 'dashboard') {
    actionLabel = 'View dashboard';
  } else if (root === 'activity-logs') {
    actionLabel = 'View activity logs';
  } else {
    actionLabel = `${httpMethodToAction(method)} ${titleCaseSegment(root)}`;
  }

  return { entitySlug: root, module, actionLabel };
}
