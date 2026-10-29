import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import { buildMember, jsonResponse } from '../../members/test/fixtures';
import { buildPayment } from '../../payments/test/fixtures';
import type { Charge } from '../../payments/types/payment';
import { EnrollmentScreen } from './EnrollmentScreen';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TODAY = '2026-10-05';
const catalog: DisciplineCatalog = {
  state: { phase: 'ready', disciplines: [buildDiscipline(), buildDiscipline({ id: 'disc-2', name: 'Vóley' })] },
  retry: vi.fn(),
};

const CHARGE: Charge = {
  lines: [
    { kind: 'enrollment', period: '2026-10', amount: 20000 },
    { kind: 'socialFee', period: '2026-10', amount: 20000 },
    { kind: 'activityFee', period: '2026-10', disciplineId: 'disc-1', amount: 20000, prorated: false },
  ],
  total: 60000,
};

type Handler = (init?: RequestInit) => Response | Promise<Response>;

function stubApi(overrides: Record<string, Handler> = {}) {
  const routes: Record<string, Handler> = {
    'GET /api/members?search=30123456': () => jsonResponse([]),
    'POST /api/payments/enrollment-preview': () => jsonResponse(CHARGE),
    'POST /api/members': () => jsonResponse(buildMember({ id: 'member-9', memberNumber: '0009' }), 201),
    'POST /api/payments': () => jsonResponse(buildPayment({ id: 'pay-9' }), 201),
    ...overrides,
  };
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url)}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const keysOf = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`);
const callsTo = (fetchMock: ReturnType<typeof stubApi>, key: string) =>
  fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}` === key);

function setup() {
  const props = { today: TODAY, catalog, onSaved: vi.fn(), onCancel: vi.fn() };
  const user = userEvent.setup({ delay: null });
  render(<EnrollmentScreen {...props} />);
  return { user, ...props };
}

type User = ReturnType<typeof userEvent.setup>;

