import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/index.js';
import videosRouter from './routes/videos.js';
import groupsRouter from './routes/groups.js';
import statsRouter from './routes/stats.js';
import interactionsRouter from './routes/interactions.js';
import wishlistRouter from './routes/wishlist.js';
import authRouter from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration from environment
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Serve uploaded videos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/videos', videosRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/auth', authRouter);

// Initialize DB and start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`tapU server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
