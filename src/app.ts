import { categoryBadgeLabels, categoryQueries } from './data.js';
import {
  addToCart, applyPromo, changeQty, clearCart, clearSavedCart, initLanguage, initTheme, loadProducts,
  removeLine, removePromo, restoreCart, setLanguage, showToast, state, totals,
} from './core.js';
import { ApiError, api, serverSession } from './api.js';
import { extrasText, tr } from './i18n.js';
import type { Lang, OrderRecord, Product } from './types.js';
import {
  $, $$, bus, closeModal, el, getLang, getUser, isGuest, isOpen, money, openModal, remove, replay, shuffle, trapFocus, write,
} from './utils.js';

// ======================================================================
// Boot: main.ts calls this once the DOM is ready
// ======================================================================
export async function boot(beforeStore?: () => void): Promise<void> {
  initTheme();
  initLanguage();
  await api.detect(); // is the Node server there? (instant on localhost)
  if ($('#auth-form')) initAuthPage();
  else if ($('#product-grid')) {
    beforeStore?.(); // lets the engagement and feature layers subscribe before products render
    void initStorePage();
  }
}

// ======================================================================
// Shared modals
// ======================================================================
function ensureModal(id: string, html: string): HTMLElement {
  let modal = document.getElementById(id);
  if (modal) return modal;
  modal = el('div', 'modal');
  modal.id = id;
  modal.style.display = 'none';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal!);
  });
  return modal;
}

export function showGuestAuthPrompt(): void {
  const lang = getLang();
  const modal = ensureModal(
    'guest-prompt-modal',
    `<div class="modal-content" style="text-align:center;max-width:420px">
      <div style="font-size:3rem;margin-bottom:10px">🔒</div>
      <h3 id="guest-prompt-title" style="margin-bottom:10px"></h3>
      <p id="guest-prompt-msg" style="margin-bottom:20px;line-height:1.5"></p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="guest-login-btn" class="btn" style="flex:1"></button>
        <button id="guest-cancel-btn" class="btn outline" style="flex:1"></button>
      </div></div>`,
  );
  $('#guest-prompt-title')!.textContent = tr('guest_prompt_title', lang);
  $('#guest-prompt-msg')!.textContent = tr('guest_prompt_msg', lang);
  const login = $('#guest-login-btn')!;
  const cancel = $('#guest-cancel-btn')!;
  login.textContent = tr('login_btn', lang);
  cancel.textContent = tr('cancel', lang);
  login.onclick = () => (window.location.href = 'index.html');
  cancel.onclick = () => closeModal(modal);
  openModal(modal);
}

function showAuthErrorModal(title: string, message: string): void {
  const modal = ensureModal(
    'auth-error-modal',
    `<div class="modal-content" style="text-align:center;max-width:420px">
      <div style="font-size:3rem;color:#ef4444;margin-bottom:10px">⚠️</div>
      <h3 id="auth-error-title" style="margin-bottom:10px"></h3>
      <p id="auth-error-msg" style="margin-bottom:20px;line-height:1.5"></p>
      <button id="auth-error-close" class="btn" style="width:100%"></button></div>`,
  );
  $('#auth-error-title')!.textContent = title;
  $('#auth-error-msg')!.textContent = message;
  const close = $('#auth-error-close')!;
  close.textContent = tr('modal_understood_btn', getLang());
  close.onclick = () => closeModal(modal);
  openModal(modal);
}

// Escape closes any open window; Tab stays inside it.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal').filter(isOpen).forEach(closeModal);
  trapFocus(e);
});

// ======================================================================
// Auth page
// ======================================================================
/** Turn a server error code into a message in the visitor's language. */
function authMessage(err: unknown, lang: Lang): string {
  const x = extrasText[lang];
  const code = err instanceof ApiError ? err.code : '';
  switch (code) {
    case 'password_short': return tr('err_pass_length', lang);
    case 'password_weak': return tr('err_pass_weak', lang);
    case 'name_missing': return tr('err_missing_name', lang);
    case 'email_invalid': return x.errEmail;
    case 'email_taken': return x.errTaken;
    case 'bad_credentials': return x.errCreds;
    case 'rate_limited': return x.errRate;
    default: return x.errServer;
  }
}

const EASY = ['12345678', 'password', 'qwertyui', '123456789', 'password123', 'abc12345', 'letmein1', 'admin123'];

export function validatePassword(password: string, lang: Lang = 'en'): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: tr('err_pass_length', lang) };
  const lower = password.toLowerCase();
  if (/^([^])\1+$/.test(password) || EASY.some((w) => lower.includes(w))) return { valid: false, message: tr('err_pass_weak', lang) };
  return { valid: true };
}

