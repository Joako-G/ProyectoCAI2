import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createDisciplinesRouter } from './modules/disciplines/discipline.routes.js';
import type { DisciplineService } from './modules/disciplines/discipline.service.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';
import { UserRepository, defaultUsersFilePath } from './modules/users/user.repository.js';
import { createUsersRouter } from './modules/users/user.routes.js';
import { createUserService } from './modules/users/user.service.js';
import type { DemoUser } from './modules/users/user.types.js';

export interface AppDependencies {
  memberService?: MemberService;
  // Optional so apps that only exercise members (tests) can omit the catalog.
  disciplineService?: DisciplineService;
  storePath?: string;
  persist?: (users: DemoUser[]) => void;
}

export function createApp(options: AppDependencies) {
const repository = new UserRepository(options.storePath ?? defaultUsersFilePath, options.persist);
const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/auth', createAuthRouter(createAuthService(repository)));
app.use('/users', createUsersRouter(createUserService(repository)));

// Add auth here, e.g. app.use('/api', requireAuth), to protect every API route at once.
if (options.memberService) app.use('/api/members', createMembersRouter(options.memberService));
if (options.disciplineService) app.use('/api/disciplines', createDisciplinesRouter(options.disciplineService));
app.use('/api', apiNotFound);
app.use(errorHandler);
return app;
}
