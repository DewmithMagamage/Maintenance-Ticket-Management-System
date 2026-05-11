import pg from 'pg';

const { Pool } = pg;

/**
 * Managed Postgres (Render, Railway, Neon, etc.) often requires TLS.
 * Set DATABASE_SSL=true if connections fail or hang without sslmode in the URL.
 */
function resolveSsl() {
  if (process.env.DATABASE_SSL === 'false') return undefined;
  const url = process.env.DATABASE_URL || '';
  const urlWantsSsl = /sslmode=(require|verify-full|verify-ca)/i.test(url);
  if (process.env.DATABASE_SSL === 'true' || urlWantsSsl) {
    // Default false: many managed DBs use certs Node does not trust out of the box (Render, etc.).
    return {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    };
  }
  // Many cloud URLs omit sslmode but still require TLS — opt in explicitly
  if (process.env.NODE_ENV === 'production' && /\.(neon\.tech|render\.com|railway\.app|supabase\.co)\b/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[db] DATABASE_URL is missing. Set it in server/.env (see .env.example).');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 15000,
  ssl: resolveSsl(),
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});