/** 0 = too short, 1 = weak ... 4 = strong. Only used to give live feedback. */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 8) return 0;
  if (!validatePassword(pw).valid) return 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const bonus = pw.length >= 12 ? 1 : 0;
  return Math.min(4, Math.max(2, kinds - 1 + bonus)) as 2 | 3 | 4;
}

function initAuthPage(): void {
  const form = $<HTMLFormElement>('#auth-form')!;
  const toggleLink = $('#toggle-auth');
  const toggleText = $('#toggle-text');
  const title = $('#auth-title');
  const nameGroup = $('#name-group');
  const authBtn = $('#auth-btn');
  const pass = $<HTMLInputElement>('#password')!;
  let signUp = false;

  $('#guest-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    write('currentUser', { name: 'Guest', isGuest: true });
    window.location.href = 'store.html';
  });

  // Show / hide password
  const eye = $('#toggle-password');
  eye?.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    eye.textContent = show ? '🙈' : '👁️';
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  // Live password strength meter (shown on sign-up)
  const meter = el('div', 'pw-meter');
  meter.hidden = true;
  meter.innerHTML = '<span class="pw-bars"><i></i><i></i><i></i><i></i></span><span class="pw-label" aria-live="polite"></span>';
  pass.closest('.form-group')?.appendChild(meter);
  const paintMeter = () => {
    const score = passwordScore(pass.value);
    meter.dataset.score = String(score);
    $('.pw-label', meter)!.textContent = pass.value ? `${tr('strength_label', getLang())}: ${tr('strength_' + score, getLang())}` : '';
  };
  pass.addEventListener('input', paintMeter);
  bus.on('lang:changed', paintMeter);

  toggleLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const lang = getLang();
    signUp = !signUp;
    if (title) title.textContent = tr(signUp ? 'create_account' : 'welcome_back', lang);
    if (authBtn) authBtn.textContent = tr(signUp ? 'signup_btn' : 'login_btn', lang);
    if (toggleText) toggleText.textContent = tr(signUp ? 'has_account' : 'no_account', lang);
    toggleLink.textContent = tr(signUp ? 'login_btn' : 'signup_btn', lang);
    if (nameGroup) nameGroup.style.display = signUp ? 'block' : 'none';
    meter.hidden = !signUp;
    if (signUp) $<HTMLInputElement>('#username')?.focus();
  });

  // Localised "required" message
  const localiseValidity = () =>
    $$<HTMLInputElement>('input[required]').forEach((input) => {
      input.oninvalid = () => input.validity.valueMissing && input.setCustomValidity(tr('validation_required', getLang()));
      input.oninput = () => input.setCustomValidity('');
    });
  localiseValidity();
  bus.on('lang:changed', localiseValidity);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lang = getLang();
    const email = $<HTMLInputElement>('#email')!.value.trim();
    const name = ($<HTMLInputElement>('#username')?.value ?? '').trim();

    if (signUp && !name) return showAuthErrorModal(tr('action_rejected_title', lang), tr('err_missing_name', lang));
    // Logging in only needs a password; the server decides whether it is right.
    const check = validatePassword(pass.value, lang);
    if ((signUp || !api.available) && !check.valid) return showAuthErrorModal(tr('action_rejected_title', lang), check.message!);

    // Real accounts: the Node server checks the password and sets a session cookie.
    if (api.available) {
      const btn = $<HTMLButtonElement>('#auth-btn');
      if (btn) btn.disabled = true;
      try {
        const { user } = await api.post<{ user: { name: string; email: string } }>(
          signUp ? '/api/auth/register' : '/api/auth/login',
          signUp ? { name, email, password: pass.value } : { email, password: pass.value },
        );
        remove('omni_engage');
        write('currentUser', { name: user.name, email: user.email, isGuest: false, server: true });
        window.location.href = 'store.html';
      } catch (err) {
        showAuthErrorModal(tr('action_rejected_title', lang), authMessage(err, lang));
      } finally {
        if (btn) btn.disabled = false;
      }
      return;
    }

    // SECURITY NOTE: there is no backend, so "login" only checks that the
    // password is well-formed. Real credential checks must happen server-side.
    const finalName = signUp ? name : email.split('@')[0] || 'User';
    if (signUp) remove('omni_engage:' + email.toLowerCase()); // new accounts start fresh
    remove('omni_engage');
    write('currentUser', { name: finalName, email, isGuest: false });
    window.location.href = 'store.html';
  });
}

