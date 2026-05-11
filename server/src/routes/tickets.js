import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { getCategoryRouting, initialStatusForRouting } from '../lib/routing.js';
import { logAudit } from '../lib/audit.js';
import {
  notifyUser,
  notifyDepartmentStaff,
  notifyAdmins,
} from '../lib/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

const router = Router();
router.use(authRequired);

function ticketAccessWhere(user) {
  if (user.role === 'admin') return { sql: 'TRUE', params: [] };
  if (user.role === 'branch_user') {
    return { sql: 't.branch_id = $1', params: [user.branchId] };
  }
  if (user.role === 'dept_staff') {
    return { sql: 't.department_id = $1', params: [user.departmentId] };
  }
  return { sql: 'FALSE', params: [] };
}

router.get('/', async (req, res) => {
  const user = req.user;
  const {
    ticketNumber,
    branchId,
    categoryId,
    departmentId,
    status,
    priority,
    q,
    page = '1',
    limit = '50',
  } = req.query;

  const access = ticketAccessWhere(user);
  const params = [...access.params];
  let p = params.length;
  const conds = [access.sql];

  if (ticketNumber) {
    p++;
    conds.push(`t.ticket_number ILIKE $${p}`);
    params.push(`%${String(ticketNumber).replace(/%/g, '')}%`);
  }
  if (branchId && user.role === 'admin') {
    p++;
    conds.push(`t.branch_id = $${p}`);
    params.push(Number(branchId));
  }
  if (categoryId) {
    p++;
    conds.push(`t.category_id = $${p}`);
    params.push(Number(categoryId));
  }
  if (departmentId && user.role === 'admin') {
    p++;
    conds.push(`t.department_id = $${p}`);
    params.push(Number(departmentId));
  }
  if (status) {
    p++;
    conds.push(`t.status = $${p}::ticket_status`);
    params.push(String(status));
  }
  if (priority) {
    p++;
    conds.push(`t.priority = $${p}::ticket_priority`);
    params.push(String(priority));
  }
  if (q) {
    p++;
    conds.push(`(t.title ILIKE $${p} OR t.description ILIKE $${p})`);
    params.push(`%${String(q)}%`);
  }

  const where = conds.join(' AND ');
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const offset = (pageNum - 1) * lim;

  const countQ = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tickets t WHERE ${where}`,
    params
  );
  const total = countQ.rows[0].c;

  p++;
  params.push(lim);
  const limPh = `$${p}`;
  p++;
  params.push(offset);
  const offPh = `$${p}`;

  const { rows } = await pool.query(
    `SELECT t.id, t.ticket_number, t.title, t.priority, t.status, t.created_at, t.updated_at,
            t.branch_id, b.name AS branch_name, t.category_id, c.name AS category_name,
            t.department_id, d.name AS department_name, t.completed_at
     FROM tickets t
     JOIN branches b ON b.id = t.branch_id
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN departments d ON d.id = t.department_id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT ${limPh} OFFSET ${offPh}`,
    params
  );

  res.json({ tickets: rows, total, page: pageNum, limit: lim });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const { rows } = await pool.query(
    `SELECT t.*, b.name AS branch_name, c.name AS category_name, c.slug AS category_slug,
            d.name AS department_name,
            cr.username AS created_by_username, cr.full_name AS created_by_name,
            asg.username AS assigned_to_username, asg.full_name AS assigned_to_name
     FROM tickets t
     JOIN branches b ON b.id = t.branch_id
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN departments d ON d.id = t.department_id
     JOIN users cr ON cr.id = t.created_by
     LEFT JOIN users asg ON asg.id = t.assigned_to
     WHERE t.id = $1`,
    [id]
  );
  const t = rows[0];
  if (!t) return res.status(404).json({ error: 'Ticket not found' });

  const access = ticketAccessWhere(user);
  const { rows: ok } = await pool.query(
    `SELECT 1 FROM tickets t WHERE t.id = $1 AND (${access.sql})`,
    [id, ...access.params]
  );
  if (!ok.length) return res.status(403).json({ error: 'Access denied' });

  const atts = await pool.query(
    `SELECT id, filename, stored_path, mime_type, created_at FROM ticket_attachments WHERE ticket_id = $1 ORDER BY id`,
    [id]
  );
  const comments = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.username, u.full_name
     FROM ticket_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.ticket_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  res.json({
    ticket: t,
    attachments: atts.rows.map((a) => ({
      ...a,
      url: `/uploads/${path.basename(a.stored_path)}`,
    })),
    comments: comments.rows,
  });
});

router.post('/', upload.array('photos', 5), async (req, res) => {
  if (req.user.role !== 'branch_user') {
    return res.status(403).json({ error: 'Only branch users can submit new tickets' });
  }

  const {
    title,
    description,
    categoryId,
    priority = 'medium',
    locationRoom,
    contactPerson,
    contactNumber,
  } = req.body;

  if (!title || !description || !categoryId || !contactPerson || !contactNumber) {
    return res.status(400).json({
      error: 'Title, description, category, contact person and contact number are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cat = await getCategoryRouting(client, Number(categoryId));
    if (!cat) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid category' });
    }

    const departmentId = cat.department_id;
    const status = initialStatusForRouting(departmentId);

    const ins = await client.query(
      `INSERT INTO tickets (
        title, description, branch_id, category_id, priority,
        location_room, contact_person, contact_number,
        department_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5::ticket_priority, $6, $7, $8, $9, $10::ticket_status, $11)
      RETURNING id, ticket_number, status, department_id`,
      [
        String(title).trim(),
        String(description).trim(),
        req.user.branchId,
        Number(categoryId),
        String(priority),
        locationRoom ? String(locationRoom).trim() : null,
        String(contactPerson).trim(),
        String(contactNumber).trim(),
        departmentId,
        status,
        req.user.sub,
      ]
    );
    const ticket = ins.rows[0];

    const files = req.files || [];
    for (const f of files) {
      await client.query(
        `INSERT INTO ticket_attachments (ticket_id, filename, stored_path, mime_type)
         VALUES ($1, $2, $3, $4)`,
        [ticket.id, f.originalname, f.path, f.mimetype]
      );
    }

    await logAudit(client, ticket.id, req.user.sub, 'created', {
      ticketNumber: ticket.ticket_number,
      category: cat.name,
    });

    if (departmentId) {
      await notifyDepartmentStaff(
        client,
        departmentId,
        `New ticket ${ticket.ticket_number}: ${String(title).slice(0, 80)}`,
        ticket.id
      );
    } else {
      await notifyAdmins(
        client,
        `New ticket ${ticket.ticket_number} needs department assignment (Other).`,
        ticket.id
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: ticket.id, ticketNumber: ticket.ticket_number, status: ticket.status });
  } catch (e) {
    await client.query('ROLLBACK');
    if (req.files?.length) {
      for (const f of req.files) {
        try {
          fs.unlinkSync(f.path);
        } catch {
          /* ignore */
        }
      }
    }
    console.error(e);
    res.status(500).json({ error: 'Could not create ticket' });
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const body = req.body || {};

  const { rows: curRows } = await pool.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
  const cur = curRows[0];
  if (!cur) return res.status(404).json({ error: 'Ticket not found' });

  const access = ticketAccessWhere(user);
  const { rows: ok } = await pool.query(
    `SELECT 1 FROM tickets t WHERE t.id = $1 AND (${access.sql})`,
    [id, ...access.params]
  );
  if (!ok.length) return res.status(403).json({ error: 'Access denied' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (user.role === 'admin') {
      const updates = [];
      const params = [];
      let p = 0;

      if (body.departmentId !== undefined) {
        p++;
        updates.push(`department_id = $${p}`);
        params.push(body.departmentId ? Number(body.departmentId) : null);
      }
      if (body.assignedTo !== undefined) {
        p++;
        updates.push(`assigned_to = $${p}`);
        params.push(body.assignedTo ? Number(body.assignedTo) : null);
      }
      if (body.status) {
        p++;
        updates.push(`status = $${p}::ticket_status`);
        params.push(String(body.status));
        if (String(body.status) === 'completed' || String(body.status) === 'closed') {
          updates.push(`completed_at = COALESCE(completed_at, NOW())`);
        }
      }

      if (!updates.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No changes provided' });
      }
      p++;
      params.push(id);
      await client.query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = $${p}`, params);
      await logAudit(client, id, user.sub, 'admin_update', body);

      const { rows: t2 } = await client.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
      const t = t2[0];
      if (body.departmentId && Number(body.departmentId) !== cur.department_id) {
        await notifyDepartmentStaff(
          client,
          Number(body.departmentId),
          `Ticket ${t.ticket_number} assigned to your department.`,
          id
        );
      }
      if (body.status && body.status !== cur.status) {
        await notifyUser(
          client,
          cur.created_by,
          `Ticket ${t.ticket_number} status is now ${body.status.replace(/_/g, ' ')}.`,
          id
        );
      }
    } else if (user.role === 'dept_staff') {
      if (body.departmentId !== undefined || body.assignedTo !== undefined) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Department staff cannot reassign departments' });
      }
      if (!body.status) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No changes provided' });
      }
      const st = String(body.status);
      await client.query(
        `UPDATE tickets SET status = $1::ticket_status,
          completed_at = CASE WHEN $1::text IN ('completed','closed') THEN COALESCE(completed_at, NOW()) ELSE completed_at END
         WHERE id = $2`,
        [st, id]
      );
      await logAudit(client, id, user.sub, 'status_change', { status: st });
      await notifyUser(
        client,
        cur.created_by,
        `Ticket ${cur.ticket_number} status updated to ${st.replace(/_/g, ' ')}.`,
        id
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Branch users cannot update tickets here' });
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  } finally {
    client.release();
  }
});

