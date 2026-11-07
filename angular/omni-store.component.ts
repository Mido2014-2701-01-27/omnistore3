/**
 * OmniStore, Angular edition (Angular 17+ standalone, signals, OnPush).
 *
 * One file holds the store service and the component. It reuses the same
 * data, translations and CSS class names as the vanilla TypeScript build, so
 * styles.css / engage.css / wow.css / enhance.css style it unchanged.
 */
import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, Injectable, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import {
  DELIVERY_FEE, FREE_DELIVERY_AT, PROMO_CODES, categoryBadgeLabels, categoryQueries,
  customJewelry, customPCs, offlineProductsFallback,
} from './data';
import { engageText, tr, wowText } from './i18n';
import type { CartLine, Lang, Product, SortMode, Theme } from './types';

// ---------- small storage helpers ----------
const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : ((JSON.parse(raw) as T) ?? fallback);
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown): void => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

interface Toast { message: string; action?: { label: string; run: () => void } }

// ======================================================================
// Service: all store state lives here as signals.
// ======================================================================
@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly lang = signal<Lang>(localStorage.getItem('lang') === 'ar' ? 'ar' : 'en');
  readonly theme = signal<Theme>((localStorage.getItem('theme') as Theme) || 'dark');
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly offline = signal(false);
  readonly cart = signal<CartLine[]>(read<CartLine[]>('omni_cart', []).filter((l) => l?.product && l.qty > 0));
  readonly promo = signal<{ code: string; pct: number } | null>(null);
  readonly wish = signal<number[]>(read<number[]>('omni_ng_wish', []));
  readonly points = signal<number>(read<number>('omni_ng_points', 0));
  readonly toast = signal<Toast | null>(null);
  private toastTimer?: number;

  readonly count = computed(() => this.cart().reduce((n, l) => n + l.qty, 0));
  readonly subtotal = computed(() => this.cart().reduce((s, l) => s + l.product.price * l.qty, 0));
  readonly delivery = computed(() => (this.subtotal() >= FREE_DELIVERY_AT || this.subtotal() === 0 ? 0 : DELIVERY_FEE));
  readonly discount = computed(() => this.subtotal() * ((this.promo()?.pct ?? 0) / 100));
  readonly total = computed(() => this.subtotal() - this.discount() + this.delivery());
  readonly level = computed(() => {
    let level = 1;
    let left = this.points();
    while (left >= 100 + 50 * (level - 1)) {
      left -= 100 + 50 * (level - 1);
      level++;
    }
    return { level, into: left, need: 100 + 50 * (level - 1) };
  });

  constructor() {
    // Persist and mirror state onto the document.
    effect(() => write('omni_cart', this.cart()));
    effect(() => write('omni_ng_wish', this.wish()));
    effect(() => write('omni_ng_points', this.points()));
    effect(() => {
      const lang = this.lang();
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    });
    effect(() => {
      const theme = this.theme();
      localStorage.setItem('theme', theme);
      document.body.classList.toggle('light-mode', theme === 'light');
      document.documentElement.setAttribute('data-theme', theme);
    });
    void this.load();
  }

  t = (key: string): string => tr(key, this.lang());

  async load(): Promise<void> {
    this.loading.set(true);
    const lang = this.lang();
    const custom = [...(customJewelry[lang] ?? customJewelry.en), ...(customPCs[lang] ?? customPCs.en)];
    const cats = Array.from(new Set(Object.values(categoryQueries).flat()));
    const results = await Promise.all(
      cats.map((c) =>
        fetch(`https://dummyjson.com/products/category/${c}?limit=30`)
          .then((r) => (r.ok ? (r.json() as Promise<{ products?: Product[] }>) : { products: [] }))
          .then((d) => d.products ?? [])
          .catch(() => [] as Product[]),
      ),
    );
    const live = results.flat();
    this.offline.set(live.length === 0);
    this.products.set([...custom, ...(live.length ? live : offlineProductsFallback[lang] ?? offlineProductsFallback.en)]);
    this.loading.set(false);
  }

  // ---------- Cart ----------
  add(p: Product): void {
    this.cart.update((lines) => {
      const hit = lines.find((l) => l.product.id === p.id);
      return hit
        ? lines.map((l) => (l === hit ? { ...l, qty: Math.min(99, l.qty + 1) } : l))
        : [...lines, { product: p, qty: 1 }];
    });
    this.points.update((n) => n + 10);
    this.say(`${this.t('toast_added')} "${p.title}"`);
  }

  changeQty(id: number, delta: number): void {
    const line = this.cart().find((l) => l.product.id === id);
    if (!line) return;
    if (line.qty + delta < 1) return this.remove(id);
    this.cart.update((ls) => ls.map((l) => (l.product.id === id ? { ...l, qty: Math.min(99, l.qty + delta) } : l)));
  }

  /** Remove a line and offer Undo, which puts it back in the same spot. */
  remove(id: number): void {
    const at = this.cart().findIndex((l) => l.product.id === id);
    if (at < 0) return;
    const gone = this.cart()[at];
    this.cart.update((ls) => ls.filter((l) => l.product.id !== id));
    if (!this.cart().length) this.promo.set(null);
    this.say(`${this.t('toast_removed')} "${gone.product.title}"`, {
      label: this.t('undo'),
      run: () => {
        this.cart.update((ls) => [...ls.slice(0, at), gone, ...ls.slice(at)]);
        this.say(this.t('toast_restored'));
      },
    }, 6000);
  }

  applyPromo(raw: string): boolean {
    const code = raw.trim().toUpperCase();
    // SECURITY NOTE: client-side only. A real store must validate on the server.
    const pct = PROMO_CODES[code];
    if (!pct) {
      this.say(this.t('toast_promo_invalid'));
      return false;
    }
    this.promo.set({ code, pct });
    this.say(this.t('toast_promo_applied'));
    return true;
  }

  removePromo(): void {
    this.promo.set(null);
    this.say(this.t('toast_promo_removed'));
  }

  checkout(): void {
    this.cart.set([]);
    this.promo.set(null);
    this.points.update((n) => n + 50);
    this.say(this.t('toast_checkout_success'));
  }

  toggleSave(id: number): void {
    const had = this.wish().includes(id);
    this.wish.update((w) => (had ? w.filter((x) => x !== id) : [...w, id]));
    if (!had) this.points.update((n) => n + 5);
  }

  say(message: string, action?: Toast['action'], ms = 3500): void {
    this.toast.set({ message, action });
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.set(null), ms);
  }
}

