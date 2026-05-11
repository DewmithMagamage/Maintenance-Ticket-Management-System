/**
 * Copies Vite production build into server/public for single-process hosting (cPanel, etc.).
 * Run from repo root: node server/scripts/copy-frontend.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const dist = path.join(repoRoot, 'client/dist');
const target = path.join(repoRoot, 'server/public');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('[copy-frontend] client/dist/index.html not found. Run: npm run build --prefix client');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(dist, target, { recursive: true });
console.log('[copy-frontend] Copied client/dist -> server/public');
