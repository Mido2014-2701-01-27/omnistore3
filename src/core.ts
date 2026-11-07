import { DELIVERY_FEE, FREE_DELIVERY_AT, PROMO_CODES, categoryQueries, customJewelry, customPCs, offlineProductsFallback } from './data.js';
import { api } from './api.js';
import { tr } from './i18n.js';
import type { CartLine, Lang, Product, Theme, ToastOptions } from './types.js';
import { $, $$, bus, el, getLang, read, remove, write } from './utils.js';

// ======================================================================
// Shared store state: products, cart, promo. Everything else reads from here.
// ======================================================================
export const state = {
  products: [] as Product[],
  cart: [] as CartLine[],
  discountPct: 0,
  promoCode: '',
  offline: false,
  lang: getLang() as Lang,
};

const CART_KEY = 'omni_cart';

// ---------- Cart persistence (accepts the old format: a flat list of products) ----------
const isProduct = (p: any): p is Product =>
  !!p && typeof p.id === 'number' && typeof p.title === 'string' && typeof p.price === 'number' && typeof p.thumbnail === 'string';

export function restoreCart(): void {
  const saved = read<unknown[]>(CART_KEY, []);
  if (!Array.isArray(saved)) return;
  const lines = new Map<number, CartLine>();
  for (const item of saved.slice(0, 80) as any[]) {
    const product = isProduct(item?.product) ? item.product : isProduct(item) ? item : null;
    if (!product) continue;
    const qty = Math.min(99, Math.max(1, Number(item?.qty) || 1));
    const line = lines.get(product.id);
    if (line) line.qty = Math.min(99, line.qty + qty);
    else lines.set(product.id, { product, qty });
  }
  state.cart = [...lines.values()];
}

export const clearSavedCart = (): void => remove(CART_KEY);

// ---------- Totals ----------
export interface Totals {
  count: number;
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
}

export function totals(): Totals {
  const count = state.cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = state.cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  // A $100.00 cart already qualifies for free delivery.
  const delivery = subtotal >= FREE_DELIVERY_AT || subtotal === 0 ? 0 : DELIVERY_FEE;
  const discount = subtotal * (state.discountPct / 100);
  return { count, subtotal, delivery, discount, total: subtotal - discount + delivery };
}

function commit(): void {
  if (!state.cart.length) {
    state.discountPct = 0;
    state.promoCode = '';
  }
  write(CART_KEY, state.cart);
  bus.emit('cart:changed', { lines: state.cart });
}

// ---------- Cart actions ----------
export function addToCart(id: number, x?: number, y?: number): boolean {
  const product = state.products.find((p) => p.id === id);
  if (!product) return false;
  const line = state.cart.find((l) => l.product.id === id);
  if (line) {
    if (line.qty >= 99) return false;
    line.qty++;
  } else {
    state.cart.push({ product, qty: 1 });
  }
  commit();
  showToast(`${tr('toast_added', state.lang)} "${product.title}"`);
  bus.emit('cart:added', { product, x: x ?? innerWidth / 2, y: y ?? innerHeight / 2 });
  return true;
}

export function changeQty(id: number, delta: number): void {
  const i = state.cart.findIndex((l) => l.product.id === id);
  if (i < 0) return;
  const next = state.cart[i].qty + delta;
  if (next < 1) return removeLine(id);
  state.cart[i].qty = Math.min(99, next);
  commit();
}

/** Remove a line and offer an Undo that puts it back in the same spot. */
export function removeLine(id: number): void {
  const i = state.cart.findIndex((l) => l.product.id === id);
  if (i < 0) return;
  const [gone] = state.cart.splice(i, 1);
  commit();
  showToast(`${tr('toast_removed', state.lang)} "${gone.product.title}"`, {
    duration: 6000,
    action: {
      label: tr('undo', state.lang),
      run: () => {
        state.cart.splice(Math.min(i, state.cart.length), 0, gone);
        commit();
        showToast(tr('toast_restored', state.lang));
      },
    },
  });
}

export function clearCart(): void {
  state.cart = [];
  commit();
}

