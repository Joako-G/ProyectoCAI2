import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../../members/test/fixtures';
import { buildPayment } from '../../payments/test/fixtures';
import { buildAccessCheck } from '../test/fixtures';
import { createFakeSource, FakeSource } from '../test/fake-source';
import type { EntriesDay } from '../types/entries';
import type { GreetingEvent } from '../types/greeting';
import { AccessPage } from './AccessPage';

beforeEach(() => {
  FakeSource.all = [];
});
afterEach(() => vi.unstubAllGlobals());

const day: EntriesDay = {
  date: '2026-11-08',
  count: 2,
  distinctMembers: 2,
  counts: { entered: 5, warned: 2, refused: 1 },
  entries: [
    { id: 'e2', checkedAt: '2026-11-08T15:30:00.000Z', memberNumber: '1198', name: 'Rocío Ferreyra', method: 'face', result: 'red' },
    { id: 'e1', checkedAt: '2026-11-08T13:05:00.000Z', memberNumber: '1042', name: 'Valentina Ríos', method: 'dni', result: 'green' },
  ],
};

const identified = { id: 'member-1', memberNumber: '1042', fullName: 'Valentina Ríos', firstName: 'Valentina', disciplines: ['Natación', 'Gimnasia artística'] };
const stored = buildMember({ id: 'member-1', memberNumber: '1042', dni: '57201998', birthDate: '2012-05-01', category: 'Cadete', memberSince: '2021-03-15' });
const payments = [
  buildPayment({ id: 'p3', paymentDate: '2026-11-07', annulment: { reason: 'x', annulledBy: 'u', annulledAt: '2026-11-07T20:00:00.000Z' } }),
  buildPayment({ id: 'p2', paymentDate: '2026-11-04' }),
  buildPayment({ id: 'p1', paymentDate: '2026-10-02' }),
];

type Handler = () => Response | Promise<Response>;

/** Routes every request by `METHOD url`; a request nobody expects fails the test loudly. */
function stubApi(overrides: Record<string, Handler> = {}) {
  const routes: Record<string, Handler> = {
    'GET /api/access/entries': () => jsonResponse(day),
    'POST /api/access/check': () => jsonResponse(buildAccessCheck()),
    'GET /api/members/member-1': () => jsonResponse(stored),
    'GET /api/payments/members/member-1': () => jsonResponse(payments),
    ...overrides,
  };
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(props: Partial<Parameters<typeof AccessPage>[0]> = {}) {
  return render(
    <MemoryRouter>
      <AccessPage createSource={createFakeSource} checkSession={async () => true} today="2026-11-08" streamGraceMs={60} {...props} />
    </MemoryRouter>,
  );
}

const upToDate: Partial<GreetingEvent> = { tone: 'welcome', kind: 'up_to_date', member: identified, firstName: 'Valentina', dueDate: '2027-01-10', paidThrough: '2026-12' };
const banner = () => screen.getByRole('status', { name: 'Último control' });
const input = () => screen.getByLabelText('DNI del socio');

describe('AccessPage: the door card', () => {
  it('shows the camera as the way in, with no camera toggle, and keeps the DNI field focused', () => {
    stubApi();
    renderPage();
    expect(screen.getByText('La cámara reconoce sola')).toBeInTheDocument();
    expect(screen.getByText('CÁMARA DE LA PUERTA')).toBeInTheDocument();
    expect(screen.getByText('Si no funciona, ingresá el DNI del socio.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cámara' })).not.toBeInTheDocument();
    expect(input()).toHaveFocus();
  });

  it('offers the searches in Socios and the public screen', () => {
    stubApi();
    renderPage();
    expect(screen.getByRole('link', { name: 'Buscar por N° socio' })).toHaveAttribute('href', '/socios');
    expect(screen.getByRole('link', { name: 'Buscar por nombre' })).toHaveAttribute('href', '/socios');
    const display = screen.getByRole('link', { name: 'Abrir pantalla pública' });
    expect(display).toHaveAttribute('href', '/pantalla-ingreso');
    expect(display).toHaveAttribute('target', '_blank');
  });

  it('says whether the live stream is connected', async () => {
    stubApi();
    renderPage();
    expect(screen.getByText('● CONECTADO')).toBeInTheDocument();
    FakeSource.latest().fail(false);
    expect(await screen.findByText('● RECONECTANDO')).toBeInTheDocument();
    FakeSource.latest().open();
    expect(await screen.findByText('● CONECTADO')).toBeInTheDocument();
  });
});

