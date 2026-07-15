import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const strict = process.env.STRICT_ARCH === '1';

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', '.vite', 'coverage']);
const targetExtensions = new Set(['.js', '.mjs', '.ts', '.vue']);
const targetRoots = [
  'src/components',
  'src/views',
  'src/api',
  'server/routes',
  'server/services',
  'server/middleware',
];

const softLimit = 500;
const hardLimit = 900;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (targetExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function isTarget(file) {
  const rel = relative(file);
  return targetRoots.some(prefix => rel.startsWith(`${prefix}/`));
}

const files = (await walk(root)).filter(isTarget);
const rows = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r\n|\r|\n/).length;
  if (lines > softLimit) rows.push({ file: relative(file), lines });
}

rows.sort((a, b) => b.lines - a.lines);

if (!rows.length) {
  console.log(`File size check passed: no target file exceeds ${softLimit} lines.`);
  process.exit(0);
}

console.warn(`Large file report (${rows.length} files over ${softLimit} lines):`);
for (const row of rows) {
  const marker = row.lines > hardLimit ? 'HARD' : 'SOFT';
  console.warn(`  - [${marker}] ${row.file}: ${row.lines} lines`);
}

if (strict && rows.some(row => row.lines > hardLimit)) {
  console.error(`File size check failed in STRICT_ARCH mode: files over ${hardLimit} lines need splitting.`);
  process.exit(1);
}

console.warn('File size check completed as advisory. Set STRICT_ARCH=1 to fail on hard-limit files.');
