import { readFile } from 'node:fs/promises';
import { SEED_FILE, membersFilePath } from '../config/paths.js';
import { createJsonMemberRepository } from '../modules/members/json-member.repository.js';
import { seedMembers, type SeedEntry } from '../modules/members/member.seed.js';
import { createMemberService } from '../modules/members/member.service.js';

async function main() {
  const file = membersFilePath();
  const repository = createJsonMemberRepository(file);
  const service = createMemberService({ repository });
  const entries = JSON.parse(await readFile(SEED_FILE, 'utf8')) as SeedEntry[];

  const count = await seedMembers({ service, repository, entries, force: process.argv.includes('--force') });
  console.log(`Seeded ${count} synthetic members into ${file}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
