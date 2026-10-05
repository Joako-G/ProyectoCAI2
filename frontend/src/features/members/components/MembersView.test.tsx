import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { Member } from '../types/member';
import { MembersView } from './MembersView';

const TODAY = '2026-10-05';
const fetchMock = vi.fn<typeof fetch>();

interface Call {
  method: string;
  url: string;
  body?: unknown;
}

let members: Member[];
let calls: Call[];
/** Overrides for a `METHOD /path` key; return `undefined` to fall through to the default fake API. */
let overrides: Record<string, () => Response | Promise<Response>>;

function key(call: Call) {
  return `${call.method} ${call.url}`;
}

beforeEach(() => {
  members = [buildMember(), buildMember({ id: 'member-2', memberNumber: '0002', firstName: 'Ana', lastName: 'Álvarez', dni: '30222222' })];
  calls = [];
  overrides = {};
  fetchMock.mockImplementation(async (input, init) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const override = overrides[key(call)];
    if (override) return override();

    if (key(call).startsWith('GET /api/members?') || key(call) === 'GET /api/members') {
      return jsonResponse(members);
    }
    const byId = /^\/api\/members\/([^/]+)(\/\w+)?$/.exec(call.url);
    const member = members.find((candidate) => candidate.id === byId?.[1]);
    if (!member) return jsonResponse({ error: 'not_found', message: 'Member not found' }, 404);
    if (call.method === 'GET') return jsonResponse(member);
    if (call.method === 'PUT') return jsonResponse(Object.assign(member, call.body));
    if (byId?.[2] === '/deactivate') {
      return jsonResponse(
        Object.assign(member, {
          status: 'inactive',
          deactivation: { date: TODAY, reason: (call.body as { reason: string }).reason },
        }),
      );
    }
    if (byId?.[2] === '/reactivate') {
      member.status = 'active';
      delete member.deactivation;
      return jsonResponse(member);
    }
    return jsonResponse({ error: 'not_found', message: 'Route not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function renderView() {
  const user = userEvent.setup({ delay: null });
  render(<MembersView today={TODAY} />);
  return user;
}

function listCalls() {
  return calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/members?') || call.url === '/api/members' && call.method === 'GET');
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre'), 'Valentina');
  await user.type(screen.getByLabelText('Apellido'), 'Ferreyra');
  await user.type(screen.getByLabelText('DNI'), '39884120');
  await user.type(screen.getByLabelText('Fecha de nacimiento'), '1999-05-20');
  await user.selectOptions(screen.getByLabelText('Categoría'), 'Mayor');
  await user.type(screen.getByLabelText('WhatsApp'), '3814903321');
}

describe('MembersView navigation', () => {
  it('starts on the list', async () => {
    renderView();

    expect(await screen.findByRole('table', { name: 'Listado de socios' })).toBeInTheDocument();
  });

  it('opens a member detail from the list and returns with a fresh list', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Ana Álvarez' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ana Álvarez' })).toBeInTheDocument();
    expect(calls.map(key)).toContain('GET /api/members/member-2');

    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));

    expect(await screen.findByRole('table', { name: 'Listado de socios' })).toBeInTheDocument();
    expect(listCalls()).toHaveLength(2);
  });

  it('shows a detail error with retry and a way back when the member cannot be loaded', async () => {
    overrides['GET /api/members/member-2'] = () =>
      jsonResponse({ error: 'not_found', message: 'Member not found' }, 404);
    const user = renderView();
    await screen.findByText('Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Ana Álvarez' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar el socio');
    expect(alert).toHaveTextContent('Member not found');
    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

describe('MembersView create', () => {
  it('creates a member and shows its detail', async () => {
    const created = buildMember({ id: 'member-9', memberNumber: '0009', firstName: 'Valentina', lastName: 'Ferreyra', dni: '39884120' });
    overrides['POST /api/members'] = () => {
      members.push(created);
      return jsonResponse(created, 201);
    };
    const user = renderView();
    await screen.findByText('Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Alta de socio' })).toBeInTheDocument();
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Valentina Ferreyra' })).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({ firstName: 'Valentina', dni: '39884120', memberSince: TODAY });
  });

  it('does not call the API while the form is invalid', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    expect(screen.getByLabelText('Nombre')).toBeInvalid();
  });

  it('disables the submit button while the request is in flight', async () => {
    let finish!: (response: Response) => void;
    overrides['POST /api/members'] = () => new Promise<Response>((resolve) => (finish = resolve));
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    const created = buildMember({ id: 'member-9', firstName: 'Valentina', lastName: 'Ferreyra' });
    members.push(created);
    finish(jsonResponse(created, 201));
    expect(await screen.findByRole('heading', { level: 2, name: 'Valentina Ferreyra' })).toBeInTheDocument();
  });

  it('shows a duplicate DNI (409) on the DNI field and keeps the form', async () => {
    overrides['POST /api/members'] = () =>
      jsonResponse({ error: 'conflict', message: 'A member with this DNI already exists' }, 409);
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un socio con ese DNI');
    await waitFor(() =>
      expect(screen.getByLabelText('DNI')).toHaveAccessibleDescription('Ya existe un socio con ese DNI.'),
    );
    await waitFor(() => expect(screen.getByLabelText('DNI')).toHaveFocus());
    expect(screen.getByLabelText('Nombre')).toHaveValue('Valentina');
    expect(screen.getByRole('button', { name: 'Crear socio' })).toBeEnabled();
  });

  it('maps backend fieldErrors (400) onto the fields', async () => {
    overrides['POST /api/members'] = () =>
      jsonResponse(
        { error: 'validation_error', message: 'Validation failed', fieldErrors: { whatsapp: 'WhatsApp must be a valid phone number' } },
        400,
      );
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    await waitFor(() =>
      expect(screen.getByLabelText('WhatsApp')).toHaveAccessibleDescription('WhatsApp must be a valid phone number'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Revisá los datos ingresados');
  });

  it('shows a connection error when the network fails', async () => {
    overrides['POST /api/members'] = () => Promise.reject(new TypeError('Failed to fetch'));
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));
    await fillCreateForm(user);

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });

  it('cancels back to the list', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Alta de socio' }));

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('table', { name: 'Listado de socios' })).toBeInTheDocument();
  });
});

