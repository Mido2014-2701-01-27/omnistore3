import type { BusEvents, Lang, User } from './types.js';

// ---------- DOM helpers ----------
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

/** Create an element. Text is set with textContent, so it can never inject HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Restart a CSS animation class on an element. */
export function replay(node: Element | null, cls: string): void {
  if (!node) return;
  node.classList.remove(cls);
  void (node as HTMLElement).offsetWidth;
  node.classList.add(cls);
}

export const prefersReducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: number | undefined;
  return (...a: A) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
}

// ---------- Currency (prices are stored in USD and converted for display) ----------
export type CurrencyCode = 'USD' | 'SAR' | 'EUR';
/** SAR is pegged to the dollar at 3.75. The EUR rate is approximate, for display only. */
export const CURRENCIES: Record<CurrencyCode, { rate: number; label: string }> = {
  USD: { rate: 1, label: 'USD $' },
  SAR: { rate: 3.75, label: 'SAR ﷼' },
  EUR: { rate: 0.92, label: 'EUR €' },
};
export const getCurrency = (): CurrencyCode => {
  const c = localStorage.getItem('currency');
  return c === 'SAR' || c === 'EUR' ? c : 'USD';
};
export function money(usd: number): string {
  const code = getCurrency();
  const v = (usd * CURRENCIES[code].rate).toFixed(2);
  if (code === 'USD') return `$${v}`;
  if (code === 'EUR') return `€${v}`;
  return getLang() === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}
export function setCurrency(code: CurrencyCode): void {
  localStorage.setItem('currency', code);
  bus.emit('currency:changed', { code });
}

export function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Storage helpers (never throw) ----------
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : ((JSON.parse(raw) as T) ?? fallback);
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: ignore */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const getLang = (): Lang => (localStorage.getItem('lang') === 'ar' ? 'ar' : 'en');
export const getUser = (): User | null => read<User | null>('currentUser', null);

// SECURITY NOTE: this reads localStorage only. There is no server session, so
// anything gated behind it can be bypassed in DevTools. Real login and checkout
// gating must be enforced by a backend.
export const isGuest = (): boolean => {
  const u = getUser();
  return !u || u.isGuest;
};

// ---------- Typed event bus ----------
type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

class Bus {
  private map = new Map<keyof BusEvents, Set<Handler<any>>>();

  on<K extends keyof BusEvents>(name: K, fn: Handler<K>): () => void {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name)!.add(fn);
    return () => this.map.get(name)?.delete(fn);
  }

  emit<K extends keyof BusEvents>(name: K, payload: BusEvents[K]): void {
    this.map.get(name)?.forEach((fn) => fn(payload));
  }
}

export const bus = new Bus();

// ---------- Modal accessibility ----------
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
const lastFocus = new WeakMap<HTMLElement, HTMLElement | null>();

export function isOpen(modal: HTMLElement): boolean {
  return modal.style.display === 'flex';
}

/** Show a modal, move focus inside it, and remember where to return focus. */
export function openModal(modal: HTMLElement): void {
  if (!isOpen(modal)) lastFocus.set(modal, document.activeElement as HTMLElement | null);
  modal.style.display = 'flex';
  const box = modal.querySelector<HTMLElement>('.modal-content');
  box?.setAttribute('role', 'dialog');
  box?.setAttribute('aria-modal', 'true');
  requestAnimationFrame(() => (modal.querySelector<HTMLElement>(FOCUSABLE) ?? box)?.focus?.());
}

export function closeModal(modal: HTMLElement): void {
  if (modal.style.display === 'none') return;
  modal.style.display = 'none';
  lastFocus.get(modal)?.focus?.();
}

/** Keep Tab / Shift+Tab inside the open modal. */
export function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const open = $$('.modal').find(isOpen);
  if (!open) return;
  const items = $$<HTMLElement>(FOCUSABLE, open).filter((n) => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// Let the close "×" buttons work with Enter / Space too (they are role="button").
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if ((e.key === 'Enter' || e.key === ' ') && t.classList?.contains('close-modal')) {
    e.preventDefault();
    t.click();
  }
});
