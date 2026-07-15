import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';

const cwd = process.cwd();
const root = path.basename(cwd) === 'tapu' && existsSync(path.join(cwd, '..', '.git'))
  ? path.resolve(cwd, '..')
  : cwd;
const decoder = new TextDecoder('utf-8', { fatal: true });

const ignoredDirs = new Set([
  '.git',
  'archo evo',
  'node_modules',
  'dist',
  '.vite',
  'coverage',
]);

const namedTextFiles = new Set([
  '.editorconfig',
  '.env.example',
  '.gitattributes',
  '.gitignore',
  '.ledger',
]);

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.ts',
  '.txt',
  '.vue',
  '.yaml',
  '.yml',
]);

const cjkMojibakeMarkers = /(?:\u951b|\u9286|\u9225|\u4e63|\u20ac).*(?:\u951b|\u9286|\u9225|\u4e63|\u20ac)/;

const mojibakePatterns = [
  /\uFFFD/,
  /\u00c3[\x80-\xBF]/,
  /\u00c2[\x80-\xBF]/,
  /\u00e2[\x80-\xBF]{1,2}/,
  /\u00e6[\x80-\xBF]/,
  /\u00e7[\x80-\xBF]/,
  /\u00e8[\x80-\xBF]/,
  cjkMojibakeMarkers,
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (namedTextFiles.has(entry.name) || textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

const failures = [];
const warnings = [];

for (const file of await walk(root)) {
  const buffer = await readFile(file);
  let text = '';
  try {
    text = decoder.decode(buffer);
  } catch {
    failures.push(`${relative(file)} is not valid UTF-8`);
    continue;
  }

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    warnings.push(`${relative(file)} has UTF-8 BOM`);
  }

  if (mojibakePatterns.some(pattern => pattern.test(text))) {
    failures.push(`${relative(file)} contains mojibake-like characters`);
  }
}

if (warnings.length) {
  console.warn(`Encoding warnings:\n${warnings.map(item => `  - ${item}`).join('\n')}`);
}

if (failures.length) {
  console.error(`Encoding check failed:\n${failures.map(item => `  - ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('Encoding check passed: UTF-8 text files look healthy.');
