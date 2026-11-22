import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('dist/web/browser');
const manifest = JSON.parse(await readFile(path.join(root, 'ngsw.json'), 'utf8'));
if (!manifest.hashTable['/runtime-config.js']) {
  throw new Error('Runtime configuration must remain available offline.');
}
for (const [url, expected] of Object.entries(manifest.hashTable)) {
  const file = await readFile(path.join(root, url.replace(/^\//, '')));
  const actual = createHash('sha1').update(file).digest('hex');
  if (actual !== expected) throw new Error(`Service worker integrity mismatch: ${url}`);
}
console.log('Service worker integrity verified after runtime configuration.');
