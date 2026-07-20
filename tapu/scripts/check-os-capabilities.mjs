import { buildOsCapabilityMatrix, getOsCapabilityFindings } from '../server/contracts/osCapabilityMap.js';

const findings = getOsCapabilityFindings();
const errors = findings.filter(finding => finding.level === 'error');

if (errors.length) {
  console.error(`OS capability check failed:\n${errors.map(item => `  - ${item.message}`).join('\n')}`);
  process.exit(1);
}

const matrix = buildOsCapabilityMatrix();
console.log(`OS capability check passed: ${matrix.length} apps have adapter, Studio, open API, and runtime context contracts.`);
