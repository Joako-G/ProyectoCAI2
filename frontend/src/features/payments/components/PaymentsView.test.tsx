import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { buildMember, jsonResponse } from '../../members/test/fixtures';
import { buildAccount, buildCharge, buildPayment } from '../test/fixtures';
import { PaymentsView } from './PaymentsView';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Handler = () => Response | Promise<Response>;

const failure = (status: number, message: string): Handler => () => jsonResponse({ error: 'error', message }, status);

const issued = buildPayment({ id: 'pay-2', receiptNumber: 8, paymentDate: '2026-10-26', lines: buildCharge().lines, total: 76000 });

/** Routes every request by `METHOD url`; a request nobody expects fails the test loudly. */
function stubApi(overrides: Record<string, Handler> = {}) {
  const routes: Record<string, Handler> = {
    'GET /api/members?search=30123456': () => jsonResponse([buildMember()]),
    'GET /api/disciplines': () => jsonResponse([buildDiscipline()]),
    'GET /api/payments/members/member-1/account': () => jsonResponse(buildAccount()),
    'GET /api/payments/members/member-1': () => jsonResponse([buildPayment()]),
    'POST /api/payments/preview': () => jsonResponse(buildCharge()),
    'POST /api/payments': () => jsonResponse(issued, 201),
    'POST /api/payments/pay-1/annul': () => jsonResponse(buildPayment({ annulment: { reason: 'Cobro duplicado', annulledBy: 'user-1', annulledAt: '2026-10-26T15:00:00.000Z' } })),
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

const callsTo = (fetchMock: ReturnType<typeof stubApi>, key: string) =>
  fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}` === key);

const bodyOf = (fetchMock: ReturnType<typeof stubApi>, key: string) =>
  JSON.parse(String(callsTo(fetchMock, key)[0]?.[1]?.body));

const ACCOUNT = 'GET /api/payments/members/member-1/account';
const HISTORY = 'GET /api/payments/members/member-1';

async function searchByDni(user: ReturnType<typeof userEvent.setup>, dni = '30123456') {
  await user.type(screen.getByLabelText('DNI del socio'), dni);
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
}

async function openMember(props: { canCollect?: boolean; canAnnul?: boolean } = {}) {
  const user = userEvent.setup();
  render(<PaymentsView canCollect={props.canCollect ?? true} canAnnul={props.canAnnul ?? false} />);
  await searchByDni(user);
  await screen.findByRole('region', { name: 'Socio' });
  return user;
}

const formRegion = () => screen.getByRole('region', { name: 'Registrar cobro' });

async function previewAll(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(formRegion()).getByRole('button', { name: 'Calcular total' }));
  return screen.findByRole('table', { name: 'Detalle del cobro' });
}

describe('PaymentsView search', () => {
  it('shows the member, the standing and every owed concept with its discipline name after searching by DNI', async () => {
    const fetchMock = stubApi();
    await openMember();

    const member = screen.getByRole('region', { name: 'Socio' });
    expect(within(member).getByRole('heading', { name: 'Lucía Ríos' })).toBeInTheDocument();
    expect(member).toHaveTextContent('N° 0001');
    expect(member).toHaveTextContent('DNI 30123456');
    const account = await screen.findByRole('region', { name: 'Estado de cuenta' });
    expect(account).toHaveTextContent('Deudor');
    expect(account).toHaveTextContent('2 meses adeudados');
    const form = within(await screen.findByRole('region', { name: 'Registrar cobro' }));
    for (const name of ['Cuota social 09/2026', 'Cuota de Básquet 09/2026', 'Cuota social 10/2026', 'Cuota de Básquet 10/2026']) {
      expect(form.getByRole('checkbox', { name })).toBeChecked();
    }
    expect(form.getByRole('checkbox', { name: 'Inscripción (socio nuevo)' })).not.toBeChecked();
    expect(form.getByRole('checkbox', { name: 'Reposición de carnet' })).not.toBeChecked();
    expect(fetchMock).toHaveBeenCalledWith('/api/members?search=30123456', expect.anything());
  });

  it('does not search for a blank DNI', async () => {
    const fetchMock = stubApi();
    render(<PaymentsView canCollect canAnnul={false} />);

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says when no member matches', async () => {
    stubApi({ 'GET /api/members?search=999': () => jsonResponse([]) });
    const user = userEvent.setup();
    render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(user, '999');

    expect(await screen.findByText('No se encontró ningún socio con ese DNI.')).toBeInTheDocument();
  });

  it('lets the user choose among several matches', async () => {
    stubApi({ 'GET /api/members?search=3012': () => jsonResponse([buildMember(), buildMember({ id: 'member-2', memberNumber: '0002', firstName: 'Ana', lastName: 'Paz', dni: '30123999' })]) });
    const user = userEvent.setup();
    render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(user, '3012');

    expect(screen.queryByRole('region', { name: 'Socio' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Lucía Ríos/ }));
    expect(await screen.findByRole('region', { name: 'Socio' })).toHaveTextContent('Lucía Ríos');
  });

  it('shows a Spanish error when the search fails, never the backend text', async () => {
    stubApi({ 'GET /api/members?search=30123456': failure(500, 'Internal failure') });
    const user = userEvent.setup();
    render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servidor no pudo completar la consulta.');
    expect(alert).not.toHaveTextContent('Internal failure');
  });
});

describe('PaymentsView account states', () => {
  it('shows a loading state while the account is read', async () => {
    let release: () => void = () => {};
    stubApi({
      'GET /api/payments/members/member-1/account': () => new Promise<Response>((resolve) => { release = () => resolve(jsonResponse(buildAccount())); }),
    });
    const user = userEvent.setup();
    render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(user);

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando cuenta…');
    release();
    expect(await screen.findByRole('region', { name: 'Registrar cobro' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the account cannot be read', async () => {
    let attempts = 0;
    stubApi({ [ACCOUNT]: () => (++attempts === 1 ? failure(500, 'Boom')() : jsonResponse(buildAccount())) });
    const user = userEvent.setup();
    render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar la cuenta del socio.');
    expect(alert).not.toHaveTextContent('Boom');
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Registrar cobro' })).toBeInTheDocument();
  });

  it('shows an up-to-date member with nothing owed and an empty history', async () => {
    stubApi({
      [ACCOUNT]: () => jsonResponse(buildAccount({ standing: 'up_to_date', unpaidPeriodCount: 0, owed: [] })),
      [HISTORY]: () => jsonResponse([]),
    });
    await openMember();

    expect(await screen.findByRole('region', { name: 'Estado de cuenta' })).toHaveTextContent('Al día');
    expect(screen.getByText('No hay conceptos adeudados.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
    expect(within(formRegion()).getByRole('button', { name: 'Calcular total' })).toBeDisabled();
  });

  it('blocks an inactive member: it cannot pay and no form is offered', async () => {
    stubApi({
      'GET /api/members?search=30123456': () => jsonResponse([buildMember({ status: 'inactive' })]),
      [ACCOUNT]: () => jsonResponse(buildAccount({ standing: 'deregistered', unpaidPeriodCount: 4 })),
    });
    await openMember();

    expect(await screen.findByRole('region', { name: 'Estado de cuenta' })).toHaveTextContent('Dado de baja');
    expect(screen.getByText('Este socio está dado de baja: no puede registrar pagos.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Registrar cobro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calcular total' })).not.toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Historial de pagos' })).toBeInTheDocument();
  });
});

describe('PaymentsView collecting', () => {
  it('shows the itemized charge with surcharge lines and the total before anything is registered', async () => {
    const fetchMock = stubApi();
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });

    const table = await previewAll(user);

    expect(within(table).getByText('Recargo por pago tardío de Básquet 09/2026')).toBeInTheDocument();
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toContain('Cuota social 09/2026$ 15.000');
    expect(table).toHaveTextContent('Total$ 76.000');
    expect(bodyOf(fetchMock, 'POST /api/payments/preview')).toEqual({
      memberId: 'member-1',
      concepts: buildAccount().owed.flatMap((entry) => entry.concepts),
    });
    expect(callsTo(fetchMock, 'POST /api/payments')).toHaveLength(0);
    expect(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' })).toBeDisabled();
  });

  it('drops the preview when the selection changes, so a stale total can never be confirmed', async () => {
    stubApi();
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });
    await previewAll(user);

    await user.click(within(formRegion()).getByRole('checkbox', { name: 'Cuota social 10/2026' }));

    expect(screen.queryByRole('table', { name: 'Detalle del cobro' })).not.toBeInTheDocument();
  });

  it('registers with only what is being paid, never an amount, and shows the printable receipt', async () => {
    const fetchMock = stubApi();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });
    await previewAll(user);

    await user.click(within(formRegion()).getByRole('radio', { name: 'Efectivo' }));
    await user.click(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' }));

    const receipt = await screen.findByRole('region', { name: 'Comprobante' });
    expect(receipt).toHaveTextContent('Comprobante N° 8');
    expect(receipt).toHaveTextContent('26/10/2026');
    expect(receipt).toHaveTextContent('Lucía Ríos');
    expect(receipt).toHaveTextContent('Efectivo');
    expect(receipt).toHaveTextContent('Recargo por pago tardío de Básquet 09/2026');
    expect(receipt).toHaveTextContent('Total$ 76.000');
    const sent = bodyOf(fetchMock, 'POST /api/payments');
    expect(sent).toEqual({ memberId: 'member-1', concepts: buildAccount().owed.flatMap((entry) => entry.concepts), method: 'cash' });
    expect(String(callsTo(fetchMock, 'POST /api/payments')[0][1]?.body)).not.toMatch(/amount|total/i);
    expect(callsTo(fetchMock, ACCOUNT)).toHaveLength(2);
    expect(callsTo(fetchMock, HISTORY)).toHaveLength(2);

    await user.click(within(receipt).getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('adds the registration and the carnet replacement only when explicitly ticked', async () => {
    const fetchMock = stubApi();
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });

    await user.click(within(formRegion()).getByRole('checkbox', { name: 'Inscripción (socio nuevo)' }));
    await user.click(within(formRegion()).getByRole('checkbox', { name: 'Reposición de carnet' }));
    await previewAll(user);
    await user.click(within(formRegion()).getByRole('radio', { name: 'QR' }));
    await user.click(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' }));
    await screen.findByRole('region', { name: 'Comprobante' });

    const owed = buildAccount().owed.flatMap((entry) => entry.concepts);
    const expected = { memberId: 'member-1', concepts: [...owed, { kind: 'enrollment' }, { kind: 'carnetReplacement' }], registration: {} };
    expect(bodyOf(fetchMock, 'POST /api/payments/preview')).toEqual(expected);
    expect(bodyOf(fetchMock, 'POST /api/payments')).toEqual({ ...expected, method: 'qr' });
  });

  it('explains an already paid concept in Spanish and re-reads the account', async () => {
    let reads = 0;
    const fetchMock = stubApi({
      [ACCOUNT]: () => jsonResponse(++reads === 1 ? buildAccount() : buildAccount({ unpaidPeriodCount: 1, owed: [buildAccount().owed[1]] })),
      'POST /api/payments': failure(409, 'Already paid: socialFee:2026-09'),
    });
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });
    await previewAll(user);
    await user.click(within(formRegion()).getByRole('radio', { name: 'Débito' }));
    await user.click(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' }));

    const alert = await within(formRegion()).findByRole('alert');
    expect(alert).toHaveTextContent('Alguno de los conceptos ya está pagado.');
    expect(alert).not.toHaveTextContent('Already paid');
    expect(screen.queryByRole('region', { name: 'Comprobante' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, ACCOUNT)).toHaveLength(2);
    expect(within(formRegion()).queryByRole('checkbox', { name: 'Cuota social 09/2026' })).not.toBeInTheDocument();
  });

  it('never claims a payment was saved when the connection failed, and re-reads the account', async () => {
    const fetchMock = stubApi({ 'POST /api/payments': () => { throw new TypeError('Failed to fetch'); } });
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });
    await previewAll(user);
    await user.click(within(formRegion()).getByRole('radio', { name: 'Efectivo' }));
    await user.click(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' }));

    const alert = await within(formRegion()).findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.queryByRole('region', { name: 'Comprobante' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, ACCOUNT)).toHaveLength(2);
  });

  it('keeps the receipt and says the payment was registered when only the re-read fails', async () => {
    let reads = 0;
    stubApi({ [ACCOUNT]: () => (++reads === 1 ? jsonResponse(buildAccount()) : failure(500, 'Boom')()) });
    const user = await openMember();
    await screen.findByRole('region', { name: 'Registrar cobro' });
    await previewAll(user);
    await user.click(within(formRegion()).getByRole('radio', { name: 'Efectivo' }));
    await user.click(within(formRegion()).getByRole('button', { name: 'Confirmar cobro' }));

    expect(await screen.findByRole('region', { name: 'Comprobante' })).toBeInTheDocument();
    expect(await screen.findByText('El pago se registró, pero no se pudo actualizar la cuenta. Reintentá para ver los datos al día.')).toBeInTheDocument();
  });

  it('offers no collecting controls without payments:collect but still lists what is owed', async () => {
    stubApi();
    await openMember({ canCollect: false });

    await screen.findByRole('region', { name: 'Estado de cuenta' });
    expect(screen.queryByRole('region', { name: 'Registrar cobro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Conceptos adeudados' })).toHaveTextContent('Cuota de Básquet 09/2026');
  });
});

describe('PaymentsView history and annulment', () => {
  const annulledHistory = [buildPayment({ annulment: { reason: 'Cobro duplicado', annulledBy: 'user-1', annulledAt: '2026-10-26T15:00:00.000Z' } })];

  it('lists each payment with receipt, date, total, method and status', async () => {
    stubApi({ [HISTORY]: () => jsonResponse([buildPayment(), buildPayment({ id: 'pay-0', receiptNumber: 3, method: 'transfer', total: 9000, annulment: { reason: 'x', annulledBy: 'u', annulledAt: '2026-08-21T10:00:00.000Z' } })]) });
    await openMember();

    const rows = within(await screen.findByRole('region', { name: 'Historial de pagos' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').slice(0, 5).map((cell) => cell.textContent))).toEqual([
      ['7', '20/08/2026', '$ 15.000', 'Efectivo', 'Vigente'],
      ['3', '20/08/2026', '$ 9.000', 'Transferencia', 'Anulado'],
    ]);
  });

  it('shows Anular only with payments:annul and never on an annulled payment', async () => {
    stubApi({ [HISTORY]: () => jsonResponse([buildPayment(), buildPayment({ id: 'pay-0', receiptNumber: 3, annulment: { reason: 'x', annulledBy: 'u', annulledAt: '2026-08-21T10:00:00.000Z' } })]) });
    const first = render(<PaymentsView canCollect canAnnul={false} />);
    await searchByDni(userEvent.setup());
    await screen.findByRole('region', { name: 'Historial de pagos' });
    expect(screen.queryByRole('button', { name: /Anular/ })).not.toBeInTheDocument();
    first.unmount();

    render(<PaymentsView canCollect canAnnul />);
    await searchByDni(userEvent.setup());
    expect(await screen.findByRole('button', { name: 'Anular comprobante 7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular comprobante 3' })).not.toBeInTheDocument();
  });

  it('requires a reason, then annuls and refreshes the account and the history', async () => {
    let reads = 0;
    const fetchMock = stubApi({ [HISTORY]: () => jsonResponse(++reads === 1 ? [buildPayment()] : annulledHistory) });
    const user = await openMember({ canAnnul: true });
    await user.click(await screen.findByRole('button', { name: 'Anular comprobante 7' }));

    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    expect(await screen.findByText('Indique el motivo de la anulación.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST /api/payments/pay-1/annul')).toHaveLength(0);

    await user.type(screen.getByLabelText('Motivo de la anulación'), '  Cobro duplicado ');
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    expect(await screen.findByText('Anulado')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST /api/payments/pay-1/annul')).toEqual({ reason: 'Cobro duplicado' });
    expect(callsTo(fetchMock, ACCOUNT)).toHaveLength(2);
    expect(callsTo(fetchMock, HISTORY)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Anular comprobante 7' })).not.toBeInTheDocument();
  });

  it('explains in Spanish that a payment was already annulled and re-reads', async () => {
    const fetchMock = stubApi({ 'POST /api/payments/pay-1/annul': failure(409, 'Payment is already annulled') });
    const user = await openMember({ canAnnul: true });
    await user.click(await screen.findByRole('button', { name: 'Anular comprobante 7' }));
    await user.type(screen.getByLabelText('Motivo de la anulación'), 'Error');
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    const alert = await within(screen.getByRole('region', { name: 'Historial de pagos' })).findByRole('alert');
    expect(alert).toHaveTextContent('El pago ya estaba anulado.');
    expect(alert).not.toHaveTextContent('already annulled');
    expect(callsTo(fetchMock, HISTORY)).toHaveLength(2);
  });

  it('opens the receipt of a past payment so it can be printed again', async () => {
    stubApi();
    const user = await openMember();
    await user.click(await screen.findByRole('button', { name: 'Ver comprobante 7' }));

    expect(await screen.findByRole('region', { name: 'Comprobante' })).toHaveTextContent('Comprobante N° 7');
  });
});
