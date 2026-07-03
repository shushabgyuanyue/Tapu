import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const TEMP_DIR = path.join(UPLOADS_DIR, 'temp');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export function getUploadsDir() {
  return UPLOADS_DIR;
}

export function getTempDir() {
  return TEMP_DIR;
}

export function getFilePath(filename) {
  return path.join(UPLOADS_DIR, filename);
}

export function getTempPath(filename) {
  return path.join(TEMP_DIR, filename);
}

export function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function cleanTempFiles(videoId) {
  const patterns = [`${videoId}.mp4`, `${videoId}.jpg`];
  for (const p of patterns) {
    deleteFile(path.join(UPLOADS_DIR, p));
  }
}
