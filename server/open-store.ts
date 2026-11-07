import { DATA_DIR, MIGRATIONS_DIR } from './paths.js';
import { JsonStore } from './json-store.js';
import { PgStore } from './pg-store.js';
import type { Store } from './store.js';

/** Uses PostgreSQL when DATABASE_URL is set, otherwise the JSON file. */
export function openStore(): { store: Store; label: string } {
  const url = process.env.DATABASE_URL;
  if (url) return { store: new PgStore(url, MIGRATIONS_DIR), label: `PostgreSQL (${describe(url)})` };
  return { store: new JsonStore(DATA_DIR), label: `JSON file (${DATA_DIR}/db.json)` };
}

/** host:port/database only. The password in the URL is never printed. */
function describe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return 'invalid DATABASE_URL';
  }
}

/** Turn a database error into one plain sentence that says what to do. */
export function explainDbError(err: unknown): string {
  const e = err as { code?: string; message?: string; errors?: { code?: string }[] };
  const codes = [e.code, ...(e.errors ?? []).map((x) => x.code)];
  if (e.message?.includes('"pg" package is not installed')) return e.message;
  if (codes.includes('ECONNREFUSED')) return 'Could not connect. Is PostgreSQL running? (With Postgres.app, open it and click Start.) Also check the host and port in DATABASE_URL.';
  if (codes.includes('ENOTFOUND')) return 'The database host in DATABASE_URL could not be found. Check the spelling.';
  if (codes.includes('3D000')) return 'That database does not exist yet. Create it first, for example:  createdb omnistore';
  if (codes.includes('28P01') || codes.includes('28000')) return 'PostgreSQL rejected the username or password in DATABASE_URL.';
  return e.message || String(err);
}
