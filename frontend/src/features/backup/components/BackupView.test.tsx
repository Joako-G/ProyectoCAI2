import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildStatus } from '../test/fixtures';
import type { BackupStatus } from '../types/backup';
import { BackupView } from './BackupView';

afterEach(() => vi.unstubAllGlobals());

const COPY = { name: 'backup-20261104T150000Z', at: '2026-11-04T15:00:00.000Z', files: ['members.json'] };

function stubStatus(status: BackupStatus) {
  const fetchMock = vi.fn(async () => jsonResponse(status));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BackupView', () => {
  it('shows a loading message, then the last good copy in the club time zone, the copies kept and where they go', async () => {
    const fetchMock = stubStatus(buildStatus());
    render(<BackupView />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando el estado del respaldo');
    expect(await screen.findByText('04/11/2026 12:00')).toBeInTheDocument();
    expect(screen.getByText(/12 copias guardadas/)).toHaveTextContent('se conserva la última copia de cada uno de los últimos 30 días con copias y siempre las 5 más recientes');
    expect(screen.getByText(/carpeta configurada/)).toBeInTheDocument();
    expect(screen.queryByText(/no es un dispositivo externo/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/backups', expect.anything());
  });

  it('warns that the default folder is not an external device', async () => {
    stubStatus(buildStatus({ destination: { isDefault: true, state: 'ready' } }));
    render(<BackupView />);

    expect(await screen.findByText(/no es un dispositivo externo/)).toBeInTheDocument();
  });

  it('says there is no copy yet and uses the singular for a single copy', async () => {
    stubStatus(buildStatus({ lastSuccessAt: null, copies: 0 }));
    const { unmount } = render(<BackupView />);
    expect(await screen.findByText('Todavía no hay ningún respaldo.')).toBeInTheDocument();
    unmount();

    stubStatus(buildStatus({ copies: 1 }));
    render(<BackupView />);
    expect(await screen.findByText(/1 copia guardada /)).toBeInTheDocument();
  });

  it('tells staff to connect the drive or check the folder when the destination is missing, instead of saying there is no copy', async () => {
    stubStatus(buildStatus({ destination: { isDefault: false, state: 'missing' }, lastSuccessAt: null, copies: 0 }));
    render(<BackupView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se encuentra la carpeta de respaldos');
    expect(alert).toHaveTextContent('Conecte la unidad externa o revise la carpeta configurada');
    expect(alert).not.toHaveTextContent(/[A-Z]:\\|\//);
    expect(screen.queryByText('Todavía no hay ningún respaldo.')).not.toBeInTheDocument();
    expect(screen.queryByText(/copias guardadas/)).not.toBeInTheDocument();
  });

  it('says the folder cannot be read, not that it is empty, when the destination is unreadable', async () => {
    stubStatus(buildStatus({ destination: { isDefault: false, state: 'unreadable' }, lastSuccessAt: null, copies: 0 }));
    render(<BackupView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede leer la carpeta de respaldos');
    expect(screen.queryByText('Todavía no hay ningún respaldo.')).not.toBeInTheDocument();
  });

  it('shows the last failed attempt as an alert with its time, without any server text', async () => {
    stubStatus(buildStatus({ lastFailure: { at: '2026-11-05T15:30:00.000Z', code: 'ENOSPC' } }));
    render(<BackupView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El último intento de respaldo falló el 05/11/2026 12:30');
    expect(alert).toHaveTextContent('quien mantiene el sistema');
    expect(alert).not.toHaveTextContent('ENOSPC');
  });

  it('shows an error with a retry that loads the status again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(buildStatus()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<BackupView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el estado del respaldo');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('04/11/2026 12:00')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes a copy now: disables the button while it runs, then shows the new status and a confirmation', async () => {
    let finish!: (response: Response) => void;
    let copied = false;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        copied = true;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return jsonResponse(copied ? buildStatus({ copies: 13, lastSuccessAt: '2026-11-05T15:00:00.000Z' }) : buildStatus());
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<BackupView />);

    await user.click(await screen.findByRole('button', { name: 'Hacer un respaldo ahora' }));

    expect(await screen.findByRole('button', { name: 'Haciendo el respaldo…' })).toBeDisabled();
    finish(jsonResponse(COPY, 201));

    expect(await screen.findByText('05/11/2026 12:00')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Respaldo realizado.');
    expect(screen.getByRole('button', { name: 'Hacer un respaldo ahora' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/backups', expect.objectContaining({ method: 'POST' }));
  });

  it('cannot start a copy while the server says one is running', async () => {
    stubStatus(buildStatus({ running: true }));
    render(<BackupView />);

    expect(await screen.findByRole('button', { name: 'Haciendo el respaldo…' })).toBeDisabled();
  });

  it('says a copy is already running when the server answers 409', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? jsonResponse({ error: 'conflict', message: 'A backup is already running' }, 409) : jsonResponse(buildStatus())));
    const user = userEvent.setup();
    render(<BackupView />);

    await user.click(await screen.findByRole('button', { name: 'Hacer un respaldo ahora' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay un respaldo en curso');
  });

  it('shows a failed copy in Spanish, never the server text, and reloads the status', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ error: 'backup_failed', message: 'The backup could not be completed', code: 'ENOSPC' }, 500)
        : jsonResponse(buildStatus()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<BackupView />);

    await user.click(await screen.findByRole('button', { name: 'Hacer un respaldo ahora' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo hacer el respaldo');
    expect(alert).not.toHaveTextContent('could not be completed');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hacer un respaldo ahora' })).toBeEnabled();
  });
});
