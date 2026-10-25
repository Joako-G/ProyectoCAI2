import { createApp } from './app.js';
import { disciplinesFilePath, membershipsFilePath, membersFilePath } from './config/paths.js';
import { createJsonDisciplineRepository } from './modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from './modules/disciplines/discipline.service.js';
import { createJsonMembershipRepository } from './modules/memberships/json-membership.repository.js';
import { createMembershipService } from './modules/memberships/membership.service.js';
import { createJsonMemberRepository } from './modules/members/json-member.repository.js';
import { createMemberService } from './modules/members/member.service.js';
import { toIsoDate } from './shared/date.js';

const port = Number(process.env.PORT ?? 3001);
const disciplineService = createDisciplineService({
  repository: createJsonDisciplineRepository(disciplinesFilePath()),
});
// Memberships are the dated history derived from each member's disciplines.
const membershipService = createMembershipService({
  repository: createJsonMembershipRepository(membershipsFilePath()),
});
// The members module only sees small ports, which the disciplines and memberships services satisfy.
const memberService = createMemberService({
  repository: createJsonMemberRepository(membersFilePath()),
  disciplineLookup: disciplineService,
  disciplineHistory: {
    onDisciplinesChanged: (memberId, disciplineIds, date) =>
      membershipService.syncMember(memberId, disciplineIds, date),
  },
});
const app = createApp({ memberService, disciplineService, membershipService });

async function main() {
  // The members and memberships files cannot be written atomically together, so align them at startup.
  // Members without history are backfilled from their memberSince date.
  await membershipService.reconcile(await memberService.list(), toIsoDate(new Date()));
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

main().catch((error: unknown) => {
  console.error('Server failed to start', error);
  process.exit(1);
});
