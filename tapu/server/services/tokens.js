import crypto from 'crypto';

export function generateToken128() {
  return crypto.randomBytes(16).toString('hex');
}

export function normalizeEntityToken(token) {
  if (!token || typeof token !== 'string') return '';
  return token.trim();
}

export function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export function createUniqueEntityToken(db) {
  return createUniqueToken(db, 'ip_instances', 'token', 'ip instance token');
}

export function createUniqueToken(db, table, column = 'token', label = 'token') {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
    throw new Error('Invalid token lookup target');
  }

  for (let i = 0; i < 8; i++) {
    const token = generateToken128();
    const existing = db.exec(`SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`, [token]);
    if (resultToObjects(existing).length === 0) return token;
  }
  throw new Error(`Failed to generate unique ${label}`);
}

export function getEntityByToken(db, token) {
  const normalized = normalizeEntityToken(token);
  if (!normalized) return null;
  const results = db.exec('SELECT * FROM ip_instances WHERE token = ? OR entity_key = ? LIMIT 1', [normalized, normalized]);
  return resultToObjects(results)[0] || null;
}
