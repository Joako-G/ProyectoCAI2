import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, expect, it } from 'vitest';

// RNF-01: the screens must look the same without internet, so no font may come from an external host.
const frontendRoot = join(__dirname, '..', '..');
const sourceRoot = join(frontendRoot, 'src');
const externalFontHosts = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const scannedExtensions = new Set(['.css', '.ts', '.tsx']);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return scannedExtensions.has(extname(path)) ? [path] : [];
  });
}

describe('offline fonts', () => {
  it('never references an external font host', () => {
    const files = [join(frontendRoot, 'index.html'), ...listSourceFiles(sourceRoot)];
    // This file names the hosts on purpose, so it is the only one skipped.
    const offenders = files
      .filter((file) => file !== __filename)
      .filter((file) => {
        const content = readFileSync(file, 'utf8');
        return externalFontHosts.some((host) => content.includes(host));
      });

    expect(offenders).toEqual([]);
  });

  it('imports the self-hosted font packages from the entry', () => {
    const entry = readFileSync(join(sourceRoot, 'main.tsx'), 'utf8');

    expect(entry).toContain('@fontsource/ibm-plex-sans/');
    expect(entry).toContain('@fontsource/ibm-plex-mono/');
    expect(entry).toContain('@fontsource/libre-baskerville/');
  });
});
