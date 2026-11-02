import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildEntry } from '../test/fixtures';
import type { AuditEntry, AuditFailedWrites } from '../types/audit';
import { AuditView } from './AuditView';

afterEach(() => vi.unstubAllGlobals());

function stubEntries(entries: AuditEntry[], failedWrites: AuditFailedWrites = { count: 0, lastFailedAt: null }) {
  const fetchMock = vi.fn(async () => jsonResponse({ entries, failedWrites }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('AuditView', () => {
  it('shows a loading message, then the entries newest first with date, user, role, action, record and fields', async () => {
    const fetchMock = stubEntries([
      buildEntry({ id: 'e2', action: 'annul', entityType: 'payment', entityId: 'pay-9', entityLabel: 'Pago N.º 12', changedFields: [], at: '2026-11-01T16:00:00.000Z' }),
      buildEntry({ id: 'e1' }),
    ]);
    render(<AuditView />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando la auditoría');
    const table = await screen.findByRole('table', { name: 'Registro de auditoría' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('01/11/2026 13:00');
    expect(rows[0]).toHaveTextContent('Ana Prueba');
    expect(rows[0]).toHaveTextContent('Jefa de secretaría');
    expect(rows[0]).toHaveTextContent('Anulación');
    expect(rows[0]).toHaveTextContent('Pago N.º 12');
    expect(rows[0]).toHaveTextContent('—');
    expect(rows[1]).toHaveTextContent('Modificación');
    expect(rows[1]).toHaveTextContent('Socio 0007');
    expect(rows[1]).toHaveTextContent('Categoría, WhatsApp');
    expect(fetchMock).toHaveBeenCalledWith('/api/audit', expect.anything());
  });

  it('is read-only: it offers no button or form to change the log', async () => {
    stubEntries([buildEntry()]);
    render(<AuditView />);

    await screen.findByRole('table');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing was recorded yet', async () => {
    stubEntries([]);
    render(<AuditView />);

    expect(await screen.findByText('Todavía no hay operaciones registradas.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that loads the log again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ entries: [buildEntry()], failedWrites: { count: 0, lastFailedAt: null } }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AuditView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la auditoría');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table', { name: 'Registro de auditoría' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows no warning while every audit write succeeded', async () => {
    stubEntries([buildEntry()]);
    render(<AuditView />);

    await screen.findByRole('table');
    expect(screen.queryByText(/pueden no haberse registrado/)).not.toBeInTheDocument();
  });

  it('warns with the count and the last time when audit writes failed, and still shows the entries', async () => {
    stubEntries([buildEntry()], { count: 3, lastFailedAt: '2026-11-01T15:30:00.000Z' });
    render(<AuditView />);

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('Algunas operaciones pueden no haberse registrado');
    expect(warning).toHaveTextContent('3 fallos');
    expect(warning).toHaveTextContent('01/11/2026 12:30');
    expect(warning).toHaveTextContent('quien mantiene el sistema');
    expect(screen.getByRole('table', { name: 'Registro de auditoría' })).toBeInTheDocument();
  });

  it('uses the singular for a single failed write', async () => {
    stubEntries([], { count: 1, lastFailedAt: '2026-11-01T15:30:00.000Z' });
    render(<AuditView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('1 fallo ');
  });

  it('says the log cannot be read when the server reports an unreadable audit file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'audit_unreadable', message: 'The audit log could not be read' }, 500)));
    render(<AuditView />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El registro de auditoría está dañado o no se puede leer.');
    expect(alert).toHaveTextContent('quien mantiene el sistema');
    expect(alert).not.toHaveTextContent('Intente de nuevo.');
  });

  it('explains a missing permission and a lost connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'forbidden', message: 'Forbidden' }, 403)));
    const { unmount } = render(<AuditView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver la auditoría.');
    unmount();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    render(<AuditView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });
});
