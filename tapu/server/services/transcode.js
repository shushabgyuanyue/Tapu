import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import fs from 'fs';
import { getUploadsDir } from './storage.js';
import { uploadToR2, isR2Configured } from './r2.js';
import { getDb, saveDb } from '../db/index.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

function getVideoFilter(srcWidth, srcHeight) {
  const srcRatio = srcWidth / srcHeight;
  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT; // 0.5625

  if (srcRatio > targetRatio) {
    // Source is wider (landscape) → scale height to target, crop width
    return `scale=-2:${TARGET_HEIGHT},crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`;
  } else if (srcRatio < targetRatio) {
    // Source is taller → scale width to target, crop height
    return `scale=${TARGET_WIDTH}:-2,crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`;
  } else {
    // Already 9:16 → just scale
    return `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}`;
  }
}

function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        width: videoStream?.width || 1920,
        height: videoStream?.height || 1080,
        duration: metadata.format?.duration || 0,
      });
    });
  });
}

function extractPoster(inputPath, outputPath, duration) {
  const seekTo = Math.max(0.1, duration * 0.3);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(seekTo)
      .frames(1)
      .videoFilter('scale=360:-1')
      .outputOptions(['-q:v', '5'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => {
        console.error('Poster extraction failed:', err.message);
        // Non-fatal: resolve anyway, poster just won't exist
        resolve();
      })
      .run();
  });
}

export function transcodeVideo(inputPath, videoId) {
  const outputFilename = `${videoId}.mp4`;
  const posterFilename = `${videoId}.jpg`;
  const outputPath = path.join(getUploadsDir(), outputFilename);
  const posterPath = path.join(getUploadsDir(), posterFilename);

  return new Promise(async (resolve, reject) => {
    try {
      const { width, height, duration } = await probeVideo(inputPath);
      const vf = getVideoFilter(width, height);

      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 28',
          '-c:a aac',
          '-b:a 96k',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          `-vf ${vf}`,
        ])
        .output(outputPath)
        .on('end', async () => {
          try {
            // Extract poster frame
            await extractPoster(outputPath, posterPath, duration);

            const { size } = fs.statSync(outputPath);
            let filePath = `/uploads/${outputFilename}`;
            let posterUrl = null;

            // Only set poster if extraction succeeded
            if (fs.existsSync(posterPath)) {
              posterUrl = `/uploads/${posterFilename}`;
            }

            // Upload to R2 if configured
            if (isR2Configured()) {
              filePath = await uploadToR2(outputPath, `videos/${outputFilename}`, 'video/mp4');
              if (posterUrl && fs.existsSync(posterPath)) {
                posterUrl = await uploadToR2(posterPath, `posters/${posterFilename}`, 'image/jpeg');
                fs.unlinkSync(posterPath);
              }
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }

            // Update DB
            const db = await getDb();
            db.run(
              'UPDATE videos SET status = ?, file_path = ?, poster_url = ?, duration = ?, file_size = ? WHERE id = ?',
              ['ready', filePath, posterUrl, duration, size, videoId]
            );
            saveDb();

            // Remove original temp file
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

            resolve(outputPath);
          } catch (postErr) {
            console.error('Post-transcode error:', postErr.message);
            const db = await getDb();
            db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
            saveDb();
            reject(postErr);
          }
        })
        .on('error', async (err) => {
          console.error('Transcode error:', err.message);
          const db = await getDb();
          db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
          saveDb();
          reject(err);
        })
        .run();
    } catch (probeErr) {
      console.error('Probe error:', probeErr.message);
      const db = await getDb();
      db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
      saveDb();
      reject(probeErr);
    }
  });
}
