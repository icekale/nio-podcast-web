import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildCatalog,
  mergeKnownAlbums,
  requestAlbum,
  reconcileFullScan,
  scanCatalog,
  sameCatalogContent,
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
const scanResult = mode === 'incremental'
  ? await scanCatalog(previous.albums.map(album => album.id), (id, signal) => requestAlbum(id, globalThis.fetch, signal), concurrency)
  : await buildCatalog(ids, globalThis.fetch, concurrency);
const previousAlbums = previous?.albums || [];
const previousIds = new Set(previousAlbums.map(album => Number(album.id)));
const discoveredIds = new Set(scanResult.albums.map(album => Number(album.id)));
const stats = {
  discovered: scanResult.albums.length,
  preserved: mode === 'incremental'
    ? previousAlbums.length - scanResult.albums.length
    : scanResult.failedIds.filter(id => previousIds.has(Number(id)) && !discoveredIds.has(Number(id))).length,
  missing: scanResult.missingIds.length,
  failed: scanResult.failedIds.length,
};
console.log(`Catalog scan: discovered ${stats.discovered}, preserved ${stats.preserved}, missing ${stats.missing}, failed ${stats.failed}`);
const albums = mode === 'incremental'
  ? mergeKnownAlbums(previousAlbums, scanResult)
  : reconcileFullScan(previousAlbums, scanResult).albums;
if (!albums.length) throw new Error('No albums found; refusing to replace the existing catalog');

const catalog = { generatedAt: Date.now(), albums };
if (previous && sameCatalogContent(previous, catalog)) {
  console.log('No catalog changes');
  process.exit(0);
}

await writeCatalogAtomically(output, catalog);
console.log(`Wrote ${catalog.albums.length} albums to ${output}`);
