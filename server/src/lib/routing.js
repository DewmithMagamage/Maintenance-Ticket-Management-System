/** @param {import('pg').PoolClient} client */
export async function getCategoryRouting(client, categoryId) {
  const { rows } = await client.query(
    `SELECT c.id, c.name, c.department_id, d.code AS department_code
     FROM categories c
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE c.id = $1`,
    [categoryId]
  );
  return rows[0] || null;
}

export function initialStatusForRouting(departmentId) {
  if (departmentId) return 'assigned';
  return 'new';
}
