import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Store, UserRow } from './store.js';
import { HttpError, parseCookies } from './http.js';

export const COOKIE = 'omni_sid';
export const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS) || 7);

// ---------- Password hashing (scrypt, random salt per user) ----------
const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `s1$${salt.toString('base64')}$${(await derive(password, salt)).toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [tag, salt, hash] = stored.split('$');
  if (tag !== 's1' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// A hash we can compare against when the email is unknown, so "no such user"
// takes as long as "wrong password" and reveals nothing by timing.
let decoy: Promise<string> | undefined;
export const decoyHash = (): Promise<string> => (decoy ??= hashPassword(randomBytes(12).toString('hex')));

// ---------- Validation (same rules as the browser) ----------
const EASY = ['12345678', 'password', 'qwertyui', '123456789', 'password123', 'abc12345', 'letmein1', 'admin123'];

export function checkPassword(pw: unknown): void {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'password_short', 'Password must be at least 8 characters.');
  if (pw.length > 200) throw new HttpError(400, 'password_long', 'Password is too long.');
  const lower = pw.toLowerCase();
  if (/^([^])\1+$/.test(pw) || EASY.some((w) => lower.includes(w))) throw new HttpError(400, 'password_weak', 'That password is too easy to guess.');
}

export function checkEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'email_invalid', 'Enter a valid email address.');
  return email;
}

// ---------- Sessions (random token in an HttpOnly cookie; only its hash is stored) ----------
const sha = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createSession(store: Store, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await store.createSession({ id: sha(token), userId, expires: Date.now() + SESSION_DAYS * 864e5 });
  return token;
}

export function tokenOf(req: IncomingMessage): string | undefined {
  return parseCookies(req.headers.cookie)[COOKIE];
}

export async function userFrom(store: Store, req: IncomingMessage): Promise<UserRow | null> {
  const token = tokenOf(req);
  return token ? store.sessionUser(sha(token)) : null;
}

export async function endSession(store: Store, req: IncomingMessage): Promise<void> {
  const token = tokenOf(req);
  if (token) await store.deleteSession(sha(token));
}

// ---------- Throttle for login / sign-up ----------
const hits = new Map<string, { n: number; reset: number }>();

/** Allow `max` tries per `windowMs` for a key; throws 429 after that. */
export function throttle(key: string, max = 10, windowMs = 10 * 60_000): void {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
  } else if (++entry.n > max) {
    throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
  }
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}
