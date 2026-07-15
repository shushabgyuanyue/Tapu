import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './db/index.js';
import videosRouter from './routes/videos.js';
import groupsRouter from './routes/groups.js';
import seriesRouter from './routes/series.js';
import applicationsRouter from './routes/applications.js';
import statsRouter from './routes/stats.js';
import interactionsRouter from './routes/interactions.js';
import wishlistRouter from './routes/wishlist.js';
import authRouter from './routes/auth.js';
import purchasesRouter from './routes/purchases.js';
import ordersRouter from './routes/orders.js';
import entitiesRouter from './routes/entities.js';
import configRouter from './routes/config.js';
import dailyStickersRouter from './routes/dailyStickers.js';
import answerBookRouter from './routes/answerBook.js';
import contentCollectionsRouter from './routes/contentCollections.js';
import momentsRouter from './routes/moments.js';
import worksRouter from './routes/works.js';
import travelTrailsRouter from './routes/travelTrails.js';
import checklistsRouter from './routes/checklists.js';
import mintStudioRouter from './routes/mintStudio.js';
import { getUploadsDir } from './services/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const uploadsDir = getUploadsDir();

// CORS configuration from environment
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Serve uploaded videos with Range request support (required by Safari)
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path);
  if (!filePath.endsWith('.mp4')) {
    return express.static(uploadsDir)(req, res, next);
  }

  fs.stat(filePath, (err, stat) => {
    if (err) return next();
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

// API routes
app.use('/api/videos', videosRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/series', seriesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/auth', authRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/config', configRouter);
app.use('/api/daily-stickers', dailyStickersRouter);
app.use('/api/answer-book', answerBookRouter);
app.use('/api/content-collections', contentCollectionsRouter);
app.use('/api/moments', momentsRouter);
app.use('/api/works', worksRouter);
app.use('/api/travel-trails', travelTrailsRouter);
app.use('/api/checks', checklistsRouter);
app.use('/api/mint-studio', mintStudioRouter);

// Serve frontend static files (production build)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for all non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
  } else {
    next();
  }
});

// Initialize DB and start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`tapU server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
