# British Way Holdings — Maintenance Ticket Management System

End-to-end web application for reporting and tracking maintenance requests across British Way English Academy branches, The Pharaoh Hotel, British Way International School, British Way Campus, and Head Office.

## Repository layout

| Folder | Description |
|--------|-------------|
| `server/` | Node.js (Express) REST API, JWT auth, file uploads, PDF/Excel reports |
| `client/` | React (Vite + TypeScript) UI with Tailwind CSS v4 and ShadCN-style components |

### cPanel + Git hosting

See **[DEPLOYMENT-CPANEL.md](./DEPLOYMENT-CPANEL.md)** for Node.js application settings, PostgreSQL, `npm run build:cpanel`, and optional **`.cpanel.yml`** / **`deploy/passenger.htaccess.example`**.

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+ (for generated columns and trigger syntax)

## Database setup

1. Create a database:

```bash
createdb bw_maintenance
```

2. Apply the schema:

```bash
psql "$DATABASE_URL" -f server/db/schema.sql
```

Use your real connection string, for example:

`postgresql://postgres:postgres@localhost:5432/bw_maintenance`

3. Configure the API environment:

```bash
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL and JWT_SECRET
```

4. Seed departments, branches, categories, demo users, and sample tickets:

```bash
cd server && npm install && npm run seed
```

### Demo accounts (password: `password`)

| Username | Role |
|----------|------|
| `matara_admin` | Branch user (Matara Branch) |
| `galle_admin` | Branch user (Galle Branch) |
| `pharaoh_hotel` | Branch user (The Pharaoh Hotel) |
| `campus_admin` | Branch user (British Way Campus) |
| `it_staff` | Department staff (IT) |
| `maintenance_staff` | Department staff (Maintenance) |
| `admin_dept` | Department staff (Administration) |
| `bw_admin` | System administrator |

## Run locally

**Terminal 1 — API**

```bash
cd server
npm run dev
```

API: `http://localhost:4000` (health: `GET /api/health`)

**Terminal 2 — Web app**

```bash
cd client
npm run dev
```

App: `http://localhost:5173` — Vite proxies `/api` and `/uploads` to the API.

**One command (API + web):** from the repo root, `npm install` then `npm run dev`. This avoids **502 Bad Gateway** in the browser, which usually means the UI is running but **nothing is listening on port 4000** (API not started).

### Troubleshooting: “Bad Gateway” or database errors

| Symptom | Likely cause | What to do |
|--------|----------------|-------------|
| **502** on `http://localhost:5173/api/...` | Vite proxy cannot reach the API | Start the API: `cd server && npm run dev`, or use `npm run dev` from the **repo root** after `npm install`. |
| API exits on startup: `FAILED to connect to PostgreSQL` | Wrong `DATABASE_URL`, Postgres stopped, or SSL | Local: start Postgres (`brew services start postgresql@16`) and check `server/.env`. Cloud: use the provider’s **external** connection string; try `DATABASE_SSL=true` on Render/Railway. |
| `self signed certificate` / TLS errors | Managed DB needs TLS | Set `DATABASE_SSL=true` (see `server/.env.example`). |

Check database connectivity directly: `GET http://localhost:4000/api/health/db` — returns `200` with `"database": true` when PostgreSQL is reachable.

## Features implemented

- Username/password login (JWT), role-based access (branch, department, admin)
- Ticket form: title, description, auto branch, category, priority, location, contact, photo upload (images)
- Automatic routing to IT / Maintenance / Administration from category; **Other** stays unassigned for admin
- Ticket numbers `BW-0001`, `BW-0002`, … (stored generated column)
- Status workflow: New → Assigned → In progress → Completed → Closed
- Comments, in-app notifications, audit trail, post-completion satisfaction (1–5)
- Search/filter (admin); scoped lists for branch and department users
- Admin: assign department and staff, user management, reports
- Reports: Open, Completed, Branch-wise, Department-wise, Priority-wise, Monthly; export **PDF** or **Excel**

## Deploy

### Frontend (Vercel)

1. Connect the repo; set **Root Directory** to `client`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variable **`VITE_API_BASE`**: your public API origin **without** a trailing slash, e.g. `https://bw-maintenance-api.onrender.com`. The client will call `https://…/api` and `https://…/uploads` automatically.

5. SPA routing: `client/vercel.json` rewrites all paths to `/` so React Router works.

**Alternative:** leave `VITE_API_BASE` empty and add Vercel rewrites so `/api` and `/uploads` proxy to the same backend URL; then the browser uses same-origin relative `/api` as in local dev.

### Backend (Render or Railway)

1. New **Web Service** from this repo; **Root Directory** `server`.
2. Build: `npm install` (default)
3. Start: `npm start`
4. Environment: `DATABASE_URL` (use the **external** URL if the API runs outside the provider’s private network), `JWT_SECRET`, `PORT` (Render sets `PORT` automatically), `CLIENT_ORIGIN` (your Vercel URL, e.g. `https://your-app.vercel.app`). If the DB requires TLS, set **`DATABASE_SSL=true`**.

5. Use a managed PostgreSQL instance; run `server/db/schema.sql` once against that database, then `npm run seed` (or run seed from a one-off shell).

6. **Persistent disk** (or S3 in a future iteration) is recommended for `server/uploads` so attachments survive restarts.

## Security notes for production

- Replace `JWT_SECRET` with a long random string.
- Use HTTPS everywhere.
- Consider rate limits and IP allowlists for admin routes.
- Upgrade `multer` when moving to 2.x for security patches.

## API overview (all under `/api`)

- `POST /auth/login`, `GET /auth/me`
- `GET /branches`, `GET /categories`, `GET /departments`
- `GET/POST /tickets`, `GET/PATCH /tickets/:id`, `POST /tickets/:id/comments`, `GET /tickets/:id/audit`, `PATCH /tickets/:id/satisfaction`
- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- `GET /stats/dashboard`
- `GET /reports?type=…&format=json|pdf|xlsx`
- `GET/POST/PATCH /users` (admin)

## Licence

Proprietary — British Way Holdings internal use.
