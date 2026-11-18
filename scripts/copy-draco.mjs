// Copies the Draco decoder that ships with three.js into /public/draco
// so the GLB (which is Draco-compressed) can be decoded offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf');
const dst = join(root, 'public', 'draco');

if (!existsSync(src)) {
  console.warn('[copy-draco] three.js draco folder not found, skipping:', src);
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log('[copy-draco] Draco decoder copied to public/draco');
