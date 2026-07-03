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

    db.run(
      'INSERT INTO videos (id, title, group_id, original_filename, file_path, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, groupId, req.file.originalname, '', 'processing']
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

  let results;
  if (group_id) {
    results = db.exec(
      'SELECT v.*, g.name as group_name FROM videos v LEFT JOIN groups g ON v.group_id = g.id WHERE v.group_id = ? ORDER BY v.created_at DESC',
      [group_id]
    );
  } else {
    results = db.exec(
      'SELECT v.*, g.name as group_name FROM videos v LEFT JOIN groups g ON v.group_id = g.id ORDER BY v.created_at DESC'
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
  res.json(videos[0]);
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

  const siblings = db.exec(
    'SELECT id, title, file_path, poster_url, duration FROM videos WHERE group_id = ? AND status = ? AND id != ? ORDER BY created_at DESC',
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