async function fillData(user: User) {
  await user.type(screen.getByLabelText('Nombre'), 'Lucía');
  await user.type(screen.getByLabelText('Apellido'), 'Ríos');
  await user.type(screen.getByLabelText('DNI'), '30123456');
  await user.type(screen.getByLabelText('Fecha de nacimiento'), '1990-03-15');
  await user.selectOptions(screen.getByLabelText('Categoría'), 'Mayor');
  await user.type(screen.getByLabelText('WhatsApp'), '1155551234');
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Continuar' }));

async function reachDisciplines(user: User) {
  await fillData(user);
  await next(user);
  await screen.findByRole('checkbox', { name: 'Básquet' });
}

async function reachPayment(user: User) {
  await reachDisciplines(user);
  await user.click(screen.getByRole('checkbox', { name: 'Básquet' }));
  await next(user);
  await screen.findByRole('table', { name: 'Detalle del cobro' });
}

describe('EnrollmentScreen: steps', () => {
  it('starts with the personal data only and always offers Cancelar', async () => {
    const { user, onCancel } = setup();

    expect(screen.getByText('Paso 1 de 3 · Datos')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Básquet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('validates the data before moving on', async () => {
    const { user } = setup();
    await next(user);

    expect(screen.getByText('Ingresá el nombre.')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 3 · Datos')).toBeInTheDocument();
  });

  it('keeps Cancelar on every step', async () => {
    stubApi();
    const { user } = setup();

    await reachDisciplines(user);
    expect(screen.getByText('Paso 2 de 3 · Disciplinas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: 'Básquet' }));
    await next(user);
    await screen.findByRole('table', { name: 'Detalle del cobro' });
    expect(screen.getByText('Paso 3 de 3 · Cobro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('asks for at least one discipline before the payment step', async () => {
    stubApi();
    const { user } = setup();
    await reachDisciplines(user);
    await next(user);

    expect(screen.getByText('Elegí al menos una disciplina.')).toBeInTheDocument();
    expect(screen.getByText('Paso 2 de 3 · Disciplinas')).toBeInTheDocument();
  });

  it('keeps what was entered when going back and forth', async () => {
    stubApi();
    const { user } = setup();
    await reachPayment(user);

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('checkbox', { name: 'Básquet' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Vóley' }));

    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Lucía');
    expect(screen.getByLabelText('Apellido')).toHaveValue('Ríos');
    expect(screen.getByLabelText('DNI')).toHaveValue('30123456');
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('1990-03-15');
    expect(screen.getByLabelText('Categoría')).toHaveValue('Mayor');
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('1155551234');

    await next(user);
    // The disciplines changed on the way back, so both are still ticked, including the one added later.
    expect(await screen.findByRole('checkbox', { name: 'Básquet' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vóley' })).toBeChecked();
  });

  it('refuses a DNI that already belongs to a member before any money is taken', async () => {
    const fetchMock = stubApi({ 'GET /api/members?search=30123456': () => jsonResponse([buildMember()]) });
    const { user } = setup();
    await fillData(user);
    await next(user);

    expect(await screen.findByText('Ya existe un socio con ese DNI.')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 3 · Datos')).toBeInTheDocument();
    expect(keysOf(fetchMock)).not.toContain('POST /api/members');
  });
});

describe('EnrollmentScreen: collecting and creating', () => {
  it('shows what to collect, and saves nothing until Crear socio is pressed', async () => {
    const fetchMock = stubApi();
    const { user } = setup();
    await reachPayment(user);

    const table = screen.getByRole('table', { name: 'Detalle del cobro' });
    expect(within(table).getByRole('row', { name: /Total.*60\.000/ })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST /api/payments/enrollment-preview')).toHaveLength(1);
    expect(JSON.parse(String(callsTo(fetchMock, 'POST /api/payments/enrollment-preview')[0]![1]!.body))).toEqual({ disciplineIds: ['disc-1'] });
    expect(keysOf(fetchMock)).not.toContain('POST /api/members');
    expect(screen.getByRole('button', { name: 'Crear socio' })).toBeDisabled();
  });

  it('creates the member first and then collects, in that order, with the concepts the server priced', async () => {
    const fetchMock = stubApi();
    const { user, onSaved } = setup();
    await reachPayment(user);

    await user.click(screen.getByRole('radio', { name: 'Efectivo' }));
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0]![0]).toMatchObject({ id: 'member-9' });

    const writes = keysOf(fetchMock).filter((key) => key.startsWith('POST /api/members') || key === 'POST /api/payments');
    expect(writes).toEqual(['POST /api/members', 'POST /api/payments']);

    const member = JSON.parse(String(callsTo(fetchMock, 'POST /api/members')[0]![1]!.body));
    expect(member).toMatchObject({ dni: '30123456', disciplineIds: ['disc-1'] });
    const payment = JSON.parse(String(callsTo(fetchMock, 'POST /api/payments')[0]![1]!.body));
    expect(payment).toMatchObject({
      memberId: 'member-9',
      method: 'cash',
      registration: {},
      concepts: [{ kind: 'enrollment' }, { kind: 'socialFee', period: '2026-10' }, { kind: 'activityFee', period: '2026-10', disciplineId: 'disc-1' }],
    });
    expect(payment.requestId).toEqual(expect.any(String));
  });

  it('does not collect anything when the member cannot be created, and goes back to the DNI', async () => {
    const fetchMock = stubApi({ 'POST /api/members': () => jsonResponse({ error: 'conflict', message: 'A member with this DNI already exists' }, 409) });
    const { user, onSaved } = setup();
    await reachPayment(user);

    await user.click(screen.getByRole('radio', { name: 'Efectivo' }));
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(await screen.findByText('Ya existe un socio con ese DNI.')).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 3 · Datos')).toBeInTheDocument();
    expect(keysOf(fetchMock)).not.toContain('POST /api/payments');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('when the collection fails after the member was saved, says so and retries only the payment with the same key', async () => {
    let attempts = 0;
    const fetchMock = stubApi({
      'POST /api/payments': () => (++attempts === 1 ? jsonResponse({ error: 'boom', message: 'x' }, 500) : jsonResponse(buildPayment({ id: 'pay-9' }), 201)),
    });
    const { user, onSaved } = setup();
    await reachPayment(user);

    await user.click(screen.getByRole('radio', { name: 'Efectivo' }));
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(await screen.findByText(/El socio se guardó/)).toBeInTheDocument();
    expect(screen.getByText(/0009/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reintentar cobro' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(callsTo(fetchMock, 'POST /api/members')).toHaveLength(1);
    const [first, second] = callsTo(fetchMock, 'POST /api/payments').map(([, init]) => JSON.parse(String(init!.body)));
    expect(second.requestId).toBe(first.requestId);
  });
});
