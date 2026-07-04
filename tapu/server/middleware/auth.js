import crypto from 'crypto';
import { getDb } from '../db/index.js';

const SECRET_KEY = '12345678901234567890123456789012';
const ALGORITHM = 'aes-256-cbc';

// Verify token from Authorization header, return user object or null
export async function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '需要登录母账户' });
  }

  const db = await getDb();
  const stmt = db.prepare('SELECT id, username, is_creator FROM users WHERE id = ?');
  stmt.bind([token]);
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();

  if (!user) {
    return res.status(401).json({ error: '无效的登录凭证' });
  }

  req.user = user;
  next();
}

// Optional auth - attach user if token present, but don't reject
export async function authOptional(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }

  const db = await getDb();
  const stmt = db.prepare('SELECT id, username, is_creator FROM users WHERE id = ?');
  stmt.bind([token]);
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();

  req.user = user || null;
  next();
}

// Verify entity key → returns { user_id, group_id, entity_id }
export function verifyEntityKey(key) {
  try {
    const parts = key.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// Generate entity key from payload
export function generateEntityKey(payload) {
  const data = JSON.stringify(payload);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
