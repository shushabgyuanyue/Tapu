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

  // Don't upscale - if source is smaller, use source dimensions scaled to 9:16
  const effectiveHeight = Math.min(srcHeight, TARGET_HEIGHT);
  const effectiveWidth = Math.min(srcWidth, TARGET_WIDTH);

  if (srcRatio > targetRatio) {
    // Source is wider (landscape) → scale height to target, crop width
    return `scale=-2:${effectiveHeight},crop=${Math.round(effectiveHeight * targetRatio / 2) * 2}:${effectiveHeight}`;
  } else if (srcRatio < targetRatio) {
    // Source is taller → scale width to target, crop height
    return `scale=${effectiveWidth}:-2,crop=${effectiveWidth}:${Math.round(effectiveWidth / targetRatio / 2) * 2}`;
  } else {
    // Already 9:16 → just scale (no upscale)
    if (srcHeight <= TARGET_HEIGHT) {
      return `scale=${srcWidth}:${srcHeight}`;
    }
    return `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}`;
  }
}

function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve({
        width: videoStream?.width || 1920,
        height: videoStream?.height || 1080,
        duration: metadata.format?.duration || 0,
        codec: videoStream?.codec_name || '',
        pixFmt: videoStream?.pix_fmt || '',
        bitrate: metadata.format?.bit_rate ? parseInt(metadata.format.bit_rate) : 0,
        fileSize: metadata.format?.size ? parseInt(metadata.format.size) : 0,
        hasAudio: !!audioStream,
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
        resolve(); // Non-fatal
      })
      .run();
  });
}

/**
 * Determine if transcode is needed.
 * Skip if: already H.264, yuv420p, portrait 9:16, and reasonable size.
 */
function needsTranscode(probe) {
  const isH264 = probe.codec === 'h264';
  const isYuv420p = probe.pixFmt === 'yuv420p';
  const isPortrait = probe.height > probe.width;
  const ratio = probe.width / probe.height;
  const is916 = Math.abs(ratio - 9 / 16) < 0.02;
  const isReasonableSize = probe.bitrate > 0 && probe.bitrate < 4000000; // < 4Mbps

  // If already well-encoded portrait H.264, skip heavy transcode
  if (isH264 && isYuv420p && isPortrait && is916 && isReasonableSize) {
    return false;
  }
  return true;
}

export function transcodeVideo(inputPath, videoId) {
  const outputFilename = `${videoId}.mp4`;
  const posterFilename = `${videoId}.jpg`;
  const outputPath = path.join(getUploadsDir(), outputFilename);
  const posterPath = path.join(getUploadsDir(), posterFilename);

  return new Promise(async (resolve, reject) => {
    try {
      const probe = await probeVideo(inputPath);
      const { width, height, duration } = probe;
      const inputSize = probe.fileSize || (fs.existsSync(inputPath) ? fs.statSync(inputPath).size : 0);

      const shouldTranscode = needsTranscode(probe);

      if (!shouldTranscode) {
        // Just copy the file and extract poster — no re-encode
        fs.copyFileSync(inputPath, outputPath);
        await extractPoster(outputPath, posterPath, duration);
        await finalizeVideo(videoId, outputPath, posterPath, posterFilename, outputFilename, duration, inputPath);
        return resolve(outputPath);
      }

      const vf = getVideoFilter(width, height);

      // CRF 23 with medium preset for good compression
      // Profile high + level 4.0 for Safari 12+ compatibility and better compression
      const outputOptions = [
        '-c:v', 'libx264',
        '-profile:v', 'high',
        '-level', '4.0',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', vf,
      ];

      // Handle audio
      if (probe.hasAudio) {
        outputOptions.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
      } else {
        outputOptions.push('-an');
      }

      ffmpeg(inputPath)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', async () => {
          try {
            // Compare output vs input size. If output is larger, use lower quality or keep original.
            const outputSize = fs.statSync(outputPath).size;
            if (outputSize > inputSize && inputSize > 0) {
              // Re-encode at higher CRF to ensure smaller file
              console.log(`Output (${outputSize}) > Input (${inputSize}), re-encoding with CRF 30...`);
              const retryPath = outputPath + '.retry.mp4';
              await new Promise((res2, rej2) => {
                ffmpeg(inputPath)
                  .outputOptions([
                    '-c:v', 'libx264',
                    '-profile:v', 'high',
                    '-level', '4.0',
                    '-preset', 'medium',
                    '-crf', '30',
                    '-movflags', '+faststart',
                    '-pix_fmt', 'yuv420p',
                    '-vf', vf,
                    ...(probe.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']),
                  ])
                  .output(retryPath)
                  .on('end', res2)
                  .on('error', rej2)
                  .run();
              });
              const retrySize = fs.statSync(retryPath).size;
              // Use whichever is smaller
              if (retrySize < outputSize) {
                fs.unlinkSync(outputPath);
                fs.renameSync(retryPath, outputPath);
              } else {
                fs.unlinkSync(retryPath);
              }
            }

            await extractPoster(outputPath, posterPath, duration);
            await finalizeVideo(videoId, outputPath, posterPath, posterFilename, outputFilename, duration, inputPath);
            resolve(outputPath);
          } catch (postErr) {
            console.error('Post-transcode error:', postErr.message);
            const db = await getDb();
            db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
            db.run('UPDATE content_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', videoId]);
            db.run('UPDATE resources SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', `resource-${videoId}`]);
            saveDb();
            reject(postErr);
          }
        })
        .on('error', async (err) => {
          console.error('Transcode error:', err.message);
          const db = await getDb();
          db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
          db.run('UPDATE content_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', videoId]);
          db.run('UPDATE resources SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', `resource-${videoId}`]);
          saveDb();
          reject(err);
        })
        .run();
    } catch (probeErr) {
      console.error('Probe error:', probeErr.message);
      const db = await getDb();
      db.run('UPDATE videos SET status = ? WHERE id = ?', ['error', videoId]);
      db.run('UPDATE content_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', videoId]);
      db.run('UPDATE resources SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['error', `resource-${videoId}`]);
      saveDb();
      reject(probeErr);
    }
  });
}

