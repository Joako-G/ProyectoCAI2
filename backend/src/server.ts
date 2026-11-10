import { createApp } from './app.js';
import {
  auditFilePath,
  backupDirectory,
  cashCountsFilePath,
  COMPOSE_FILE,
  disciplinesFilePath,
  expensesFilePath,
  membershipsFilePath,
  membersFilePath,
  paymentsFilePath,
  pricingConfigFilePath,
} from './config/paths.js';
import { databaseUrl } from './config/database.js';
import { runMigrations } from './database/migrate.js';
import { createPool } from './database/pool.js';
import { startFaces } from './modules/faces/faces.startup.js';
import { createExpenseService } from './modules/expenses/expense.service.js';
import { createJsonExpenseRepository } from './modules/expenses/json-expense.repository.js';
import { createFaceService } from './modules/faces/face.service.js';
import { createPgFaceRepository } from './modules/faces/pg-face.repository.js';
import { createEntriesService } from './modules/access/access.entries.js';
import { createAccessService } from './modules/access/access.service.js';
import { createEntranceRecorder } from './modules/access/entrance.js';
import type { EntryRepository } from './modules/access/entry.repository.js';
import { createGreetingBus } from './modules/access/greeting.bus.js';
import { createMemberDisciplineNames } from './modules/access/member-disciplines.js';
import { createPgEntryRepository } from './modules/access/pg-entry.repository.js';
import type { AuditLabelSources } from './modules/audit/audit.labels.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { startBackupScheduler } from './modules/backup/backup.scheduler.js';
import { createPgDumper } from './modules/backup/backup.dump.js';
import { createBackupService } from './modules/backup/backup.service.js';
import { backupSources } from './modules/backup/backup.sources.js';
import { createJsonAuditRepository } from './modules/audit/json-audit.repository.js';
import { UserRepository, defaultUsersFilePath } from './modules/users/user.repository.js';
import { createJsonPricingConfigRepository } from './modules/payments/json-pricing-config.repository.js';
import { createJsonPaymentRepository } from './modules/payments/json-payment.repository.js';
import { createPaymentService } from './modules/payments/payment.service.js';
import { createReceiptPdfService } from './modules/payments/receipt.service.js';
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
import { createMailer, createSmtpTransport } from './modules/notices/notice.mailer.js';
import { mailConfig } from './config/mail.js';
import { createPaymentIncomeSource } from './modules/reports/income.source.js';
import { createReportService } from './modules/reports/report.service.js';
import { createRosterService } from './modules/roster/roster.service.js';
import { createMemberSummaryService } from './modules/members/member-summary.service.js';
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
  // A deactivated member's face profile is deleted; the thunk runs later, once the face service exists (or never, without a database).
  lifecycle: { onMemberDeactivated: async (memberId, actorId) => faceService?.discardForDeactivatedMember(memberId, actorId) },
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
// The receipt PDF is rendered on demand from the stored receipt, its member and the discipline names.
const receiptPdfService = createReceiptPdfService({ payments: paymentService, members: memberService, disciplines: disciplineService });
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
const expenseService = createExpenseService({ repository: createJsonExpenseRepository(expensesFilePath()), audit: auditService });
// Debt notices read the four sources once per request and prepare wa.me links; a Business API sender can replace the sender later.
// The mailbox is optional: without SMTP_HOST and MAIL_FROM the welcome simply offers no email. Values are never logged.
const mail = mailConfig();
if (mail.state === 'invalid') console.warn(`Email sending is off: ${mail.problems.join('; ')}.`);
const noticeService = createNoticeService({
  members: memberService,
  memberships: membershipService,
  payments: paymentRepository,
  pricing: pricingConfigService,
  disciplines: disciplineService,
  sender: createWaMeSender(),
  mailer: mail.state === 'configured' ? createMailer(mail.config.from, createSmtpTransport(mail.config)) : undefined,
  receipts: receiptPdfService,
});
// The members screen's stat cards read the same four sources once per request.
const memberSummaryService = createMemberSummaryService({
  members: memberService,
  memberships: membershipService,
  payments: paymentRepository,
  pricing: pricingConfigService,
});
// Identified checks are logged in PostgreSQL. The repository exists only once the database is ready, so the recorder
// reaches it late: without a database, or until it is ready, a check is simply not logged and still answers.
let entryRepository: EntryRepository | undefined;
// The public display's greetings travel through memory and work without a database.
const greetings = createGreetingBus();
const entranceRecorder = createEntranceRecorder({ entries: { append: async (entry) => entryRepository?.append(entry) }, greetings });
// The entrance check reads the same four sources once per request and answers green, yellow or red.
const accessService = createAccessService({
  entrance: entranceRecorder,
  memberDisciplines: createMemberDisciplineNames({ memberships: membershipService, disciplines: disciplineService }),
  members: memberService,
  memberships: membershipService,
  payments: paymentRepository,
  pricing: pricingConfigService,
});
// The daily backup copies the data files, and the PostgreSQL dump when DATABASE_URL is set, to BACKUP_DIR (an external drive,
// or backend/backups); see docs/backup-restore.md.
const backup = backupDirectory();
const backupService = createBackupService({
  sources: backupSources(),
  database: connectionString ? createPgDumper({ connectionString, composeFile: COMPOSE_FILE }) : undefined,
  destination: backup.path,
  isDefaultDestination: backup.isDefault,
  audit: auditService,
});
// Face profiles live in PostgreSQL. The database is optional: without DATABASE_URL, or when it is down at start,
// the face routes answer 503 faces_unavailable until the server restarts and everything else runs as usual.
let faceService: ReturnType<typeof createFaceService> | undefined;
const facesReady = pool && connectionString
  ? startFaces({ migrate: () => runMigrations(pool), log: (message) => console.log(message), connectionString })
  : Promise.resolve(false);

facesReady.then((available) => {
  if (available && pool) {
    faceService = createFaceService({ repository: createPgFaceRepository(pool), members: memberService, access: accessService, audit: auditService, entrance: entranceRecorder });
    entryRepository = createPgEntryRepository(pool);
  }
  const accessEntries = entryRepository ? createEntriesService({ entries: entryRepository, members: memberService }) : undefined;
  const app = createApp({ faceService, facesUnavailable: !faceService, memberService, memberSummaryService, disciplineService, membershipService, pricingConfigService, paymentService, receiptPdfService, reportService, cashCountService, expenseService, rosterService, noticeService, accessService, accessEntries, greetings, auditService, backupService, userRepository });
  return bootstrap({
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
  });
}).catch((error: unknown) => {
  // Anything bootstrap does not degrade on (an unreadable members file, a throwing listen) is fatal.
  console.error('Server failed to start', error);
  process.exit(1);
});
