import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { createDisciplinesRouter } from './modules/disciplines/discipline.routes.js';
import type { DisciplineService } from './modules/disciplines/discipline.service.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';

export interface AppDependencies {
  memberService: MemberService;
  // Optional so apps that only exercise members (tests) can omit the catalog.
  disciplineService?: DisciplineService;
}

export function createApp({ memberService, disciplineService }: AppDependencies) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  // Add auth here, e.g. app.use('/api', requireAuth), to protect every API route at once.
  app.use('/api/members', createMembersRouter(memberService));
  if (disciplineService) app.use('/api/disciplines', createDisciplinesRouter(disciplineService));
  app.use('/api', apiNotFound);
  app.use(errorHandler);

  return app;
}
