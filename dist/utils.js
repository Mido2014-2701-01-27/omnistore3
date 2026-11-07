// ---------- DOM helpers ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
/** Create an element. Text is set with textContent, so it can never inject HTML. */
export function el(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text != null)
        node.textContent = text;
    return node;
}
/** Restart a CSS animation class on an element. */
export function replay(node, cls) {
    if (!node)
        return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
}
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function debounce(fn, ms) {
    let t;
    return (...a) => {
        window.clearTimeout(t);
        t = window.setTimeout(() => fn(...a), ms);
    };
}
/** SAR is pegged to the dollar at 3.75. The EUR rate is approximate, for display only. */
export const CURRENCIES = {
    USD: { rate: 1, label: 'USD $' },
    SAR: { rate: 3.75, label: 'SAR ﷼' },
    EUR: { rate: 0.92, label: 'EUR €' },
};
export const getCurrency = () => {
    const c = localStorage.getItem('currency');
    return c === 'SAR' || c === 'EUR' ? c : 'USD';
};
export function money(usd) {
    const code = getCurrency();
    const v = (usd * CURRENCIES[code].rate).toFixed(2);
    if (code === 'USD')
        return `$${v}`;
    if (code === 'EUR')
        return `€${v}`;
    return getLang() === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}
export function setCurrency(code) {
    localStorage.setItem('currency', code);
    bus.emit('currency:changed', { code });
}
export function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
// ---------- Storage helpers (never throw) ----------
export function read(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : (JSON.parse(raw) ?? fallback);
    }
    catch {
        return fallback;
    }
}
export function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        /* storage blocked or full: ignore */
    }
}
export function remove(key) {
    try {
        localStorage.removeItem(key);
    }
    catch {
        /* ignore */
    }
}
export const getLang = () => (localStorage.getItem('lang') === 'ar' ? 'ar' : 'en');
export const getUser = () => read('currentUser', null);
// SECURITY NOTE: this reads localStorage only. There is no server session, so
// anything gated behind it can be bypassed in DevTools. Real login and checkout
// gating must be enforced by a backend.
export const isGuest = () => {
    const u = getUser();
    return !u || u.isGuest;
};
class Bus {
    map = new Map();
    on(name, fn) {
        if (!this.map.has(name))
            this.map.set(name, new Set());
        this.map.get(name).add(fn);
        return () => this.map.get(name)?.delete(fn);
    }
    emit(name, payload) {
        this.map.get(name)?.forEach((fn) => fn(payload));
    }
}
export const bus = new Bus();
// ---------- Modal accessibility ----------
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
const lastFocus = new WeakMap();
export function isOpen(modal) {
    return modal.style.display === 'flex';
}
/** Show a modal, move focus inside it, and remember where to return focus. */
export function openModal(modal) {
    if (!isOpen(modal))
        lastFocus.set(modal, document.activeElement);
    modal.style.display = 'flex';
    const box = modal.querySelector('.modal-content');
    box?.setAttribute('role', 'dialog');
    box?.setAttribute('aria-modal', 'true');
    requestAnimationFrame(() => (modal.querySelector(FOCUSABLE) ?? box)?.focus?.());
}
export function closeModal(modal) {
    if (modal.style.display === 'none')
        return;
    modal.style.display = 'none';
    lastFocus.get(modal)?.focus?.();
}
/** Keep Tab / Shift+Tab inside the open modal. */
export function trapFocus(e) {
    if (e.key !== 'Tab')
        return;
    const open = $$('.modal').find(isOpen);
    if (!open)
        return;
    const items = $$(FOCUSABLE, open).filter((n) => n.offsetParent !== null);
    if (!items.length)
        return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}
// Let the close "×" buttons work with Enter / Space too (they are role="button").
document.addEventListener('keydown', (e) => {
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.classList?.contains('close-modal')) {
        e.preventDefault();
        t.click();
    }
});
//# sourceMappingURL=utils.js.map