import { resolve } from 'node:path';
import { buildCatalog, writeCatalogAtomically } from './catalog-generator.js';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(projectRoot, 'public/data/albums.json');
const maxId = Number(process.env.NIO_MAX_ALBUM_ID || 2000);
const concurrency = Number(process.env.NIO_CATALOG_CONCURRENCY || 12);
const ids = Array.from({ length: maxId }, (_, index) => index + 1);

console.log(`Scanning ${ids.length} album IDs with concurrency ${concurrency}...`);
const catalog = await buildCatalog(ids, globalThis.fetch, concurrency);
if (!catalog.albums.length) throw new Error('No albums found; refusing to replace the existing catalog');
await writeCatalogAtomically(output, catalog);
console.log(`Wrote ${catalog.albums.length} albums to ${output}`);
