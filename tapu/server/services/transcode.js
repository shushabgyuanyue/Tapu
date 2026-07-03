import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { getUploadsDir } from './storage.js';
import { getDb, saveDb } from '../db/index.js';

export function transcodeVideo(inputPath, videoId) {
  const outputFilename = `${videoId}.mp4`;
  const outputPath = path.join(getUploadsDir(), outputFilename);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-vf scale=\'min(1080,iw)\':-2',
      ])
      .output(outputPath)
      .on('end', async () => {
        // Update video status
        const db = await getDb();
        // Get file info
        const { size } = await import('fs').then(fs => fs.statSync(outputPath));

        // Get duration via ffprobe
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          const duration = metadata?.format?.duration || 0;
          db.run(
            'UPDATE videos SET status = ?, file_path = ?, duration = ?, file_size = ? WHERE id = ?',
            ['ready', `/uploads/${outputFilename}`, duration, size, videoId]
          );
          saveDb();

          // Remove original temp file
          import('fs').then(fs => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          });

          resolve(outputPath);
        });
      })
      .on('error', async (err) => {
        console.error('Transcode error:', err.message);
        const db = await getDb();
        db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
        saveDb();
        reject(err);
      })
      .run();
  });
}
