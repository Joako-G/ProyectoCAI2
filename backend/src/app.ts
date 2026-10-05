import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';

export interface AppDependencies {
  memberService: MemberService;
}

export function createApp({ memberService }: AppDependencies) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  // Add auth here, e.g. app.use('/api', requireAuth), to protect every API route at once.
  app.use('/api/members', createMembersRouter(memberService));
  app.use('/api', apiNotFound);
  app.use(errorHandler);

  return app;
}
