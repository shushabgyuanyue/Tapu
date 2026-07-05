import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tapu-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g. https://cdn.tapu.app

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : 'http://localhost:9000',
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file to R2 and return its public CDN URL.
 */
export async function uploadToR2(localPath, key, contentType = 'video/mp4') {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteFromR2(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));
}

export function getR2KeyFromUrl(url) {
  if (!R2_PUBLIC_URL || !url || typeof url !== 'string') return null;
  const normalizedBase = R2_PUBLIC_URL.replace(/\/+$/, '');
  if (!url.startsWith(normalizedBase + '/')) return null;
  return url.slice(normalizedBase.length + 1);
}

/**
 * Check if R2 is configured (env vars present).
 */
export function isR2Configured() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL);
}
