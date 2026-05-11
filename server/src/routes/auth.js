import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const { rows } = await pool.query(
    `SELECT id, username, password_hash, full_name, role, branch_id, department_id, is_active
     FROM users WHERE username = $1`,
    [String(username).trim()]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    branchId: user.branch_id,
    departmentId: user.department_id,
    fullName: user.full_name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      branchId: user.branch_id,
      departmentId: user.department_id,
    },
  });
});

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.role, u.branch_id, u.department_id,
            b.name AS branch_name, d.name AS department_name
     FROM users u
     LEFT JOIN branches b ON b.id = u.branch_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1 AND u.is_active = TRUE`,
    [req.user.sub]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    branchId: user.branch_id,
    departmentId: user.department_id,
    branchName: user.branch_name,
    departmentName: user.department_name,
  });
});

export default router;
