import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { explainDbError, openStore } from './open-store.js';
import { DATA_DIR } from './paths.js';
import { PgStore } from './pg-store.js';
// ======================================================================
// npm run db:import
// Copies everything in data/db.json (accounts, orders, reviews, profiles) into
// PostgreSQL. Safe to run more than once: anything already there is skipped.
// Logins (sessions) are not copied, so everyone just logs in again.
// ======================================================================
if (!process.env.DATABASE_URL) {
    console.error('\nSet DATABASE_URL first, for example:\n  DATABASE_URL=postgres://localhost:5432/omnistore npm run db:import\n');
    process.exit(1);
}
const file = join(DATA_DIR, 'db.json');
let data;
try {
    data = JSON.parse(await readFile(file, 'utf8'));
}
catch {
    console.error(`\nNo readable JSON database at ${file}. Nothing to import.\n`);
    process.exit(1);
}
const { store, label } = openStore();
if (!(store instanceof PgStore))
    process.exit(1);
try {
    await store.init();
    console.log(`\nImporting ${file}\n  into ${label} ...`);
    const added = await store.importAll({ users: data.users ?? [], sessions: [], orders: data.orders ?? [], reviews: data.reviews ?? [], profiles: data.profiles ?? {} });
    console.log(`  users: ${added.users}, orders: ${added.orders}, reviews: ${added.reviews}, profiles: ${added.profiles} added\n`);
}
catch (err) {
    console.error(`\nImport failed: ${explainDbError(err)}\n`);
    process.exitCode = 1;
}
finally {
    await store.close();
}
//# sourceMappingURL=import-json.js.map