# Deploying on cPanel (Git repository)

This app is a **Node.js API** plus a **React** front end. On cPanel you usually run **one Node process** that serves both: the API builds the UI into `server/public`, and Express serves those files.

## What was added for cPanel

| Path | Purpose |
|------|---------|
| `server/src/load-env.js` | Loads `server/.env` even when the app starts from the repo root (cPanel often sets cwd to the project root). |
| `server/scripts/copy-frontend.mjs` | Copies `client/dist` → `server/public` after `npm run build` on the client. |
| `npm run build:cpanel` (repo root) | Builds the React app and runs the copy script. |
| `server/src/index.js` | Serves `server/public` (SPA) when `index.html` exists, same origin as `/api` and `/uploads`. |
| `.cpanel.yml` | Required for cPanel Git “Deploy”: valid YAML at repo root with at least one `tasks` command (included in this repo). |
| `deploy/passenger.htaccess.example` | Example for Phusion Passenger + reverse proxy setups. |

## cPanel says “invalid .cpanel.yml” or “clean working tree”

Official requirements: [**Guide to Git — Deployment**](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/).

### Valid `.cppanel.yml`

- File must live at the **top level** of the repository (same folder as root `package.json`).
- YAML must parse; **`deployment.tasks` must contain at least one runnable shell command** (an empty list is rejected).
- This repo ships a minimal file that only checks `package.json` / `server/package.json` exist. Add extra `tasks` yourself if you need to copy files into `public_html`.

### Clean working tree (“No uncommitted changes exist”)

Means **every change is committed locally and pushed**, and **the copy on the server must not have local edits** after checkout.

Do this:

1. On your PC, in your project folder:
   ```bash
   git status
   ```
   If anything shows as modified, either commit or discard it:
   ```bash
   git add -A
   git commit -m "Add cPanel deployment config"
   git push origin YOUR_BRANCH
   ```
2. On cPanel, use **Pull** / **Update from Remote** so the server repo matches Git (no stray edited files inside the repo directory on the server).
3. If you created `server/.env` **inside** the clone on the server, Git often sees it only if mistakenly tracked—but `.env` is gitignored. If you edited **tracked** files on the server, reset them:
   ```bash
   cd /path/to/clone && git reset --hard && git pull
   ```
   (Back up `server/.env` first if you store secrets there.)

## Requirements on the server

- **Node.js** 20+ (cPanel “Setup Node.js App” / “Application Manager”).
- **PostgreSQL** database (cPanel → PostgreSQL Databases). Note the host (often `localhost`), database name, user, and password.
- **Git** deployment or SSH to pull/build.

## 1. Create PostgreSQL and apply schema

1. In cPanel, create a PostgreSQL database and user; grant the user access to the database.
2. Connection string format:

   `postgresql://DB_USER:DB_PASSWORD@localhost:5432/DB_NAME`

   If your host uses a **remote** DB host, replace `localhost` with the hostname cPanel shows.

3. Import the schema (SSH or phpPgAdmin if available):

   ```bash
   psql "postgresql://USER:PASS@HOST/DBNAME" -f server/db/schema.sql
   ```

4. Seed demo data (optional):

   ```bash
   cd /path/to/your/repo/server && npm run seed
   ```

## 2. Environment variables (cPanel Node app UI or `server/.env`)

Create `server/.env` on the server (or set the same keys in the Node application environment in cPanel):

| Variable | Example | Notes |
|----------|---------|--------|
| `NODE_ENV` | `production` | Recommended. |
| `PORT` | *(often set by cPanel)* | Do not hardcode if the panel injects `PORT`. |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/user_bw` | Use cPanel’s real DB user/password. |
| `DATABASE_SSL` | `true` or omit | Try `true` only if the DB requires TLS (uncommon for `localhost`). |
| `JWT_SECRET` | long random string | Required for login tokens. |
| `CLIENT_ORIGIN` | `https://maintenance.yourdomain.com` | **Exact** browser origin (scheme + host, no trailing slash). |
| `CORS_ORIGIN` | `*` | **Temporary only** if login fails due to CORS (www vs non‑www). Prefer fixing `CLIENT_ORIGIN` instead. |

## 3. Build and install (after `git pull`)

From the **repository root** (the folder that contains `client/`, `server/`, and `package.json`):

```bash
npm run install:all
npm run build:cpanel
```

- `build:cpanel` runs the TypeScript/Vite production build and copies output to `server/public/`.
- `server/public/` is gitignored; build again after each deploy that changes the UI.

## 4. cPanel “Setup Node.js App” / Application Manager

Typical settings (names vary by host):

| Field | Suggested value |
|-------|------------------|
| **Application root** | `/home/USERNAME/repositories/bw-maintenance` (your clone path) |
| **Application URL** | Subdomain or folder you want (e.g. `https://maintenance.example.com`) |
| **Application startup file** | `server/src/index.js` |
| **Node.js version** | 20.x or newer |

**Application root = repo root** is supported: startup file `server/src/index.js` and `load-env.js` read `server/.env` from disk.

Alternative: set **Application root** to `.../bw-maintenance/server` and startup file `src/index.js` (same relative paths inside `server/`).

## 5. After changing code

```bash
git pull
npm run install:all   # if package.json changed
npm run build:cpanel  # if client or API static bundle should update
```

Then **Restart** the Node application in cPanel.

## 6. Subdirectory hosting (advanced)

Easiest is a **subdomain** at path `/` (e.g. `https://bw.yourdomain.com`).

If you must use a **subfolder** (e.g. `https://yourdomain.com/tickets/`), you need a reverse proxy that forwards that prefix to Node **and** set Vite’s `base` when building:

```bash
VITE_BASE_PATH=/tickets/ npm run build --prefix client && node server/scripts/copy-frontend.mjs
```

You must also align URL rewrites in Apache/Nginx with that path. Prefer a subdomain unless you are comfortable with proxy rules.

## 7. Uploads

Uploaded ticket photos are stored under `server/uploads/`. On shared hosting, ensure that directory is writable by the Node process and **persists** across deploys (do not delete it when pulling Git unless you intend to wipe files).

## Troubleshooting

- **502 / application won’t start:** Check cPanel error log; run `GET /api/health` and `GET /api/health/db` on your public URL. If `/api/health/db` fails, `DATABASE_URL` or SSL flags are wrong.
- **Login works in Postman but not browser:** Set `CLIENT_ORIGIN` to the exact site URL; if needed temporarily, set `CORS_ORIGIN=*` (not ideal for production).
- **Blank page:** Run `npm run build:cpanel` so `server/public/index.html` exists, then restart Node.
