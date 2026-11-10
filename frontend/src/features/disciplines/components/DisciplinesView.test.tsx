import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildDiscipline } from '../test/fixtures';
import { DisciplinesView } from './DisciplinesView';

const fetchMock = vi.fn<typeof fetch>();

const basket = buildDiscipline();
const volley = buildDiscipline({ id: 'disc-2', name: 'Vóley',
  teachers: ['Ana Gómez', 'Luis Sosa', 'Eva Ríos'],
  leadTeacher: 'Luis Sosa',
  status: 'inactive',
});

const TEACHERS = [{ id: 'teacher-1', name: 'Marcos Peña' }, { id: 'teacher-2', name: 'Ana Gómez' }];

function requests() {
  return fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('DisciplinesView list', () => {
  it('shows a loading state, then name, teachers and status chip', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([basket, volley]));
    render(<DisciplinesView canWrite />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando disciplinas');

    const table = await screen.findByRole('table', { name: 'Listado de disciplinas' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Básquet')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Marcos Peña')).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/Otros/)).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('Activa')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Inactiva')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Luis Sosa')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Otros: Ana Gómez, Eva Ríos')).toBeInTheDocument();
    expect(screen.getByText('2 resultados')).toBeInTheDocument();
    expect(requests()).toEqual(['GET /api/disciplines']);
  });

  it('shows an empty state', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    render(<DisciplinesView canWrite />);

    expect(await screen.findByText(/No hay disciplinas/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the backend message on error and retries on demand', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'Boom' }, 500))
      .mockResolvedValueOnce(jsonResponse([basket]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar el listado');
    expect(alert).toHaveTextContent('Boom');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Básquet')).toBeInTheDocument();
  });

  it('shows a connection message when the request fails outright', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<DisciplinesView canWrite />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });

  it('filters by status and searches by name', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([basket]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);
    await screen.findByText('Básquet');

    await user.click(screen.getByRole('radio', { name: 'Inactivas' }));
    await waitFor(() => expect(requests()).toContain('GET /api/disciplines?status=inactive'));

    await user.type(screen.getByRole('searchbox', { name: /Buscar disciplina/ }), 'bás{Enter}');
    await waitFor(() => expect(requests()).toContain('GET /api/disciplines?search=b%C3%A1s&status=inactive'));
  });
});

