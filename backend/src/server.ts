import { createApp } from './app.js';
import { membersFilePath } from './config/paths.js';
import { createJsonMemberRepository } from './modules/members/json-member.repository.js';
import { createMemberService } from './modules/members/member.service.js';

const port = Number(process.env.PORT ?? 3001);
const repository = createJsonMemberRepository(membersFilePath());
const app = createApp({ memberService: createMemberService({ repository }) });

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
