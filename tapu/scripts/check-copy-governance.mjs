import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetRoots = [
  'src/views',
  'src/components',
  'src/composables',
];

const ignoredDirs = new Set(['node_modules', 'dist', '.vite', 'coverage']);
const allowedFiles = new Set([
  'src/components/AdminPagination.vue',
]);

const allowedLinePatterns = [
  /new URL\(.+[\u4e00-\u9fff].+\)/,
  /name\.includes\('贴纸'\)/,
  /name\.includes\('狗'\)/,
  /name\.includes\('纸巾'\)/,
  /\['跳过', '略过', 'skip', 'Skip', '-'\]\.includes\(text\)/,
];

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function isIgnoredFile(file) {
  const rel = relative(file);
  if (allowedFiles.has(rel)) return true;
  if (!rel.endsWith('.vue') && !rel.endsWith('.ts')) return true;
  if (!targetRoots.some(prefix => rel.startsWith(`${prefix}/`))) return true;
  if (rel.includes('/copy/')) return true;
  if (rel.includes('/official/')) return true;
  if (rel.includes('/admin/')) return true;
  if (rel.includes('.spec.') || rel.includes('.test.')) return true;
  return false;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function stripBlockComments(line) {
  return line.replace(/\/\*.*?\*\//g, '');
}

function shouldCheckLine(line, inStyleBlock) {
  if (inStyleBlock) return false;
  const trimmed = stripBlockComments(line).trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('//')) return false;
  if (!/[\u4e00-\u9fff]/.test(trimmed)) return false;
  return !allowedLinePatterns.some(pattern => pattern.test(trimmed));
}

const files = (await walk(root)).filter(file => !isIgnoredFile(file));
const violations = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r\n|\r|\n/);
  let inStyleBlock = false;

  lines.forEach((line, index) => {
    if (/<style\b/i.test(line)) inStyleBlock = true;
    if (/<\/style>/i.test(line) && inStyleBlock) {
      inStyleBlock = false;
      return;
    }
    if (!shouldCheckLine(line, inStyleBlock)) return;
    violations.push({
      file: relative(file),
      line: index + 1,
      text: line.trim(),
    });
  });
}

if (!violations.length) {
  console.log('Copy governance check passed: no hardcoded Chinese copy found in non-admin user surfaces.');
  process.exit(0);
}

console.error('Copy governance check failed. Move user-facing copy into src/copy/* or extend the allowlist intentionally:');
for (const item of violations) {
  console.error(`  - ${item.file}:${item.line} ${item.text}`);
}
process.exit(1);
