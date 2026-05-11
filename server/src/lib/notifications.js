/** @param {import('pg').PoolClient} client */
export async function notifyUser(client, userId, message, ticketId = null) {
  await client.query(
    `INSERT INTO notifications (user_id, message, ticket_id) VALUES ($1, $2, $3)`,
    [userId, message, ticketId]
  );
}

/** @param {import('pg').PoolClient} client */
export async function notifyDepartmentStaff(client, departmentId, message, ticketId) {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE role = 'dept_staff' AND department_id = $1 AND is_active = TRUE`,
    [departmentId]
  );
  for (const r of rows) {
    await notifyUser(client, r.id, message, ticketId);
  }
}

/** @param {import('pg').PoolClient} client */
export async function notifyAdmins(client, message, ticketId) {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`
  );
  for (const r of rows) {
    await notifyUser(client, r.id, message, ticketId);
  }
}