// ======================================================================
// Store page
// ======================================================================
const badge = (p: Product): string => (categoryBadgeLabels[state.lang] ?? categoryBadgeLabels.en)[p.category] ?? p.category;

export function productsFor(category: string): Product[] {
  const all = state.products;
  if (category === 'all') return all;
  if (category === 'gaming') return all.filter((p) => p.category === 'custom-pc' || p.category === 'laptops');
  if (category === 'jewelry-men') return all.filter((p) => ['custom-jewelry', 'womens-jewelery', 'mens-watches'].includes(p.category));
  const allowed = categoryQueries[category] ?? [];
  return all.filter((p) => allowed.includes(p.category) || p.category === category);
}

let activeCategory = 'all';
let shuffledAll: Product[] | null = null;

async function initStorePage(): Promise<void> {
  if (!getUser()) write('currentUser', { name: 'Guest', isGuest: true });

  // A saved login only counts if the server still recognises its session cookie.
  if (serverSession()) {
    try {
      await api.get('/api/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        remove('currentUser');
        clearSavedCart();
        window.location.href = 'index.html';
        return;
      }
    }
  }

  $('#logout-btn')?.addEventListener('click', async () => {
    if (serverSession()) await api.post('/api/auth/logout', {}).catch(() => undefined);
    remove('currentUser');
    clearSavedCart();
    window.location.href = 'index.html';
  });

  restoreCart();
  setupCategories();
  setupCartModal();
  setupProductModal();
  setupCarousel();
  bus.on('cart:changed', renderCart);
  bus.on('lang:changed', () => {
    renderCart();
    if (state.products.length) renderProducts(activeCategory);
  });
  bus.on('currency:changed', () => {
    renderCart();
    if (state.products.length) renderProducts(activeCategory);
  });

  const hash = location.hash.slice(1);
  if ($(`.cat-btn[data-category="${hash}"]`)) activeCategory = hash;
  $$('.cat-btn').forEach((b) => b.classList.toggle('active', b.dataset.category === activeCategory));

  await fetchAndRender();
  renderCart();
}

async function fetchAndRender(): Promise<void> {
  const grid = $('#product-grid')!;
  grid.innerHTML = '<div class="skeleton"></div>'.repeat(8);
  await loadProducts();
  shuffledAll = shuffle(state.products);
  renderProducts(activeCategory);
}

function offlineBanner(): void {
  $('#offline-banner')?.remove();
  if (!state.offline) return;
  const bar = el('div', 'offline-banner');
  bar.id = 'offline-banner';
  bar.setAttribute('role', 'alert');
  bar.append(el('span', '', tr('offline_banner', state.lang)));
  const retry = el('button', 'btn outline', tr('retry', state.lang));
  retry.type = 'button';
  retry.onclick = () => void fetchAndRender();
  bar.append(retry);
  $('#product-grid')!.before(bar);
}

export function renderProducts(category: string): void {
  activeCategory = category;
  const grid = $('#product-grid')!;
  grid.replaceChildren();
  offlineBanner();

  const list = category === 'all' ? shuffledAll ?? state.products : productsFor(category);
  if (!list.length) {
    grid.append(el('p', 'loading', 'No products found in this section.'));
    bus.emit('render', { category });
    return;
  }

  list.forEach((product, i) => {
    const card = el('div', 'card');
    card.dataset.id = String(product.id);
    card.dataset.price = String(product.price);
    card.dataset.rating = String(product.rating ?? 0);
    card.style.setProperty('--i', String(Math.min(i, 14)));

    // Built with DOM methods (never innerHTML) so API data can't inject HTML.
    const clickable = el('div', 'card-clickable');
    clickable.tabIndex = 0;
    clickable.setAttribute('role', 'button');
    clickable.setAttribute('aria-label', product.title);
    clickable.addEventListener('click', () => openProductModal(product.id));
    clickable.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProductModal(product.id);
      }
    });

    const wrap = el('div', 'card-img-wrapper');
    const img = el('img');
    img.src = product.thumbnail;
    img.alt = product.title;
    img.loading = 'lazy';
    const loaded = () => img.classList.add('loaded');
    if (img.complete) loaded();
    else img.onload = img.onerror = loaded;
    wrap.append(img);

    const info = el('div');
    info.append(
      el('span', 'category-badge', badge(product)),
      el('h4', '', product.title),
      el('p', 'description', product.description ? product.description.slice(0, 55) + '...' : ''),
      el('div', 'card-rating', `★ ${(product.rating ?? 4.5).toFixed(1)}`),
      el('div', 'price', money(product.price)),
    );
    clickable.append(wrap, info);

    const add = el('button', 'btn', tr('add_to_cart', state.lang));
    add.dataset.i18n = 'add_to_cart';
    add.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(product.id, e.clientX, e.clientY);
    });
    card.append(clickable, add);
    grid.append(card);
  });
  bus.emit('render', { category });
}