describe('AccessPage: the last control', () => {
  it('waits for the first control with a neutral banner and no member card', () => {
    stubApi();
    renderPage();
    expect(within(banner()).getByText('ÚLTIMO CONTROL')).toBeInTheDocument();
    expect(within(banner()).getByText('Esperando el primer control')).toBeInTheDocument();
    expect(banner()).toHaveAttribute('aria-live', 'polite');
    expect(banner()).toHaveAttribute('data-tone', 'neutral');
    expect(screen.queryByText('N° DE SOCIO')).not.toBeInTheDocument();
  });

  it('shows the banner and the member card of a face recognized by the door camera', async () => {
    stubApi();
    renderPage();
    FakeSource.latest().greet(upToDate);

    expect(await within(banner()).findByText('Acceso autorizado')).toBeInTheDocument();
    expect(banner()).toHaveAttribute('data-tone', 'green');
    expect(within(banner()).getByText('La cuota vence el 10/01/2027.')).toBeInTheDocument();
    expect(within(banner()).getByText('MÉTODO')).toBeInTheDocument();
    expect(within(banner()).getByText('Cámara')).toBeInTheDocument();
    expect(within(banner()).getByText('12:00')).toBeInTheDocument();

    const card = await screen.findByRole('region', { name: 'Socio identificado' });
    expect(within(card).getByText('Valentina Ríos')).toBeInTheDocument();
    expect(within(card).getByText('VR')).toBeInTheDocument();
    expect(within(card).getByText('1042')).toBeInTheDocument();
    expect(within(card).getByText('N° DE SOCIO')).toBeInTheDocument();
    // Loaded afterwards through the members and payments APIs; the last payment skips the annulled one.
    expect(await within(card).findByText('57.201.998')).toBeInTheDocument();
    expect(within(card).getByText('14 años · Cadete · Socio desde 03/2021')).toBeInTheDocument();
    expect(within(card).getByText('04/11/2026')).toBeInTheDocument();
    expect(within(card).getByText('10/01/2027')).toBeInTheDocument();
    expect(within(card).getByText('Al día')).toBeInTheDocument();
    expect(within(card).getByText('DISCIPLINAS')).toBeInTheDocument();
    expect(within(card).getByText('Natación')).toBeInTheDocument();
    expect(within(card).getByText('Gimnasia artística')).toBeInTheDocument();
    // Nothing the system does not have, and nothing that is not built.
    expect(screen.queryByText(/ASISTENCIAS/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar acceso' })).not.toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
  });

  it('opens Cobros with the member DNI and the member in Socios', async () => {
    stubApi();
    renderPage();
    FakeSource.latest().greet(upToDate);
    const card = await screen.findByRole('region', { name: 'Socio identificado' });
    await within(card).findByText('57.201.998');
    expect(within(card).getByRole('link', { name: 'Cobrar cuota' })).toHaveAttribute('href', '/cobros?dni=57201998');
    expect(within(card).getByRole('link', { name: 'Ver ficha completa' })).toHaveAttribute('href', '/socios?search=1042');
  });

  it('shows a dash for what could not be loaded and never blocks the banner', async () => {
    stubApi({
      'GET /api/members/member-1': () => jsonResponse({ error: 'x', message: 'x' }, 500),
      'GET /api/members?search=1042': () => jsonResponse({ error: 'x', message: 'x' }, 500),
      'GET /api/payments/members/member-1': () => jsonResponse({ error: 'x', message: 'x' }, 500),
    });
    renderPage();
    FakeSource.latest().greet(upToDate);

    expect(await within(banner()).findByText('Acceso autorizado')).toBeInTheDocument();
    const card = await screen.findByRole('region', { name: 'Socio identificado' });
    await waitFor(() => expect(within(card).getByRole('link', { name: 'Cobrar cuota' })).toBeInTheDocument());
    expect(within(card).getByText('Valentina Ríos')).toBeInTheDocument();
    expect(within(card).getByText('DNI').nextSibling).toHaveTextContent('—');
    expect(within(card).getByText('ÚLTIMO PAGO').nextSibling).toHaveTextContent('—');
    expect(within(card).getByRole('link', { name: 'Cobrar cuota' })).toHaveAttribute('href', '/cobros');
  });

  it('finds the member by number when the event carries a number instead of an id (HTTP fallback event)', async () => {
    const fetchMock = stubApi({
      'GET /api/members/1042': () => jsonResponse({ error: 'not_found', message: 'x' }, 404),
      'GET /api/members?search=1042': () => jsonResponse([buildMember({ id: 'other', memberNumber: '10420' }), stored]),
    });
    renderPage();
    FakeSource.latest().greet({ ...upToDate, member: { ...identified, id: '1042' } });
    expect(await screen.findByText('57.201.998')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/members/member-1', expect.anything());
  });

  it('shows the amber, red, gray and not-recognized cases with their own titles', async () => {
    stubApi();
    renderPage();
    const source = FakeSource.latest();
    source.greet({ tone: 'see_desk', kind: 'debtor', member: identified, debtSince: '2026-08' });
    expect(await within(banner()).findByText('Acceso autorizado · avisar')).toBeInTheDocument();
    expect(banner()).toHaveAttribute('data-tone', 'amber');
    expect(within(banner()).getByText('Tiene cuotas pendientes desde agosto 2026.')).toBeInTheDocument();
    expect(await screen.findByText('Debe desde agosto 2026')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    source.greet({ tone: 'see_desk', kind: 'deregistered', member: identified, debtSince: '2026-01' });
    expect(await within(banner()).findByText('Acceso no habilitado')).toBeInTheDocument();
    expect(banner()).toHaveAttribute('data-tone', 'red');

    source.greet({ tone: 'refused', kind: 'inactive', member: identified });
    expect(await within(banner()).findByText('Socio inactivo')).toBeInTheDocument();
    expect(banner()).toHaveAttribute('data-tone', 'gray');

    source.greet({ tone: 'refused', kind: 'not_recognized' });
    expect(await within(banner()).findByText('No reconocido')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Socio identificado' })).not.toBeInTheDocument();
  });
});

describe('AccessPage: the DNI check', () => {
  it('sends the DNI in the body, shows the answer that arrives through the stream and clears the field', async () => {
    const fetchMock = stubApi({ 'POST /api/access/check': () => jsonResponse(buildAccessCheck({ member: { memberNumber: '1', name: 'Otra Persona', unpaidPeriodCount: 0 } })) });
    const user = userEvent.setup();
    renderPage();

    await user.type(input(), '57201998');
    await user.click(screen.getByRole('button', { name: 'Controlar DNI' }));

    const [url, init] = fetchMock.mock.calls.find(([target]) => target === '/api/access/check')!;
    expect(url).toBe('/api/access/check');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ dni: '57201998' }) });
    await waitFor(() => expect(input()).toHaveValue(''));
    expect(input()).toHaveFocus();

    FakeSource.latest().greet({ ...upToDate, method: 'dni' });
    expect(await within(banner()).findByText('DNI')).toBeInTheDocument();
    expect(within(await screen.findByRole('region', { name: 'Socio identificado' })).getByText('Valentina Ríos')).toBeInTheDocument();
    // The HTTP answer names somebody else; the stream is the single source, so it never takes over.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByText('Otra Persona')).not.toBeInTheDocument();
  });

  it('answers from the HTTP response at once when the stream is down', async () => {
    stubApi({ 'POST /api/access/check': () => jsonResponse(buildAccessCheck({ result: 'yellow', reason: 'debtor', member: { memberNumber: '1042', name: 'Valentina Ríos', unpaidPeriodCount: 2, debtSince: '2026-09' } })) });
    const user = userEvent.setup();
    renderPage({ streamGraceMs: 60_000 });
    FakeSource.latest().fail(true);

    await user.type(input(), '57201998{Enter}');

    expect(await within(banner()).findByText('Acceso autorizado · avisar')).toBeInTheDocument();
    expect(within(banner()).getByText('DNI')).toBeInTheDocument();
    expect(within(banner()).getByText('Tiene cuotas pendientes desde septiembre 2026.')).toBeInTheDocument();
  });

  it('answers from the HTTP response after a moment when the stream is up but the event never arrives', async () => {
    stubApi();
    const user = userEvent.setup();
    renderPage({ streamGraceMs: 40 });

    await user.type(input(), '57201998{Enter}');
    expect(within(banner()).getByText('Esperando el primer control')).toBeInTheDocument();
    expect(await within(banner()).findByText('Acceso autorizado')).toBeInTheDocument();
    expect(within(banner()).getByText('DNI')).toBeInTheDocument();
  });

  it('does nothing for an empty field, and keeps what was typed after a failure', async () => {
    const fetchMock = stubApi({ 'POST /api/access/check': () => jsonResponse({ error: 'bad', message: 'x' }, 400) });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Controlar DNI' }));
    expect(fetchMock.mock.calls.filter(([target]) => target === '/api/access/check')).toHaveLength(0);

    await user.type(input(), '123{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingrese un DNI de 7 u 8 dígitos.');
    expect(input()).toHaveValue('123');
  });
});

describe('AccessPage: the day', () => {
  it('lists the day with a count, colored chips and no discipline column', async () => {
    stubApi();
    renderPage();
    expect(await screen.findByText('2 registros')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['HORA', 'N° SOCIO', 'SOCIO', 'MEDIO', 'RESULTADO']);
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['12:30', '1198', 'Rocío Ferreyra', 'Cámara', 'NO HABILITADO']);
    expect(within(rows[2]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['10:05', '1042', 'Valentina Ríos', 'DNI', 'AUTORIZADO']);
  });

  it('shows the three counters of the club today from the day counts', async () => {
    stubApi();
    renderPage();
    const card = await screen.findByRole('region', { name: 'Hoy en el club' });
    expect(within(card).getByText('HOY EN EL CLUB')).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByText('Accesos autorizados').nextSibling).toHaveTextContent('5'));
    expect(within(card).getByText('Con aviso de cuota').nextSibling).toHaveTextContent('2');
    expect(within(card).getByText('No habilitados').nextSibling).toHaveTextContent('1');
    expect(screen.queryByText('AVISO DEL DÍA')).not.toBeInTheDocument();
  });

  it('reads the entries again after every event, and not after a failed check', async () => {
    const fetchMock = stubApi({ 'POST /api/access/check': () => jsonResponse({ error: 'x', message: 'x' }, 500) });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('2 registros');
    const reads = () => fetchMock.mock.calls.filter(([target]) => target === '/api/access/entries').length;
    expect(reads()).toBe(1);

    FakeSource.latest().greet(upToDate);
    await waitFor(() => expect(reads()).toBe(2));

    await user.type(input(), '30111222{Enter}');
    await screen.findByText(/No se pudo verificar el DNI/);
    expect(reads()).toBe(2);
  });
});

describe('AccessPage: the session', () => {
  it('tells the secretary to sign in again when the session ended', async () => {
    stubApi();
    renderPage({ checkSession: async () => false });
    FakeSource.latest().fail(true);
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Sesión vencida: iniciá sesión en esta PC');
    expect(within(notice).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/ingreso');
  });
});
