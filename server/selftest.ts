import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { explainDbError, openStore } from './open-store.js';
import type { OrderRow, ProfileRow, ReviewRow, UserRow } from './store.js';

// ======================================================================
// npm run db:check
// Runs the same checks against whichever database is configured (PostgreSQL
// when DATABASE_URL is set, otherwise the JSON file). It creates two throw-away
// users, tests every database operation the server uses, then deletes them.
// ======================================================================
const { store, label } = openStore();
console.log(`\nChecking the database: ${label}\n`);

let passed = 0;
async function check(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}\n        ${(err as Error).message.split('\n')[0]}`);
    failures.push(name);
  }
}
const failures: string[] = [];

try {
  await store.init();
} catch (err) {
  console.error(`Could not open the database:\n  ${explainDbError(err)}\n`);
  process.exit(1);
}

const tag = randomUUID().slice(0, 8);
const now = Date.now();
const alice: UserRow = { id: randomUUID(), name: 'Selftest Alice', email: `alice-${tag}@example.com`, pass: 's1$salt$hash', createdAt: now };
const bob: UserRow = { id: randomUUID(), name: 'Selftest Bob', email: `bob-${tag}@example.com`, pass: 's1$salt$hash', createdAt: now };
const productId = 900_000 + Math.floor(Math.random() * 90_000);

try {
  await check('can reach the database', () => store.ping());

  await check('create a user, then find them by email and by id', async () => {
    assert.equal(await store.createUser(alice), true);
    assert.equal(await store.createUser(bob), true);
    assert.deepEqual(await store.userByEmail(alice.email), alice);
    assert.equal((await store.userById(bob.id))?.email, bob.email);
    assert.equal(await store.userByEmail(`nobody-${tag}@example.com`), null);
  });

  await check('a second account with the same email is refused', async () => {
    assert.equal(await store.createUser({ ...alice, id: randomUUID() }), false);
  });

  await check('sessions: found while valid, gone after logout or expiry', async () => {
    await store.createSession({ id: `s-ok-${tag}`, userId: alice.id, expires: now + 60_000 });
    await store.createSession({ id: `s-old-${tag}`, userId: alice.id, expires: now - 1000 });
    assert.equal((await store.sessionUser(`s-ok-${tag}`))?.id, alice.id);
    assert.equal(await store.sessionUser(`s-old-${tag}`), null);
    assert.ok((await store.purgeSessions()) >= 1);
    await store.deleteSession(`s-ok-${tag}`);
    assert.equal(await store.sessionUser(`s-ok-${tag}`), null);
  });

  await check('orders: saved with their lines, newest first, exact to the cent', async () => {
    const mk = (id: string, at: number, price: number): OrderRow => ({
      id, userId: alice.id, at, total: Math.round((price * 3 + 10) * 100) / 100, subtotal: Math.round(price * 3 * 100) / 100, delivery: 10, discountPct: 0, promoCode: '',
      lines: [
        { id: 1, title: 'First item', thumbnail: 'https://example.com/1.png', qty: 3, price },
        { id: 2, title: 'Second item', thumbnail: 'https://example.com/2.png', qty: 1, price: 18.5 },
      ],
    });
    await store.createOrder(mk(`OS-OLD${tag}`, now - 5000, 49.99));
    await store.createOrder(mk(`OS-NEW${tag}`, now, 49.99));
    const list = await store.ordersFor(alice.id, 10);
    assert.deepEqual(list.map((o) => o.id), [`OS-NEW${tag}`, `OS-OLD${tag}`]);
    assert.equal(list[0].lines.length, 2);
    assert.equal(list[0].lines[0].title, 'First item');
    assert.equal(list[0].lines[0].price, 49.99);
    assert.equal(list[0].lines[1].price, 18.5);
    assert.equal(list[0].total, 159.97);
    assert.equal(list[0].delivery, 10);
    assert.equal((await store.ordersFor(alice.id, 1)).length, 1);
    assert.deepEqual(await store.ordersFor(bob.id, 10), []);
  });

  await check('reviews: one per user per product, average and "mine" are right', async () => {
    assert.equal(await store.hasReview(productId, alice.id), false);
    const rv = (u: UserRow, rating: number, text: string, at: number): ReviewRow => ({ id: randomUUID(), productId, userId: u.id, name: u.name, rating, text, at });
    await store.saveReview(rv(alice, 5, 'great', now - 1000));
    await store.saveReview(rv(bob, 2, 'meh', now));
    assert.equal(await store.hasReview(productId, alice.id), true);
    let r = await store.reviewsFor(productId, alice.id, 20);
    assert.equal(r.count, 2);
    assert.equal(r.avg, 3.5);
    assert.equal(r.reviews[0].name, bob.name); // newest first
    assert.deepEqual(r.reviews.map((x) => x.mine), [false, true]);
    assert.equal((await store.reviewsFor(productId, null, 20)).reviews.some((x) => x.mine), false);
    await store.saveReview(rv(bob, 4, 'changed my mind', now + 1000)); // replaces Bob's review
    r = await store.reviewsFor(productId, bob.id, 20);
    assert.equal(r.count, 2);
    assert.equal(r.avg, 4.5);
    assert.equal(r.reviews[0].text, 'changed my mind');
    assert.equal((await store.reviewsFor(productId, bob.id, 1)).reviews.length, 1);
    await store.deleteReview(productId, bob.id);
    assert.equal((await store.reviewsFor(productId, null, 20)).count, 1);
  });

  await check('profile: saved, read back, and replaced', async () => {
    assert.equal(await store.profile(alice.id), null);
    const p: ProfileRow = { points: 120, streak: 3, last: 'Fri Nov 06 2026', wish: [3, 1, 2], ever: [1], ach: ['first', 'fan'], adds: 4, gift: '', gifts: 1, updatedAt: now };
    await store.saveProfile(alice.id, p);
    const got = await store.profile(alice.id);
    assert.ok(got);
    assert.deepEqual({ ...got, updatedAt: 0 }, { ...p, updatedAt: 0 });
    await store.saveProfile(alice.id, { ...p, points: 500, wish: [], ach: [] });
    const again = await store.profile(alice.id);
    assert.equal(again?.points, 500);
    assert.deepEqual(again?.wish, []);
  });

  await check('deleting a user also removes their orders, reviews and profile', async () => {
    await store.createSession({ id: `s-del-${tag}`, userId: alice.id, expires: now + 60_000 });
    await store.deleteUser(alice.id);
    await store.deleteUser(bob.id);
    assert.equal(await store.userById(alice.id), null);
    assert.equal(await store.sessionUser(`s-del-${tag}`), null);
    assert.deepEqual(await store.ordersFor(alice.id, 10), []);
    assert.equal(await store.profile(alice.id), null);
    assert.equal((await store.reviewsFor(productId, null, 20)).count, 0);
  });
} finally {
  // Leave nothing behind even if a check failed half way.
  await store.deleteUser(alice.id).catch(() => undefined);
  await store.deleteUser(bob.id).catch(() => undefined);
  await store.close();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) FAILED, ${passed} passed.\n`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed. The database works.\n`);
