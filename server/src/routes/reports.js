import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
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

async function runDetailQuery(user, extraWhere = '', extraParams = []) {
  const s = scopeWhere(user);
  const params = [...s.params, ...extraParams];
  const where = `${s.sql} ${extraWhere}`;
  const { rows } = await pool.query(
    `SELECT t.ticket_number, t.title, t.priority, t.status, t.created_at, t.completed_at,
            b.name AS branch_name, c.name AS category_name, d.name AS department_name
     FROM tickets t
     JOIN branches b ON b.id = t.branch_id
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN departments d ON d.id = t.department_id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT 2000`,
    params
  );
  return rows;
}

router.get('/', async (req, res) => {
  const { type = 'open', format = 'json' } = req.query;
  const user = req.user;

  let rows = [];
  let title = 'Report';

  if (type === 'open') {
    title = 'Open Tickets';
    rows = await runDetailQuery(user, `AND t.status NOT IN ('completed','closed')`);
  } else if (type === 'completed') {
    title = 'Completed Tickets';
    rows = await runDetailQuery(user, `AND t.status IN ('completed','closed')`);
  } else if (type === 'branch') {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Branch-wise summary is available to administrators' });
    }
    title = 'Tickets by Branch';
    const { rows: agg } = await pool.query(
      `SELECT b.name AS branch_name, COUNT(*)::int AS ticket_count,
              SUM(CASE WHEN t.status NOT IN ('completed','closed') THEN 1 ELSE 0 END)::int AS open_count
       FROM tickets t
       JOIN branches b ON b.id = t.branch_id
       GROUP BY b.id, b.name
       ORDER BY b.name`
    );
    rows = agg;
  } else if (type === 'department') {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Department-wise summary is available to administrators' });
    }
    title = 'Tickets by Department';
    const { rows: agg } = await pool.query(
      `SELECT COALESCE(d.name, 'Unassigned') AS department_name, COUNT(*)::int AS ticket_count
       FROM tickets t
       LEFT JOIN departments d ON d.id = t.department_id
       GROUP BY d.id, d.name
       ORDER BY department_name`
    );
    rows = agg;
  } else if (type === 'priority') {
    title = 'Tickets by Priority';
    const s = scopeWhere(user);
    const { rows: agg } = await pool.query(
      `SELECT t.priority, COUNT(*)::int AS ticket_count
       FROM tickets t
       WHERE ${s.sql}
       GROUP BY t.priority
       ORDER BY t.priority`,
      s.params
    );
    rows = agg;
  } else if (type === 'monthly') {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Monthly overview is available to administrators' });
    }
    title = 'Tickets This Month';
    rows = await pool.query(
      `SELECT t.ticket_number, t.title, t.priority, t.status, t.created_at,
              b.name AS branch_name, c.name AS category_name
       FROM tickets t
       JOIN branches b ON b.id = t.branch_id
       JOIN categories c ON c.id = t.category_id
       WHERE t.created_at >= date_trunc('month', NOW())
       ORDER BY t.created_at DESC
       LIMIT 2000`
    ).then((r) => r.rows);
  } else {
    return res.status(400).json({ error: 'Unknown report type' });
  }

  if (format === 'json') {
    return res.json({ title, type, rows });
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bw-report-${type}.pdf"`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).fillColor('#1e40af').text('British Way Holdings', { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#111827').text(title);
    doc.moveDown();
    doc.fontSize(10).fillColor('#374151');
    rows.forEach((r, i) => {
      const line = Object.entries(r)
        .map(([k, v]) => `${k}: ${v === null ? '' : v}`)
        .join('  |  ');
      doc.text(`${i + 1}. ${line}`, { width: 520 });
      doc.moveDown(0.25);
    });
    doc.end();
    return;
  }

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BW Maintenance';
    const ws = wb.addWorksheet(title.slice(0, 28));
    if (rows.length) {
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 24 }));
      rows.forEach((r) => ws.addRow(r));
      ws.getRow(1).font = { bold: true, color: { argb: 'FF1E40AF' } };
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="bw-report-${type}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
    return;
  }

  return res.status(400).json({ error: 'Unsupported format' });
});

export default router;
