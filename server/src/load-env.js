import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/** Load `server/.env` regardless of process cwd (needed for cPanel / monorepo). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
