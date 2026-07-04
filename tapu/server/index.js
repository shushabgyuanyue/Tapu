import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/index.js';
import videosRouter from './routes/videos.js';
import groupsRouter from './routes/groups.js';
import seriesRouter from './routes/series.js';
import statsRouter from './routes/stats.js';
import interactionsRouter from './routes/interactions.js';
import wishlistRouter from './routes/wishlist.js';
import authRouter from './routes/auth.js';
import purchasesRouter from './routes/purchases.js';
import entitiesRouter from './routes/entities.js';
import configRouter from './routes/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration from environment
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Serve uploaded videos with proper MIME types for cross-browser support
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// API routes
app.use('/api/videos', videosRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/series', seriesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/auth', authRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/config', configRouter);

// Initialize DB and start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`tapU server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
