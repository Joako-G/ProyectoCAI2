import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

const testsDir = join(__dirname, '..');
const HELPER_DIR = join(testsDir, 'helpers');
// `listen(0)` and `listen(0, ...)`, but not `listenOnFetchSafePort(...)` or a `listen(port)` of a fixed port.
const RAW_LISTEN = /\.listen\(\s*0\s*[,)]/;

async function sourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) files.push(path);
  }
  return files;
}

it('keeps raw listen(0) out of the tests: servers must start through listenOnFetchSafePort', async () => {
  const offenders: string[] = [];
  for (const file of await sourceFiles(testsDir)) {
    if (file.startsWith(HELPER_DIR)) continue;
    if (RAW_LISTEN.test(await readFile(file, 'utf8'))) offenders.push(relative(testsDir, file).replaceAll('\\', '/'));
  }
  // fetch refuses some ports that the OS hands out for listen(0), which made tests fail at random.
  expect(offenders, 'use listenOnFetchSafePort from tests/helpers/listen.mjs instead of listen(0)').toEqual([]);
});
