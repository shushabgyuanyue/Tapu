import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const serverRoot = path.join(root, 'server');
const ignoredDirs = new Set(['node_modules', 'dist', '.vite', 'coverage']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = await walk(serverRoot);
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failures.push({
      file: path.relative(root, file).replace(/\\/g, '/'),
      output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
    });
  }
}

if (failures.length) {
  console.error('Server syntax check failed:');
  for (const failure of failures) {
    console.error(`\n${failure.file}\n${failure.output}`);
  }
  process.exit(1);
}

console.log(`Server syntax check passed: ${files.length} files checked.`);
