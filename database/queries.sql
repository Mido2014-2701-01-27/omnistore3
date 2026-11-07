-- ======================================================================
-- OmniStore: SQL practice queries (PostgreSQL)
-- Run the whole file:   psql omnistore -f database/queries.sql
-- Or copy ONE query at a time into psql, pgAdmin, TablePlus or DBeaver.
-- They only read data (SELECT), so nothing here can change your database.
-- Place a few test orders in the store first so there is something to look at.
-- ======================================================================

-- In psql, these meta-commands show the structure (they are not SQL):
--   \dt            list the tables
--   \d users       describe one table: columns, types, keys, indexes
--   \q             quit

-- 1. SELECT: read rows. ORDER BY sorts them.
SELECT id, name, email, created_at
FROM users
ORDER BY created_at DESC;

-- 2. JOIN: combine two tables. Each order belongs to a user through user_id.
SELECT o.id AS order_id, u.name AS customer, o.placed_at, o.total_cents / 100.0 AS total
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY o.placed_at DESC;

-- 3. One order has many lines (a one-to-many relationship).
SELECT o.id AS order_id,
       i.title,
       i.qty,
       i.unit_price_cents / 100.0           AS unit_price,
       (i.qty * i.unit_price_cents) / 100.0 AS line_total
FROM orders o
JOIN order_items i ON i.order_id = o.id
ORDER BY o.placed_at DESC, i.line_no;

-- 4. GROUP BY + aggregates: orders and money spent per customer.
SELECT u.name,
       count(*)                  AS orders,
       sum(o.total_cents) / 100.0 AS spent
FROM users u
JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY spent DESC;

-- 5. Best sellers: which products sold the most units?
SELECT i.product_id,
       min(i.title)                              AS title,
       sum(i.qty)                                AS units_sold,
       sum(i.qty * i.unit_price_cents) / 100.0   AS revenue
FROM order_items i
GROUP BY i.product_id
ORDER BY units_sold DESC
LIMIT 10;

-- 6. HAVING filters groups (WHERE filters rows): products with 2 or more reviews.
SELECT product_id, count(*) AS reviews, round(avg(rating), 2) AS average_rating
FROM reviews
GROUP BY product_id
HAVING count(*) >= 2
ORDER BY average_rating DESC;

-- 7. LEFT JOIN keeps rows with no match: customers who have never ordered.
SELECT u.name, u.email
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;

-- 8. Arrays: the wishlist is a column holding a list of product ids.
SELECT u.name, cardinality(p.wish) AS saved_items, p.points
FROM profiles p
JOIN users u ON u.id = p.user_id
ORDER BY p.points DESC;

-- Who saved product 7003?
SELECT u.name
FROM profiles p
JOIN users u ON u.id = p.user_id
WHERE 7003 = ANY (p.wish);

-- 9. Dates: orders and revenue per day over the last 7 days.
SELECT date_trunc('day', placed_at) AS day,
       count(*)                      AS orders,
       sum(total_cents) / 100.0      AS revenue
FROM orders
WHERE placed_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 10. EXPLAIN ANALYZE shows how PostgreSQL ran a query and whether it used an index.
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = (SELECT id FROM users LIMIT 1) ORDER BY placed_at DESC;

-- ======================================================================
-- Next: try changing data (INSERT, UPDATE, DELETE) safely inside a transaction.
-- Nothing is kept until COMMIT, and ROLLBACK undoes it all:
--
--   BEGIN;
--   UPDATE reviews SET body = '' WHERE rating = 1;
--   SELECT count(*) FROM reviews WHERE body = '';
--   ROLLBACK;     -- change your mind: nothing was saved
-- ======================================================================
