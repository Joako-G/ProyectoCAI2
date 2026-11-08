// Copies the three face-api models the app needs from the installed package into public/models/face, so the
// browser loads them from this server and the club needs no internet (RNF-01). The copies are about 7 MB, so
// they are git-ignored and recreated on install; run it by hand with `pnpm --filter @club-socios/frontend copy-face-models`.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = ['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model'];
const FILES = MODELS.flatMap((name) => [`${name}-weights_manifest.json`, `${name}.bin`]);

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'public', 'models', 'face');
const source = join(dirname(createRequire(import.meta.url).resolve('@vladmandic/face-api/package.json')), 'model');

await mkdir(target, { recursive: true });
let copied = 0;
for (const file of FILES) {
  const from = join(source, file);
  const to = join(target, file);
  // Skip a file that is already there with the same size, so `pnpm dev` stays quick.
  const same = await Promise.all([stat(from), stat(to)]).then(([a, b]) => a.size === b.size, () => false);
  if (same) continue;
  await copyFile(from, to);
  copied += 1;
}
console.log(copied === 0 ? 'Face models are up to date.' : `Copied ${copied} face model file(s) to public/models/face.`);
