const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const MODULE_BY_SEGMENT: Record<string, string> = {
  'truck-types': 'Truck Types',
  'tep-types': 'TEP Types',
  'facility-types': 'Facilities',
  'terminal-gates': 'Terminals',
  terminals: 'Terminals',
  'transit-parks': 'Transit Parks',
  facilities: 'Facilities',
};

export type ActivityContext = {
  entitySlug: string;
  module: string;
  actionLabel: string;
  shouldLog: boolean;
};

const IMPORTANT_ROOTS = new Set([
  'truck-types',
  'tep-types',
  'facility-types',
  'terminal-gates',
  'terminals',
  'transit-parks',
  'facilities',
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
  const root = seg[0] || 'system';
  const module = MODULE_BY_SEGMENT[root] || 'System';

  const pathLower = pathWithoutQuery.toLowerCase();
  let actionLabel: string;
  let shouldLog = method !== 'GET' && IMPORTANT_ROOTS.has(root);

  if (root === 'truck-types') {
    actionLabel = `${httpMethodToAction(method)} truck type`;
  } else if (root === 'tep-types') {
    actionLabel = `${httpMethodToAction(method)} TEP type`;
  } else if (root === 'facility-types') {
    actionLabel = `${httpMethodToAction(method)} facility`;
  } else if (root === 'terminal-gates') {
    actionLabel = `${httpMethodToAction(method)} terminal`;
  } else if (root === 'terminals') {
    actionLabel = `${httpMethodToAction(method)} terminal`;
  } else if (root === 'transit-parks') {
    actionLabel = `${httpMethodToAction(method)} transit park`;
  } else if (root === 'facilities') {
    actionLabel = `${httpMethodToAction(method)} facility`;
  } else {
    actionLabel = `${httpMethodToAction(method)} system`;
    shouldLog = false;
  }

  return { entitySlug: root, module, actionLabel, shouldLog };
}
