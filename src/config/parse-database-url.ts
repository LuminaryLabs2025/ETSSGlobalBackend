export interface ParsedDatabaseUrl {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function parseDatabaseUrl(
  databaseUrl: string,
): ParsedDatabaseUrl | null {
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return null;
    }
    const database = url.pathname.replace(/^\//, '').split('/')[0];
    if (!database) {
      return null;
    }
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 5432,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
    };
  } catch {
    return null;
  }
}
