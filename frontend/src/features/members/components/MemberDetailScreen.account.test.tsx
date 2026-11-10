import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { Member } from '../types/member';
import { MemberDetailScreen } from './MemberDetailScreen';

afterEach(() => vi.unstubAllGlobals());

const ACCOUNT_URL = '/api/payments/members/member-1/account';

function account(standing: string, unpaidPeriodCount: number) {
  return { memberId: 'member-1', asOf: '2026-10-05', standing, unpaidPeriodCount, owed: [], enrollmentAvailable: false };
}

function stubApi(member: Member, accountResponse: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string) => (url === ACCOUNT_URL ? accountResponse() : jsonResponse(member)));
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

const accountCalls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.filter(([url]) => url === ACCOUNT_URL);

describe('MemberDetailScreen account card', () => {
  it('shows the standing and the unpaid months, with the link to Cobros searched by DNI', async () => {
    stubApi(buildMember(), () => jsonResponse(account('debtor', 2)));
    renderScreen({ canReadPayments: true });

    const card = await screen.findByRole('region', { name: 'Cuenta' });
    expect(await within(card).findByText('Debe')).toBeInTheDocument();
    expect(within(card).getByText('2 meses adeudados')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Cobrar cuota' })).toHaveAttribute('href', '/cobros?dni=30123456');
  });

  it('says al día without a month count', async () => {
    stubApi(buildMember(), () => jsonResponse(account('up_to_date', 0)));
    renderScreen({ canReadPayments: true });

    const card = await screen.findByRole('region', { name: 'Cuenta' });
    expect(await within(card).findByText('Al día')).toBeInTheDocument();
    expect(within(card).queryByText(/adeudad/)).not.toBeInTheDocument();
  });

  it('names a deregistered account as vencida', async () => {
    stubApi(buildMember(), () => jsonResponse(account('deregistered', 5)));
    renderScreen({ canReadPayments: true });

    const card = await screen.findByRole('region', { name: 'Cuenta' });
    expect(await within(card).findByText('Vencido')).toBeInTheDocument();
  });

  it('is hidden, and never reads the account, without payments:read', async () => {
    const fetchMock = stubApi(buildMember(), () => jsonResponse(account('debtor', 1)));
    renderScreen({ canReadPayments: false });

    await screen.findByRole('heading', { level: 2, name: 'Lucía Ríos' });
    expect(screen.queryByRole('region', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(accountCalls(fetchMock)).toHaveLength(0);
  });

  it('reports a failed read in one short line and keeps the record usable', async () => {
    stubApi(buildMember(), () => jsonResponse({ error: 'internal_error', message: 'Boom' }, 500));
    renderScreen({ canReadPayments: true });

    expect(await screen.findByText('El servidor no pudo completar la consulta.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lucía Ríos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('shows no account for an inactive member', async () => {
    const fetchMock = stubApi(buildMember({ status: 'inactive', deactivation: { date: '2026-10-01', reason: 'Baja voluntaria' } }), () => jsonResponse(account('debtor', 1)));
    renderScreen({ canReadPayments: true });

    await screen.findByText('Baja registrada');
    expect(screen.queryByRole('region', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(accountCalls(fetchMock)).toHaveLength(0);
  });
});
