import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

router.use(requireAdmin);

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.branch_id, u.department_id,
            b.name AS branch_name, d.name AS department_name
     FROM users u
     LEFT JOIN branches b ON b.id = u.branch_id
     LEFT JOIN departments d ON d.id = u.department_id
     ORDER BY u.role, u.username`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const {
    username,
    password,
    fullName,
    role,
    branchId,
    departmentId,
  } = req.body || {};

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  if (role === 'branch_user' && !branchId) {
    return res.status(400).json({ error: 'Branch users must be linked to a branch' });
  }
  if (role === 'dept_staff' && !departmentId) {
    return res.status(400).json({ error: 'Department staff must be linked to a department' });
  }
  if (role === 'admin' && (branchId || departmentId)) {
    return res.status(400).json({ error: 'Administrators should not be linked to a branch or department' });
  }

  const hash = await bcrypt.hash(String(password), 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, branch_id, department_id)
       VALUES ($1, $2, $3, $4::user_role, $5, $6)
       RETURNING id, username, full_name, role, branch_id, department_id, is_active`,
      [
        String(username).trim(),
        hash,
        fullName ? String(fullName).trim() : null,
        role,
        role === 'branch_user' ? Number(branchId) : null,
        role === 'dept_staff' ? Number(departmentId) : null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Could not create user' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { isActive, fullName } = req.body || {};
  if (id === req.user.sub && isActive === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }
  const updates = [];
  const params = [];
  let p = 0;
  if (typeof isActive === 'boolean') {
    p++;
    updates.push(`is_active = $${p}`);
    params.push(isActive);
  }
  if (fullName !== undefined) {
    p++;
    updates.push(`full_name = $${p}`);
    params.push(fullName ? String(fullName).trim() : null);
  }
  if (!updates.length) {
    return res.status(400).json({ error: 'No changes provided' });
  }
  p++;
  params.push(id);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

router.post('/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const hash = await bcrypt.hash(String(password), 10);
  const { rowCount } = await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    hash,
    id,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

export default router;