router.post('/:id/comments', async (req, res) => {
  const id = Number(req.params.id);
  const raw = req.body || {};
  const text = raw.body ?? raw.text;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const user = req.user;
  const access = ticketAccessWhere(user);
  const { rows: ok } = await pool.query(
    `SELECT t.* FROM tickets t WHERE t.id = $1 AND (${access.sql})`,
    [id, ...access.params]
  );
  if (!ok.length) return res.status(403).json({ error: 'Access denied' });
  const ticket = ok[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES ($1, $2, $3)`,
      [id, user.sub, String(text).trim()]
    );
    await logAudit(client, id, user.sub, 'comment', { preview: String(text).slice(0, 120) });

    if (user.role === 'branch_user') {
      if (ticket.department_id) {
        await notifyDepartmentStaff(
          client,
          ticket.department_id,
          `New comment on ${ticket.ticket_number}.`,
          id
        );
      } else {
        await notifyAdmins(client, `New comment on ${ticket.ticket_number} (unassigned).`, id);
      }
    } else {
      await notifyUser(client, ticket.created_by, `New update on ${ticket.ticket_number}.`, id);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Could not add comment' });
  } finally {
    client.release();
  }
});

router.get('/:id/audit', async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const access = ticketAccessWhere(user);
  const { rows: ok } = await pool.query(
    `SELECT 1 FROM tickets t WHERE t.id = $1 AND (${access.sql})`,
    [id, ...access.params]
  );
  if (!ok.length) return res.status(403).json({ error: 'Access denied' });

  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.details, a.created_at, u.username, u.full_name
     FROM ticket_audit a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.ticket_id = $1
     ORDER BY a.created_at ASC`,
    [id]
  );
  res.json(rows);
});

router.patch('/:id/satisfaction', async (req, res) => {
  const id = Number(req.params.id);
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }

  if (req.user.role !== 'branch_user') {
    return res.status(403).json({ error: 'Only branch users can submit satisfaction ratings' });
  }

  const { rows } = await pool.query(
    `SELECT * FROM tickets WHERE id = $1 AND branch_id = $2 AND created_by = $3`,
    [id, req.user.branchId, req.user.sub]
  );
  const t = rows[0];
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  if (t.status !== 'completed' && t.status !== 'closed') {
    return res.status(400).json({ error: 'You can rate tickets only after they are completed' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE tickets SET satisfaction_rating = $1, satisfaction_comment = $2 WHERE id = $3`,
      [r, comment ? String(comment).trim() : null, id]
    );
    await logAudit(client, id, req.user.sub, 'satisfaction', { rating: r });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ error: 'Could not save rating' });
  } finally {
    client.release();
  }

  res.json({ ok: true });
});

export default router;
