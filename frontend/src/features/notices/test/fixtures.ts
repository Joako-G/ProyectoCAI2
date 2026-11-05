import type { DebtNotice, DebtNoticeList } from '../types/notice';

export function buildNotice(overrides: Partial<DebtNotice> = {}): DebtNotice {
  return {
    memberId: 'member-1',
    memberNumber: '101',
    name: 'Lucía Prueba',
    standing: 'debtor',
    unpaidPeriodCount: 2,
    total: 80000,
    recipient: 'member',
    recipientName: 'Lucía Prueba',
    link: 'https://wa.me/5493815550101?text=Hola',
    numberIssue: false,
    ...overrides,
  };
}

export function buildNoticeList(rows: DebtNotice[] = [buildNotice()], asOf = '2026-11-01'): DebtNoticeList {
  return { asOf, rows };
}
