import { readFile } from 'node:fs/promises';
import { DISCIPLINES_SEED_FILE, SEED_FILE, disciplinesFilePath, membersFilePath } from '../config/paths.js';
import type { DisciplineSeedEntry } from '../modules/disciplines/discipline.seed.js';
import type { SeedEntry } from '../modules/members/member.seed.js';
import { runSeed } from './run-seed.js';

async function main() {
  const disciplinesFile = disciplinesFilePath();
  const membersFile = membersFilePath();

  const { disciplines, members } = await runSeed({
    disciplinesFile,
    membersFile,
    disciplineEntries: JSON.parse(await readFile(DISCIPLINES_SEED_FILE, 'utf8')) as DisciplineSeedEntry[],
    memberEntries: JSON.parse(await readFile(SEED_FILE, 'utf8')) as SeedEntry[],
    force: process.argv.includes('--force'),
  });
  console.log(`Seeded ${disciplines} synthetic disciplines into ${disciplinesFile}`);
  console.log(`Seeded ${members} synthetic members into ${membersFile}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