// ======================================================================
// Component
// ======================================================================
@Component({
  selector: 'omni-store',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="navbar">
      <div class="logo"><span class="logo-icon">🌐</span> OmniStore</div>
      <div class="nav-controls">
        <button class="eng-hud" type="button" (click)="rewardsOpen.set(true)">
          <span>⭐ {{ et().lvl }} {{ s.level().level }} · {{ s.points() }} {{ et().pts }}</span>
          <span class="eng-bar"><i [style.width.%]="(s.level().into / s.level().need) * 100"></i></span>
        </button>
        <button id="theme-toggle" type="button" (click)="toggleTheme()"
                [attr.aria-label]="s.theme() === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'">
          {{ s.theme() === 'light' ? '🌙' : '☀️' }}
        </button>
        <select id="lang-select" class="lang-dropdown" [value]="s.lang()" (change)="setLang($any($event.target).value)">
          <option value="en">English 🇬🇧</option>
          <option value="ar">العربية 🇸🇦</option>
        </select>
        <button class="cart-trigger-btn" type="button" (click)="cartOpen.set(true)">
          🛒 {{ s.t('cart') }} ({{ s.count() }})
        </button>
      </div>
    </header>

    <main class="store-container">
      <div class="eng-tools">
        <input #searchBox id="eng-search" type="search" autocomplete="off"
               [placeholder]="et().search" [value]="query()" (input)="query.set($any($event.target).value)" />
        <select class="eng-sort" [value]="sort()" (change)="sort.set($any($event.target).value)">
          <option value="def">{{ et().sort }}</option>
          <option value="p1">{{ et().s1 }}</option>
          <option value="p2">{{ et().s2 }}</option>
          <option value="n1">{{ et().s3 }}</option>
          <option value="r1">{{ et().s4 }}</option>
        </select>
        <label class="eng-price">
          <span>{{ s.t('price_max') }}</span>
          <input type="range" min="0" [max]="ceiling()" step="10" [value]="maxPrice() ?? ceiling()"
                 (input)="maxPrice.set(+$any($event.target).value)" />
          <output>\${{ maxPrice() ?? ceiling() }}</output>
        </label>
        <button class="eng-saved" type="button" [class.on]="onlySaved()" [attr.aria-pressed]="onlySaved()"
                (click)="onlySaved.set(!onlySaved())">{{ et().saved }}</button>
      </div>

      <nav class="category-nav">
        @for (c of categories; track c.key) {
          <button class="cat-btn" type="button" [class.active]="category() === c.key" (click)="category.set(c.key)">
            {{ s.t(c.label) }}
          </button>
        }
      </nav>

      @if (s.offline() && !s.loading()) {
        <div class="offline-banner" role="alert">
          <span>{{ s.t('offline_banner') }}</span>
          <button class="btn outline" type="button" (click)="s.load()">{{ s.t('retry') }}</button>
        </div>
      }

      <div class="eng-status" style="display:flex" role="status">
        <span>{{ visible().length }} / {{ inCategory().length }} {{ s.t('results') }}</span>
        @if (filtersActive()) {
          <button class="eng-clear" type="button" (click)="resetFilters()">{{ s.t('clear_filters') }}</button>
        }
      </div>

      <section class="product-grid">
        @if (s.loading()) {
          @for (n of skeletons; track n) { <div class="skeleton"></div> }
        } @else {
          @for (p of visible(); track p.id) {
            <div class="card eng-reveal eng-in">
              <div class="card-clickable" tabindex="0" role="button" [attr.aria-label]="p.title"
                   (click)="open(p)" (keydown.enter)="open(p)" (keydown.space)="$event.preventDefault(); open(p)">
                <div class="card-img-wrapper"><img class="loaded" [src]="p.thumbnail" [alt]="p.title" loading="lazy" /></div>
                <div>
                  <span class="category-badge">{{ badge(p) }}</span>
                  <h4>{{ p.title }}</h4>
                  <p class="description">{{ p.description.slice(0, 55) }}...</p>
                  <div class="card-rating">★ {{ (p.rating ?? 4.5).toFixed(1) }}</div>
                  <div class="price">{{ money(p.price) }}</div>
                </div>
              </div>
              <button class="eng-heart" type="button" aria-label="Save" [class.on]="isSaved(p.id)"
                      [attr.aria-pressed]="isSaved(p.id)" (click)="s.toggleSave(p.id)">♥</button>
              <button class="btn" type="button" (click)="s.add(p)">{{ s.t('add_to_cart') }}</button>
            </div>
          } @empty {
            <div class="eng-empty" style="display:block">{{ et().empty }}</div>
          }
        }
      </section>
    </main>

    <!-- Product details -->
    @if (selected(); as p) {
      <div class="modal" style="display:flex" (click)="closeIfBackdrop($event, 'product')">
        <div class="modal-content product-modal-content" role="dialog" aria-modal="true">
          <span class="close-modal" role="button" tabindex="0" aria-label="Close"
                (click)="selected.set(null)" (keydown.enter)="selected.set(null)">&times;</span>
          <div class="product-modal-body">
            <div class="modal-img-container"><img [src]="p.thumbnail" [alt]="p.title" /></div>
            <div class="modal-info-container">
              <span class="category-badge">{{ badge(p) }}</span>
              <h2>{{ p.title }}</h2>
              <div class="modal-rating"><span class="stars">★ {{ (p.rating ?? 4.5).toFixed(1) }} / 5.0</span></div>
              <p class="modal-description">{{ p.description }}</p>
              <div class="modal-footer-action">
                <div class="modal-price">{{ money(p.price) }}</div>
                <button class="btn" type="button" (click)="s.add(p); selected.set(null)">{{ s.t('add_to_cart') }}</button>
              </div>
              @if (similar().length) {
                <div class="wow-sim">
                  <h5>{{ wt().similar }}</h5>
                  <div class="wow-sim-row">
                    @for (x of similar(); track x.id) {
                      <button type="button" [title]="x.title" (click)="open(x)">
                        <img [src]="x.thumbnail" [alt]="x.title" loading="lazy" /><span>{{ money(x.price) }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Cart -->
    @if (cartOpen()) {
      <div class="modal" style="display:flex" (click)="closeIfBackdrop($event, 'cart')">
        <div class="modal-content cart-modal-content" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3>{{ s.t('your_cart') }}</h3>
            <span class="close-modal" role="button" tabindex="0" aria-label="Close"
                  (click)="cartOpen.set(false)" (keydown.enter)="cartOpen.set(false)">&times;</span>
          </div>

          <div class="cart-items-container">
            @for (l of s.cart(); track l.product.id) {
              <div class="cart-item">
                <div class="cart-item-info">
                  <img class="cart-item-img" [src]="l.product.thumbnail" [alt]="l.product.title" />
                  <div>
                    <div class="cart-item-title">{{ l.product.title }}</div>
                    <div class="cart-item-price">{{ money(l.product.price * l.qty) }}</div>
                    <div class="qty">
                      <button class="qty-btn" type="button" [attr.aria-label]="s.t('qty_less')" (click)="s.changeQty(l.product.id, -1)">−</button>
                      <span class="qty-num" aria-live="polite">{{ l.qty }}</span>
                      <button class="qty-btn" type="button" [attr.aria-label]="s.t('qty_more')" (click)="s.changeQty(l.product.id, 1)">+</button>
                    </div>
                  </div>
                </div>
                <button class="delete-btn" type="button" [title]="s.t('remove_item')" [attr.aria-label]="s.t('remove_item')"
                        (click)="s.remove(l.product.id)">&times;</button>
              </div>
            } @empty {
              <div class="empty-cart-msg">
                <div style="font-size:2.5rem;margin-bottom:.5rem;color:#d4af37">✨</div>
                <p style="font-weight:500">{{ s.t('cart_empty') }}</p>
              </div>
            }
          </div>

          <div class="promo-container">
            <input #promoBox class="promo-input" autocomplete="off" aria-label="Promo code" [placeholder]="s.t('promo_code_placeholder')"
                   (keydown.enter)="applyPromo(promoBox)" />
            <button class="btn outline promo-btn" type="button" (click)="applyPromo(promoBox)">{{ s.t('apply_promo') }}</button>
          </div>
          @if (s.promo(); as pr) {
            <div class="promo-chip">
              <span>🏷️ {{ s.t('promo_active') }}: {{ pr.code }} (-{{ pr.pct }}%)</span>
              <button type="button" (click)="s.removePromo()">{{ s.t('promo_remove') }}</button>
            </div>
          }

          @if (s.subtotal() > 0) {
            <div class="eng-ship" style="display:block">
              <div class="eng-ship-txt">{{ s.subtotal() >= freeAt ? et().free : et().more((freeAt - s.subtotal()).toFixed(2)) }}</div>
              <div class="eng-bar"><i [style.width.%]="Math.min(100, s.subtotal())"></i></div>
            </div>
          }

          <div class="cart-summary">
            <div class="summary-line">{{ s.t('subtotal') }}: {{ money(s.subtotal()) }}</div>
            <div class="summary-line">
              {{ s.t('delivery_fee') }}: {{ s.delivery() === 0 && s.subtotal() > 0 ? s.t('free_delivery') : money(s.delivery()) }}
            </div>
            @if (s.promo()) {
              <div class="summary-line discount-text" style="display:flex">
                {{ s.t('discount') }}: -{{ money(s.discount()) }} ({{ s.promo()!.pct }}%)
              </div>
            }
            <div class="total-line">{{ s.t('total') }}: {{ money(s.total()) }}</div>
            <button class="btn checkout-btn" type="button" (click)="checkout()">{{ s.t('checkout') }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Order placed -->
    @if (orderDone()) {
      <div class="modal" style="display:flex" (click)="closeIfBackdrop($event, 'order')">
        <div class="modal-content success-modal-content">
          <div class="success-icon">✨</div>
          <h3>{{ s.t('order_success') }}</h3>
          <button class="btn" type="button" (click)="orderDone.set(false)">{{ s.t('continue_shopping') }}</button>
        </div>
      </div>
    }

    <!-- Rewards -->
    @if (rewardsOpen()) {
      <div class="modal" style="display:flex" (click)="closeIfBackdrop($event, 'rewards')">
        <div class="modal-content eng-panel" role="dialog" aria-modal="true">
          <span class="close-modal" role="button" tabindex="0" aria-label="Close" (click)="rewardsOpen.set(false)">&times;</span>
          <h3>⭐ {{ et().rewards }}</h3>
          <div class="eng-big">{{ et().lvl }} {{ s.level().level }}</div>
          <div class="eng-bar big"><i [style.width.%]="(s.level().into / s.level().need) * 100"></i></div>
          <p class="eng-sub">{{ s.level().need - s.level().into }} {{ et().pts }} {{ et().next }}</p>
          <p class="eng-sub">{{ et().how }}</p>
        </div>
      </div>
    }

    <!-- Toast -->
    <div class="toast" [class.show]="!!s.toast()" role="status" aria-live="polite">
      <span>{{ s.toast()?.message }}</span>
      @if (s.toast()?.action; as a) {
        <button class="toast-action" type="button" (click)="a.run(); s.toast.set(null)">{{ a.label }}</button>
      }
    </div>
  `,
})
export class OmniStoreComponent {
  protected readonly s = inject(StoreService);
  protected readonly Math = Math;
  protected readonly freeAt = FREE_DELIVERY_AT;
  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  // UI state
  readonly category = signal('all');
  readonly query = signal('');
  readonly sort = signal<SortMode>('def');
  readonly maxPrice = signal<number | null>(null);
  readonly onlySaved = signal(false);
  readonly selected = signal<Product | null>(null);
  readonly cartOpen = signal(false);
  readonly orderDone = signal(false);
  readonly rewardsOpen = signal(false);

  readonly categories = [
    { key: 'all', label: 'cat_all' }, { key: 'food-drink', label: 'cat_food' }, { key: 'clothing-men', label: 'cat_men' },
    { key: 'clothing-women', label: 'cat_women' }, { key: 'jewelry-men', label: 'cat_jewelry' }, { key: 'gaming', label: 'cat_gaming' },
    { key: 'peripherals', label: 'cat_peripherals' }, { key: 'furniture', label: 'cat_furniture' },
  ];

  protected et = computed(() => engageText[this.s.lang()]);
  protected wt = computed(() => wowText[this.s.lang()]);

  // Derived data
  readonly inCategory = computed(() => {
    const all = this.s.products();
    const c = this.category();
    if (c === 'all') return all;
    if (c === 'gaming') return all.filter((p) => p.category === 'custom-pc' || p.category === 'laptops');
    if (c === 'jewelry-men') return all.filter((p) => ['custom-jewelry', 'womens-jewelery', 'mens-watches'].includes(p.category));
    const allowed = categoryQueries[c] ?? [];
    return all.filter((p) => allowed.includes(p.category) || p.category === c);
  });

  readonly ceiling = computed(() => Math.max(10, Math.ceil(Math.max(0, ...this.s.products().map((p) => p.price)) / 10) * 10));

  readonly filtersActive = computed(
    () => !!this.query().trim() || this.onlySaved() || this.sort() !== 'def' || (this.maxPrice() ?? this.ceiling()) < this.ceiling(),
  );

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const max = this.maxPrice() ?? this.ceiling();
    const wish = this.s.wish();
    const list = this.inCategory().filter(
      (p) => (!q || `${p.title} ${p.description}`.toLowerCase().includes(q)) && p.price <= max && (!this.onlySaved() || wish.includes(p.id)),
    );
    const lang = this.s.lang();
    switch (this.sort()) {
      case 'p1': return [...list].sort((a, b) => a.price - b.price);
      case 'p2': return [...list].sort((a, b) => b.price - a.price);
      case 'n1': return [...list].sort((a, b) => a.title.localeCompare(b.title, lang));
      case 'r1': return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      default: return list;
    }
  });

  readonly similar = computed(() => {
    const p = this.selected();
    if (!p) return [];
    return this.s.products().filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  });

  // Helpers used by the template
  money = (n: number): string => `$${n.toFixed(2)}`;
  badge = (p: Product): string => (categoryBadgeLabels[this.s.lang()] ?? categoryBadgeLabels.en)[p.category] ?? p.category;
  isSaved = (id: number): boolean => this.s.wish().includes(id);

  // Actions
  open(p: Product): void { this.selected.set(p); }
  setLang(v: string): void { this.s.lang.set(v === 'ar' ? 'ar' : 'en'); }
  toggleTheme(): void { this.s.theme.update((t) => (t === 'light' ? 'dark' : 'light')); }

  resetFilters(): void {
    this.query.set('');
    this.sort.set('def');
    this.maxPrice.set(null);
    this.onlySaved.set(false);
  }

  applyPromo(input: HTMLInputElement): void {
    if (this.s.applyPromo(input.value)) input.value = '';
  }

  checkout(): void {
    if (!this.s.cart().length) return this.s.say(this.s.t('toast_empty_cart'));
    this.s.checkout();
    this.cartOpen.set(false);
    this.orderDone.set(true);
  }

  /** Clicking the dark area outside a dialog closes it. */
  closeIfBackdrop(e: MouseEvent, which: 'product' | 'cart' | 'order' | 'rewards'): void {
    if (!(e.target as HTMLElement).classList.contains('modal')) return;
    if (which === 'product') this.selected.set(null);
    else if (which === 'cart') this.cartOpen.set(false);
    else if (which === 'order') this.orderDone.set(false);
    else this.rewardsOpen.set(false);
  }

  // Keyboard: "/" search, Escape closes the open window, "?" tip.
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName?.toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.searchBox()?.nativeElement.focus();
    } else if (e.key === 'Escape') {
      this.selected.set(null);
      this.cartOpen.set(false);
      this.orderDone.set(false);
      this.rewardsOpen.set(false);
    }
  }
}
