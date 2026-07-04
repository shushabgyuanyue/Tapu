import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { getDb, saveDb } from '../db/index.js';
import { getUploadsDir, deleteFile } from '../services/storage.js';
import { transcodeVideo } from '../services/transcode.js';

const router = Router();

// Configure multer for temp uploads
const upload = multer({
  dest: path.join(getUploadsDir(), 'temp'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

function getEntityId(req) {
  return req.headers['x-entity-id'] || req.query.entity_id || null;
}

// Upload video
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const db = await getDb();
    const id = uuidv4();
    const title = req.body.title || req.file.originalname;
    const groupId = req.body.group_id || null;
    const isPrivate = req.body.is_private === 'true' || req.body.is_private === '1' ? 1 : 0;
    const entityId = getEntityId(req) || req.body.entity_id || null;

    db.run(
      'INSERT INTO videos (id, title, group_id, original_filename, file_path, status, is_private, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, groupId, req.file.originalname, '', 'processing', isPrivate, entityId]
    );
    saveDb();

    // Start transcoding asynchronously
    transcodeVideo(req.file.path, id).catch(err => {
      console.error(`Transcode failed for ${id}:`, err.message);
    });

    res.json({ id, status: 'processing' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List videos
router.get('/', async (req, res) => {
  const db = await getDb();
  const { group_id } = req.query;
  const currentEntityId = getEntityId(req);

  let results;
  // If no currentEntityId, exclude private videos. If provided, include public + private belonging to entity.
  const privacyCondition = currentEntityId ? `(v.is_private = 0 OR v.entity_id = '${currentEntityId}')` : `v.is_private = 0`;

  if (group_id) {
    results = db.exec(
      `SELECT v.*, g.name as group_name FROM videos v LEFT JOIN groups g ON v.group_id = g.id WHERE v.group_id = ? AND ${privacyCondition} ORDER BY v.created_at DESC`,
      [group_id]
    );
  } else {
    results = db.exec(
      `SELECT v.*, g.name as group_name FROM videos v LEFT JOIN groups g ON v.group_id = g.id WHERE ${privacyCondition} ORDER BY v.created_at DESC`
    );
  }

  const videos = resultToObjects(results);
  res.json(videos);
});

// Get single video
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT * FROM videos WHERE id = ?', [req.params.id]);
  const videos = resultToObjects(results);
  
  if (videos.length === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const video = videos[0];
  const currentEntityId = getEntityId(req);

  if (video.is_private === 1 && video.entity_id !== currentEntityId) {
    return res.status(403).json({ error: '私有作品非持有者无法查看' });
  }

  res.json(video);
});

// Get sibling videos in the same group (for swipe feed)
router.get('/:id/siblings', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT group_id FROM videos WHERE id = ?', [req.params.id]);
  const current = resultToObjects(results);
  if (current.length === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const groupId = current[0].group_id;
  if (!groupId) {
    return res.json([]);
  }

  const currentEntityId = getEntityId(req);
  const privacyCondition = currentEntityId ? `(is_private = 0 OR entity_id = '${currentEntityId}')` : `is_private = 0`;

  const siblings = db.exec(
    `SELECT id, title, file_path, poster_url, duration FROM videos WHERE group_id = ? AND status = ? AND id != ? AND ${privacyCondition} ORDER BY created_at DESC`,
    [groupId, 'ready', req.params.id]
  );
  res.json(resultToObjects(siblings));
});

// Delete video
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT file_path FROM videos WHERE id = ?', [req.params.id]);
  const videos = resultToObjects(results);

  if (videos.length > 0 && videos[0].file_path) {
    const filePath = path.join(getUploadsDir(), '..', videos[0].file_path);
    deleteFile(filePath);
  }

  db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// Helper: convert sql.js result to array of objects
function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export default router;
