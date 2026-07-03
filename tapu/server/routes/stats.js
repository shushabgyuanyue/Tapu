import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// Record play event
router.post('/play', async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });

  const db = await getDb();
  const userAgent = req.headers['user-agent'] || '';
  db.run(
    'INSERT INTO play_events (video_id, user_agent) VALUES (?, ?)',
    [video_id, userAgent]
  );
  saveDb();
  res.json({ success: true });
});

// Overview stats
router.get('/overview', async (req, res) => {
  const db = await getDb();

  // Total plays
  const totalResult = db.exec('SELECT COUNT(*) as count FROM play_events');
  const totalPlays = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;

  // Total videos
  const videosResult = db.exec('SELECT COUNT(*) as count FROM videos');
  const totalVideos = videosResult.length > 0 ? videosResult[0].values[0][0] : 0;

  // Top videos by play count
  const topResult = db.exec(`
    SELECT v.id, v.title, COUNT(p.id) as play_count
    FROM videos v
    LEFT JOIN play_events p ON v.id = p.video_id
    GROUP BY v.id
    ORDER BY play_count DESC
    LIMIT 10
  `);
  const topVideos = resultToObjects(topResult);

  // Recent plays
  const recentResult = db.exec(`
    SELECT p.played_at, p.user_agent, v.id as video_id, v.title
    FROM play_events p
    JOIN videos v ON p.video_id = v.id
    ORDER BY p.played_at DESC
    LIMIT 20
  `);
  const recentPlays = resultToObjects(recentResult);

  res.json({ totalPlays, totalVideos, topVideos, recentPlays });
});

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
