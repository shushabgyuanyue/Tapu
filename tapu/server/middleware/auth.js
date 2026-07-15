import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { generateToken128, getEntityByToken } from '../services/tokens.js';
import { serverMessages } from '../copy/messages.js';

const SECRET_KEY = '12345678901234567890123456789012';
const ALGORITHM = 'aes-256-cbc';

// Verify token from Authorization header, return user object or null
export async function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: serverMessages.auth.parentLoginRequired });
  }

  const db = await getDb();
  let user = findUserBySession(db, token) || findUserByLegacyToken(db, token);

  if (!user) {
    return res.status(401).json({ error: serverMessages.auth.invalidCredentials });
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
  const user = findUserBySession(db, token) || findUserByLegacyToken(db, token);

  req.user = user || null;
  next();
}

function findUserBySession(db, token) {
  const stmt = db.prepare(
    `SELECT u.id, u.username, u.is_creator
     FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)`
  );
  stmt.bind([token]);
  let user = null;
  if (stmt.step()) user = stmt.getAsObject();
  stmt.free();
  return user;
}

function findUserByLegacyToken(db, token) {
  const stmt = db.prepare('SELECT id, username, is_creator FROM users WHERE id = ?');
  stmt.bind([token]);
  let user = null;
  if (stmt.step()) user = stmt.getAsObject();
  stmt.free();
  return user;
}

export function createLoginSession(db, userId) {
  const token = generateToken128();
  db.run(
    "INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))",
    [token, userId]
  );
  return token;
}

// Verify entity token → returns { user_id, group_id, entity_id, token, bound }
export function verifyEntityKey(key, db) {
  if (db) {
    const entity = getEntityByToken(db, key);
    if (!entity) return null;
    return {
      user_id: entity.user_id || null,
      group_id: entity.group_id,
      entity_id: entity.id,
      token: entity.token || entity.entity_key,
      bound: !!entity.user_id,
    };
  }

  // Legacy fallback for historical encrypted keys. New tokens use database lookup.
  try {
    const parts = key.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);

    // Validate HMAC checksum if present
    if (payload.checksum) {
      const expected = crypto.createHmac('sha256', SECRET_KEY)
        .update(payload.entity_id + payload.group_id)
        .digest('hex')
        .slice(0, 16);
      if (payload.checksum !== expected) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Generate legacy-compatible random entity token. The database enforces uniqueness.
export function generateEntityKey(payload) {
  return generateToken128();
}
