import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const SECRET_KEY = '12345678901234567890123456789012'; // 32 chars
const ALGORITHM = 'aes-256-cbc';

// Helper to hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate simple token (for demo purposes)
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const id = uuidv4();
    const password_hash = hashPassword(password);

    db.run(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [id, username, password_hash]
    );

    res.json({ success: true, id, username });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const password_hash = hashPassword(password);
    const user = db.query(
      'SELECT id, username FROM users WHERE username = ? AND password_hash = ?',
      [username, password_hash]
    );

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(); // In a real app, this should be stored or be a JWT
    res.json({ success: true, token, user: user[0] });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/entity-key', (req, res) => {
  try {
    const { user_id, group_id, entity_id } = req.body;
    if (!user_id || !group_id || !entity_id) {
      return res.status(400).json({ error: 'user_id, group_id, and entity_id required' });
    }

    const payload = JSON.stringify({ user_id, group_id, entity_id });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combine IV and encrypted data
    const key = iv.toString('hex') + ':' + encrypted;
    
    res.json({ success: true, key });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify-key', (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }

    const parts = key.split(':');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Invalid key format' });
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);
    res.json({ success: true, payload });
  } catch (error) {
    console.error('Verify key error:', error);
    res.status(400).json({ error: 'Invalid or corrupted key' });
  }
});

export default router;
