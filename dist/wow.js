import { openProductModal, showGuestAuthPrompt } from './app.js';
import { applyPromo, state } from './core.js';
import { wowText as T } from './i18n.js';
import { $, $$, bus, closeModal, el, getUser, money, openModal, prefersReducedMotion, read, write } from './utils.js';
const SEGMENTS = [
    { s: '10%', code: 'SAVE10', w: 24 }, { s: '+20 ★', pts: 20, w: 22 }, { s: '15%', code: 'WELCOME15', w: 16 }, { s: '+50 ★', pts: 50, w: 14 },
    { s: '20%', code: 'DISCOUNT20', w: 10 }, { s: '+100 ★', pts: 100, w: 8 }, { s: '25%', code: 'GAMER25', w: 4 }, { s: '30%', code: 'FLASH30', w: 2 },
];
export function initWow(engage) {
    const grid = $('#product-grid');
    if (!grid)
        return;
    const lang = () => state.lang;
    const t = () => T[lang()];
    const reduce = prefersReducedMotion();
    const E = engage ?? { addPoints() { }, confetti() { }, GUEST: true };
    // ---------- Scroll progress + ambient gold dust ----------
    const progress = el('div');
    progress.id = 'wow-prog';
    document.body.append(progress);
    addEventListener('scroll', () => {
        const h = document.documentElement.scrollHeight - innerHeight;
        progress.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%';
    }, { passive: true });
    if (!reduce)
        startDust();
    function startDust() {
        const c = el('canvas');
        c.id = 'wow-dust';
        document.body.append(c);
        const g = c.getContext('2d');
        let W = 0;
        let H = 0;
        const size = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
        size();
        addEventListener('resize', size);
        const specks = Array.from({ length: 38 }, () => ({
            x: Math.random() * innerWidth, y: Math.random() * innerHeight,
            r: 0.6 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.35, d: Math.random() * 6,
        }));
        const tick = () => {
            if (!document.hidden) {
                g.clearRect(0, 0, W, H);
                const light = document.body.classList.contains('light-mode');
                for (const p of specks) {
                    p.y -= p.v;
                    p.d += 0.01;
                    p.x += Math.sin(p.d) * 0.3;
                    if (p.y < -4) {
                        p.y = H + 4;
                        p.x = Math.random() * W;
                    }
                    g.beginPath();
                    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    g.fillStyle = light ? 'rgba(166,124,18,.35)' : `rgba(248,229,138,${0.25 + Math.sin(p.d * 3) * 0.2})`;
                    g.fill();
                }
            }
            requestAnimationFrame(tick);
        };
        tick();
    }
    // ---------- Recently viewed + similar items ----------
    const recent = el('div', 'wow-recent');
    recent.setAttribute('aria-label', 'Recently viewed');
    grid.parentNode.insertBefore(recent, grid);
    const recentIds = () => read('omni_recent', []);
    function drawRecent() {
        recent.replaceChildren();
        const items = recentIds().map((id) => state.products.find((p) => p.id === id)).filter((p) => !!p);
        recent.classList.toggle('has', items.length > 0);
        if (!items.length)
            return;
        recent.append(el('span', '', t().recent));
        for (const p of items) {
            const chip = el('button', 'wow-chip');
            chip.type = 'button';
            const img = el('img');
            img.src = p.thumbnail;
            img.alt = '';
            chip.append(img, el('b', '', p.title));
            chip.onclick = () => openProductModal(p.id);
            recent.append(chip);
        }
    }
    function drawSimilar(id) {
        const product = state.products.find((x) => x.id === id);
        const host = $('#product-modal .modal-info-container');
        if (!product || !host)
            return;
        let box = $('#wow-sim');
        if (!box) {
            box = el('div', 'wow-sim');
            box.id = 'wow-sim';
            host.append(box);
        }
        box.replaceChildren();
        const pool = state.products
            .filter((x) => x.category === product.category && x.id !== id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);
        box.style.display = pool.length ? '' : 'none';
        if (!pool.length)
            return;
        box.append(el('h5', '', t().similar));
        const row = el('div', 'wow-sim-row');
        for (const x of pool) {
            const b = el('button');
            b.type = 'button';
            b.title = x.title;
            const img = el('img');
            img.src = x.thumbnail;
            img.alt = x.title;
            img.loading = 'lazy';
            b.append(img, el('span', '', money(x.price)));
            b.onclick = () => openProductModal(x.id);
            row.append(b);
        }
        box.append(row);
    }
    bus.on('product:opened', ({ id }) => {
        write('omni_recent', [id, ...recentIds().filter((x) => x !== id)].slice(0, 8));
        drawSimilar(id);
        drawRecent();
        const m = $('#product-modal .modal-content');
        if (m)
            m.scrollTop = 0;
    });
    bus.on('render', drawRecent);
    // ---------- Tools row: voice, wheel, surprise, palette, help ----------
    const tools = $('.eng-tools');
    const search = $('#eng-search');
    const surprise = () => {
        if (state.products.length)
            openProductModal(state.products[(Math.random() * state.products.length) | 0].id);
    };
    let wheelBtn;
    let surpBtn;
    if (tools) {
        wheelBtn = el('button', 'eng-saved eng-giftbtn');
        surpBtn = el('button', 'eng-saved');
        const palBtn = el('button', 'eng-saved', '⌘');
        for (const b of [wheelBtn, surpBtn, palBtn]) {
            b.type = 'button';
            tools.append(b);
        }
        palBtn.append(el('span', 'wow-k', 'Ctrl K'));
        palBtn.setAttribute('aria-label', 'Command palette');
        palBtn.onclick = () => openPalette();
        surpBtn.onclick = surprise;
        wheelBtn.onclick = () => openWheel();
        const SR = (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (SR && search) {
            const mic = el('button', 'wow-mic', '🎤');
            mic.type = 'button';
            search.after(mic);
            let rec = null;
            mic.onclick = () => {
                if (rec)
                    return rec.stop();
                rec = new SR();
                rec.lang = lang() === 'ar' ? 'ar-SA' : 'en-US';
                rec.interimResults = false;
                mic.classList.add('live');
                rec.onresult = (e) => {
                    search.value = e.results[0][0].transcript;
                    search.dispatchEvent(new Event('input'));
                };
                rec.onend = rec.onerror = () => { mic.classList.remove('live'); rec = null; };
                try {
                    rec.start();
                }
                catch {
                    mic.classList.remove('live');
                    rec = null;
                }
            };
        }
    }
    // ---------- Royal Wheel ----------
    const wheelKey = () => {
        const u = getUser();
        return u && !u.isGuest ? 'omni_wheel:' + String(u.email || u.name).toLowerCase() : null;
    };
    const spunToday = () => {
        const k = wheelKey();
        return !!k && read(k, '') === new Date().toDateString();
    };
    const refreshWheelBtn = () => wheelBtn?.classList.toggle('ready', !E.GUEST && !spunToday());
    function drawWheel(cv) {
        const g = cv.getContext('2d');
        const n = SEGMENTS.length;
        const a = (Math.PI * 2) / n;
        const c = cv.width / 2;
        const r = c - 6;
        SEGMENTS.forEach((seg, i) => {
            g.beginPath();
            g.moveTo(c, c);
            g.arc(c, c, r, -Math.PI / 2 + i * a, -Math.PI / 2 + (i + 1) * a);
            g.closePath();
            g.fillStyle = seg.code ? (i % 4 === 0 ? '#3b1f7a' : '#4b2a94') : '#120d2b';
            g.fill();
            g.strokeStyle = '#d4af37';
            g.lineWidth = 2;
            g.stroke();
            g.save();
            g.translate(c, c);
            g.rotate(-Math.PI / 2 + (i + 0.5) * a);
            g.textAlign = 'right';
            g.fillStyle = '#f8e58a';
            g.font = '700 22px Cinzel, serif';
            g.fillText(seg.s, r - 18, 8);
            g.restore();
        });
        g.beginPath();
        g.arc(c, c, 26, 0, Math.PI * 2);
        g.fillStyle = '#d4af37';
        g.fill();
        g.strokeStyle = '#8a6a16';
        g.lineWidth = 4;
        g.stroke();
    }
    function openWheel() {
        if (E.GUEST)
            return showGuestAuthPrompt();
        let modal = $('#wow-wheel-modal');
        if (!modal) {
            modal = el('div', 'modal');
            modal.id = 'wow-wheel-modal';
            modal.addEventListener('click', (e) => e.target === modal && closeModal(modal));
            document.body.append(modal);
        }
        modal.replaceChildren();
        const m = modal;
        const box = el('div', 'modal-content eng-panel');
        const x = el('span', 'close-modal', '×');
        x.setAttribute('role', 'button');
        x.tabIndex = 0;
        x.setAttribute('aria-label', 'Close');
        x.onclick = () => closeModal(m);
        const wrap = el('div', 'wow-wheel-wrap');
        const cv = el('canvas');
        cv.id = 'wow-wheel';
        cv.width = cv.height = 560;
        wrap.append(cv);
        drawWheel(cv);
        const go = el('button', 'btn wow-spin', spunToday() ? t().spun : t().spin);
        const prize = el('div', 'wow-prize');
        prize.setAttribute('aria-live', 'polite');
        go.disabled = spunToday();
        go.onclick = () => {
            if (spunToday())
                return;
            write(wheelKey(), new Date().toDateString());
            go.disabled = true;
            go.textContent = t().again;
            refreshWheelBtn();
            // Weighted pick: rarer segments have lower weights.
            let roll = Math.random() * SEGMENTS.reduce((sum, s) => sum + s.w, 0);
            let idx = 0;
            for (; idx < SEGMENTS.length - 1; idx++) {
                roll -= SEGMENTS[idx].w;
                if (roll < 0)
                    break;
            }
            const jitter = (Math.random() - 0.5) * 28;
            const final = 360 * 6 - (idx + 0.5) * (360 / SEGMENTS.length) + jitter;
            cv.style.transition = `transform ${reduce ? 0.4 : 5}s cubic-bezier(.12,.7,.1,1)`;
            cv.style.transform = `rotate(${final}deg)`;
            setTimeout(() => {
                const seg = SEGMENTS[idx];
                const r = cv.getBoundingClientRect();
                go.textContent = t().spun;
                E.confetti(r.left + r.width / 2, r.top + r.height / 2, 120);
                if (seg.pts) {
                    prize.textContent = t().ptsWon(seg.pts);
                    E.addPoints(seg.pts, r.left + r.width / 2, r.top);
                }
                else if (seg.code) {
                    const input = $('#promo-input');
                    let msg = t().codeWon(seg.code) + ' ';
                    if (state.cart.length && applyPromo(seg.code))
                        msg += t().codeApplied;
                    else {
                        if (input)
                            input.value = seg.code;
                        msg += t().codeReady;
                    }
                    prize.textContent = msg;
                }
            }, reduce ? 450 : 5200);
        };
        box.append(x, el('h3', '', t().wheelT), wrap, go, prize);
        modal.append(box);
        openModal(modal);
    }
    // ---------- Command palette ----------
    const pal = el('div', 'wow-pal');
    const pbox = el('div', 'wow-pal-box');
    const pin = el('input');
    const plist = el('ul');
    pin.type = 'text';
    pin.autocomplete = 'off';
    pin.setAttribute('role', 'combobox');
    pin.setAttribute('aria-expanded', 'true');
    plist.setAttribute('role', 'listbox');
    pbox.append(pin, plist);
    pal.append(pbox);
    document.body.append(pal);
    let rows = [];
    let sel = 0;
    const clickEl = (s) => () => $(s)?.click();
    function actions() {
        const x = t();
        const list = [
            { i: '🛒', n: x.a_cart, run: clickEl('#cart-btn') },
            { i: '⭐', n: x.a_rewards, run: clickEl('#eng-hud') },
            { i: '🎁', n: x.a_gift, run: clickEl('#eng-gift') },
            { i: '🎡', n: x.a_wheel, run: () => openWheel() },
            { i: '🎲', n: x.a_surprise, run: surprise },
            { i: '🌓', n: x.a_theme, run: clickEl('#theme-toggle') },
            {
                i: '🌐', n: x.a_lang,
                run: () => {
                    const s = $('#lang-select');
                    if (!s)
                        return;
                    s.value = lang() === 'ar' ? 'en' : 'ar';
                    s.dispatchEvent(new Event('change'));
                },
            },
            { i: '❔', n: x.a_help, run: () => openHelp() },
            { i: '↑', n: x.a_top, run: () => scrollTo({ top: 0, behavior: 'smooth' }) },
        ];
        $$('.cat-btn').forEach((b) => list.push({ i: '🗂️', n: b.textContent.trim(), tag: x.cat, run: () => { b.click(); scrollTo({ top: 0, behavior: 'smooth' }); } }));
        return list;
    }
    function paint() {
        const q = pin.value.trim().toLowerCase();
        plist.replaceChildren();
        rows = actions().filter((a) => !q || a.n.toLowerCase().includes(q));
        if (q.length > 1) {
            state.products
                .filter((p) => p.title.toLowerCase().includes(q))
                .slice(0, 6)
                .forEach((p) => rows.push({ i: '🛍️', n: p.title, tag: t().prod, run: () => openProductModal(p.id) }));
        }
        sel = Math.min(sel, Math.max(rows.length - 1, 0));
        if (!rows.length) {
            plist.append(el('div', 'none', t().none));
            return;
        }
        rows.forEach((row, i) => {
            const li = el('li', i === sel ? 'on' : '');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', String(i === sel));
            li.append(el('span', '', row.i), el('span', '', row.n));
            if (row.tag)
                li.append(el('small', '', row.tag));
            li.onmousemove = () => {
                if (sel === i)
                    return;
                sel = i;
                [...plist.children].forEach((c, j) => c.classList.toggle('on', j === i));
            };
            li.onclick = () => runRow(i);
            plist.append(li);
        });
        plist.children[sel]?.scrollIntoView({ block: 'nearest' });
    }
    function runRow(i) {
        const row = rows[i];
        closePalette();
        if (row)
            setTimeout(row.run, 30);
    }
    function openPalette() {
        pin.placeholder = t().palPh;
        pin.value = '';
        sel = 0;
        paint();
        pal.classList.add('open');
        pin.focus();
    }
    function closePalette() {
        pal.classList.remove('open');
        pin.blur();
    }
    pal.addEventListener('click', (e) => e.target === pal && closePalette());
    pin.addEventListener('input', () => { sel = 0; paint(); });
    pin.addEventListener('keydown', (e) => {
        const n = Math.max(rows.length, 1);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            sel = (sel + 1) % n;
            paint();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            sel = (sel - 1 + n) % n;
            paint();
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            runRow(sel);
        }
        else if (e.key === 'Escape') {
            e.stopPropagation();
            closePalette();
        }
    });
    // ---------- Shortcut help sheet ----------
    function openHelp() {
        let modal = $('#wow-help-modal');
        if (!modal) {
            modal = el('div', 'modal');
            modal.id = 'wow-help-modal';
            modal.addEventListener('click', (e) => e.target === modal && closeModal(modal));
            document.body.append(modal);
        }
        const m = modal;
        const ar = lang() === 'ar';
        const rowsData = [
            ['/', ar ? 'التركيز على خانة البحث' : 'Focus the search box'],
            ['Ctrl / ⌘ + K', ar ? 'فتح لوحة الأوامر' : 'Open the command palette'],
            ['?', ar ? 'عرض هذه القائمة' : 'Show this list'],
            ['Esc', ar ? 'إغلاق أي نافذة مفتوحة' : 'Close any open window'],
        ];
        m.replaceChildren();
        const box = el('div', 'modal-content eng-panel');
        const x = el('span', 'close-modal', '×');
        x.setAttribute('role', 'button');
        x.tabIndex = 0;
        x.setAttribute('aria-label', 'Close');
        x.onclick = () => closeModal(m);
        const dl = el('dl', 'wow-keys');
        rowsData.forEach(([k, d]) => dl.append(el('dt', '', k), el('dd', '', d)));
        box.append(x, el('h3', '', ar ? 'اختصارات لوحة المفاتيح' : 'Keyboard shortcuts'), dl);
        m.append(box);
        openModal(m);
    }
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            pal.classList.contains('open') ? closePalette() : openPalette();
            return;
        }
        const tag = e.target.tagName?.toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
        if (e.key === '?' && !typing) {
            e.preventDefault();
            openHelp();
        }
    });
    // ---------- Language-aware labels ----------
    function labels() {
        if (wheelBtn && surpBtn) {
            wheelBtn.textContent = t().wheel;
            surpBtn.textContent = t().surprise;
        }
        const mic = $('.wow-mic');
        if (mic) {
            mic.title = t().mic;
            mic.setAttribute('aria-label', t().mic);
        }
        drawRecent();
        refreshWheelBtn();
    }
    bus.on('lang:changed', labels);
    labels();
}
//# sourceMappingURL=wow.js.map