describe('DisciplinesView create and edit', () => {
  it('creates a discipline and returns to the refreshed list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(TEACHERS))
      .mockResolvedValueOnce(jsonResponse(basket, 201))
      .mockResolvedValueOnce(jsonResponse([basket]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Nueva disciplina' }));
    expect(screen.getByRole('heading', { name: 'Alta de disciplina' })).toHaveFocus();
    await user.type(await screen.findByLabelText('Nombre'), 'Básquet');
    await user.click(screen.getByRole('checkbox', { name: 'Marcos Peña' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ana Gómez' }));
    await user.click(screen.getByRole('radio', { name: 'A cargo: Ana Gómez' }));
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(await screen.findByRole('table', { name: 'Listado de disciplinas' })).toBeInTheDocument();
    expect(requests()).toEqual(['GET /api/disciplines', 'GET /api/disciplines/teachers', 'POST /api/disciplines', 'GET /api/disciplines']);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      name: 'Básquet',
      teacherIds: ['teacher-1', 'teacher-2'],
      leadTeacherId: 'teacher-2',
    });
  });

  it('offers to try again when the teacher accounts cannot be read', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'Boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(TEACHERS));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Nueva disciplina' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar la lista de profesores. Boom');
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('checkbox', { name: 'Marcos Peña' })).toBeInTheDocument();
  });

  it('shows the duplicate-name conflict on the name field', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(TEACHERS))
      .mockResolvedValueOnce(jsonResponse({ error: 'conflict', message: 'A discipline with this name already exists' }, 409));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Nueva disciplina' }));
    await user.type(await screen.findByLabelText('Nombre'), 'Básquet');
    await user.click(screen.getByRole('checkbox', { name: 'Marcos Peña' }));
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ya existe una disciplina con ese nombre.'),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('maps backend field errors from a 400 onto the fields', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(TEACHERS))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'validation_error', message: 'Invalid', fieldErrors: { teachers: 'Every teacher must be an active teacher account', leadTeacher: 'Lead teacher must be one of the teachers' } }, 400),
      );
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Nueva disciplina' }));
    await user.type(await screen.findByLabelText('Nombre'), 'Básquet');
    await user.click(screen.getByRole('checkbox', { name: 'Marcos Peña' }));
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Profesores' })).toHaveAccessibleDescription(
        'Every teacher must be an active teacher account',
      ),
    );
    expect(screen.getByRole('radio', { name: 'A cargo: Marcos Peña' })).toHaveAccessibleDescription(
      'Lead teacher must be one of the teachers',
    );
  });

  it('edits a discipline with a prefilled form', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([basket]))
      .mockResolvedValueOnce(jsonResponse(TEACHERS))
      .mockResolvedValueOnce(jsonResponse({ ...basket, teachers: ['Ana Gómez'], leadTeacher: 'Ana Gómez' }))
      .mockResolvedValueOnce(jsonResponse([{ ...basket, teachers: ['Ana Gómez'], leadTeacher: 'Ana Gómez' }]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Editar Básquet' }));
    expect(screen.getByRole('heading', { name: 'Editar disciplina' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Básquet');
    expect(screen.getByRole('checkbox', { name: 'Marcos Peña' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A cargo: Marcos Peña' })).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Marcos Peña' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ana Gómez' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument();
    expect(requests()[2]).toBe('PUT /api/disciplines/disc-1');
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ name: 'Básquet', teacherIds: ['teacher-2'], leadTeacherId: 'teacher-2' });
  });

  it('keeps the status tab and search when coming back from the form', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([basket]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);
    await screen.findByText('Básquet');

    await user.click(screen.getByRole('radio', { name: 'Activas' }));
    await user.type(screen.getByRole('searchbox', { name: /Buscar disciplina/ }), 'bás{Enter}');
    await waitFor(() => expect(requests()).toContain('GET /api/disciplines?search=b%C3%A1s&status=active'));

    await user.click(await screen.findByRole('button', { name: 'Editar Básquet' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await screen.findByRole('table', { name: 'Listado de disciplinas' });
    expect(screen.getByRole('radio', { name: 'Activas' })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: /Buscar disciplina/ })).toHaveValue('bás');
    expect(requests().at(-1)).toBe('GET /api/disciplines?search=b%C3%A1s&status=active');
  });

  it('cancels back to the list without saving', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([basket]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Editar Básquet' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(requests().every((request) => request.startsWith('GET'))).toBe(true);
  });
});

describe('DisciplinesView status actions', () => {
  it('deactivates after confirmation and refreshes the list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([basket]))
      .mockResolvedValueOnce(jsonResponse({ ...basket, status: 'inactive' }))
      .mockResolvedValueOnce(jsonResponse([{ ...basket, status: 'inactive' }]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Dar de baja Básquet' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByText('Inactiva')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(requests()[1]).toBe('POST /api/disciplines/disc-1/deactivate');
    expect(screen.getByRole('button', { name: 'Reactivar Básquet' })).toBeInTheDocument();
  });

  it('reactivates after confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([volley]))
      .mockResolvedValueOnce(jsonResponse({ ...volley, status: 'active' }))
      .mockResolvedValueOnce(jsonResponse([{ ...volley, status: 'active' }]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Reactivar Vóley' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }));

    expect(await screen.findByText('Activa')).toBeInTheDocument();
    expect(requests()[1]).toBe('POST /api/disciplines/disc-2/reactivate');
  });

  it('keeps the dialog open with the error when the request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([basket]))
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'Boom' }, 500));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Dar de baja Básquet' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Boom');
  });

  it('closes the dialog, reloads and explains when the discipline no longer exists (404)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([basket]))
      .mockResolvedValueOnce(jsonResponse({ error: 'not_found', message: 'Discipline not found' }, 404))
      .mockResolvedValueOnce(jsonResponse([]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Dar de baja Básquet' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByText(/No hay disciplinas/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Discipline not found');
    expect(requests()).toEqual([
      'GET /api/disciplines',
      'POST /api/disciplines/disc-1/deactivate',
      'GET /api/disciplines',
    ]);
  });

  it('closes the dialog, reloads and explains when the discipline already changed (409)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([basket]))
      .mockResolvedValueOnce(jsonResponse({ error: 'conflict', message: 'Discipline is already inactive' }, 409))
      .mockResolvedValueOnce(jsonResponse([{ ...basket, status: 'inactive' }]));
    const user = userEvent.setup();
    render(<DisciplinesView canWrite />);

    await user.click(await screen.findByRole('button', { name: 'Dar de baja Básquet' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByText('Inactiva')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Discipline is already inactive');
  });
});
