# OmniStore: TypeScript + Node.js + PostgreSQL

A storefront with a TypeScript front end and a Node.js server. The data lives in **PostgreSQL** (or, with no setup, in a JSON file).

## Quick start (no database to install)
You need Node 20.11 or newer.

```
npm start
```
Open **http://localhost:3000**, then go to `index.html` to sign in. With no database configured, the server keeps its data in `data/db.json`.

If you change any `.ts` file, rebuild first:
```
npm install      # once: installs TypeScript, Node's types and the pg driver
npm run build    # builds the browser code (dist/) and the server (dist-server/)
npm start
```

## Use PostgreSQL
The server switches to PostgreSQL when the `DATABASE_URL` setting is present. Everything else works exactly the same.

**1. Install PostgreSQL (Mac).** Download **Postgres.app** from postgresapp.com, drag it to Applications, open it and click **Start**. It runs on port 5432.

**2. Let Terminal find `psql`** (one time):
```
sudo mkdir -p /etc/paths.d && echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
```
Then close and reopen Terminal.

**3. Create the database:**
```
createdb omnistore
```

**4. Install the driver and start the server:**
```
npm install
DATABASE_URL=postgres://localhost:5432/omnistore npm start
```
The first start creates all the tables and prints `Applied database migration 001_init.sql`. The line `Database: PostgreSQL (localhost:5432/omnistore)` confirms which database is in use. With Postgres.app you don't need a username or password: it uses your Mac username.

**5. Check that it works:**
```
DATABASE_URL=postgres://localhost:5432/omnistore npm run db:check
```
This runs 8 checks on every database operation the server uses (accounts, sessions, orders, reviews, rewards) against a throw-away user, then cleans up after itself. It should end with `All 8 checks passed`. If one fails, the line says which operation, so you can tell me exactly what broke.

**6. (Optional) Move your existing `data/db.json` into PostgreSQL:**
```
DATABASE_URL=postgres://localhost:5432/omnistore npm run db:import
```
It is safe to run twice. Everyone has to log in again because logins are not copied.

### Connection string format
`postgres://USER:PASSWORD@HOST:PORT/DATABASE`. For a hosted database (Neon, Supabase, Render) copy the URL they give you and add `?sslmode=require` at the end.

### Learn SQL on your own data
```
psql omnistore
```
Inside psql: `\dt` lists the tables, `\d users` describes one, `\q` quits. `database/queries.sql` has ten practice queries that go from `SELECT` to joins, grouping, arrays and `EXPLAIN`. Run them all with `psql omnistore -f database/queries.sql`, or paste one at a time into psql or a visual tool such as TablePlus, pgAdmin or DBeaver.

### The tables
```
users ──< sessions            (a login; the cookie token is stored only as a hash)
  │
  ├──< orders ──< order_items (one row per product; title and price are copied at purchase time)
  ├──< reviews                (one per user per product)
  └──1 profiles               (points, streak, wishlist and achievements; the lists are PostgreSQL arrays)
```
- Money is stored as whole **cents** (integers) so rounding errors cannot happen.
- Rules are enforced by the database itself: unique emails, ratings between 1 and 5, `ON DELETE CASCADE` (deleting a user deletes everything of theirs).
- The schema lives in `database/migrations/001_init.sql`. To change it later, add `002_something.sql`; each file runs once, in order, and the server remembers which ones ran.

## Settings (environment variables)
| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | not set | Use PostgreSQL. Not set means the JSON file |
| `PORT` | 3000 | Port to listen on |
| `HOST` | 127.0.0.1 | Use `0.0.0.0` to open the store from your phone on the same Wi-Fi |
| `DATA_DIR` | `./data` | Where `db.json` is kept (JSON mode only) |
| `SESSION_DAYS` | 7 | How long a login lasts |
| `COOKIE_SECURE` | off | Set to `1` when the site is served over HTTPS |

## What the server does
| Route | Purpose |
|---|---|
| `GET /api/products?lang=en\|ar` | The catalogue, cached for 10 minutes, with a built-in sample selection if the live source is unreachable |
| `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me` | Real accounts. Passwords are hashed with scrypt; the session is an HttpOnly cookie |
| `POST /api/orders`, `GET /api/orders` | Checkout. **The server re-prices every order itself**, so the browser cannot change a price |
| `GET/POST/DELETE /api/reviews` | Product reviews (one per account per product) |
| `GET/PUT /api/profile` | Points, streak, wishlist and achievements, synced across devices |
| `GET /api/health` | Says the server is up and which database it uses (`json` or `postgres`) |

Only the `.html`, `.css` and `dist/*.js` files are public. `data/`, `database/`, `server/`, `src/` and `package.json` are not. If you open the pages with any other web server, the store falls back to browser-only behaviour.

### Security measures
- scrypt password hashing with a random salt; login takes the same time for unknown emails
- session token stored hashed; cookie is HttpOnly and SameSite=Lax
- login and sign-up throttled (429 after repeated tries)
- JSON-only writes, 64 KB body limit, cross-site `Origin` check on every write
- strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`
- every SQL statement uses numbered parameters (`$1`, `$2`), so user input can never be run as SQL
- review text is shown with `textContent`, so it cannot inject HTML

### Honest limits
- There is no email verification or password reset, and no payment processing.
- Order tracking is a **demo timeline** (about two minutes) because there is no real shipping behind it.
- Login throttling is kept in memory and resets when the server restarts.
- For a public site, put it behind HTTPS and set `COOKIE_SECURE=1`.

## Project layout
```
database/
  migrations/001_init.sql   the tables, keys, rules and indexes
  queries.sql               SQL practice queries on your own data
server/             Node server (TypeScript)
  server.ts           routes, static files, startup
  store.ts            the database contract (one interface, two implementations)
  pg-store.ts         PostgreSQL implementation (all the SQL lives here)
  json-store.ts       JSON-file implementation (no setup)
  open-store.ts       picks one, depending on DATABASE_URL
  selftest.ts         npm run db:check
  import-json.ts      npm run db:import
  auth.ts  catalogue.ts  db.ts  http.ts  paths.ts
src/                browser code (TypeScript)
dist/  dist-server/ compiled code (npm run build)
angular/            Angular version (first-round features only)
```

## Commands
| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run build` | Compile the browser code and the server |
| `npm run db:check` | Test every database operation on the configured database |
| `npm run db:import` | Copy `data/db.json` into PostgreSQL |
