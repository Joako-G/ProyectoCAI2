import cors from 'cors';
import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { requireCapability, requireCapabilityByMethod } from './middlewares/require-role.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthenticator, createSessionStore } from './modules/auth/auth.session.js';
import { createCashCountRouter } from './modules/cashcount/cashcount.routes.js';
import type { CashCountService } from './modules/cashcount/cashcount.service.js';
import { createDisciplinesRouter } from './modules/disciplines/discipline.routes.js';
import type { DisciplineService } from './modules/disciplines/discipline.service.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';
import { createMembershipsRouter } from './modules/memberships/membership.routes.js';
import type { MembershipService } from './modules/memberships/membership.service.js';
import { createPaymentRouter } from './modules/payments/payment.routes.js';
import { createPricingConfigRouter } from './modules/payments/pricing-config.routes.js';
import type { PaymentService } from './modules/payments/payment.service.js';
import type { PricingConfigService } from './modules/payments/pricing-config.service.js';
import { createReportRouter } from './modules/reports/report.routes.js';
import type { ReportService } from './modules/reports/report.service.js';
import { createRosterRouter } from './modules/roster/roster.routes.js';
import type { RosterService } from './modules/roster/roster.service.js';
import { UserRepository, defaultUsersFilePath } from './modules/users/user.repository.js';
import { createUsersRouter } from './modules/users/user.routes.js';
import { createUserService, hasActiveHeadSecretary } from './modules/users/user.service.js';
import type { DemoUser } from './modules/users/user.types.js';

export interface AppDependencies {
  memberService?: MemberService;
  // Optional so apps that only exercise members (tests) can omit the catalog.
  disciplineService?: DisciplineService;
  membershipService?: MembershipService;
  pricingConfigService?: PricingConfigService;
  paymentService?: PaymentService;
  reportService?: Pick<ReportService, 'revenue' | 'disciplineSettlement'>;
  cashCountService?: CashCountService;
  rosterService?: RosterService;
  storePath?: string;
  // Origin allowed to send credentialed requests; defaults to the Vite dev server.
  frontendOrigin?: string;
  persist?: (users: DemoUser[]) => void;
}

export function createApp(options: AppDependencies) {
const repository = new UserRepository(options.storePath ?? defaultUsersFilePath, options.persist);
if (!hasActiveHeadSecretary(repository.list())) {
  // No automatic promotion: an operator must restore a head_secretary account in the users file.
  console.warn('Users store has no active head_secretary: nobody can manage users. Set an account role to "head_secretary" and active to true in the users file, then restart.');
}
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
app.use('/users', requireCapability(authenticate, 'users:manage'), createUsersRouter(createUserService(repository, { disciplineLookup: options.disciplineService })));

// Every route below needs a session and a role allowed by modules/auth/permissions.ts; only /auth and /health are public.
if (options.memberService) {
  app.use('/api/members', requireCapabilityByMethod(authenticate, { read: 'members:read', write: 'members:write' }), createMembersRouter(options.memberService));
}
if (options.disciplineService) {
  app.use('/api/disciplines', requireCapabilityByMethod(authenticate, { read: 'disciplines:read', write: 'disciplines:write' }), createDisciplinesRouter(options.disciplineService));
}
if (options.membershipService) {
  // Read-only guard for every method: memberships has no write routes. Add a write capability before adding one.
  app.use('/api/memberships', requireCapability(authenticate, 'memberships:read'), createMembershipsRouter(options.membershipService));
}
if (options.pricingConfigService) {
  app.use('/api/pricing', requireCapabilityByMethod(authenticate, { read: 'config:read', write: 'config:manage' }), createPricingConfigRouter(options.pricingConfigService));
}
if (options.paymentService) {
  // Reading needs payments:read; the write routes add payments:collect or payments:annul themselves.
  app.use('/api/payments', requireCapability(authenticate, 'payments:read'), createPaymentRouter(options.paymentService, authenticate));
}
if (options.reportService) {
  // Read-only: reports:read for every request, and the router has no write route.
  app.use('/api/reports', requireCapability(authenticate, 'reports:read'), createReportRouter(options.reportService));
}
if (options.cashCountService) {
  // The daily close is the head secretary's alone; the secretary reaches reports but never the cash count.
  app.use('/api/cashcount', requireCapability(authenticate, 'cashcount:run'), createCashCountRouter(options.cashCountService, authenticate));
}
if (options.rosterService) {
  app.use('/api/roster', requireCapability(authenticate, 'roster:read'), createRosterRouter(options.rosterService, authenticate));
}
app.use('/api', apiNotFound);
app.use(errorHandler);
return app;
}
