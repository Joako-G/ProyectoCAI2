import { createApp } from './app.js';
import { disciplinesFilePath, membersFilePath } from './config/paths.js';
import { createJsonDisciplineRepository } from './modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from './modules/disciplines/discipline.service.js';
import { createJsonMemberRepository } from './modules/members/json-member.repository.js';
import { createMemberService } from './modules/members/member.service.js';

const port = Number(process.env.PORT ?? 3001);
const disciplineService = createDisciplineService({
  repository: createJsonDisciplineRepository(disciplinesFilePath()),
});
// The members module only sees the small lookup port, which the disciplines service satisfies.
const memberService = createMemberService({
  repository: createJsonMemberRepository(membersFilePath()),
  disciplineLookup: disciplineService,
});
const app = createApp({ memberService, disciplineService });

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
