import { ApiError, api, serverSession } from './api.js';
import { showToast, state } from './core.js';
import { extrasText } from './i18n.js';
import { $, bus, el, isOpen } from './utils.js';
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
export function initReviews() {
    if (!api.available)
        return;
    const x = () => extrasText[state.lang];
    const box = el('section', 'reviews');
    box.id = 'reviews';
    let current = 0;
    async function render(id) {
        current = id;
        let data;
        try {
            data = await api.get(`/api/reviews?product=${id}`);
        }
        catch {
            return box.replaceChildren();
        }
        if (current !== id)
            return; // another product was opened meanwhile
        const mine = data.reviews.find((r) => r.mine);
        let rating = mine?.rating ?? 0;
        box.replaceChildren(el('h5', '', x().revTitle));
        const sum = el('p', 'rev-sum');
        sum.textContent = data.count ? `${stars(Math.round(data.avg))}  ${data.avg.toFixed(1)} · ${x().revCount(data.count)}` : x().revNone;
        box.append(sum);
        const list = el('ul', 'rev-list');
        data.reviews.slice(0, 5).forEach((r) => {
            const li = el('li', r.mine ? 'mine' : '');
            const head = el('div', 'rev-head');
            head.append(el('b', '', r.name), el('span', 'rev-stars', stars(r.rating)));
            li.append(head);
            if (r.text)
                li.append(el('p', '', r.text)); // textContent only: reviews can never inject HTML
            list.append(li);
        });
        box.append(list);
        if (!serverSession())
            return void box.append(el('p', 'eng-sub', x().revLogin));
        // Write or update your own review
        const form = el('div', 'rev-form');
        form.append(el('b', '', x().revYour));
        const picker = el('div', 'rev-pick');
        picker.setAttribute('role', 'radiogroup');
        picker.setAttribute('aria-label', x().revYour);
        const paint = () => picker.querySelectorAll('button').forEach((b, i) => {
            b.classList.toggle('on', i < rating);
            b.setAttribute('aria-checked', String(i + 1 === rating));
        });
        for (let i = 1; i <= 5; i++) {
            const b = el('button', '', '★');
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-label', `${i}`);
            b.onclick = () => { rating = i; paint(); };
            picker.append(b);
        }
        paint();
        const text = el('textarea');
        text.maxLength = 500;
        text.rows = 3;
        text.placeholder = x().revPlaceholder;
        text.value = mine?.text ?? '';
        const actions = el('div', 'rev-actions');
        const send = el('button', 'btn', mine ? x().revUpdate : x().revSubmit);
        send.type = 'button';
        send.onclick = async () => {
            if (!rating)
                return showToast(x().revPickStars);
            send.disabled = true;
            try {
                await api.post('/api/reviews', { productId: id, rating, text: text.value });
                showToast(x().revThanks);
                await render(id);
            }
            catch (err) {
                showToast(err instanceof ApiError && err.status === 401 ? extrasText[state.lang].sessionExpired : x().revFail);
                send.disabled = false;
            }
        };
        actions.append(send);
        if (mine) {
            const del = el('button', 'btn outline', x().revDelete);
            del.type = 'button';
            del.onclick = async () => {
                await api.del(`/api/reviews?product=${id}`).catch(() => undefined);
                showToast(x().revRemoved);
                await render(id);
            };
            actions.append(del);
        }
        form.append(picker, text, actions);
        box.append(form);
    }
    bus.on('product:opened', ({ id }) => {
        $('#product-modal .modal-info-container')?.append(box); // always last in the dialog
        box.replaceChildren();
        void render(id);
    });
    bus.on('lang:changed', () => {
        const modal = $('#product-modal');
        if (current && modal && isOpen(modal))
            void render(current);
    });
}
//# sourceMappingURL=reviews.js.map