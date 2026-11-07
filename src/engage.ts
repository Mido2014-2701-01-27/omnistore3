import { showGuestAuthPrompt } from './app.js';
import { api, serverSession } from './api.js';
import { showToast, state, totals } from './core.js';
import { engageText as T } from './i18n.js';
import type { EngageState, Lang, SortMode } from './types.js';
import { $, $$, bus, closeModal, debounce, el, getUser, money, openModal, prefersReducedMotion, read, replay, write } from './utils.js';

// ======================================================================
// Engagement layer: points, levels, streaks, achievements, wishlist,
// search, sort, price filter, free-delivery meter and micro-interactions.
// ======================================================================
export interface OmniEngage {
  addPoints(n: number, x?: number, y?: number): void;
  confetti(x: number, y: number, n: number): void;
  GUEST: boolean;
}

interface Achievement {
  id: string;
  ic: string;
  en: string;
  ar: string;
  ok: () => boolean;
}

const MAX_PRICE_FALLBACK = 3000;

export function initEngage(): OmniEngage | null {
  const found = $('#product-grid');
  if (!found) return null;
  const grid: HTMLElement = found;
  let lang: Lang = state.lang;
  const t = () => T[lang];

  // Progress belongs to the logged-in account. Guests never earn or keep points.
  const user = getUser();
  const GUEST = !user || user.isGuest;
  const KEY = GUEST ? '' : 'omni_engage:' + String(user!.email || user!.name).trim().toLowerCase();
  const S: EngageState = { points: 0, streak: 0, last: '', wish: [], ever: [], ach: [], adds: 0, gift: '', gifts: 0 };
  if (!GUEST) Object.assign(S, read<Partial<EngageState>>(KEY, {}));
  // Logged in through the Node server? Then progress is also kept there so it follows you to other devices.
  const pushToServer = debounce(() => void api.put('/api/profile', S).catch(() => undefined), 800);
  const save = () => {
    if (GUEST) return;
    write(KEY, S);
    if (serverSession()) pushToServer();
  };
  const askLogin = () => showGuestAuthPrompt();

  const ACH: Achievement[] = [
    { id: 'first', ic: '🛍️', en: 'First Pick', ar: 'أول اختيار', ok: () => S.adds >= 1 },
    { id: 'collector', ic: '🧺', en: 'Collector (5 items)', ar: 'جامع (5 منتجات)', ok: () => S.adds >= 5 },
    { id: 'fan', ic: '💛', en: 'Wishlister (3 saves)', ar: 'محب (3 محفوظات)', ok: () => S.wish.length >= 3 },
    { id: 'streak', ic: '🔥', en: '3-Day Streak', ar: '3 أيام متتالية', ok: () => S.streak >= 3 },
    { id: 'lucky', ic: '🍀', en: 'Lucky Opener', ar: 'محظوظ', ok: () => S.gifts >= 1 },
    { id: 'order', ic: '📦', en: 'Big Spender (10 items)', ar: 'متسوق نشط (10 منتجات)', ok: () => S.adds >= 10 },
  ];

  // Each level needs more XP than the last: 100 to reach Lvl 2, then 150, 200...
  const need = (l: number) => 100 + 50 * (l - 1);
  const progress = () => {
    let level = 1;
    let left = S.points;
    while (left >= need(level)) {
      left -= need(level);
      level++;
    }
    return { level, into: left, need: need(level) };
  };

  // ---------- Effects ----------
  function confetti(x: number, y: number, n: number): void {
    if (prefersReducedMotion()) return;
    const c = el('canvas', 'eng-confetti');
    c.width = innerWidth;
    c.height = innerHeight;
    document.body.append(c);
    const g = c.getContext('2d')!;
    const colors = ['#d4af37', '#f5d76e', '#ffffff', '#38bdf8', '#f472b6'];
    const bits = Array.from({ length: n }, () => ({
      x, y, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
      s: 4 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6, t: 0,
    }));
    const frame = () => {
      g.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      for (const p of bits) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; p.t++;
        if (p.y < c.height && p.t < 110) {
          alive++;
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.r);
          g.fillStyle = p.c;
          g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
          g.restore();
        }
      }
      alive ? requestAnimationFrame(frame) : c.remove();
    };
    frame();
  }

  function floatText(text: string, x: number, y: number): void {
    const node = el('div', 'eng-float', text);
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    document.body.append(node);
    setTimeout(() => node.remove(), 1000);
  }

  function fly(src: string, from: { x: number; y: number }): void {
    const target = $('#cart-btn');
    if (!target || prefersReducedMotion()) return;
    const r = target.getBoundingClientRect();
    const img = el('img', 'eng-fly');
    img.src = src;
    img.style.left = from.x + 'px';
    img.style.top = from.y + 'px';
    document.body.append(img);
    requestAnimationFrame(() => {
      img.style.transform = `translate(${r.left + r.width / 2 - from.x}px,${r.top + r.height / 2 - from.y}px) scale(.15)`;
      img.style.opacity = '.3';
    });
    setTimeout(() => img.remove(), 750);
  }

  // ---------- Points / levels / achievements ----------
  function checkAch(): void {
    if (GUEST) return;
    for (const a of ACH) {
      if (S.ach.includes(a.id) || !a.ok()) continue;
      S.ach.push(a.id);
      save();
      setTimeout(() => {
        showToast(`${a.ic} ${t().unlocked} ${a[lang]}`);
        confetti(innerWidth / 2, innerHeight / 3, 60);
      }, 700);
    }
  }

  function addPoints(n: number, x?: number, y?: number): void {
    if (GUEST) return;
    const before = progress().level;
    S.points += n;
    if (x != null && y != null) floatText('+' + n, x, y);
    if (progress().level > before) {
      showToast(t().up(progress().level));
      confetti(innerWidth / 2, innerHeight / 3, 90);
    }
    save();
    checkAch();
    paintHud();
    replay($('#eng-hud'), 'pulse');
  }

  // ---------- Header HUD + rewards panel ----------
  const hud = el('button', 'eng-hud');
  hud.id = 'eng-hud';
  hud.type = 'button';
  hud.innerHTML = '<span class="eng-txt"></span><span class="eng-bar"><i></i></span>';
  const cartBtn = $('#cart-btn');
  cartBtn?.parentNode?.insertBefore(hud, cartBtn);

  function paintHud(): void {
    const txt = $('.eng-txt', hud)!;
    const bar = $<HTMLElement>('.eng-bar', hud)!;
    if (GUEST) {
      txt.textContent = t().guestHud;
      bar.style.display = 'none';
      return;
    }
    const g = progress();
    txt.textContent = `${S.streak ? '🔥' + S.streak + ' · ' : ''}⭐ ${t().lvl} ${g.level} · ${S.points} ${t().pts}`;
    $<HTMLElement>('i', bar)!.style.width = (g.into / g.need) * 100 + '%';
  }

  hud.addEventListener('click', () => {
    if (GUEST) return askLogin();
    let modal = $('#eng-modal');
    if (!modal) {
      modal = el('div', 'modal');
      modal.id = 'eng-modal';
      modal.addEventListener('click', (e) => e.target === modal && closeModal(modal!));
      document.body.append(modal);
    }
    const g = progress();
    const week = S.streak % 7 || (S.streak ? 7 : 0);
    // Every dynamic value here is a number or one of our own constant strings.
    modal.innerHTML = `<div class="modal-content eng-panel"><span class="close-modal" id="eng-x" role="button" tabindex="0" aria-label="Close">&times;</span>
      <h3>⭐ ${t().rewards}</h3><div class="eng-big">${t().lvl} ${g.level}</div>
      <div class="eng-bar big"><i style="width:${(g.into / g.need) * 100}%"></i></div>
      <p class="eng-sub">${g.need - g.into} ${t().pts} ${t().next}</p>
      <h4>🔥 ${t().streak}: ${S.streak}</h4>
      <div class="eng-days">${Array.from({ length: 7 }, (_, i) => `<span class="${i < week ? 'on' : ''}">${i + 1}</span>`).join('')}</div>
      <h4>🏅 ${t().ach}</h4>
      <div class="eng-ach">${ACH.map((a) => `<div class="${S.ach.includes(a.id) ? 'on' : ''}"><b>${a.ic}</b>${a[lang]}</div>`).join('')}</div>
      <p class="eng-sub">${t().how}</p></div>`;
    $('#eng-x', modal)!.onclick = () => closeModal(modal!);
    openModal(modal);
  });

  // ---------- Tools row: search, sort, price, saved, gift ----------
  const tools = el('div', 'eng-tools');
  tools.innerHTML = `<input id="eng-search" type="search" autocomplete="off">
    <select id="eng-sort" class="eng-sort"><option value="def"></option><option value="p1"></option><option value="p2"></option><option value="n1"></option><option value="r1"></option></select>
    <label class="eng-price"><span id="eng-price-label"></span><input id="eng-price" type="range" min="0" max="${MAX_PRICE_FALLBACK}" step="10"><output id="eng-price-out"></output></label>
    <button id="eng-saved" class="eng-saved" type="button"></button>
    <button id="eng-gift" class="eng-saved eng-giftbtn" type="button"></button>`;
  const nav = $('.category-nav');
  nav?.parentNode?.insertBefore(tools, nav);

  const search = $<HTMLInputElement>('#eng-search', tools)!;
  const sort = $<HTMLSelectElement>('#eng-sort', tools)!;
  const price = $<HTMLInputElement>('#eng-price', tools)!;
  const priceOut = $<HTMLOutputElement>('#eng-price-out', tools)!;
  const savedBtn = $<HTMLButtonElement>('#eng-saved', tools)!;
  const giftBtn = $<HTMLButtonElement>('#eng-gift', tools)!;

  const status = el('div', 'eng-status');
  status.setAttribute('role', 'status');
  const clear = el('button', 'eng-clear');
  clear.type = 'button';
  const empty = el('div', 'eng-empty');
  grid.parentNode!.insertBefore(status, grid);
  grid.parentNode!.insertBefore(empty, grid.nextSibling);

  const cards = () => $$('.card', grid);
  const priceOf = (c: HTMLElement) => Number(c.dataset.price) || 0;
  const ceiling = () => Math.max(10, Math.ceil(Math.max(...state.products.map((p) => p.price), 0) / 10) * 10) || MAX_PRICE_FALLBACK;

  function labels(): void {
    const x = t();
    search.placeholder = x.search;
    savedBtn.textContent = x.saved;
    giftBtn.textContent = x.gift;
    empty.textContent = x.empty;
    clear.textContent = lang === 'ar' ? 'مسح التصفية' : 'Clear filters';
    (['sort', 's1', 's2', 's3', 's4'] as const).forEach((k, i) => (sort.options[i].textContent = x[k]));
    $('#eng-price-label', tools)!.textContent = lang === 'ar' ? 'أعلى سعر' : 'Max price';
    $('#eng-top')?.setAttribute('aria-label', x.top);
  }

  const giftReady = () => giftBtn.classList.toggle('ready', !GUEST && S.gift !== new Date().toDateString());

  function applySort(): void {
    const mode = sort.value as SortMode;
    const name = (c: HTMLElement) => $('h4', c)?.textContent ?? '';
    const order = (a: HTMLElement, b: HTMLElement) =>
      mode === 'p1' ? priceOf(a) - priceOf(b)
      : mode === 'p2' ? priceOf(b) - priceOf(a)
      : mode === 'n1' ? name(a).localeCompare(name(b), lang)
      : mode === 'r1' ? Number(b.dataset.rating) - Number(a.dataset.rating)
      : Number(a.dataset.i) - Number(b.dataset.i);
    cards().sort(order).forEach((c) => grid.append(c));
  }

  const filtersActive = () => !!search.value.trim() || grid.classList.contains('only-saved') || Number(price.value) < Number(price.max);

  function applyFilter(): void {
    const q = search.value.trim().toLowerCase();
    const only = grid.classList.contains('only-saved');
    const max = Number(price.value);
    let shown = 0;
    cards().forEach((c) => {
      const ok = (!q || c.textContent!.toLowerCase().includes(q)) && (!only || c.dataset.wish === '1') && priceOf(c) <= max;
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    const total = cards().length;
    priceOut.textContent = money(max);
    status.replaceChildren(el('span', '', `${shown} / ${total} ${lang === 'ar' ? 'منتج' : 'products'}`));
    if (filtersActive()) status.append(clear);
    status.style.display = total ? 'flex' : 'none';
    empty.style.display = total && !shown ? 'block' : 'none';
  }

  const resetFilters = () => {
    search.value = '';
    sort.value = 'def';
    price.value = price.max;
    grid.classList.remove('only-saved');
    savedBtn.classList.remove('on');
    savedBtn.setAttribute('aria-pressed', 'false');
    applySort();
    applyFilter();
  };
  clear.addEventListener('click', resetFilters);
  sort.addEventListener('change', applySort);
  search.addEventListener('input', debounce(applyFilter, 120));
  price.addEventListener('input', applyFilter);
  savedBtn.addEventListener('click', () => {
    grid.classList.toggle('only-saved');
    const on = grid.classList.contains('only-saved');
    savedBtn.classList.toggle('on', on);
    savedBtn.setAttribute('aria-pressed', String(on));
    applyFilter();
  });

  // ---------- Wishlist hearts, card glow, tilt ----------
  const io =
    'IntersectionObserver' in window && !prefersReducedMotion()
      ? new IntersectionObserver((entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('eng-in');
            io!.unobserve(e.target);
          }
        }), { threshold: 0.08 })
      : null;

  function decorate(): void {
    cards().forEach((card, i) => {
      card.dataset.i = String(i);
      if (io) {
        card.classList.add('eng-reveal');
        card.style.transitionDelay = Math.min(i % 8, 7) * 50 + 'ms';
        io.observe(card);
      }
      const id = Number(card.dataset.id);
      const wished = S.wish.includes(id);
      card.dataset.wish = wished ? '1' : '0';
      card.append(el('span', 'eng-glow'));

      const heart = el('button', 'eng-heart' + (wished ? ' on' : ''), '♥');
      heart.type = 'button';
      heart.setAttribute('aria-label', 'Save');
      heart.setAttribute('aria-pressed', String(wished));
      heart.addEventListener('click', (e) => {
        e.stopPropagation();
        const at = S.wish.indexOf(id);
        if (at > -1) S.wish.splice(at, 1);
        else S.wish.push(id);
        const now = S.wish.includes(id);
        heart.classList.toggle('on', now);
        heart.setAttribute('aria-pressed', String(now));
        card.dataset.wish = now ? '1' : '0';
        replay(heart, 'pop');
        if (now && !S.ever.includes(id)) {
          S.ever.push(id);
          addPoints(5, e.clientX, e.clientY);
        } else save();
        checkAch();
        applyFilter();
      });
      card.append(heart);
    });
  }

  bus.on('render', () => {
    // A fresh category starts with clean filters; the price ceiling tracks the catalogue.
    const top = ceiling();
    price.max = String(top);
    resetFilters();
    decorate();
    applyFilter();
  });

  grid.addEventListener('mousemove', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    c.style.setProperty('--mx', x + 'px');
    c.style.setProperty('--my', y + 'px');
    c.style.setProperty('--ry', ((x / r.width - 0.5) * 8).toFixed(2) + 'deg');
    c.style.setProperty('--rx', ((0.5 - y / r.height) * 8).toFixed(2) + 'deg');
  });
  grid.addEventListener('mouseout', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.card');
    if (c && !c.contains(e.relatedTarget as Node | null)) {
      c.style.setProperty('--rx', '0deg');
      c.style.setProperty('--ry', '0deg');
    }
  });

  // ---------- Daily gift ----------
  giftBtn.addEventListener('click', () => {
    if (GUEST) return askLogin();
    let modal = $('#eng-gift-modal');
    if (!modal) {
      modal = el('div', 'modal');
      modal.id = 'eng-gift-modal';
      modal.addEventListener('click', (e) => e.target === modal && closeModal(modal!));
      document.body.append(modal);
    }
    const done = S.gift === new Date().toDateString();
    modal.innerHTML = `<div class="modal-content eng-panel"><span class="close-modal" id="eng-gx" role="button" tabindex="0" aria-label="Close">&times;</span><h3>${t().giftT}</h3>
      <button class="eng-box${done ? ' open' : ''}" id="eng-box" type="button">${done ? '✨' : '🎁'}</button><p class="eng-sub" id="eng-gmsg" aria-live="polite">${done ? t().giftDone : t().giftTap}</p></div>`;
    $('#eng-gx', modal)!.onclick = () => closeModal(modal!);
    openModal(modal);
    const box = $<HTMLButtonElement>('#eng-box', modal)!;
    box.onclick = () => {
      if (S.gift === new Date().toDateString()) return;
      S.gift = new Date().toDateString();
      S.gifts++;
      const n = 10 + ((Math.random() * 6) | 0) * 10;
      const r = box.getBoundingClientRect();
      box.classList.add('open');
      box.textContent = '✨';
      $('#eng-gmsg', modal!)!.textContent = t().giftWon(n);
      confetti(r.left + r.width / 2, r.top + r.height / 2, 100);
      addPoints(n, r.left + r.width / 2, r.top);
      giftReady();
    };
  });

  // ---------- Back-to-top + shortcuts ----------
  const top = el('button', 'eng-top', '↑');
  top.id = 'eng-top';
  top.type = 'button';
  top.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(top);
  addEventListener('scroll', () => top.classList.toggle('show', scrollY > 600), { passive: true });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName?.toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === '/' && !typing) {
      e.preventDefault();
      search.focus();
    }
    if (e.key === 'Escape' && typing) (e.target as HTMLElement).blur();
  });

  // ---------- Cart: fly-to-cart, points, free-delivery meter ----------
  bus.on('cart:added', ({ product, x, y }) => {
    fly(product.thumbnail, { x, y });
    S.adds++;
    addPoints(10, x, y);
  });

  const ship = el('div', 'eng-ship');
  ship.innerHTML = '<div class="eng-ship-txt"></div><div class="eng-bar"><i></i></div>';
  $('.cart-summary')?.before(ship);
  const paintShip = () => {
    const sub = totals().subtotal;
    ship.style.display = sub > 0 ? 'block' : 'none';
    $('.eng-ship-txt', ship)!.textContent = sub >= 100 ? t().free : t().more(money(100 - sub));
    $<HTMLElement>('i', ship)!.style.width = Math.min(100, sub) + '%';
  };
  bus.on('cart:changed', paintShip);

  bus.on('checkout:done', () => {
    confetti(innerWidth / 2, innerHeight / 2, 140);
    addPoints(50, innerWidth / 2, innerHeight / 2);
  });

  // ---------- Button ripple ----------
  document.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.btn');
    if (!b || prefersReducedMotion()) return;
    const r = b.getBoundingClientRect();
    const dot = el('span', 'eng-ripple');
    dot.style.left = e.clientX - r.left + 'px';
    dot.style.top = e.clientY - r.top + 'px';
    b.append(dot);
    setTimeout(() => dot.remove(), 600);
  });

  // ---------- Daily streak ----------
  const today = new Date().toDateString();
  if (!GUEST && S.last !== today) {
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    S.streak = S.last === yesterday ? S.streak + 1 : 1;
    S.last = today;
    const bonus = Math.min(S.streak * 10, 70);
    setTimeout(() => {
      addPoints(bonus);
      showToast(t().daily(S.streak, bonus));
      confetti(innerWidth / 2, innerHeight / 3, 50);
    }, 1200);
  }

  bus.on('currency:changed', paintShip);

  bus.on('lang:changed', ({ lang: next }) => {
    lang = next;
    labels();
    paintHud();
    applyFilter();
    paintShip();
  });

  labels();
  paintHud();
  giftReady();
  paintShip();

  // Merge this account's saved progress from the server. Rule: the best value wins and lists are combined,
  // so nothing earned on either device is thrown away.
  if (!GUEST && serverSession()) {
    void api
      .get<{ profile: (Partial<EngageState> & { updatedAt?: number }) | null }>('/api/profile')
      .then(({ profile: p }) => {
        if (!p) return save(); // first time: upload what this device has
        const union = <T,>(a: T[], b: T[] = []) => Array.from(new Set([...a, ...b]));
        const day = (s?: string) => Date.parse(s ?? '') || 0;
        S.points = Math.max(S.points, p.points ?? 0);
        S.adds = Math.max(S.adds, p.adds ?? 0);
        S.gifts = Math.max(S.gifts, p.gifts ?? 0);
        S.wish = union(S.wish, p.wish);
        S.ever = union(S.ever, p.ever);
        S.ach = union(S.ach, p.ach);
        if (day(p.last) > day(S.last)) { S.last = p.last ?? S.last; S.streak = p.streak ?? S.streak; }
        else if (day(p.last) === day(S.last)) S.streak = Math.max(S.streak, p.streak ?? 0);
        if (day(p.gift) > day(S.gift)) S.gift = p.gift ?? S.gift;
        write(KEY, S);
        pushToServer();
        paintHud();
        giftReady();
        // Hearts may already be on screen: refresh them from the merged list.
        cards().forEach((c) => {
          const on = S.wish.includes(Number(c.dataset.id));
          c.dataset.wish = on ? '1' : '0';
          const h = $('.eng-heart', c);
          h?.classList.toggle('on', on);
          h?.setAttribute('aria-pressed', String(on));
        });
        applyFilter();
      })
      .catch(() => undefined);
  }

  const publicApi: OmniEngage = { addPoints, confetti, GUEST };
  (window as unknown as { OmniEngage: OmniEngage }).OmniEngage = publicApi;
  return publicApi;
}
