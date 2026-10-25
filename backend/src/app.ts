import cors from 'cors';
import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { requireCapability, requireCapabilityByMethod } from './middlewares/require-role.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthenticator, createSessionStore } from './modules/auth/auth.session.js';
import { createDisciplinesRouter } from './modules/disciplines/discipline.routes.js';
import type { DisciplineService } from './modules/disciplines/discipline.service.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';
import { createMembershipsRouter } from './modules/memberships/membership.routes.js';
import type { MembershipService } from './modules/memberships/membership.service.js';
import { UserRepository, defaultUsersFilePath } from './modules/users/user.repository.js';
import { createUsersRouter } from './modules/users/user.routes.js';
import { createUserService } from './modules/users/user.service.js';
import type { DemoUser } from './modules/users/user.types.js';

export interface AppDependencies {
  memberService?: MemberService;
  // Optional so apps that only exercise members (tests) can omit the catalog.
  disciplineService?: DisciplineService;
  membershipService?: MembershipService;
  storePath?: string;
  // Origin allowed to send credentialed requests; defaults to the Vite dev server.
  frontendOrigin?: string;
  persist?: (users: DemoUser[]) => void;
}

export function createApp(options: AppDependencies) {
const repository = new UserRepository(options.storePath ?? defaultUsersFilePath, options.persist);
const app = express();

app.use(cors({ origin: options.frontendOrigin ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

const authService = createAuthService(repository);
const sessions = createSessionStore();
const authenticate = createAuthenticator(sessions, authService);

app.use('/auth', createAuthRouter(authService, sessions, authenticate));
app.use('/users', requireCapability(authenticate, 'users:manage'), createUsersRouter(createUserService(repository)));

// Every route below needs a session and a role allowed by modules/auth/permissions.ts; only /auth and /health are public.
if (options.memberService) {
  app.use('/api/members', requireCapabilityByMethod(authenticate, { read: 'members:read', write: 'members:write' }), createMembersRouter(options.memberService));
}
if (options.disciplineService) {
  app.use('/api/disciplines', requireCapabilityByMethod(authenticate, { read: 'disciplines:read', write: 'disciplines:write' }), createDisciplinesRouter(options.disciplineService));
}
if (options.membershipService) {
  app.use('/api/memberships', requireCapability(authenticate, 'memberships:read'), createMembershipsRouter(options.membershipService));
}
app.use('/api', apiNotFound);
app.use(errorHandler);
return app;
}
