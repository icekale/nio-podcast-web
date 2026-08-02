import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildCatalog,
  requestAlbum,
  sameCatalogContent,
  updateKnownAlbums,
  writeCatalogAtomically,
} from './catalog-generator.js';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(projectRoot, 'public/data/albums.json');
const maxId = Number(process.env.NIO_MAX_ALBUM_ID || 2000);
const concurrency = Number(process.env.NIO_CATALOG_CONCURRENCY || 12);
const ids = Array.from({ length: maxId }, (_, index) => index + 1);
const mode = process.env.NIO_CATALOG_MODE === 'incremental' ? 'incremental' : 'full';

async function readPreviousCatalog() {
  try {
    return JSON.parse(await readFile(output, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const previous = await readPreviousCatalog();
if (mode === 'incremental' && !previous?.albums?.length) {
  throw new Error('Incremental mode requires an existing catalog');
}

console.log(`${mode === 'incremental' ? 'Refreshing' : 'Scanning'} ${mode === 'incremental' ? previous.albums.length : ids.length} albums with concurrency ${concurrency}...`);
const albums = mode === 'incremental'
  ? await updateKnownAlbums(previous.albums, id => requestAlbum(id, globalThis.fetch), concurrency)
  : (await buildCatalog(ids, globalThis.fetch, concurrency)).albums;
if (!albums.length) throw new Error('No albums found; refusing to replace the existing catalog');

const catalog = { generatedAt: Date.now(), albums };
if (previous && sameCatalogContent(previous, catalog)) {
  console.log('No catalog changes');
  process.exit(0);
}

await writeCatalogAtomically(output, catalog);
console.log(`Wrote ${catalog.albums.length} albums to ${output}`);
