import '../src/load-env.js';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const hash = (p) => bcrypt.hashSync(p, 10);

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO departments (code, name) VALUES
        ('IT', 'IT Department'),
        ('MAINTENANCE', 'Maintenance Unit'),
        ('ADMIN', 'Administration Department')
      ON CONFLICT (code) DO NOTHING
    `);

    const deptRes = await client.query(`SELECT id, code FROM departments ORDER BY id`);
    const dept = Object.fromEntries(deptRes.rows.map((r) => [r.code, r.id]));

    const { rows: bc } = await client.query(`SELECT COUNT(*)::int AS c FROM branches`);
    if (bc[0].c === 0) {
      const branches = [
        ...[
          'Matara',
          'Galle',
          'Kandy',
          'Kurunegala',
          'Maharagama',
          'Colombo',
          'Negombo',
          'Panadura',
          'Anuradhapura',
          'Jaffna',
          'Batticaloa',
          'Badulla',
          'Ratnapura',
          'Kalutara',
          'Nugegoda',
          'Mount Lavinia',
        ].map((city) => ({
          name: `${city} Branch`,
          organization: 'British Way English Academy',
        })),
        { name: 'The Pharaoh Hotel', organization: 'The Pharaoh Hotel' },
        {
          name: 'British Way International School',
          organization: 'British Way International School',
        },
        { name: 'British Way Campus', organization: 'British Way Campus' },
        { name: 'Head Office', organization: 'British Way Holdings' },
      ];
      for (const b of branches) {
        await client.query(
          `INSERT INTO branches (name, organization) VALUES ($1, $2)`,
          [b.name, b.organization]
        );
      }
    }

    const { rows: catCount } = await client.query(`SELECT COUNT(*)::int AS c FROM categories`);
    if (catCount[0].c === 0) {
      const categories = [
        ['Computer Repair', 'computer_repair', 'IT'],
        ['Printer Issues', 'printer_issues', 'IT'],
        ['Internet/Wi-Fi', 'internet_wifi', 'IT'],
        ['CCTV', 'cctv', 'IT'],
        ['Smart TV / Projector', 'smart_tv_projector', 'IT'],
        ['Software Issues', 'software_issues', 'IT'],
        ['Air Conditioner (AC)', 'ac', 'MAINTENANCE'],
        ['Electrical', 'electrical', 'MAINTENANCE'],
        ['Plumbing', 'plumbing', 'MAINTENANCE'],
        ['Furniture', 'furniture', 'MAINTENANCE'],
        ['Building Repairs', 'building_repairs', 'MAINTENANCE'],
        ['Office Equipment', 'office_equipment', 'ADMIN'],
        ['Stationery Requests', 'stationery', 'ADMIN'],
        ['Cleaning', 'cleaning', 'ADMIN'],
        ['Other Administrative Issues', 'other_admin', 'ADMIN'],
        ['Other', 'other', null],
      ];
      for (const [name, slug, code] of categories) {
        const did = code ? dept[code] : null;
        await client.query(
          `INSERT INTO categories (name, slug, department_id) VALUES ($1, $2, $3)`,
          [name, slug, did]
        );
      }
    }

    const { rows: allBranches } = await client.query(
      `SELECT id, name FROM branches ORDER BY id`
    );
    const branchByName = Object.fromEntries(allBranches.map((r) => [r.name, r.id]));

    const demoPassword = hash('password');

    const usersToEnsure = [
      {
        username: 'matara_admin',
        full_name: 'Matara Branch Rep',
        role: 'branch_user',
        branch: 'Matara Branch',
      },
      {
        username: 'galle_admin',
        full_name: 'Galle Branch Rep',
        role: 'branch_user',
        branch: 'Galle Branch',
      },
      {
        username: 'pharaoh_hotel',
        full_name: 'Pharaoh Hotel Rep',
        role: 'branch_user',
        branch: 'The Pharaoh Hotel',
      },
      {
        username: 'campus_admin',
        full_name: 'Campus Administrator',
        role: 'branch_user',
        branch: 'British Way Campus',
      },
      {
        username: 'it_staff',
        full_name: 'IT Team Member',
        role: 'dept_staff',
        departmentCode: 'IT',
      },
      {
        username: 'maintenance_staff',
        full_name: 'Maintenance Team',
        role: 'dept_staff',
        departmentCode: 'MAINTENANCE',
      },
      {
        username: 'admin_dept',
        full_name: 'Administration Team',
        role: 'dept_staff',
        departmentCode: 'ADMIN',
      },
      {
        username: 'bw_admin',
        full_name: 'System Administrator',
        role: 'admin',
      },
    ];

    for (const u of usersToEnsure) {
      const { rows: ex } = await client.query(`SELECT id FROM users WHERE username = $1`, [
        u.username,
      ]);
      if (ex.length) continue;

      let branchId = null;
      let departmentId = null;
      if (u.role === 'branch_user') {
        branchId = branchByName[u.branch];
        if (!branchId) throw new Error(`Branch not found: ${u.branch}`);
      }
      if (u.role === 'dept_staff') {
        departmentId = dept[u.departmentCode];
      }

      await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, branch_id, department_id)
         VALUES ($1, $2, $3, $4::user_role, $5, $6)`,
        [u.username, demoPassword, u.full_name, u.role, branchId, departmentId]
      );
    }

    const { rows: tc } = await client.query(`SELECT COUNT(*)::int AS c FROM tickets`);
    if (tc[0].c === 0) {
      const { rows: mataraUser } = await client.query(
        `SELECT id FROM users WHERE username = 'matara_admin'`
      );
      if (!mataraUser.length) {
        throw new Error('matara_admin user missing');
      }
      const { rows: cat } = await client.query(`SELECT id, slug FROM categories`);
      const catBySlug = Object.fromEntries(cat.map((c) => [c.slug, c.id]));
      const mataraId = branchByName['Matara Branch'];
      const creatorId = mataraUser[0].id;

      const sample = [
        {
          title: 'AC not cooling in Classroom 3',
          description: 'Unit runs but no cold air since Monday.',
          category: 'ac',
          priority: 'high',
          dept: 'MAINTENANCE',
          status: 'in_progress',
        },
        {
          title: 'Projector HDMI signal drops',
          description: 'Cable replaced; issue persists.',
          category: 'smart_tv_projector',
          priority: 'medium',
          dept: 'IT',
          status: 'assigned',
        },
        {
          title: 'Request office chairs (2)',
          description: 'Reception area.',
          category: 'furniture',
          priority: 'low',
          dept: 'MAINTENANCE',
          status: 'new',
        },
      ];

      for (const s of sample) {
        const deptId = dept[s.dept];
        await client.query(
          `INSERT INTO tickets (
            title, description, branch_id, category_id, priority,
            location_room, contact_person, contact_number,
            department_id, status, created_by
          ) VALUES ($1, $2, $3, $4, $5::ticket_priority, $6, $7, $8, $9, $10::ticket_status, $11)`,
          [
            s.title,
            s.description,
            mataraId,
            catBySlug[s.category],
            s.priority,
            'Room 101',
            'Branch Manager',
            '+94 77 000 0000',
            deptId,
            s.status,
            creatorId,
          ]
        );
      }

      const { rows: tickets } = await client.query(`SELECT id FROM tickets ORDER BY id`);
      const { rows: itUser } = await client.query(
        `SELECT id FROM users WHERE username = 'it_staff' LIMIT 1`
      );
      if (tickets[1] && itUser[0]) {
        await client.query(`UPDATE tickets SET assigned_to = $1 WHERE id = $2`, [
          itUser[0].id,
          tickets[1].id,
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('Seed completed. Demo password for all sample users: password');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
