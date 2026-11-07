export type Lang = 'en' | 'ar';
export type Theme = 'light' | 'dark';

export interface Product {
  id: number;
  title: string;
  category: string;
  price: number;
  description: string;
  thumbnail: string;
  rating?: number;
}

/** A cart line: one product plus how many of it. */
export interface CartLine {
  product: Product;
  qty: number;
}

export interface User {
  name: string;
  email?: string;
  isGuest: boolean;
  /** True when this login was created by the Node server (a real session cookie exists). */
  server?: boolean;
}

export type SortMode = 'def' | 'p1' | 'p2' | 'n1' | 'r1';

/** Engagement progress saved per account. */
export interface EngageState {
  points: number;
  streak: number;
  last: string;
  wish: number[];
  ever: number[];
  ach: string[];
  adds: number;
  gift: string;
  gifts: number;
}

export interface ToastOptions {
  /** Optional action button shown inside the toast (e.g. Undo). */
  action?: { label: string; run: () => void };
  /** Milliseconds before auto-hide. Defaults to 3500. */
  duration?: number;
}

/** Every event that modules can publish or listen to. */
export interface BusEvents {
  render: { category: string };
  'cart:changed': { lines: CartLine[] };
  'cart:added': { product: Product; x: number; y: number };
  'product:opened': { id: number };
  'lang:changed': { lang: Lang };
  'currency:changed': { code: string };
  'checkout:done': { lines: CartLine[]; total: number; order: OrderRecord | null };
}

/** A placed order, saved per account so it can be shown in the Orders window. */
export interface OrderRecord {
  id: string;
  at: number;
  /** Total in USD (the store's base currency). */
  total: number;
  /** Present on orders created by the server, which calculates every figure itself. */
  subtotal?: number;
  delivery?: number;
  discountPct?: number;
  promoCode?: string;
  lines: { id: number; title: string; thumbnail: string; qty: number; price: number }[];
}
