import { categoryQueries, customJewelry, customPCs, offlineProductsFallback } from '../src/data.js';
const TTL = 10 * 60_000;
let live = [];
let fetchedAt = 0;
let inflight;
const clean = (p) => p && Number.isInteger(p.id) && typeof p.title === 'string' && typeof p.price === 'number' && typeof p.thumbnail === 'string'
    ? {
        id: p.id,
        title: String(p.title).slice(0, 200),
        category: String(p.category ?? ''),
        price: p.price,
        description: String(p.description ?? '').slice(0, 1000),
        thumbnail: p.thumbnail,
        rating: typeof p.rating === 'number' ? p.rating : undefined,
    }
    : null;
async function refresh() {
    const cats = Array.from(new Set(Object.values(categoryQueries).flat()));
    const results = await Promise.all(cats.map((c) => fetch(`https://dummyjson.com/products/category/${encodeURIComponent(c)}?limit=30`, { signal: AbortSignal.timeout(6000) })
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((d) => (d.products ?? []).map(clean).filter((p) => !!p))
        .catch(() => [])));
    const fresh = results.flat();
    // Keep serving the last good copy if the live source is down.
    if (fresh.length) {
        live = fresh;
        fetchedAt = Date.now();
    }
}
export async function getCatalogue(lang) {
    if (Date.now() - fetchedAt > TTL) {
        inflight ??= refresh().finally(() => (inflight = undefined));
        await inflight;
    }
    const custom = [...customJewelry[lang], ...customPCs[lang]];
    const offline = live.length === 0;
    return { products: [...custom, ...(offline ? offlineProductsFallback[lang] : live)], offline, cachedAt: fetchedAt };
}
export async function findProducts(ids) {
    const { products } = await getCatalogue('en');
    const map = new Map();
    for (const p of products)
        if (ids.includes(p.id))
            map.set(p.id, p);
    return map;
}
//# sourceMappingURL=catalogue.js.map