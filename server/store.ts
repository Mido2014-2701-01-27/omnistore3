import type { OrderRecord } from '../src/types.js';

// ======================================================================
// The database contract. The server only ever talks to a `Store`, so the
// data can live in a JSON file (no setup) or in PostgreSQL (DATABASE_URL).
// ======================================================================
export interface UserRow { id: string; name: string; email: string; pass: string; createdAt: number }
export interface SessionRow { id: string; userId: string; expires: number }
export interface OrderRow extends OrderRecord { userId: string }
export interface ReviewRow { id: string; productId: number; userId: string; name: string; rating: number; text: string; at: number }
export interface ProfileRow { points: number; streak: number; last: string; wish: number[]; ever: number[]; ach: string[]; adds: number; gift: string; gifts: number; updatedAt: number }

/** A review as shown to a visitor (`mine` is true for the viewer's own). */
export interface ReviewView { id: string; name: string; rating: number; text: string; at: number; mine: boolean }

/** Everything the JSON file holds. Also the shape `npm run db:import` reads. */
export interface Data {
  users: UserRow[];
  sessions: SessionRow[];
  orders: OrderRow[];
  reviews: ReviewRow[];
  profiles: Record<string, ProfileRow>;
}

export interface Store {
  readonly kind: 'json' | 'postgres';
  /** Open the connection / load the file, and create or update tables. */
  init(): Promise<void>;
  close(): Promise<void>;
  /** Throws if the database cannot be reached. */
  ping(): Promise<void>;

  // accounts
  userByEmail(email: string): Promise<UserRow | null>;
  userById(id: string): Promise<UserRow | null>;
  /** Returns false (and stores nothing) when the email is already registered. */
  createUser(user: UserRow): Promise<boolean>;
  /** Removes the user and everything that belongs to them. */
  deleteUser(id: string): Promise<void>;

  // sessions (the id is a hash of the cookie token, never the token itself)
  createSession(session: SessionRow): Promise<void>;
  /** The user for a session id, or null if it is unknown or expired. */
  sessionUser(id: string): Promise<UserRow | null>;
  deleteSession(id: string): Promise<void>;
  /** Removes expired sessions and says how many were removed. */
  purgeSessions(): Promise<number>;

  // orders
  createOrder(order: OrderRow): Promise<void>;
  /** A user's orders, newest first. */
  ordersFor(userId: string, limit: number): Promise<OrderRecord[]>;

  // reviews
  reviewsFor(productId: number, viewerId: string | null, limit: number): Promise<{ count: number; avg: number; reviews: ReviewView[] }>;
  hasReview(productId: number, userId: string): Promise<boolean>;
  /** One review per user per product: saving again replaces the old one. */
  saveReview(review: ReviewRow): Promise<void>;
  deleteReview(productId: number, userId: string): Promise<void>;

  // rewards profile
  profile(userId: string): Promise<ProfileRow | null>;
  saveProfile(userId: string, profile: ProfileRow): Promise<void>;
}