// ---------- Promo codes ----------
export function applyPromo(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  const pct = PROMO_CODES[code];
  if (!pct) {
    showToast(tr('toast_promo_invalid', state.lang));
    return false;
  }
  state.discountPct = pct;
  state.promoCode = code;
  commit();
  showToast(tr('toast_promo_applied', state.lang));
  return true;
}

export function removePromo(): void {
  state.discountPct = 0;
  state.promoCode = '';
  commit();
  showToast(tr('toast_promo_removed', state.lang));
}

// ---------- Catalogue ----------
export async function loadProducts(): Promise<void> {
  const lang = state.lang;
  // With the Node server running, it supplies (and caches) the whole catalogue.
  if (api.available) {
    try {
      const data = await api.get<{ products: Product[]; offline: boolean }>(`/api/products?lang=${lang}`);
      if (data.products?.length) {
        state.products = data.products;
        state.offline = !!data.offline;
        return;
      }
    } catch {
      /* fall through to the direct fetch below */
    }
  }
  const custom = [...(customJewelry[lang] ?? customJewelry.en), ...(customPCs[lang] ?? customPCs.en)];
  const fallback = offlineProductsFallback[lang] ?? offlineProductsFallback.en;
  const cats = Array.from(new Set(Object.values(categoryQueries).flat()));
  let live: Product[] = [];
  try {
    const results = await Promise.all(
      cats.map((c) =>
        fetch(`https://dummyjson.com/products/category/${c}?limit=30`)
          .then((r) => {
            if (!r.ok) throw new Error('bad response');
            return r.json() as Promise<{ products?: Product[] }>;
          })
          .then((d) => d.products ?? [])
          .catch(() => [] as Product[]),
      ),
    );
    live = results.flat();
  } catch {
    live = [];
  }
  state.offline = live.length === 0;
  state.products = [...custom, ...(state.offline ? fallback : live)];
}

// ---------- Toasts (single timer, optional action button) ----------
let toastTimer: number | undefined;

export function showToast(message: string, opts: ToastOptions = {}): void {
  const toast = $('#toast-notification');
  const msg = $('#toast-message');
  if (!toast || !msg) return;
  msg.textContent = message;
  toast.querySelector('.toast-action')?.remove();
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  if (opts.action) {
    const btn = el('button', 'toast-action', opts.action.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      opts.action!.run();
      toast.classList.remove('show');
    });
    toast.appendChild(btn);
  }
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), opts.duration ?? 3500);
}

// ---------- Theme ----------
export function applyTheme(theme: Theme): void {
  document.body.classList.toggle('light-mode', theme === 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
  applyTheme((localStorage.getItem('theme') as Theme) || 'dark');
  const btn = $('#theme-toggle');
  if (!btn) return;
  const paint = () => {
    const light = document.body.classList.contains('light-mode');
    btn.textContent = light ? '🌙' : '☀️';
    btn.setAttribute('aria-label', light ? 'Switch to Dark Mode' : 'Switch to Light Mode');
  };
  paint();
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const next: Theme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('theme', next);
    paint();
  });
}

// ---------- Language ----------
export function setLanguage(lang: Lang): void {
  state.lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  $$('[data-i18n]').forEach((n) => {
    n.textContent = tr(n.dataset.i18n!, lang);
  });
  $$<HTMLInputElement>('[data-i18n-placeholder]').forEach((n) => {
    n.placeholder = tr(n.dataset.i18nPlaceholder!, lang);
  });

  const who = $('#user-display');
  if (who) {
    const u = read<{ name: string; isGuest?: boolean } | null>('currentUser', null);
    who.textContent = !u || u.isGuest ? tr('guest_user', lang) : `${tr('welcome_user', lang)}${u.name}`;
  }
  bus.emit('lang:changed', { lang });
}

export function initLanguage(): void {
  const select = $<HTMLSelectElement>('#lang-select');
  if (select) {
    select.value = state.lang;
    select.addEventListener('change', () => setLanguage(select.value === 'ar' ? 'ar' : 'en'));
  }
  setLanguage(state.lang);
}