function setupCategories(): void {
  const buttons = $$<HTMLButtonElement>('.cat-btn');
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      history.replaceState(null, '', btn.dataset.category === 'all' ? location.pathname : `#${btn.dataset.category}`);
      renderProducts(btn.dataset.category ?? 'all');
    }),
  );
}

// ---------- Product details modal ----------
function setupProductModal(): void {
  const modal = $('#product-modal');
  $('#product-modal-close')?.addEventListener('click', () => modal && closeModal(modal));
}

export function openProductModal(id: number): void {
  const p = state.products.find((x) => x.id === id);
  const modal = $('#product-modal');
  if (!p || !modal) return;
  $('#product-modal-title')!.textContent = p.title;
  $<HTMLImageElement>('#product-modal-img')!.src = p.thumbnail;
  $('#product-modal-category')!.textContent = badge(p);
  $('#product-modal-description')!.textContent = p.description;
  $('#product-modal-price')!.textContent = money(p.price);
  const rating = $('#product-modal-rating')!;
  rating.replaceChildren(el('span', 'stars', `★ ${(p.rating ?? 4.5).toFixed(1)} / 5.0`));

  const add = $<HTMLButtonElement>('#product-modal-add-btn')!;
  add.textContent = tr('add_to_cart', state.lang);
  add.onclick = (e) => {
    addToCart(p.id, e.clientX, e.clientY);
    closeModal(modal);
  };
  openModal(modal);
  bus.emit('product:opened', { id });
}

// ---------- Cart modal ----------
function setupCartModal(): void {
  const modal = $('#cart-modal')!;
  const success = $('#checkout-success-modal');
  $('#cart-btn')?.addEventListener('click', () => openModal(modal));
  $('#cart-modal-close')?.addEventListener('click', () => closeModal(modal));

  const input = $<HTMLInputElement>('#promo-input')!;
  const apply = () => {
    if (applyPromo(input.value)) input.value = '';
  };
  $('#apply-promo-btn')?.addEventListener('click', apply);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), apply()));

  const checkoutBtn = $<HTMLButtonElement>('#checkout-btn');
  checkoutBtn?.addEventListener('click', async () => {
    if (isGuest()) {
      closeModal(modal);
      return showGuestAuthPrompt();
    }
    if (!state.cart.length) return showToast(tr('toast_empty_cart', state.lang));
    const lines = state.cart.map((l) => ({ ...l }));
    let total = totals().total;
    let order: OrderRecord | null = null;

    // With the Node server the order is checked and priced there, not trusted from the browser.
    if (serverSession()) {
      checkoutBtn.disabled = true;
      try {
        order = (
          await api.post<{ order: OrderRecord }>('/api/orders', {
            lines: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
            promoCode: state.promoCode,
          })
        ).order;
        total = order.total;
      } catch (err) {
        const x = extrasText[state.lang];
        const code = err instanceof ApiError ? err.code : '';
        if (code === 'invalid_promo') {
          removePromo();
        } else if (code === 'login_required') {
          showToast(x.sessionExpired);
          setTimeout(() => (window.location.href = 'index.html'), 1500);
        } else {
          showToast(code === 'unknown_product' ? x.orderGone : x.orderFail);
        }
        return;
      } finally {
        checkoutBtn.disabled = false;
      }
    }

    clearCart();
    closeModal(modal);
    if (success) openModal(success);
    showToast(tr('toast_checkout_success', state.lang));
    bus.emit('checkout:done', { lines, total, order });
  });
  $('#checkout-success-close')?.addEventListener('click', () => success && closeModal(success));

  // Click a promo banner code to copy it into the cart
  document.addEventListener('click', (e) => {
    const box = (e.target as HTMLElement).closest('.promo-code-box');
    if (!box) return;
    const code = box.textContent!.trim();
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    input.value = code;
    showToast(state.lang === 'ar' ? `تم نسخ الرمز ${code} وهو جاهز في السلة` : `Code ${code} copied and ready in your cart`);
  });
  $$('.promo-code-box').forEach((b) => (b.title = 'Click to copy'));
}

let lastCount = 0;

