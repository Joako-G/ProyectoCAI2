import cors from 'cors';
import express from 'express';
import { apiNotFound, errorHandler } from './middlewares/error-handler.js';
import { requireCapability, requireCapabilityByMethod } from './middlewares/require-role.js';
import { createAccessRouter } from './modules/access/access.routes.js';
import type { AccessService } from './modules/access/access.service.js';
import { createAuditRouter } from './modules/audit/audit.routes.js';
import { discardAudit, type AuditService } from './modules/audit/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthenticator, createSessionStore } from './modules/auth/auth.session.js';
import { createBackupRouter } from './modules/backup/backup.routes.js';
import type { BackupService } from './modules/backup/backup.service.js';
import { createCashCountRouter } from './modules/cashcount/cashcount.routes.js';
import type { CashCountService } from './modules/cashcount/cashcount.service.js';
import { createFaceRouter, createFacesUnavailableRouter } from './modules/faces/face.routes.js';
import type { FaceService } from './modules/faces/face.service.js';
import { createDisciplinesRouter } from './modules/disciplines/discipline.routes.js';
import type { DisciplineService } from './modules/disciplines/discipline.service.js';
import { createMembersRouter } from './modules/members/member.routes.js';
import type { MemberService } from './modules/members/member.service.js';
import { createMembershipsRouter } from './modules/memberships/membership.routes.js';
import type { MembershipService } from './modules/memberships/membership.service.js';
import { createNoticeRouter } from './modules/notices/notice.routes.js';
import type { NoticeService } from './modules/notices/notice.service.js';
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
  noticeService?: Pick<NoticeService, 'debtNotices'>;
  accessService?: Pick<AccessService, 'check'>;
  faceService?: FaceService;
  // Set when there is no database: the face routes then answer 503 faces_unavailable instead of 404.
  facesUnavailable?: boolean;
  auditService?: AuditService;
  backupService?: Pick<BackupService, 'status' | 'run'>;
  // Lets the process share one users repository with the audit log, which reads actor names from it.
  userRepository?: UserRepository;
  storePath?: string;
  // Origin allowed to send credentialed requests; defaults to the Vite dev server.
  frontendOrigin?: string;
  persist?: (users: DemoUser[]) => void;
}

export function createApp(options: AppDependencies) {
const repository = options.userRepository ?? new UserRepository(options.storePath ?? defaultUsersFilePath, options.persist);
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
app.use('/users', requireCapability(authenticate, 'users:manage'), createUsersRouter(createUserService(repository, { disciplineLookup: options.disciplineService, audit: options.auditService ?? discardAudit }), authenticate));

// Every route below needs a session and a role allowed by modules/auth/permissions.ts; only /auth and /health are public.
if (options.memberService) {
  app.use('/api/members', requireCapabilityByMethod(authenticate, { read: 'members:read', write: 'members:write' }), createMembersRouter(options.memberService, authenticate));
}
if (options.disciplineService) {
  app.use('/api/disciplines', requireCapabilityByMethod(authenticate, { read: 'disciplines:read', write: 'disciplines:write' }), createDisciplinesRouter(options.disciplineService, authenticate));
}
if (options.membershipService) {
  // Read-only guard for every method: memberships has no write routes. Add a write capability before adding one.
  app.use('/api/memberships', requireCapability(authenticate, 'memberships:read'), createMembershipsRouter(options.membershipService));
}
if (options.pricingConfigService) {
  app.use('/api/pricing', requireCapabilityByMethod(authenticate, { read: 'config:read', write: 'config:manage' }), createPricingConfigRouter(options.pricingConfigService, authenticate));
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
if (options.noticeService) {
  // Read-only: notices:read for every request, and the router has no write route.
  app.use('/api/notices', requireCapability(authenticate, 'notices:read'), createNoticeRouter(options.noticeService));
}
if (options.accessService) {
  // One POST that reads and writes nothing, so a single capability guards it.
  app.use('/api/access', requireCapability(authenticate, 'access:check'), createAccessRouter(options.accessService));
}
if (options.faceService) {
  // Enroll, remove and recognize share one capability; the router audits its own writes and recognize writes nothing.
  app.use('/api/faces', requireCapability(authenticate, 'faces:manage'), createFaceRouter(options.faceService, authenticate));
} else if (options.facesUnavailable) {
  app.use('/api/faces', requireCapability(authenticate, 'faces:manage'), createFacesUnavailableRouter());
}
if (options.auditService) {
  // Read-only: audit:read for every request, and the router has no write route.
  app.use('/api/audit', requireCapability(authenticate, 'audit:read'), createAuditRouter(options.auditService));
}
if (options.backupService) {
  // The head secretary's alone: GET reads the status and POST makes a copy now, so one capability guards both.
  app.use('/api/backups', requireCapability(authenticate, 'backup:run'), createBackupRouter(options.backupService, authenticate));
}
app.use('/api', apiNotFound);
app.use(errorHandler);
return app;
}
