import { openProductModal, showGuestAuthPrompt } from './app.js';
import { api, serverSession } from './api.js';
import { addToCart, showToast, state } from './core.js';
import { extrasText } from './i18n.js';
import { $, $$, CURRENCIES, bus, closeModal, debounce, el, getCurrency, getUser, isGuest, isOpen, money, openModal, read, setCurrency, write, } from './utils.js';
// ======================================================================
// Extras: currency switcher, compare tray, orders + tracking, "picked for you",
// product zoom + share links, deep links, and a daily-rewards countdown.
// ======================================================================
const x = () => extrasText[state.lang];
const accountKey = (prefix) => {
    const u = getUser();
    return u && !u.isGuest ? `${prefix}:${String(u.email || u.name).trim().toLowerCase()}` : null;
};
function makeModal(id) {
    let m = document.getElementById(id);
    if (!m) {
        m = el('div', 'modal');
        m.id = id;
        m.style.display = 'none';
        const self = m;
        m.addEventListener('click', (e) => e.target === self && closeModal(self));
        document.body.append(m);
    }
    return m;
}
function closeButton(modal) {
    const b = el('span', 'close-modal', '×');
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.setAttribute('aria-label', 'Close');
    b.onclick = () => closeModal(modal);
    return b;
}
export function initExtras() {
    const grid = $('#product-grid');
    if (!grid)
        return;
    currency();
    compare(grid);
    orders();
    picked(grid);
    productExtras();
    suggest();
    dailyBar();
    deepLink();
}
// ---------- Currency ----------
function currency() {
    const sel = el('select', 'lang-dropdown');
    sel.id = 'currency-select';
    sel.setAttribute('aria-label', 'Currency');
    Object.keys(CURRENCIES).forEach((c) => {
        const o = el('option', '', CURRENCIES[c].label);
        o.value = c;
        sel.append(o);
    });
    sel.value = getCurrency();
    sel.title = x().currencyNote;
    sel.addEventListener('change', () => setCurrency(sel.value));
    $('#lang-select')?.before(sel);
    bus.on('lang:changed', () => (sel.title = x().currencyNote));
}
// ---------- Compare ----------
function compare(grid) {
    let ids = [];
    const tray = el('div', 'cmp-tray');
    tray.setAttribute('role', 'region');
    document.body.append(tray);
    const modal = makeModal('cmp-modal');
    const product = (id) => state.products.find((p) => p.id === id);
    function paintCards() {
        $$('.card', grid).forEach((card) => {
            const on = ids.includes(Number(card.dataset.id));
            const b = $('.cmp-btn', card);
            b?.classList.toggle('on', on);
            b?.setAttribute('aria-pressed', String(on));
        });
    }
    function paintTray() {
        tray.replaceChildren();
        tray.classList.toggle('show', ids.length > 0);
        if (!ids.length)
            return;
        tray.append(el('b', '', `⇄ ${x().compare} (${ids.length}/3)`));
        ids.forEach((id) => {
            const p = product(id);
            if (!p)
                return;
            const chip = el('button', 'cmp-chip');
            chip.type = 'button';
            chip.title = x().cRemove;
            const img = el('img');
            img.src = p.thumbnail;
            img.alt = p.title;
            chip.append(img, el('span', '', '×'));
            chip.onclick = () => toggle(id);
            tray.append(chip);
        });
        const go = el('button', 'btn', x().compareGo);
        go.type = 'button';
        go.disabled = ids.length < 2;
        go.title = ids.length < 2 ? x().compareNeed : '';
        go.onclick = open;
        const clear = el('button', 'eng-clear', x().compareClear);
        clear.type = 'button';
        clear.onclick = () => { ids = []; paintTray(); paintCards(); };
        tray.append(go, clear);
    }
    function toggle(id) {
        if (ids.includes(id))
            ids = ids.filter((n) => n !== id);
        else if (ids.length >= 3)
            return showToast(x().compareMax);
        else
            ids.push(id);
        paintTray();
        paintCards();
    }
    function open() {
        const list = ids.map(product).filter((p) => !!p);
        if (list.length < 2)
            return showToast(x().compareNeed);
        const bestPrice = Math.min(...list.map((p) => p.price));
        const bestRating = Math.max(...list.map((p) => p.rating ?? 0));
        const rows = [
            ['', (p) => { const i = el('img'); i.src = p.thumbnail; i.alt = p.title; return i; }],
            ['', (p) => el('b', '', p.title)],
            [x().cPrice, (p) => money(p.price), (p) => p.price === bestPrice],
            [x().cRating, (p) => `★ ${(p.rating ?? 4.5).toFixed(1)}`, (p) => (p.rating ?? 0) === bestRating],
            [x().cCategory, (p) => p.category.replace(/-/g, ' ')],
            [x().cAbout, (p) => (p.description || '').slice(0, 110)],
            ['', (p) => { const b = el('button', 'btn', state.lang === 'ar' ? 'إضافة إلى السلة' : 'Add to Reserve'); b.type = 'button'; b.onclick = (e) => addToCart(p.id, e.clientX, e.clientY); return b; }],
        ];
        const table = el('table', 'cmp-table');
        rows.forEach(([label, cell, best]) => {
            const tr = el('tr');
            tr.append(el('th', '', label));
            list.forEach((p) => {
                const td = el('td', best?.(p) ? 'best' : '');
                const v = cell(p);
                td.append(v);
                if (best?.(p))
                    td.append(el('small', '', `✓ ${x().compareBest}`));
                tr.append(td);
            });
            table.append(tr);
        });
        const wrap = el('div', 'cmp-scroll');
        wrap.append(table);
        const box = el('div', 'modal-content cmp-box');
        box.append(closeButton(modal), el('h3', '', x().compareTitle), wrap);
        modal.replaceChildren(box);
        openModal(modal);
    }
    bus.on('render', () => {
        $$('.card', grid).forEach((card) => {
            const id = Number(card.dataset.id);
            const b = el('button', 'cmp-btn', '⇄');
            b.type = 'button';
            b.title = x().compare;
            b.setAttribute('aria-label', x().compare);
            b.addEventListener('click', (e) => { e.stopPropagation(); toggle(id); });
            card.append(b);
        });
        paintCards();
        paintTray();
    });
    bus.on('lang:changed', paintTray);
}
// ---------- Orders + tracking ----------
// Demo timeline: seconds after the order is placed when each step begins.
const STEP_AT = [0, 15, 40, 70, 110];
function orders() {
    const modal = makeModal('orders-modal');
    const btn = el('button', 'orders-btn', x().orders);
    btn.type = 'button';
    $('#cart-btn')?.before(btn);
    let timer;
    let cache = [];
    const localLoad = () => {
        const k = accountKey('omni_orders');
        return k ? read(k, []) : [];
    };
    /** Orders come from the Node server when you are logged in through it, otherwise from this browser. */
    async function refresh() {
        if (serverSession()) {
            try {
                cache = (await api.get('/api/orders')).orders;
                return;
            }
            catch {
                /* fall back to this browser's copy */
            }
        }
        cache = localLoad();
    }
    const stepOf = (o) => {
        const s = (Date.now() - o.at) / 1000;
        return STEP_AT.reduce((n, at, i) => (s >= at ? i : n), 0);
    };
    function paintTracks() {
        $$('.track', modal).forEach((t) => {
            const o = cache.find((r) => r.id === t.dataset.order);
            if (!o)
                return;
            const step = stepOf(o);
            t.style.setProperty('--p', String(step / (STEP_AT.length - 1)));
            $$('li', t).forEach((li, i) => { li.classList.toggle('done', i <= step); li.classList.toggle('now', i === step); });
        });
    }
    /** Save a plain-text receipt (amounts in USD, the store's base currency). */
    function receipt(o) {
        const usd = (n) => `$${n.toFixed(2)}`;
        const sub = o.subtotal ?? o.lines.reduce((n, l) => n + l.price * l.qty, 0);
        const rows = [
            'OMNISTORE RECEIPT', `Order ${o.id}`, new Date(o.at).toLocaleString('en-GB'), '-'.repeat(40),
            ...o.lines.map((l) => `${String(l.qty).padStart(2)} x ${l.title.slice(0, 26).padEnd(26)} ${usd(l.price * l.qty).padStart(10)}`),
            '-'.repeat(40),
            `Subtotal: ${usd(sub)}`,
            `Delivery: ${usd(o.delivery ?? 0)}`,
            ...(o.discountPct ? [`Discount${o.promoCode ? ` (${o.promoCode})` : ''}: -${o.discountPct}%`] : []),
            `TOTAL: ${usd(o.total)}`, '', 'All amounts in USD. Thank you for shopping with OmniStore.',
        ];
        const url = URL.createObjectURL(new Blob([rows.join('\r\n')], { type: 'text/plain' }));
        const a = el('a');
        a.href = url;
        a.download = `receipt-${o.id}.txt`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function open() {
        if (isGuest())
            return showGuestAuthPrompt();
        await refresh();
        const list = cache;
        const box = el('div', 'modal-content orders-box');
        box.append(closeButton(modal), el('h3', '', x().ordersTitle));
        if (!list.length)
            box.append(el('p', 'eng-sub', x().ordersEmpty));
        else
            box.append(el('p', 'eng-sub', x().demoNote));
        list.forEach((o) => {
            const card = el('article', 'order');
            const head = el('header');
            head.append(el('b', '', `${x().orderNo} ${o.id}`), el('span', '', new Date(o.at).toLocaleString(state.lang === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })), el('b', 'order-total', money(o.total)));
            const thumbs = el('div', 'order-thumbs');
            o.lines.slice(0, 6).forEach((l) => {
                const i = el('img');
                i.src = l.thumbnail;
                i.alt = l.title;
                i.title = `${l.title} × ${l.qty}`;
                thumbs.append(i);
            });
            thumbs.append(el('span', '', `${o.lines.reduce((n, l) => n + l.qty, 0)} ${x().items}`));
            const rc = el('button', 'receipt-btn', x().receipt);
            rc.type = 'button';
            rc.onclick = () => receipt(o);
            thumbs.append(rc);
            const track = el('ol', 'track');
            track.dataset.order = o.id;
            x().steps.forEach((s) => track.append(el('li', '', s)));
            card.append(head, thumbs, track);
            box.append(card);
        });
        modal.replaceChildren(box);
        // Only one window at a time: close the cart or "order placed" window first.
        $$('.modal').filter((m) => m !== modal && isOpen(m)).forEach(closeModal);
        openModal(modal);
        paintTracks();
        window.clearInterval(timer);
        timer = window.setInterval(() => (modal.style.display === 'flex' ? paintTracks() : window.clearInterval(timer)), 1000);
    }
    btn.onclick = () => void open();
    bus.on('lang:changed', () => (btn.textContent = x().orders));
    bus.on('checkout:done', ({ lines, total, order: fromServer }) => {
        const k = accountKey('omni_orders');
        if (!k)
            return;
        if (fromServer) {
            cache = [fromServer, ...cache.filter((o) => o.id !== fromServer.id)]; // already saved by the server
        }
        else {
            const order = {
                id: 'OS-' + Date.now().toString(36).toUpperCase().slice(-6),
                at: Date.now(),
                total,
                lines: lines.map((l) => ({ id: l.product.id, title: l.product.title, thumbnail: l.product.thumbnail, qty: l.qty, price: l.product.price })),
            };
            write(k, [order, ...localLoad()].slice(0, 20));
        }
        // The button lives in the "Order placed" window because toasts can be replaced by other messages.
        const done = $('#checkout-success-modal .modal-content');
        if (done) {
            done.querySelector('.track-order-btn')?.remove();
            const go = el('button', 'btn outline track-order-btn', `📦 ${x().track}`);
            go.type = 'button';
            go.style.marginTop = '.75rem';
            go.onclick = () => void open();
            done.append(go);
        }
    });
}
// ---------- Picked for you ----------
function picked(grid) {
    const row = el('section', 'picked');
    row.setAttribute('aria-label', 'Picked for you');
    grid.parentNode.insertBefore(row, grid);
    function paint() {
        row.replaceChildren();
        if (!state.products.length)
            return void row.classList.remove('has');
        const wishKey = accountKey('omni_engage');
        const wish = wishKey ? read(wishKey, {}).wish ?? [] : [];
        const seeds = new Set([...wish, ...read('omni_recent', []), ...state.cart.map((l) => l.product.id)]);
        const cats = new Set(state.products.filter((p) => seeds.has(p.id)).map((p) => p.category));
        const byRating = (a, b) => (b.rating ?? 0) - (a.rating ?? 0);
        const fromCats = state.products.filter((p) => cats.has(p.category) && !seeds.has(p.id)).sort(byRating);
        const fill = state.products.filter((p) => !seeds.has(p.id) && !fromCats.includes(p)).sort(byRating);
        const picks = [...fromCats, ...fill].slice(0, 6);
        row.classList.toggle('has', picks.length > 0);
        if (!picks.length)
            return;
        row.append(el('h4', '', x().picked));
        const scroller = el('div', 'picked-row');
        picks.forEach((p) => {
            const b = el('button', 'pick-card');
            b.type = 'button';
            const img = el('img');
            img.src = p.thumbnail;
            img.alt = '';
            img.loading = 'lazy';
            b.append(img, el('span', 'pick-title', p.title), el('span', 'pick-price', money(p.price)));
            b.onclick = () => openProductModal(p.id);
            scroller.append(b);
        });
        row.append(scroller);
    }
    bus.on('render', paint);
    bus.on('product:opened', paint);
    bus.on('lang:changed', paint);
}
// ---------- Product dialog: zoom + share ----------
function productExtras() {
    const wrap = $('#product-modal .modal-img-container');
    const img = $('#product-modal-img');
    if (wrap && img) {
        wrap.classList.add('zoomable');
        wrap.addEventListener('mousemove', (e) => {
            const r = wrap.getBoundingClientRect();
            img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
        });
    }
    let current = 0;
    const share = el('button', 'btn outline share-btn', x().share);
    share.type = 'button';
    $('#product-modal .modal-footer-action')?.append(share);
    share.onclick = async () => {
        const url = `${location.origin}${location.pathname}#p=${current}`;
        try {
            await navigator.clipboard.writeText(url);
            showToast(x().copied);
        }
        catch {
            showToast(x().copyFail);
        }
    };
    bus.on('product:opened', ({ id }) => { current = id; share.textContent = x().share; });
}
// ---------- Daily rewards countdown ----------
function dailyBar() {
    const tools = $('.eng-tools');
    if (!tools || isGuest())
        return;
    const bar = el('div', 'daily-bar');
    bar.setAttribute('role', 'status');
    tools.after(bar);
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
        if (document.hidden)
            return;
        const today = new Date().toDateString();
        const gk = accountKey('omni_engage');
        const wk = accountKey('omni_wheel');
        const giftReady = (gk ? read(gk, {}).gift : '') !== today;
        const wheelReady = (wk ? read(wk, '') : '') !== today;
        if (giftReady || wheelReady) {
            bar.textContent = x().dailyReady;
            bar.classList.add('ready');
            return;
        }
        const next = new Date();
        next.setHours(24, 0, 0, 0);
        const s = Math.max(0, Math.floor((next.getTime() - Date.now()) / 1000));
        bar.classList.remove('ready');
        bar.textContent = x().dailyNext(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    tick();
    window.setInterval(tick, 1000);
}
// ---------- Deep links: store.html#p=123 opens that product ----------
function deepLink() {
    const m = /^#p=(\d+)$/.exec(location.hash);
    if (!m)
        return;
    const id = Number(m[1]);
    const off = bus.on('render', () => {
        off();
        if (state.products.some((p) => p.id === id))
            setTimeout(() => openProductModal(id), 300);
    });
}
// ---------- Search suggestions (a dropdown under the search box) ----------
function suggest() {
    const found = $('#eng-search');
    const tools = $('.eng-tools');
    if (!found || !tools)
        return;
    const input = found;
    const list = el('ul', 'sg-list');
    list.id = 'sg-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', x().suggestions);
    tools.append(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'sg-list');
    input.setAttribute('aria-expanded', 'false');
    let items = [];
    let sel = -1;
    const close = () => {
        list.hidden = true;
        sel = -1;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    };
    const pick = (p) => {
        close();
        openProductModal(p.id);
    };
    const mark = (title, q) => {
        const frag = document.createDocumentFragment();
        const at = title.toLowerCase().indexOf(q);
        if (at < 0) {
            frag.append(title);
            return frag;
        }
        frag.append(title.slice(0, at), el('mark', '', title.slice(at, at + q.length)), title.slice(at + q.length));
        return frag;
    };
    const highlight = () => {
        [...list.children].forEach((li, i) => {
            li.classList.toggle('on', i === sel);
            li.setAttribute('aria-selected', String(i === sel));
        });
        if (sel >= 0)
            input.setAttribute('aria-activedescendant', `sg-${sel}`);
        else
            input.removeAttribute('aria-activedescendant');
    };
    function show() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2)
            return close();
        items = state.products
            .filter((p) => p.title.toLowerCase().includes(q))
            .sort((a, b) => Number(b.title.toLowerCase().startsWith(q)) - Number(a.title.toLowerCase().startsWith(q)) || (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 6);
        if (!items.length)
            return close();
        list.replaceChildren();
        items.forEach((p, i) => {
            const li = el('li');
            li.id = `sg-${i}`;
            li.setAttribute('role', 'option');
            const img = el('img');
            img.src = p.thumbnail;
            img.alt = '';
            const name = el('span', 'sg-name');
            name.append(mark(p.title, q));
            li.append(img, name, el('b', '', money(p.price)));
            // mousedown (not click) so the input keeps focus and the list is still there
            li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(p); });
            li.addEventListener('mousemove', () => { sel = i; highlight(); });
            list.append(li);
        });
        // Line the list up under the search box (works in both text directions)
        list.style.left = `${input.offsetLeft}px`;
        list.style.top = `${input.offsetTop + input.offsetHeight + 6}px`;
        list.style.width = `${input.offsetWidth}px`;
        list.hidden = false;
        sel = -1;
        highlight();
        input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', debounce(show, 80));
    input.addEventListener('blur', close);
    input.addEventListener('keydown', (e) => {
        if (list.hidden)
            return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            sel = (sel + 1) % items.length;
            highlight();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            sel = (sel - 1 + items.length) % items.length;
            highlight();
        }
        else if (e.key === 'Enter' && sel >= 0) {
            e.preventDefault();
            pick(items[sel]);
        }
        else if (e.key === 'Escape')
            close();
    });
    bus.on('render', close);
    bus.on('currency:changed', close);
}
//# sourceMappingURL=extras.js.map