import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const directories = [
  { label: 'migration', dir: path.join(root, 'server/db/migrations'), requiredFunction: 'up' },
  { label: 'seed', dir: path.join(root, 'server/db/seeds'), requiredFunction: 'apply' },
];

const failures = [];

function isGovernanceFile(file) {
  return /^\d{4}_[a-z0-9_]+\.js$/.test(file);
}

async function validateDirectory({ label, dir, requiredFunction }) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort();

  if (!files.length) {
    failures.push(`${label} directory has no governance files`);
    return;
  }

  const ids = new Set();
  for (const file of files) {
    if (!isGovernanceFile(file)) {
      failures.push(`${label} file ${file} must match 0000_snake_case.js`);
      continue;
    }

    const expectedId = file.replace(/\.js$/, '');
    const module = await import(pathToFileURL(path.join(dir, file)).href);
    const contract = module.default;

    if (!contract || typeof contract !== 'object') {
      failures.push(`${label} ${file} must export a default object`);
      continue;
    }
    if (contract.id !== expectedId) {
      failures.push(`${label} ${file} id must be "${expectedId}"`);
    }
    if (ids.has(contract.id)) {
      failures.push(`${label} id "${contract.id}" is duplicated`);
    }
    ids.add(contract.id);

    for (const field of ['title', 'description']) {
      if (!contract[field] || typeof contract[field] !== 'string') {
        failures.push(`${label} ${file} must declare string field "${field}"`);
      }
    }
    if (typeof contract[requiredFunction] !== 'function') {
      failures.push(`${label} ${file} must declare ${requiredFunction}()`);
    }
  }
}

for (const directory of directories) {
  await validateDirectory(directory);
}

if (failures.length) {
  console.error(`Database governance check failed:\n${failures.map(item => `  - ${item}`).join('\n')}`);
  process.exit(1);
}

console.log('Database governance check passed: migrations and seeds have stable contracts.');
