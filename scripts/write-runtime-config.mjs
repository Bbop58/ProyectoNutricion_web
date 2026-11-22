import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const outputDirectory = path.resolve('dist/web/browser');
const configFile = path.join(outputDirectory, 'runtime-config.js');
const configuredApiUrl = process.env.API_BASE_URL?.trim();

if (!configuredApiUrl) {
  console.error('Falta API_BASE_URL. Configúrala con la URL del backend y el sufijo /api/v1 antes de compilar.');
  process.exit(1);
}

const apiUrl = configuredApiUrl.replace(/\/+$/, '');
let parsedApiUrl;

try {
  parsedApiUrl = new URL(apiUrl);
} catch {
  console.error(`API_BASE_URL no es una URL válida: ${apiUrl}`);
  process.exit(1);
}

if (parsedApiUrl.protocol !== 'https:') {
  console.error('API_BASE_URL debe usar HTTPS en builds de producción.');
  process.exit(1);
}

if (parsedApiUrl.username || parsedApiUrl.password) {
  console.error('API_BASE_URL no debe incluir usuario ni contraseña.');
  process.exit(1);
}

if (!parsedApiUrl.pathname.replace(/\/+$/, '').endsWith('/api/v1') || parsedApiUrl.search || parsedApiUrl.hash) {
  console.error('API_BASE_URL debe terminar en /api/v1 y no incluir query ni fragmento.');
  process.exit(1);
}

try {
  await access(path.join(outputDirectory, 'index.html'));
  await writeFile(
    configFile,
    `window.__NUTRISALUD_CONFIG__ = ${JSON.stringify({ apiUrl })};\n`,
    'utf8',
  );
  // Angular generated this manifest before runtime-config.js was populated.
  // Keep the config available offline while matching its deployed contents.
  const manifestFile = path.join(outputDirectory, 'ngsw.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (!Object.hasOwn(manifest.hashTable, '/runtime-config.js')) {
    throw new Error('runtime-config.js is missing from the service worker manifest.');
  }
  manifest.hashTable['/runtime-config.js'] = createHash('sha1')
    .update(await readFile(configFile)).digest('hex');
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Configuración de API escrita en ${configFile}.`);
} catch (error) {
  console.error(`No se pudo escribir la configuración de API: ${error.message}`);
  process.exit(1);
}
