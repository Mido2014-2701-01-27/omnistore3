import type { OrderRecord } from '../src/types.js';
import { Db } from './db.js';
import type { OrderRow, ProfileRow, ReviewRow, ReviewView, SessionRow, Store, UserRow } from './store.js';

/** The no-setup store: everything in `data/db.json`. */
export class JsonStore implements Store {
  readonly kind = 'json' as const;
  private readonly db: Db;

  constructor(dir: string) {
    this.db = new Db(dir);
  }

  get file(): string {
    return `${this.db.dir}/db.json`;
  }

  init = () => this.db.load();
  close = () => this.db.flush();
  ping = async () => undefined;

  // ---------- accounts ----------
  userByEmail = async (email: string) => this.db.data.users.find((u) => u.email === email) ?? null;
  userById = async (id: string) => this.db.data.users.find((u) => u.id === id) ?? null;

  async createUser(user: UserRow): Promise<boolean> {
    if (this.db.data.users.some((u) => u.email === user.email)) return false;
    this.db.data.users.push(user);
    this.db.save();
    return true;
  }

  async deleteUser(id: string): Promise<void> {
    const d = this.db.data;
    d.users = d.users.filter((u) => u.id !== id);
    d.sessions = d.sessions.filter((s) => s.userId !== id);
    d.orders = d.orders.filter((o) => o.userId !== id);
    d.reviews = d.reviews.filter((r) => r.userId !== id);
    delete d.profiles[id];
    this.db.save();
  }

  // ---------- sessions ----------
  async createSession(session: SessionRow): Promise<void> {
    this.db.data.sessions.push(session);
    this.db.save();
  }

  async sessionUser(id: string): Promise<UserRow | null> {
    const s = this.db.data.sessions.find((x) => x.id === id);
    if (!s || s.expires <= Date.now()) return null;
    return this.db.data.users.find((u) => u.id === s.userId) ?? null;
  }

  async deleteSession(id: string): Promise<void> {
    this.db.data.sessions = this.db.data.sessions.filter((s) => s.id !== id);
    this.db.save();
  }

  async purgeSessions(): Promise<number> {
    const before = this.db.data.sessions.length;
    const now = Date.now();
    this.db.data.sessions = this.db.data.sessions.filter((s) => s.expires > now);
    if (this.db.data.sessions.length !== before) this.db.save();
    return before - this.db.data.sessions.length;
  }

  // ---------- orders ----------
  async createOrder(order: OrderRow): Promise<void> {
    this.db.data.orders.push(order);
    this.db.save();
  }

  async ordersFor(userId: string, limit: number): Promise<OrderRecord[]> {
    return this.db.data.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit)
      .map(({ userId: _u, ...order }) => order);
  }

  // ---------- reviews ----------
  async reviewsFor(productId: number, viewerId: string | null, limit: number) {
    const all = this.db.data.reviews.filter((r) => r.productId === productId).sort((a, b) => b.at - a.at);
    const avg = all.length ? Math.round((all.reduce((n, r) => n + r.rating, 0) / all.length) * 10) / 10 : 0;
    const reviews: ReviewView[] = all
      .slice(0, limit)
      .map((r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, at: r.at, mine: viewerId !== null && r.userId === viewerId }));
    return { count: all.length, avg, reviews };
  }

  hasReview = async (productId: number, userId: string) =>
    this.db.data.reviews.some((r) => r.productId === productId && r.userId === userId);

  async saveReview(review: ReviewRow): Promise<void> {
    const existing = this.db.data.reviews.find((r) => r.productId === review.productId && r.userId === review.userId);
    if (existing) Object.assign(existing, { rating: review.rating, text: review.text, at: review.at, name: review.name });
    else this.db.data.reviews.push(review);
    this.db.save();
  }

  async deleteReview(productId: number, userId: string): Promise<void> {
    this.db.data.reviews = this.db.data.reviews.filter((r) => !(r.productId === productId && r.userId === userId));
    this.db.save();
  }

  // ---------- profile ----------
  profile = async (userId: string) => this.db.data.profiles[userId] ?? null;

  async saveProfile(userId: string, profile: ProfileRow): Promise<void> {
    this.db.data.profiles[userId] = profile;
    this.db.save();
  }
}
