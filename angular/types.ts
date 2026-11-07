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
  'checkout:done': undefined;
}
