import { createApp } from './app.js';
import {
  auditFilePath,
  backupDirectory,
  cashCountsFilePath,
  disciplinesFilePath,
  membershipsFilePath,
  membersFilePath,
  paymentsFilePath,
  pricingConfigFilePath,
} from './config/paths.js';
import { databaseUrl } from './config/database.js';
import { runMigrations } from './database/migrate.js';
import { createPool } from './database/pool.js';
import { createFaceService } from './modules/faces/face.service.js';
import { createPgFaceRepository } from './modules/faces/pg-face.repository.js';
import { createAccessService } from './modules/access/access.service.js';
import type { AuditLabelSources } from './modules/audit/audit.labels.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { startBackupScheduler } from './modules/backup/backup.scheduler.js';
import { createBackupService } from './modules/backup/backup.service.js';
import { backupSources } from './modules/backup/backup.sources.js';
import { createJsonAuditRepository } from './modules/audit/json-audit.repository.js';
import { UserRepository, defaultUsersFilePath } from './modules/users/user.repository.js';
import { createJsonPricingConfigRepository } from './modules/payments/json-pricing-config.repository.js';
import { createJsonPaymentRepository } from './modules/payments/json-payment.repository.js';
import { createPaymentService } from './modules/payments/payment.service.js';
import { createPricingConfigService } from './modules/payments/pricing-config.service.js';
import { createJsonDisciplineRepository } from './modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from './modules/disciplines/discipline.service.js';
import { createJsonMembershipRepository } from './modules/memberships/json-membership.repository.js';
import { createMembershipService } from './modules/memberships/membership.service.js';
import { createJsonMemberRepository } from './modules/members/json-member.repository.js';
import { createCashCountService } from './modules/cashcount/cashcount.service.js';
import { createJsonCashCountRepository } from './modules/cashcount/json-cashcount.repository.js';
import { createNoticeService } from './modules/notices/notice.service.js';
import { createWaMeSender } from './modules/notices/notice.sender.js';
import { createPaymentIncomeSource } from './modules/reports/income.source.js';
import { createReportService } from './modules/reports/report.service.js';
import { createRosterService } from './modules/roster/roster.service.js';
import { createMemberService } from './modules/members/member.service.js';
import { bootstrap } from './startup.js';
import { toIsoDate } from './shared/date.js';

const port = Number(process.env.PORT ?? 3001);
// PostgreSQL is optional: without DATABASE_URL the database features stay off and everything else runs on the JSON files.
const connectionString = databaseUrl();
const pool = connectionString ? createPool(connectionString) : undefined;
// The audit log snapshots each actor's name and role from the users repository, which the app shares.
const userRepository = new UserRepository(defaultUsersFilePath);
// Display labels are read when the log is read, from the services built below; the thunks run later, never here.
const auditLabels: AuditLabelSources = {
  members: async () => memberService.list(),
  disciplines: async () => disciplineService.list(),
  users: async () => userRepository.list(),
  payments: async () => paymentRepository.list(),
  cashCounts: async () => cashCountRepository.list(),
};
const auditService = createAuditService({
  repository: createJsonAuditRepository(auditFilePath()),
  actors: { find: (id) => userRepository.list().find((user) => user.id === id) },
  labels: auditLabels,
});
const disciplineService = createDisciplineService({
  repository: createJsonDisciplineRepository(disciplinesFilePath()),
  audit: auditService,
});
// Memberships are the dated history derived from each member's disciplines.
const membershipService = createMembershipService({
  repository: createJsonMembershipRepository(membershipsFilePath()),
});
// The members module only sees small ports, which the disciplines and memberships services satisfy.
const memberService = createMemberService({
  repository: createJsonMemberRepository(membersFilePath()),
  disciplineLookup: disciplineService,
  audit: auditService,
  disciplineHistory: {
    onDisciplinesChanged: (memberId, disciplineIds, date) =>
      membershipService.syncMember(memberId, disciplineIds, date),
  },
});
// Prices live in their own file; a missing file means the club defaults.
const pricingConfigService = createPricingConfigService({
  repository: createJsonPricingConfigRepository(pricingConfigFilePath()),
  audit: auditService,
});
// Payments are append-only receipts, served under /api/payments.
const paymentRepository = createJsonPaymentRepository(paymentsFilePath());
const paymentService = createPaymentService({
  repository: paymentRepository,
  members: memberService,
  memberships: membershipService,
  pricing: pricingConfigService,
  audit: auditService,
});
// A teacher's roster is composed from the three services through the roster module's own ports.
const rosterService = createRosterService({ memberships: membershipService, members: memberService, disciplines: disciplineService });
// Reports read income through their own port; the daily cash count takes its expected totals from the reports.
const reportService = createReportService({
  income: createPaymentIncomeSource(paymentRepository),
  members: memberService,
  disciplines: disciplineService,
});
const cashCountRepository = createJsonCashCountRepository(cashCountsFilePath());
const cashCountService = createCashCountService({
  repository: cashCountRepository,
  revenue: reportService,
  audit: auditService,
});
// Debt notices read the four sources once per request and prepare wa.me links; a Business API sender can replace the sender later.
const noticeService = createNoticeService({
  members: memberService,
  memberships: membershipService,
  payments: paymentRepository,
  pricing: pricingConfigService,
  sender: createWaMeSender(),
});
// The entrance check reads the same four sources once per request and answers green, yellow or red.
const accessService = createAccessService({
  members: memberService,
  memberships: membershipService,
  payments: paymentRepository,
  pricing: pricingConfigService,
});
// The daily backup copies the data files to BACKUP_DIR (an external drive, or backend/backups); see docs/backup-restore.md.
const backup = backupDirectory();
const backupService = createBackupService({
  sources: backupSources(),
  destination: backup.path,
  isDefaultDestination: backup.isDefault,
  audit: auditService,
});
// Face profiles live in PostgreSQL; without a database the routes answer 503 faces_unavailable.
const faceService = pool
  ? createFaceService({ repository: createPgFaceRepository(pool), members: memberService, access: accessService, audit: auditService })
  : undefined;
const app = createApp({ faceService, facesUnavailable: !pool, memberService, disciplineService, membershipService, pricingConfigService, paymentService, reportService, cashCountService, rosterService, noticeService, accessService, auditService, backupService, userRepository });

// Pending migrations run before the server listens; a failing one is fatal, so a half-migrated database never serves.
const migrated = pool
  ? runMigrations(pool).then((applied) => { if (applied.length > 0) console.log(`Applied ${applied.length} database migration(s)`); })
  : Promise.resolve();

migrated.then(() => bootstrap({
  memberService,
  membershipService,
  today: () => toIsoDate(new Date()),
  listen: () => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      // Checks now and then every hour; a copy is made when the last good one is a day old.
      startBackupScheduler({ service: backupService });
    });
  },
  log: (message, error) => console.error(message, error),
})).catch((error: unknown) => {
  // Anything bootstrap does not degrade on (an unreadable members file, a throwing listen) is fatal.
  console.error('Server failed to start', error);
  process.exit(1);
});