export function renderCart(): void {
  const list = $('#cart-items');
  if (!list) return;
  const t = totals();
  $('#cart-count')!.textContent = String(t.count);
  list.replaceChildren();

  if (!state.cart.length) {
    const empty = el('div', 'empty-cart-msg');
    const star = el('div', '', '✨');
    star.style.cssText = 'font-size:2.5rem;margin-bottom:.5rem;color:#d4af37';
    const msg = el('p', '', tr('cart_empty', state.lang));
    msg.style.fontWeight = '500';
    empty.append(star, msg);
    list.append(empty);
  }

  state.cart.forEach(({ product, qty }) => {
    const row = el('div', 'cart-item');
    const info = el('div', 'cart-item-info');
    const img = el('img', 'cart-item-img');
    img.src = product.thumbnail;
    img.alt = product.title;
    const text = el('div');
    text.append(el('div', 'cart-item-title', product.title), el('div', 'cart-item-price', money(product.price * qty)));

    const step = el('div', 'qty');
    const minus = el('button', 'qty-btn', '−');
    const num = el('span', 'qty-num', String(qty));
    const plus = el('button', 'qty-btn', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', tr('qty_less', state.lang));
    plus.setAttribute('aria-label', tr('qty_more', state.lang));
    num.setAttribute('aria-live', 'polite');
    minus.onclick = () => changeQty(product.id, -1);
    plus.onclick = () => changeQty(product.id, 1);
    step.append(minus, num, plus);
    text.append(step);
    info.append(img, text);

    const del = el('button', 'delete-btn');
    del.innerHTML = '&times;';
    del.title = tr('remove_item', state.lang);
    del.setAttribute('aria-label', tr('remove_item', state.lang));
    del.onclick = () => removeLine(product.id);
    row.append(info, del);
    list.append(row);
  });

  // Applied-code chip with a remove button
  $('#promo-chip')?.remove();
  if (state.promoCode) {
    const chip = el('div', 'promo-chip');
    chip.id = 'promo-chip';
    const rm = el('button', '', tr('promo_remove', state.lang));
    rm.type = 'button';
    rm.onclick = removePromo;
    chip.append(el('span', '', `🏷️ ${tr('promo_active', state.lang)}: ${state.promoCode} (-${state.discountPct}%)`), rm);
    $('.promo-container')?.after(chip);
  }

  $('#cart-subtotal')!.textContent = money(t.subtotal);
  $('#cart-delivery')!.textContent = t.delivery === 0 && t.subtotal > 0 ? tr('free_delivery', state.lang) : money(t.delivery);
  const row = $('#discount-row');
  if (row) {
    row.style.display = state.discountPct > 0 ? 'flex' : 'none';
    $('#cart-discount')!.textContent = `-${money(t.discount)} (${state.discountPct}%)`;
  }
  $('#cart-total')!.textContent = money(t.total);

  if (t.count > lastCount) replay($('#cart-btn'), 'bump');
  lastCount = t.count;
}

// ======================================================================
// Promo carousel: autoplay, arrows, dots, swipe, keyboard, pause on hover/focus
// ======================================================================
function setupCarousel(): void {
  const root = $('#promo-carousel');
  const track = $('#promo-track');
  const dots = $$('.promo-dot');
  if (!root || !track) return;
  const count = track.querySelectorAll('.promo-slide').length;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer: number | undefined;

  const go = (i: number) => {
    index = ((i % count) + count) % count;
    track.style.transform = `translateX(${(document.documentElement.dir === 'rtl' ? 1 : -1) * index * (100 / count)}%)`;
    dots.forEach((d, n) => {
      d.classList.toggle('active', n === index);
      d.setAttribute('aria-current', String(n === index));
    });
  };
  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    if (!calm) timer = window.setInterval(() => !document.hidden && go(index + 1), 4000);
  };
  const nudge = (to: number) => {
    go(to);
    start();
  };

  $('#promo-next')?.addEventListener('click', () => nudge(index + 1));
  $('#promo-prev')?.addEventListener('click', () => nudge(index - 1));
  dots.forEach((d, i) => {
    d.tabIndex = 0;
    d.setAttribute('role', 'button');
    d.addEventListener('click', () => nudge(i));
    d.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudge(i)));
  });
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', start);
  root.tabIndex = 0;
  root.setAttribute('aria-roledescription', 'carousel');
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nudge(index + (document.documentElement.dir === 'rtl' ? -1 : 1));
    if (e.key === 'ArrowLeft') nudge(index + (document.documentElement.dir === 'rtl' ? 1 : -1));
  });

  // Swipe on touch screens
  let startX = 0;
  root.addEventListener('pointerdown', (e) => (startX = e.clientX));
  root.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 50 && e.pointerType === 'touch') nudge(index + (dx < 0 ? 1 : -1));
  });

  go(0);
  start();
}

export { setLanguage };
