import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function loadPool() {
    const name = 'pg'; // a variable, so TypeScript does not need the package's types
    try {
        const mod = (await import(name));
        const Pool = mod.Pool ?? mod.default?.Pool;
        if (!Pool)
            throw new Error('no Pool export');
        return Pool;
    }
    catch {
        throw new Error('The "pg" package is not installed. Run:  npm install');
    }
}
const toCents = (usd) => Math.round(usd * 100);
const fromCents = (c) => c / 100;
const time = (d) => d.getTime();
const userFrom = (r) => ({ id: r.id, name: r.name, email: r.email, pass: r.password_hash, createdAt: time(r.created_at) });
const USER_COLUMNS = 'u.id, u.name, u.email, u.password_hash, u.created_at';
/** PostgreSQL implementation of the same Store the JSON file implements. */
export class PgStore {
    url;
    migrationsDir;
    kind = 'postgres';
    pool;
    constructor(url, migrationsDir) {
        this.url = url;
        this.migrationsDir = migrationsDir;
    }
    get db() {
        if (!this.pool)
            throw new Error('Database not started yet: call init() first.');
        return this.pool;
    }
    async init() {
        const Pool = await loadPool();
        this.pool = new Pool({ connectionString: this.url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
        this.pool.on('error', (err) => console.error('PostgreSQL connection error:', err.message));
        await this.migrate();
    }
    async close() {
        await this.pool?.end();
    }
    async ping() {
        await this.db.query('SELECT 1');
    }
    /** Runs each database/migrations/*.sql file once, in name order, and remembers which ran. */
    async migrate() {
        const client = await this.db.connect();
        try {
            await client.query('SELECT pg_advisory_lock(727274)'); // only one server instance migrates at a time
            await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
            const done = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((r) => String(r.version)));
            const files = (await readdir(this.migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
            for (const file of files) {
                if (done.has(file))
                    continue;
                const sql = await readFile(join(this.migrationsDir, file), 'utf8');
                try {
                    await client.query('BEGIN');
                    await client.query(sql);
                    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`  Applied database migration ${file}`);
                }
                catch (err) {
                    await client.query('ROLLBACK').catch(() => undefined);
                    throw new Error(`Migration ${file} failed: ${err.message}`);
                }
            }
        }
        finally {
            await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
            client.release();
        }
    }
    /** Run several statements as one all-or-nothing transaction. */
    async tx(work) {
        const c = await this.db.connect();
        try {
            await c.query('BEGIN');
            const out = await work(c);
            await c.query('COMMIT');
            return out;
        }
        catch (err) {
            await c.query('ROLLBACK').catch(() => undefined);
            throw err;
        }
        finally {
            c.release();
        }
    }
    // ---------- accounts ----------
    async userByEmail(email) {
        const r = await this.db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.email = $1`, [email]);
        return r.rows[0] ? userFrom(r.rows[0]) : null;
    }
    async userById(id) {
        const r = await this.db.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id]);
        return r.rows[0] ? userFrom(r.rows[0]) : null;
    }
    async createUser(u) {
        try {
            await this.db.query('INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, to_timestamp($5::float8 / 1000))', [u.id, u.name, u.email, u.pass, u.createdAt]);
            return true;
        }
        catch (err) {
            if (err.code === '23505')
                return false; // unique_violation: email already used
            throw err;
        }
    }
    async deleteUser(id) {
        await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    }
    // ---------- sessions ----------
    async createSession(s) {
        await this.db.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, to_timestamp($3::float8 / 1000))', [s.id, s.userId, s.expires]);
    }
    async sessionUser(id) {
        const r = await this.db.query(`SELECT ${USER_COLUMNS}
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.expires_at > now()`, [id]);
        return r.rows[0] ? userFrom(r.rows[0]) : null;
    }
    async deleteSession(id) {
        await this.db.query('DELETE FROM sessions WHERE id = $1', [id]);
    }
    async purgeSessions() {
        const r = await this.db.query('DELETE FROM sessions WHERE expires_at <= now()');
        return r.rowCount ?? 0;
    }
    // ---------- orders ----------
    /** Inserts an order and its lines. Returns false if an order with that id already exists. */
    async insertOrder(c, o) {
        const subtotal = o.subtotal ?? o.lines.reduce((n, l) => n + l.price * l.qty, 0);
        const r = await c.query(`INSERT INTO orders (id, user_id, placed_at, subtotal_cents, delivery_cents, discount_pct, promo_code, total_cents)
       VALUES ($1, $2, to_timestamp($3::float8 / 1000), $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`, [o.id, o.userId, o.at, toCents(subtotal), toCents(o.delivery ?? 0), o.discountPct ?? 0, o.promoCode ?? '', toCents(o.total)]);
        if (!r.rowCount)
            return false;
        for (let i = 0; i < o.lines.length; i++) {
            const l = o.lines[i];
            await c.query(`INSERT INTO order_items (order_id, line_no, product_id, title, thumbnail, qty, unit_price_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [o.id, i + 1, l.id, l.title, l.thumbnail, l.qty, toCents(l.price)]);
        }
        return true;
    }
    /** The order and its lines are saved together, or not at all. */
    async createOrder(o) {
        await this.tx((c) => this.insertOrder(c, o));
    }
    async ordersFor(userId, limit) {
        const orders = (await this.db.query(`SELECT id, placed_at, subtotal_cents, delivery_cents, discount_pct, promo_code, total_cents
           FROM orders
          WHERE user_id = $1
          ORDER BY placed_at DESC
          LIMIT $2`, [userId, limit])).rows;
        if (!orders.length)
            return [];
        const items = (await this.db.query(`SELECT order_id, product_id, title, thumbnail, qty, unit_price_cents
           FROM order_items
          WHERE order_id = ANY($1::text[])
          ORDER BY order_id, line_no`, [orders.map((o) => o.id)])).rows;
        return orders.map((o) => ({
            id: o.id,
            at: time(o.placed_at),
            total: fromCents(o.total_cents),
            subtotal: fromCents(o.subtotal_cents),
            delivery: fromCents(o.delivery_cents),
            discountPct: o.discount_pct,
            promoCode: o.promo_code,
            lines: items
                .filter((i) => i.order_id === o.id)
                .map((i) => ({ id: i.product_id, title: i.title, thumbnail: i.thumbnail, qty: i.qty, price: fromCents(i.unit_price_cents) })),
        }));
    }
    // ---------- reviews ----------
    async reviewsFor(productId, viewerId, limit) {
        const stats = (await this.db.query('SELECT count(*)::int AS count, coalesce(round(avg(rating), 1), 0)::float8 AS avg FROM reviews WHERE product_id = $1', [productId])).rows[0];
        const list = (await this.db.query(`SELECT id, author, rating, body, created_at, (user_id = $2) AS mine
           FROM reviews
          WHERE product_id = $1
          ORDER BY created_at DESC
          LIMIT $3`, [productId, viewerId, limit])).rows;
        return {
            count: stats.count,
            avg: stats.avg,
            reviews: list.map((r) => ({ id: r.id, name: r.author, rating: r.rating, text: r.body, at: time(r.created_at), mine: r.mine === true })),
        };
    }
    async hasReview(productId, userId) {
        const r = await this.db.query('SELECT 1 FROM reviews WHERE product_id = $1 AND user_id = $2', [productId, userId]);
        return r.rows.length > 0;
    }
    /** Insert, or replace this user's earlier review of the same product (an "upsert"). */
    async saveReview(r) {
        await this.db.query(`INSERT INTO reviews (id, product_id, user_id, author, rating, body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7::float8 / 1000))
       ON CONFLICT (product_id, user_id)
       DO UPDATE SET author = EXCLUDED.author, rating = EXCLUDED.rating, body = EXCLUDED.body, created_at = EXCLUDED.created_at`, [r.id, r.productId, r.userId, r.name, r.rating, r.text, r.at]);
    }
    async deleteReview(productId, userId) {
        await this.db.query('DELETE FROM reviews WHERE product_id = $1 AND user_id = $2', [productId, userId]);
    }
    // ---------- profile ----------
    async profile(userId) {
        const r = (await this.db.query(`SELECT points, streak, last_day, wish, ever, ach, adds, gift, gifts, updated_at
           FROM profiles
          WHERE user_id = $1`, [userId])).rows[0];
        if (!r)
            return null;
        return {
            points: r.points, streak: r.streak, last: r.last_day, wish: r.wish, ever: r.ever, ach: r.ach,
            adds: r.adds, gift: r.gift, gifts: r.gifts, updatedAt: time(r.updated_at),
        };
    }
    async saveProfile(userId, p) {
        await this.db.query(`INSERT INTO profiles (user_id, points, streak, last_day, wish, ever, ach, adds, gift, gifts, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (user_id)
       DO UPDATE SET points = EXCLUDED.points, streak = EXCLUDED.streak, last_day = EXCLUDED.last_day,
                     wish = EXCLUDED.wish, ever = EXCLUDED.ever, ach = EXCLUDED.ach, adds = EXCLUDED.adds,
                     gift = EXCLUDED.gift, gifts = EXCLUDED.gifts, updated_at = now()`, [userId, p.points, p.streak, p.last, p.wish, p.ever, p.ach, p.adds, p.gift, p.gifts]);
    }
    // ---------- one-off import from data/db.json ----------
    /** Copies a JSON database into PostgreSQL. Safe to run twice: rows that already exist are skipped. */
    async importAll(data) {
        return this.tx(async (c) => {
            const added = { users: 0, orders: 0, reviews: 0, profiles: 0 };
            for (const u of data.users) {
                const r = await c.query(`INSERT INTO users (id, name, email, password_hash, created_at)
           VALUES ($1, $2, $3, $4, to_timestamp($5::float8 / 1000))
           ON CONFLICT DO NOTHING`, [u.id, u.name, u.email, u.pass, u.createdAt]);
                added.users += r.rowCount ?? 0;
            }
            // Only attach orders, reviews and profiles to users that really exist in the database now.
            const known = new Set((await c.query('SELECT id FROM users WHERE id = ANY($1::uuid[])', [data.users.map((u) => u.id)])).rows.map((r) => String(r.id)));
            for (const o of data.orders)
                if (known.has(o.userId) && (await this.insertOrder(c, o)))
                    added.orders++;
            for (const r of data.reviews) {
                if (!known.has(r.userId))
                    continue;
                const res = await c.query(`INSERT INTO reviews (id, product_id, user_id, author, rating, body, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7::float8 / 1000))
           ON CONFLICT DO NOTHING`, [r.id, r.productId, r.userId, r.name, r.rating, r.text, r.at]);
                added.reviews += res.rowCount ?? 0;
            }
            for (const [userId, p] of Object.entries(data.profiles)) {
                if (!known.has(userId))
                    continue;
                const res = await c.query(`INSERT INTO profiles (user_id, points, streak, last_day, wish, ever, ach, adds, gift, gifts, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11::float8 / 1000))
           ON CONFLICT (user_id) DO NOTHING`, [userId, p.points, p.streak, p.last, p.wish, p.ever, p.ach, p.adds, p.gift, p.gifts, p.updatedAt]);
                added.profiles += res.rowCount ?? 0;
            }
            return added;
        });
    }
}
//# sourceMappingURL=pg-store.js.map