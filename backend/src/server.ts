import { createApp } from './app.js';
import { disciplinesFilePath, membershipsFilePath, membersFilePath, pricingConfigFilePath } from './config/paths.js';
import { createJsonPricingConfigRepository } from './modules/payments/json-pricing-config.repository.js';
import { createPricingConfigService } from './modules/payments/pricing-config.service.js';
import { createJsonDisciplineRepository } from './modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from './modules/disciplines/discipline.service.js';
import { createJsonMembershipRepository } from './modules/memberships/json-membership.repository.js';
import { createMembershipService } from './modules/memberships/membership.service.js';
import { createJsonMemberRepository } from './modules/members/json-member.repository.js';
import { createRosterService } from './modules/roster/roster.service.js';
import { createMemberService } from './modules/members/member.service.js';
import { bootstrap } from './startup.js';
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
// Prices live in their own file; a missing file means the club defaults.
const pricingConfigService = createPricingConfigService({
  repository: createJsonPricingConfigRepository(pricingConfigFilePath()),
});
// A teacher's roster is composed from the three services through the roster module's own ports.
const rosterService = createRosterService({ memberships: membershipService, members: memberService, disciplines: disciplineService });
const app = createApp({ memberService, disciplineService, membershipService, pricingConfigService, rosterService });

bootstrap({
  memberService,
  membershipService,
  today: () => toIsoDate(new Date()),
  listen: () => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  },
  log: (message, error) => console.error(message, error),
}).catch((error: unknown) => {
  // Anything bootstrap does not degrade on (an unreadable members file, a throwing listen) is fatal.
  console.error('Server failed to start', error);
  process.exit(1);
});
