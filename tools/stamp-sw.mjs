// Fills in sw.js's cache name and file list from the app's files, so a new version replaces the old copy on the phone.
// Run after changing any app file: npm run stamp (npm run build also makes the icons first).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDERS = ['logic', 'data', 'audio', 'components', 'pages', 'styles', 'fonts', 'images'];
const ROOT_FILES = ['index.html', 'app.js', 'manifest.webmanifest'];
const KEEP = /\.(js|css|html|woff2|png|svg|webmanifest)$/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return KEEP.test(name) ? [full] : [];
  });
}

const files = [...ROOT_FILES.map((f) => join(app, f)), ...FOLDERS.flatMap((d) => walk(join(app, d)))]
  .map((f) => relative(app, f).split(sep).join('/'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(app, f)));
const name = `side-a-${hash.digest('hex').slice(0, 10)}`;

const swPath = join(app, 'sw.js');
const sw = readFileSync(swPath, 'utf8')
  .replace(/^const CACHE_NAME = .*$/m, `const CACHE_NAME = '${name}';`)
  .replace(/^const FILES = .*$/m, `const FILES = ${JSON.stringify(['./', ...files])};`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${name}, ${files.length} files`);
