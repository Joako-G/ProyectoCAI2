import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAccount, buildPayment } from '../../payments/test/fixtures';
import type { Payment } from '../../payments/types/payment';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { Member } from '../types/member';
import { MemberDetailScreen } from './MemberDetailScreen';

afterEach(() => vi.unstubAllGlobals());

const ACCOUNT_URL = '/api/payments/members/member-1/account';
const HISTORY_URL = '/api/payments/members/member-1';

function stubApi(member: Member, history: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === HISTORY_URL) return history();
    if (url === ACCOUNT_URL) return jsonResponse(buildAccount());
    return jsonResponse(member);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const catalog = { state: { phase: 'ready' as const, disciplines: [] }, retry: () => undefined };

function renderScreen(props: { canReadPayments?: boolean }) {
  render(
    <MemoryRouter>
      <MemberDetailScreen id="member-1" today="2026-10-05" catalog={catalog} canWrite onBack={() => undefined} onEdit={() => undefined} {...props} />
    </MemoryRouter>,
  );
}

const historyCalls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.filter(([url]) => url === HISTORY_URL);

describe('MemberDetailScreen payment history', () => {
  it('lists the payments newest first with receipt, date, detail, total, method and state', async () => {
    const older = buildPayment({ id: 'pay-1', receiptNumber: 7, paymentDate: '2026-08-20' });
    const newer: Payment = buildPayment({
      id: 'pay-2',
      receiptNumber: 9,
      paymentDate: '2026-09-18',
      method: 'transfer',
      lines: [{ kind: 'socialFee', period: '2026-09', amount: 16000 }],
      total: 16000,
    });
    stubApi(buildMember(), () => jsonResponse([older, newer]));
    renderScreen({ canReadPayments: true });

    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    const rows = await within(section).findAllByRole('row');
    // Header row first, then the newest payment, then the oldest.
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('9')).toBeInTheDocument();
    expect(within(rows[1]).getByText('18/09/2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Cuota social 09/2026')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Transferencia')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Vigente')).toBeInTheDocument();
    expect(within(rows[2]).getByText('7')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Efectivo')).toBeInTheDocument();
  });

  it('offers the receipt as a PDF download', async () => {
    stubApi(buildMember(), () => jsonResponse([buildPayment({ id: 'pay-1', receiptNumber: 7 })]));
    renderScreen({ canReadPayments: true });

    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    const link = await within(section).findByRole('link', { name: /Descargar PDF/ });
    expect(link).toHaveAttribute('href', '/api/payments/pay-1/receipt.pdf');
  });

  it('keeps an annulled payment visible, marked Anulado with its reason', async () => {
    const annulled = buildPayment({ annulment: { reason: 'Cobro duplicado', annulledBy: 'user-1', annulledAt: '2026-08-21T10:00:00.000Z' } });
    stubApi(buildMember(), () => jsonResponse([annulled]));
    renderScreen({ canReadPayments: true });

    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    expect(await within(section).findByText('Anulado')).toBeInTheDocument();
    expect(within(section).getByText('Motivo: Cobro duplicado')).toBeInTheDocument();
  });

  it('says there are no payments yet when the history is empty', async () => {
    stubApi(buildMember(), () => jsonResponse([]));
    renderScreen({ canReadPayments: true });

    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    expect(await within(section).findByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
    expect(within(section).queryByRole('table')).not.toBeInTheDocument();
  });

  it('also shows the history of an inactive member (RF-05, RF-06)', async () => {
    stubApi(buildMember({ status: 'inactive', deactivation: { date: '2026-10-01', reason: 'Baja voluntaria' } }), () => jsonResponse([buildPayment({ receiptNumber: 12 })]));
    renderScreen({ canReadPayments: true });

    await screen.findByText('Baja registrada');
    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    expect(await within(section).findByText('12')).toBeInTheDocument();
  });

  it('is hidden, and never reads the history, without payments:read', async () => {
    const fetchMock = stubApi(buildMember(), () => jsonResponse([buildPayment()]));
    renderScreen({ canReadPayments: false });

    await screen.findByRole('heading', { level: 2, name: 'Lucía Ríos' });
    expect(screen.queryByRole('region', { name: 'Historial de pagos' })).not.toBeInTheDocument();
    expect(historyCalls(fetchMock)).toHaveLength(0);
  });

  it('reports a failed read in one short line and keeps the record usable', async () => {
    stubApi(buildMember(), () => jsonResponse({ error: 'internal_error', message: 'Boom' }, 500));
    renderScreen({ canReadPayments: true });

    const section = await screen.findByRole('region', { name: 'Historial de pagos' });
    expect(await within(section).findByText('El servidor no pudo completar la consulta.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lucía Ríos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });
});
