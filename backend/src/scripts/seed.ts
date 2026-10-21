import { readFile } from 'node:fs/promises';
import { DISCIPLINES_SEED_FILE, SEED_FILE, disciplinesFilePath, membersFilePath } from '../config/paths.js';
import { seedDisciplines } from '../modules/disciplines/discipline.seed.js';
import type { DisciplineInput } from '../modules/disciplines/discipline.types.js';
import { createJsonDisciplineRepository } from '../modules/disciplines/json-discipline.repository.js';
import { createJsonMemberRepository } from '../modules/members/json-member.repository.js';
import { seedMembers, type SeedEntry } from '../modules/members/member.seed.js';

async function main() {
  const force = process.argv.includes('--force');

  const disciplinesFile = disciplinesFilePath();
  const disciplineEntries = JSON.parse(await readFile(DISCIPLINES_SEED_FILE, 'utf8')) as DisciplineInput[];
  const disciplineCount = await seedDisciplines({
    repository: createJsonDisciplineRepository(disciplinesFile),
    entries: disciplineEntries,
    force,
  });
  console.log(`Seeded ${disciplineCount} synthetic disciplines into ${disciplinesFile}`);

  const file = membersFilePath();
  const repository = createJsonMemberRepository(file);
  const entries = JSON.parse(await readFile(SEED_FILE, 'utf8')) as SeedEntry[];

  const count = await seedMembers({ repository, entries, force });
  console.log(`Seeded ${count} synthetic members into ${file}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