export function transcodeAuthoringVideo(inputPath, resourceId, options = {}) {
  const authoringDir = path.join(getUploadsDir(), 'authoring');
  if (!fs.existsSync(authoringDir)) fs.mkdirSync(authoringDir, { recursive: true });

  const preserveAlpha = options.resourceProfile === 'ar_alpha_overlay' || options.preserveAlpha;
  const outputFilename = `${resourceId}.${preserveAlpha ? 'webm' : 'mp4'}`;
  const posterFilename = `${resourceId}.jpg`;
  const outputPath = path.join(authoringDir, outputFilename);
  const posterPath = path.join(authoringDir, posterFilename);

  return new Promise(async (resolve, reject) => {
    try {
      const probe = await probeVideo(inputPath);
      const vf = getVideoFilter(probe.width, probe.height);
      const outputOptions = preserveAlpha
        ? [
          '-c:v', 'libvpx-vp9',
          '-b:v', '0',
          '-crf', '32',
          '-auto-alt-ref', '0',
          '-pix_fmt', 'yuva420p',
          '-vf', `${vf},format=yuva420p`,
          ...(probe.hasAudio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']),
        ]
        : [
          '-c:v', 'libx264',
          '-profile:v', 'high',
          '-level', '4.0',
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          ...(probe.hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : ['-an']),
        ];

      ffmpeg(inputPath)
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', async () => {
          try {
            await extractPoster(outputPath, posterPath, probe.duration || 0);
            const { size } = fs.statSync(outputPath);
            const outputProbe = await probeVideo(outputPath);
            let storageUrl = `/uploads/authoring/${outputFilename}`;
            let previewUrl = fs.existsSync(posterPath) ? `/uploads/authoring/${posterFilename}` : null;

            if (isR2Configured()) {
              storageUrl = await uploadToR2(outputPath, `authoring/${outputFilename}`, preserveAlpha ? 'video/webm' : 'video/mp4');
              if (previewUrl && fs.existsSync(posterPath)) {
                previewUrl = await uploadToR2(posterPath, `authoring-posters/${posterFilename}`, 'image/jpeg');
                fs.unlinkSync(posterPath);
              }
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }

            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            resolve({
              storageUrl,
              previewUrl,
              storageKey: `authoring/${outputFilename}`,
              storageProvider: isR2Configured() ? 'remote' : 'local',
              mimeType: preserveAlpha ? 'video/webm' : 'video/mp4',
              fileSize: size,
              duration: outputProbe.duration || probe.duration || null,
              width: outputProbe.width || null,
              height: outputProbe.height || null,
              originalCodec: probe.codec || null,
              originalPixFmt: probe.pixFmt || null,
              resourceProfile: preserveAlpha ? 'ar_alpha_overlay' : 'browser_video',
              processor: preserveAlpha ? 'video_transcode_vp9_alpha' : 'video_transcode_h264',
            });
          } catch (postErr) {
            reject(postErr);
          }
        })
        .on('error', reject)
        .run();
    } catch (error) {
      reject(error);
    }
  });
}

async function finalizeVideo(videoId, outputPath, posterPath, posterFilename, outputFilename, duration, inputPath) {
  const { size } = fs.statSync(outputPath);
  let filePath = `/uploads/${outputFilename}`;
  let posterUrl = null;

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
  db.run(
    `UPDATE content_instances
     SET status = 'published',
         visibility = COALESCE(visibility, 'public'),
         payload_json = json_set(COALESCE(payload_json, '{}'), '$.poster_url', ?, '$.file_path', ?),
         published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [posterUrl, filePath, videoId]
  );
  db.run(
    `UPDATE resources
     SET storage_url = ?, preview_url = ?, file_size = ?, duration = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [filePath, posterUrl, size, duration, `resource-${videoId}`]
  );
  saveDb();

  // Remove original temp file
  if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
}
