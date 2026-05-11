import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

router.get('/branches', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, organization FROM branches WHERE is_active = TRUE ORDER BY organization, name`
  );
  res.json(rows);
});

router.get('/categories', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.department_id, d.name AS department_name
     FROM categories c
     LEFT JOIN departments d ON d.id = c.department_id
     ORDER BY c.name`
  );
  res.json(rows);
});

router.get('/departments', async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, code, name FROM departments ORDER BY name`);
  res.json(rows);
});

export default router;
