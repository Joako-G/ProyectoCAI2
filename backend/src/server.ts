import { createApp } from './app.js';
import {
  auditFilePath,
  cashCountsFilePath,
  disciplinesFilePath,
  membershipsFilePath,
  membersFilePath,
  paymentsFilePath,
  pricingConfigFilePath,
} from './config/paths.js';
import { createAuditService } from './modules/audit/audit.service.js';
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
// The audit log snapshots each actor's name and role from the users repository, which the app shares.
const userRepository = new UserRepository(defaultUsersFilePath);
const auditService = createAuditService({
  repository: createJsonAuditRepository(auditFilePath()),
  actors: { find: (id) => userRepository.list().find((user) => user.id === id) },
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
const cashCountService = createCashCountService({
  repository: createJsonCashCountRepository(cashCountsFilePath()),
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
const app = createApp({ memberService, disciplineService, membershipService, pricingConfigService, paymentService, reportService, cashCountService, rosterService, noticeService, auditService, userRepository });

bootstrap({
  memberService,
  membershipService,
  today: () => toIsoDate(new Date()),
  listen: () => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  },
  log: (message, error) => console.error(message, error),
}).catch((error: unknown) => {
  // Anything bootstrap does not degrade on (an unreadable members file, a throwing listen) is fatal.
  console.error('Server failed to start', error);
  process.exit(1);
});