describe('MembersView edit', () => {
  it('edits a member through a prefilled form and returns to the updated detail', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Ana Álvarez' }));
    await screen.findByRole('heading', { level: 2, name: 'Ana Álvarez' });

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const firstName = await screen.findByLabelText('Nombre');
    expect(firstName).toHaveValue('Ana');
    await user.clear(firstName);
    await user.type(firstName, 'Ana María');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ana María Álvarez' })).toBeInTheDocument();
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.url).toBe('/api/members/member-2');
    expect(put?.body).toMatchObject({ firstName: 'Ana María', lastName: 'Álvarez', dni: '30222222' });
  });

  it('cancels back to the detail', async () => {
    const user = renderView();
    await screen.findByText('Ana Álvarez');
    await user.click(screen.getByRole('button', { name: 'Ana Álvarez' }));
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await screen.findByLabelText('Nombre');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ana Álvarez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeInTheDocument();
  });
});

describe('MembersView deactivate and reactivate', () => {
  async function openDetail(user: ReturnType<typeof userEvent.setup>, name: string) {
    await screen.findByText(name);
    await user.click(screen.getByRole('button', { name }));
    await screen.findByRole('heading', { level: 2, name });
  }

  it('deactivates with a reason and refreshes the detail', async () => {
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialog = screen.getByRole('dialog', { name: 'Dar de baja a Ana Álvarez' });
    await user.type(within(dialog).getByLabelText('Motivo de la baja'), 'Se mudó');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Motivo de la baja').nextElementSibling).toHaveTextContent('Se mudó');
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    const post = calls.find((call) => call.url.endsWith('/deactivate'));
    expect(post?.body).toEqual({ reason: 'Se mudó' });
  });

  it('keeps the dialog open and shows the error when the deactivation fails', async () => {
    overrides['POST /api/members/member-2/deactivate'] = () =>
      jsonResponse({ error: 'internal_error', message: 'Unexpected failure' }, 500);
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await user.type(screen.getByLabelText('Motivo de la baja'), 'Se mudó');
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unexpected failure');
    expect(within(dialog).getByRole('button', { name: 'Confirmar baja' })).toBeEnabled();
  });

  it('refreshes the detail and keeps the message when the deactivation conflicts', async () => {
    overrides['POST /api/members/member-2/deactivate'] = () => {
      Object.assign(members[1], { status: 'inactive', deactivation: { date: TODAY, reason: 'Otro usuario' } });
      return jsonResponse({ error: 'conflict', message: 'Member is already inactive' }, 409);
    };
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await user.type(screen.getByLabelText('Motivo de la baja'), 'Se mudó');
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Member is already inactive');
    expect(screen.getByText('Motivo de la baja').nextElementSibling).toHaveTextContent('Otro usuario');
    expect(calls.filter((call) => call.method === 'GET' && call.url === '/api/members/member-2')).toHaveLength(2);
  });

  it('lands on the not-found state when the member disappeared during the action', async () => {
    overrides['POST /api/members/member-2/reactivate'] = () => {
      members.splice(1, 1);
      return jsonResponse({ error: 'not_found', message: 'Member not found' }, 404);
    };
    members[1] = buildMember({
      id: 'member-2',
      firstName: 'Ana',
      lastName: 'Álvarez',
      status: 'inactive',
      deactivation: { date: '2026-09-30', reason: 'Mudanza' },
    });
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }));

    expect(await screen.findByText('No se pudo cargar el socio.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Member not found');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('moves focus to Reactivar after a successful deactivation', async () => {
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await user.type(screen.getByLabelText('Motivo de la baja'), 'Se mudó');
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByRole('button', { name: 'Reactivar' })).toHaveFocus();
  });

  it('moves focus to Dar de baja after a successful reactivation', async () => {
    members[1] = buildMember({
      id: 'member-2',
      firstName: 'Ana',
      lastName: 'Álvarez',
      status: 'inactive',
      deactivation: { date: '2026-09-30', reason: 'Mudanza' },
    });
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }));

    expect(await screen.findByRole('button', { name: 'Dar de baja' })).toHaveFocus();
  });

  it('cancelling the dialog leaves the member active and returns focus to the opener', async () => {
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');
    const opener = screen.getByRole('button', { name: 'Dar de baja' });

    await user.click(opener);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(calls.some((call) => call.url.endsWith('/deactivate'))).toBe(false);
  });

  it('reactivates an inactive member after confirmation', async () => {
    members[1] = buildMember({
      id: 'member-2',
      firstName: 'Ana',
      lastName: 'Álvarez',
      status: 'inactive',
      deactivation: { date: '2026-09-30', reason: 'Mudanza' },
    });
    const user = renderView();
    await openDetail(user, 'Ana Álvarez');

    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }));

    expect(await screen.findByText('Activo')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Motivo de la baja')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST' && call.url === '/api/members/member-2/reactivate')).toBe(true);
  });
});
