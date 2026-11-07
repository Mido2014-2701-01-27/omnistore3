import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Data } from './store.js';

const empty = (): Data => ({ users: [], sessions: [], orders: [], reviews: [], profiles: {} });

/**
 * A tiny JSON-file database. Everything lives in memory and is written to
 * disk (atomically, via a temp file) shortly after each change.
 * Fine for a demo; use PostgreSQL (see README) for anything bigger.
 */
export class Db {
  data: Data = empty();
  private timer: NodeJS.Timeout | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'db.json');
  }

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<Data>;
      this.data = { ...empty(), ...parsed };
    } catch {
      this.data = empty(); // first run, or an unreadable file
    }
    const now = Date.now();
    this.data.sessions = this.data.sessions.filter((s) => s.expires > now);
  }

  /** Schedule a write; many changes in a row become one write. */
  save(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 150);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    const json = JSON.stringify(this.data);
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, json, { mode: 0o600 });
      await rename(tmp, this.file);
    }).catch((err) => console.error('Could not save the database:', err));
    return this.writing;
  }
}
