import './load-env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { pool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import ticketsRoutes from './routes/tickets.js';
import usersRoutes from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import statsRoutes from './routes/stats.js';
import reportsRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads');
const publicDir = path.join(__dirname, '../public');

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const corsOptions =
  process.env.CORS_ORIGIN === '*'
    ? { origin: true, credentials: true }
    : { origin: clientOrigin, credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bw-maintenance-api' });
});

/** Returns 200 only if PostgreSQL accepts a query (use after deploy / for uptime checks). */
app.get('/api/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, database: true });
  } catch (err) {
    console.error('[health/db]', err.message);
    res.status(503).json({
      ok: false,
      database: false,
      error: err.message,
      hint:
        'Check DATABASE_URL. On Render/Railway use the external URL and set DATABASE_SSL=true if TLS is required.',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', metaRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reports', reportsRoutes);

const indexHtml = path.join(publicDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(publicDir, { index: false, maxAge: '7d' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(indexHtml, (err) => {
      if (err) next(err);
    });
  });
} else {
  console.log('[static] No server/public/index.html — API-only (use `npm run build:cpanel` from repo root to bundle the web UI).');
}

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).type('text').send('Not found');
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message === 'Only image uploads are allowed') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = Number(process.env.PORT) || 4000;

async function verifyDatabase() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is not set');
  }
  await pool.query('SELECT 1');
}

async function start() {
  try {
    await verifyDatabase();
    console.log('[db] PostgreSQL connection OK');
  } catch (err) {
    console.error('\n[db] FAILED to connect to PostgreSQL:', err.message);
    console.error(
      'Fix DATABASE_URL in .env (local) or host environment (Render/Railway).\n' +
        'Cloud databases: try adding DATABASE_SSL=true to your API service.\n'
    );
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start();
