/** @param {import('pg').PoolClient} client */
export async function logAudit(client, ticketId, userId, action, details = {}) {
  await client.query(
    `INSERT INTO ticket_audit (ticket_id, user_id, action, details) VALUES ($1, $2, $3, $4::jsonb)`,
    [ticketId, userId, action, JSON.stringify(details)]
  );
}
