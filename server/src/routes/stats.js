import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function scopeWhere(user) {
  if (user.role === 'admin') return { sql: 'TRUE', params: [] };
  if (user.role === 'branch_user') {
    return { sql: 't.branch_id = $1', params: [user.branchId] };
  }
  if (user.role === 'dept_staff') {
    return { sql: 't.department_id = $1', params: [user.departmentId] };
  }
  return { sql: 'FALSE', params: [] };
}

router.get('/dashboard', async (req, res) => {
  const user = req.user;
  const s = scopeWhere(user);
  const params = [...s.params];

  const statusRows = await pool.query(
    `SELECT t.status, COUNT(*)::int AS count
     FROM tickets t
     WHERE ${s.sql}
     GROUP BY t.status`,
    params
  );

  const openRows = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tickets t
     WHERE ${s.sql} AND t.status NOT IN ('completed','closed')`,
    params
  );

  const doneRows = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tickets t
     WHERE ${s.sql} AND t.status IN ('completed','closed')`,
    params
  );

  let monthly = { count: 0 };
  if (user.role === 'admin') {
    const m = await pool.query(
      `SELECT COUNT(*)::int AS c FROM tickets t
       WHERE t.created_at >= date_trunc('month', NOW())`
    );
    monthly = { count: m.rows[0].c };
  }

  res.json({
    byStatus: Object.fromEntries(statusRows.rows.map((r) => [r.status, r.count])),
    openTickets: openRows.rows[0].c,
    completedTickets: doneRows.rows[0].c,
    thisMonthNew: monthly.count,
  });
});

export default router;
