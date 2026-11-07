-- OmniStore schema, version 1.
-- Money is stored as whole cents (integers) so there is never any rounding drift.
-- Every table that belongs to a user uses ON DELETE CASCADE, so deleting a user
-- removes their sessions, orders, reviews and profile in one go.

CREATE TABLE users (
  id            uuid        PRIMARY KEY,
  name          text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  email         text        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- id is a SHA-256 hash of the cookie token. The token itself is never stored.
CREATE TABLE sessions (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE orders (
  id              text        PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  placed_at       timestamptz NOT NULL,
  subtotal_cents  integer     NOT NULL CHECK (subtotal_cents >= 0),
  delivery_cents  integer     NOT NULL CHECK (delivery_cents >= 0),
  discount_pct    integer     NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  promo_code      text        NOT NULL DEFAULT '',
  total_cents     integer     NOT NULL CHECK (total_cents >= 0)
);
CREATE INDEX orders_user_placed_idx ON orders (user_id, placed_at DESC);

-- One row per product in an order. Title and price are copied at purchase time,
-- so an old order still shows what the customer actually paid.
CREATE TABLE order_items (
  order_id          text    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  line_no           integer NOT NULL,
  product_id        integer NOT NULL,
  title             text    NOT NULL,
  thumbnail         text    NOT NULL,
  qty               integer NOT NULL CHECK (qty BETWEEN 1 AND 99),
  unit_price_cents  integer NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (order_id, line_no)
);
CREATE INDEX order_items_product_idx ON order_items (product_id);

CREATE TABLE reviews (
  id          uuid        PRIMARY KEY,
  product_id  integer     NOT NULL,
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author      text        NOT NULL,
  rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text        NOT NULL DEFAULT '' CHECK (length(body) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX reviews_product_idx ON reviews (product_id, created_at DESC);

-- Points, streak, wishlist and achievements. wish, ever and ach are PostgreSQL arrays.
CREATE TABLE profiles (
  user_id     uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  points      integer     NOT NULL DEFAULT 0,
  streak      integer     NOT NULL DEFAULT 0,
  last_day    text        NOT NULL DEFAULT '',
  wish        integer[]   NOT NULL DEFAULT '{}',
  ever        integer[]   NOT NULL DEFAULT '{}',
  ach         text[]      NOT NULL DEFAULT '{}',
  adds        integer     NOT NULL DEFAULT 0,
  gift        text        NOT NULL DEFAULT '',
  gifts       integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
