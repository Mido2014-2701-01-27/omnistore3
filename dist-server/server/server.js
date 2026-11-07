import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, normalize, resolve, sep } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { DELIVERY_FEE, FREE_DELIVERY_AT, PROMO_CODES } from '../src/data.js';
import { COOKIE, SESSION_DAYS, checkEmail, checkPassword, createSession, decoyHash, endSession, hashPassword, throttle, userFrom, verifyPassword, } from './auth.js';
import { findProducts, getCatalogue } from './catalogue.js';
import { openStore, explainDbError } from './open-store.js';
import { ROOT } from './paths.js';
import { HttpError, SECURITY_HEADERS, cleanText, clientIp, cookieHeader, isInt, readJson, sendJson } from './http.js';
const gz = promisify(gzip);
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
// PostgreSQL when DATABASE_URL is set, otherwise the JSON file. Everything below talks to `store`.
const { store, label: dbLabel } = openStore();
const routes = new Map();
const route = (method, path, fn) => routes.set(`${method} ${path}`, fn);
const publicUser = (u) => ({ name: u.name, email: u.email });
const requireUser = (c) => {
    if (!c.user)
        throw new HttpError(401, 'login_required', 'Please log in first.');
    return c.user;
};
const langOf = (url) => (url.searchParams.get('lang') === 'ar' ? 'ar' : 'en');
const productIdOf = (url) => {
    const id = Number(url.searchParams.get('product'));
    if (!isInt(id, 1, 1_000_000))
        throw new HttpError(400, 'bad_product', 'Missing or invalid product id.');
    return id;
};
route('GET', '/api/health', async ({ res }) => {
    await store.ping();
    sendJson(res, 200, { ok: true, db: store.kind, time: Date.now() });
});
route('GET', '/api/products', async ({ res, url }) => {
    const { products, offline, cachedAt } = await getCatalogue(langOf(url));
    sendJson(res, 200, { products, offline, cachedAt });
});
// ---------- accounts ----------
async function startSession({ res }, user, status) {
    const token = await createSession(store, user.id);
    sendJson(res, status, { user: publicUser(user) }, { 'Set-Cookie': cookieHeader(COOKIE, token, { maxAgeSec: SESSION_DAYS * 86400, secure: SECURE_COOKIE }) });
}
route('POST', '/api/auth/register', async (c) => {
    const body = await readJson(c.req);
    throttle(`reg:${clientIp(c.req)}`, 10);
    const name = cleanText(body.name, 60);
    if (!name)
        throw new HttpError(400, 'name_missing', 'Please enter your name.');
    const email = checkEmail(body.email);
    checkPassword(body.password);
    if (await store.userByEmail(email))
        throw new HttpError(409, 'email_taken', 'An account with that email already exists.');
    const user = { id: randomUUID(), name, email, pass: await hashPassword(body.password), createdAt: Date.now() };
    // createUser also refuses duplicates itself, which covers two sign-ups arriving at the same moment.
    if (!(await store.createUser(user)))
        throw new HttpError(409, 'email_taken', 'An account with that email already exists.');
    await startSession(c, user, 201);
});
route('POST', '/api/auth/login', async (c) => {
    const body = await readJson(c.req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    throttle(`login:${clientIp(c.req)}:${email}`, 8);
    const user = await store.userByEmail(email);
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    const ok = await verifyPassword(password, user ? user.pass : await decoyHash());
    if (!user || !ok)
        throw new HttpError(401, 'bad_credentials', 'Incorrect email or password.');
    await startSession(c, user, 200);
});
route('POST', '/api/auth/logout', async ({ req, res }) => {
    await endSession(store, req);
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(COOKIE, '', { maxAgeSec: 0, secure: SECURE_COOKIE }) });
});
route('GET', '/api/auth/me', (c) => sendJson(c.res, 200, { user: publicUser(requireUser(c)) }));
// ---------- orders: the server works out every price itself ----------
route('POST', '/api/orders', async (c) => {
    const user = requireUser(c);
    const body = await readJson(c.req);
    if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 50)
        throw new HttpError(400, 'bad_cart', 'Your cart is empty or invalid.');
    const wanted = new Map();
    for (const l of body.lines) {
        if (!l || !isInt(l.id, 1, 1_000_000) || !isInt(l.qty, 1, 99))
            throw new HttpError(400, 'bad_cart', 'A cart line is invalid.');
        wanted.set(l.id, Math.min(99, (wanted.get(l.id) ?? 0) + l.qty));
    }
    const found = await findProducts([...wanted.keys()]);
    if (found.size !== wanted.size)
        throw new HttpError(400, 'unknown_product', 'Some items are no longer available.');
    let pct = 0;
    let promoCode = '';
    if (typeof body.promoCode === 'string' && body.promoCode.trim()) {
        promoCode = body.promoCode.trim().toUpperCase().slice(0, 30);
        if (!Object.hasOwn(PROMO_CODES, promoCode))
            throw new HttpError(400, 'invalid_promo', 'That promo code is not valid.');
        pct = PROMO_CODES[promoCode];
    }
    // Money is calculated in whole cents to avoid rounding drift.
    const lines = [...wanted].map(([id, qty]) => {
        const p = found.get(id);
        return { id, title: p.title, thumbnail: p.thumbnail, qty, price: p.price };
    });
    const subC = lines.reduce((n, l) => n + Math.round(l.price * 100) * l.qty, 0);
    const delC = subC >= FREE_DELIVERY_AT * 100 ? 0 : DELIVERY_FEE * 100;
    const disC = Math.round((subC * pct) / 100);
    const order = {
        id: 'OS-' + randomBytes(3).toString('hex').toUpperCase(),
        userId: user.id,
        at: Date.now(),
        total: (subC - disC + delC) / 100,
        subtotal: subC / 100,
        delivery: delC / 100,
        discountPct: pct,
        promoCode,
        lines,
    };
    await store.createOrder(order);
    const { userId: _hidden, ...out } = order;
    sendJson(c.res, 201, { order: out });
});
route('GET', '/api/orders', async (c) => {
    const user = requireUser(c);
    sendJson(c.res, 200, { orders: await store.ordersFor(user.id, 50) });
});
// ---------- reviews ----------
route('GET', '/api/reviews', async (c) => {
    const id = productIdOf(c.url);
    sendJson(c.res, 200, await store.reviewsFor(id, c.user?.id ?? null, 20));
});
route('POST', '/api/reviews', async (c) => {
    const user = requireUser(c);
    const body = await readJson(c.req);
    if (!isInt(body.productId, 1, 1_000_000))
        throw new HttpError(400, 'bad_product', 'Invalid product.');
    if (!isInt(body.rating, 1, 5))
        throw new HttpError(400, 'bad_rating', 'Choose a rating from 1 to 5.');
    const text = cleanText(body.text, 500);
    if ((await findProducts([body.productId])).size === 0)
        throw new HttpError(404, 'unknown_product', 'That product does not exist.');
    const existed = await store.hasReview(body.productId, user.id);
    await store.saveReview({ id: randomUUID(), productId: body.productId, userId: user.id, name: user.name, rating: body.rating, text, at: Date.now() });
    sendJson(c.res, existed ? 200 : 201, { ok: true });
});
route('DELETE', '/api/reviews', async (c) => {
    const user = requireUser(c);
    await store.deleteReview(productIdOf(c.url), user.id);
    sendJson(c.res, 200, { ok: true });
});
// ---------- rewards profile (points, wishlist...) synced across devices ----------
const ids = (v) => (Array.isArray(v) ? v.filter((n) => isInt(n, 0, 1_000_000)).slice(0, 500) : []);
const num = (v, max) => (isInt(v, 0, max) ? v : 0);
route('GET', '/api/profile', async (c) => sendJson(c.res, 200, { profile: await store.profile(requireUser(c).id) }));
route('PUT', '/api/profile', async (c) => {
    const user = requireUser(c);
    const b = await readJson(c.req);
    const profile = {
        points: num(b.points, 10_000_000),
        streak: num(b.streak, 100_000),
        last: cleanText(b.last, 40),
        wish: ids(b.wish),
        ever: ids(b.ever),
        ach: Array.isArray(b.ach) ? b.ach.map((a) => cleanText(a, 30)).filter(Boolean).slice(0, 30) : [],
        adds: num(b.adds, 1_000_000),
        gift: cleanText(b.gift, 40),
        gifts: num(b.gifts, 100_000),
        updatedAt: Date.now(),
    };
    await store.saveProfile(user.id, profile);
    sendJson(c.res, 200, { profile });
});
async function handleApi(req, res, url) {
    try {
        const method = req.method ?? 'GET';
        // Refuse cross-site writes: the browser's Origin must match this server.
        const origin = req.headers.origin;
        if (method !== 'GET' && method !== 'HEAD' && origin) {
            let same = false;
            try {
                same = new URL(origin).host === req.headers.host;
            }
            catch { /* bad origin */ }
            if (!same)
                throw new HttpError(403, 'bad_origin', 'Cross-site requests are not allowed.');
        }
        const handler = routes.get(`${method} ${url.pathname}`);
        if (!handler) {
            const known = [...routes.keys()].some((k) => k.endsWith(` ${url.pathname}`));
            throw new HttpError(known ? 405 : 404, known ? 'method_not_allowed' : 'not_found', known ? 'Method not allowed.' : 'No such API route.');
        }
        await handler({ req, res, url, user: await userFrom(store, req) });
    }
    catch (err) {
        if (res.headersSent)
            return void res.end();
        if (err instanceof HttpError)
            return sendJson(res, err.status, { error: err.code, message: err.message });
        console.error(err);
        sendJson(res, 500, { error: 'server_error', message: 'Something went wrong on the server.' });
    }
}
// ======================================================================
// Static files: only the pages, stylesheets and compiled scripts are public
// ======================================================================
const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};
const isPublic = (rel) => (/^[\w.-]+\.(html|css)$/.test(rel)) || (rel.startsWith(`dist${sep}`) && /\.(js|map)$/.test(rel) && !rel.includes('..'));
async function serveStatic(req, res, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    }
    catch {
        return void sendJson(res, 400, { error: 'bad_path' });
    }
    if (pathname === '/') {
        res.writeHead(302, { Location: '/index.html', ...SECURITY_HEADERS });
        return void res.end();
    }
    if (pathname === '/favicon.ico') {
        res.writeHead(204, SECURITY_HEADERS);
        return void res.end();
    }
    const rel = normalize(pathname).replace(/^[/\\]+/, '');
    const file = resolve(ROOT, rel);
    if (!file.startsWith(ROOT + sep) || !isPublic(rel))
        return notFound(res);
    let info;
    try {
        info = await stat(file);
    }
    catch {
        return notFound(res);
    }
    if (!info.isFile())
        return notFound(res);
    const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    const headers = { 'Content-Type': type, ETag: etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding', ...SECURITY_HEADERS };
    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        return void res.end();
    }
    let body = await readFile(file);
    if (body.length > 1024 && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
        body = await gz(body);
        headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
}
function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('Not found');
}
// ======================================================================
// Start
// ======================================================================
try {
    await store.init();
}
catch (err) {
    console.error(`\nCould not start the database (${dbLabel}):\n  ${explainDbError(err)}\n`);
    process.exit(1);
}
// Expired logins are cleaned out once an hour.
setInterval(() => void store.purgeSessions().catch(() => undefined), 60 * 60_000).unref();
const server = createServer((req, res) => {
    const started = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.url?.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`));
    let url;
    try {
        url = new URL(req.url ?? '/', 'http://localhost');
    }
    catch {
        return notFound(res);
    }
    if (url.pathname.startsWith('/api/'))
        void handleApi(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD')
        void serveStatic(req, res, url).catch(() => notFound(res));
    else {
        res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS });
        res.end();
    }
});
server.listen(PORT, HOST, () => {
    console.log(`\nOmniStore is running\n  Local:    http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
        for (const list of Object.values(networkInterfaces())) {
            for (const n of list ?? [])
                if (n.family === 'IPv4' && !n.internal)
                    console.log(`  Network:  http://${n.address}:${PORT}`);
        }
    }
    else
        console.log('  (set HOST=0.0.0.0 to open it from your phone on the same Wi-Fi)');
    console.log(`  Database: ${dbLabel}\n`);
});
const stop = () => {
    server.close();
    void store.close().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
//# sourceMappingURL=server.js.map