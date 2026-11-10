import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildEntry } from '../test/fixtures';
import { renderAuditView } from '../test/render';
import type { AuditActor, AuditEntry } from '../types/audit';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ana: AuditActor = { id: 'user-head', name: 'Ana Prueba', role: 'head_secretary' };
const luis: AuditActor = { id: 'user-secretary', name: 'Luis Prueba', role: 'secretary' };

/** A server that filters nothing: tests check what is asked for, and answer with the entries they choose. */
function stubServer(entries: AuditEntry[] = [buildEntry()], failedWrites = { count: 0, lastFailedAt: null as string | null }) {
  const fetchMock = vi.fn(async (_url: string) => jsonResponse({ entries, failedWrites, actors: [ana, luis] }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const lastUrl = (fetchMock: ReturnType<typeof stubServer>) => String(fetchMock.mock.calls.at(-1)![0]);
const search = () => screen.getByTestId('location-search').textContent;

describe('AuditView filters', () => {
  it('centres its content in a bounded column and asks for the plain log without filters', async () => {
    const fetchMock = stubServer();
    renderAuditView();

    await screen.findByRole('table');
    expect(screen.getByRole('region', { name: 'Auditoría' })).toHaveClass('audit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastUrl(fetchMock)).toBe('/api/audit');
    expect(screen.queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeDisabled();
  });

  it('labels every control, offers the users of the log and the Spanish names of records and actions', async () => {
    stubServer();
    renderAuditView();
    await screen.findByRole('table');

    const user = screen.getByLabelText('Usuario');
    expect(within(user).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Todos los usuarios',
      'Ana Prueba (Jefa de secretaría)',
      'Luis Prueba (Secretaria)',
    ]);
    expect(screen.getByLabelText('Socio')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Registro')).getByRole('option', { name: 'Pagos' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Acción')).getByRole('option', { name: 'Anulación' })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date');
  });

  it('sends each filter as a query parameter and writes it to the URL', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderAuditView();
    await screen.findByRole('table');

    await user.selectOptions(screen.getByLabelText('Usuario'), 'user-secretary');
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?actorId=user-secretary'));
    await user.selectOptions(screen.getByLabelText('Registro'), 'payment');
    await user.selectOptions(screen.getByLabelText('Acción'), 'annul');
    await user.type(screen.getByLabelText('Socio'), '0007');
    await user.type(screen.getByLabelText('Desde'), '2026-11-01');
    await user.type(screen.getByLabelText('Hasta'), '2026-11-30');

    await waitFor(() =>
      expect(lastUrl(fetchMock)).toBe('/api/audit?actorId=user-secretary&member=0007&entityType=payment&action=annul&from=2026-11-01&to=2026-11-30'),
    );
    expect(search()).toBe('?actorId=user-secretary&member=0007&entityType=payment&action=annul&from=2026-11-01&to=2026-11-30');
  });

  it('restores the filters from the URL, so a reload or a shared link shows the same view', async () => {
    const fetchMock = stubServer();
    renderAuditView('/auditoria?actorId=user-head&member=7&entityType=member&action=update&from=2026-11-01&to=2026-11-09');

    await screen.findByRole('table');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastUrl(fetchMock)).toBe('/api/audit?actorId=user-head&member=7&entityType=member&action=update&from=2026-11-01&to=2026-11-09');
    expect(screen.getByLabelText('Usuario')).toHaveValue('user-head');
    expect(screen.getByLabelText('Socio')).toHaveValue('7');
    expect(screen.getByLabelText('Registro')).toHaveValue('member');
    expect(screen.getByLabelText('Acción')).toHaveValue('update');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-09');
  });

  it('drops values in the URL that the server would refuse instead of failing', async () => {
    const fetchMock = stubServer();
    renderAuditView('/auditoria?action=nope&entityType=zzz&member=abc&from=2026-13-40&to=ayer&actorId=');

    await screen.findByRole('table');
    expect(lastUrl(fetchMock)).toBe('/api/audit');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows one removable chip per filter, and removing a chip clears only that filter', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderAuditView('/auditoria?actorId=user-head&action=annul&from=2026-11-01');
    await screen.findByRole('table');

    const chips = within(screen.getByRole('list', { name: 'Filtros aplicados' }));
    expect(chips.getAllByRole('button').map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Quitar filtro Usuario: Ana Prueba',
      'Quitar filtro Acción: Anulación',
      'Quitar filtro Desde: 01/11/2026',
    ]);

    chips.getByRole('button', { name: 'Quitar filtro Acción: Anulación' }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?actorId=user-head&from=2026-11-01'));
    expect(screen.getByLabelText('Acción')).toHaveValue('');
    expect(screen.getByLabelText('Usuario')).toHaveValue('user-head');
  });

  it('clears every filter at once', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderAuditView('/auditoria?actorId=user-head&member=7&action=annul');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit'));
    expect(search()).toBe('');
    expect(screen.queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
  });

  it('fills the dates from the quick ranges, counting today as the last day in the club time zone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 02:30 UTC on 10 November is still 9 November in Tucumán (UTC-3).
    vi.setSystemTime(new Date('2026-11-10T02:30:00Z'));
    const fetchMock = stubServer();
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderAuditView();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?from=2026-11-09&to=2026-11-09'));
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Últimos 7 días' }));
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?from=2026-11-03&to=2026-11-09'));

    await user.click(screen.getByRole('button', { name: 'Últimos 30 días' }));
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?from=2026-10-11&to=2026-11-09'));
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves the other end of the range when one end is set past it', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderAuditView('/auditoria?from=2026-11-05&to=2026-11-08');
    await screen.findByRole('table');

    await user.clear(screen.getByLabelText('Hasta'));
    await user.type(screen.getByLabelText('Hasta'), '2026-11-02');
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?from=2026-11-02&to=2026-11-02'));
  });

  it('filters by a member when its record label is clicked, and only members offer it', async () => {
    const fetchMock = stubServer([
      buildEntry({ id: 'e1', entityType: 'member', entityLabel: 'Socio 0007' }),
      buildEntry({ id: 'e2', entityType: 'face_profile', entityLabel: 'Perfil facial del socio 0009' }),
      buildEntry({ id: 'e3', entityType: 'payment', entityLabel: 'Pago N.º 12' }),
      buildEntry({ id: 'e4', entityType: 'member', entityLabel: 'Socio ea722372…' }),
    ]);
    const user = userEvent.setup();
    renderAuditView();
    const table = await screen.findByRole('table');

    expect(within(table).queryByRole('button', { name: 'Pago N.º 12' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Socio ea722372…' })).not.toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'Socio 0007' }));

    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?member=0007'));
    expect(screen.getByLabelText('Socio')).toHaveValue('0007');
    expect(screen.getByRole('button', { name: 'Quitar filtro Socio: 0007' })).toBeInTheDocument();
  });

  it('accepts only digits in the member number', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    renderAuditView();
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Socio'), '1a2b');
    await waitFor(() => expect(lastUrl(fetchMock)).toBe('/api/audit?member=12'));
    expect(screen.getByLabelText('Socio')).toHaveValue('12');
  });

  it('returns to the first page when a filter changes', async () => {
    const entries = Array.from({ length: 23 }, (_unused, index) => buildEntry({ id: `e${index + 1}`, entityLabel: `Registro ${index + 1}` }));
    stubServer(entries);
    const user = userEvent.setup();
    renderAuditView();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Mostrando 11–20 de 23')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Acción'), 'update');
    await waitFor(() => expect(screen.getByText('Mostrando 1–10 de 23')).toBeInTheDocument());
  });

  it('announces the number of results politely and keeps the rows while a new filter loads', async () => {
    stubServer([buildEntry({ id: 'e1' }), buildEntry({ id: 'e2' })]);
    renderAuditView();
    await screen.findByRole('table');

    const summary = screen.getByText('2 registros');
    expect(summary).toHaveAttribute('aria-live', 'polite');
  });

  it('uses the singular for one result', async () => {
    stubServer([buildEntry()]);
    renderAuditView();
    expect(await screen.findByText('1 registro')).toBeInTheDocument();
  });

  it('shows an empty state with a way to clear the filters when nothing matches', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse({ entries: url.includes('action=annul') ? [] : [buildEntry()], failedWrites: { count: 0, lastFailedAt: null }, actors: [ana] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAuditView('/auditoria?action=annul');

    expect(await screen.findByText('No hay registros con estos filtros.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Sin registros')).toBeInTheDocument();

    const empty = screen.getByText('No hay registros con estos filtros.').parentElement!;
    await user.click(within(empty).getByRole('button', { name: 'Limpiar filtros' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(search()).toBe('');
  });

  it('keeps the filters visible when the log cannot be loaded, and retries with them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ entries: [buildEntry()], failedWrites: { count: 0, lastFailedAt: null }, actors: [ana] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAuditView('/auditoria?action=annul');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la auditoría');
    expect(screen.getByLabelText('Acción')).toHaveValue('annul');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toBe('/api/audit?action=annul');
  });

  it('keeps the failed-writes banner with filters active', async () => {
    stubServer([buildEntry()], { count: 2, lastFailedAt: '2026-11-01T15:30:00.000Z' });
    renderAuditView('/auditoria?action=update');

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Algunas operaciones pueden no haberse registrado');
    expect(banner).toHaveTextContent('2 fallos');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows each action as a badge coloured by what was done', async () => {
    stubServer(
      (['create', 'update', 'annul', 'reactivate', 'close'] as const).map((action) => buildEntry({ id: action, action })),
    );
    renderAuditView();
    const table = await screen.findByRole('table');

    const tone = (name: string) => within(table).getByText(name).className;
    expect(tone('Alta')).toContain('audit-badge--success');
    expect(tone('Reactivación')).toContain('audit-badge--success');
    expect(tone('Modificación')).toContain('audit-badge--accent');
    expect(tone('Anulación')).toContain('audit-badge--error');
    expect(tone('Cierre')).toContain('audit-badge--neutral');
  });
});
