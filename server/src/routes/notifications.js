import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, message, ticket_id, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.sub]
  );
  res.json(rows);
});

router.post('/read-all', async (req, res) => {
  await pool.query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [
    req.user.sub,
  ]);
  res.json({ ok: true });
});

router.patch('/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

export default router;
