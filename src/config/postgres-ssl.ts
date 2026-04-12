/**
 * TypeORM / node-pg `ssl` option for managed Postgres (Aiven, Render, Neon, etc.).
 * `DATABASE_URL` query `sslmode=require` is NOT applied automatically when the URL
 * is split into host/port — callers must merge this into the DataSource options.
 */
export type PostgresSslOption = boolean | { rejectUnauthorized: boolean };

export function resolvePostgresSsl(options: {
  databaseUrl?: string | null;
  /** DATABASE_SSL: true | require | false | disable */
  databaseSslEnv?: string | null;
}): PostgresSslOption | undefined {
  const flag = options.databaseSslEnv?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'disable') {
    return false;
  }
  if (flag === 'true' || flag === '1' || flag === 'require') {
    return { rejectUnauthorized: false };
  }

  const raw = options.databaseUrl?.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const u = new URL(raw);
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
      return undefined;
    }
    const mode = (u.searchParams.get('sslmode') ?? '').toLowerCase();
    if (mode === 'disable') {
      return false;
    }
    if (mode === 'verify-full' || mode === 'verify-ca') {
      return { rejectUnauthorized: true };
    }
    if (
      mode === 'require' ||
      mode === 'prefer' ||
      mode === 'allow' ||
      mode === 'no-verify'
    ) {
      return { rejectUnauthorized: false };
    }
  } catch {
    return undefined;
  }

  return undefined;
}
