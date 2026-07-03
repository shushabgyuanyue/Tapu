import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/index.js';
import videosRouter from './routes/videos.js';
import groupsRouter from './routes/groups.js';
import statsRouter from './routes/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded videos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/videos', videosRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/stats', statsRouter);

// Initialize DB and start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`tapU server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
