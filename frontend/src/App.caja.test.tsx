import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Capability } from './features/auth/types/auth';
import { buildPreview } from './features/cashcount/test/fixtures';
import { renderApp } from './test/renderApp';

const HEAD: Capability[] = ['members:read', 'members:write', 'disciplines:read', 'payments:read', 'payments:collect', 'users:manage', 'config:read', 'reports:read', 'cashcount:run'];
const SECRETARY: Capability[] = ['members:read', 'members:write', 'disciplines:read', 'payments:read', 'payments:collect', 'reports:read'];
const TEACHER: Capability[] = ['roster:read'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubSession(role: string, capabilities: Capability[]) {
  const user = { id: '1', name: 'Demo', email: 'demo@example.com', role };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (input === '/auth/me') return json({ user, capabilities });
    if (input === '/api/cashcount/today') return json(buildPreview());
    return json([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requested = (fetchMock: ReturnType<typeof stubSession>, prefix: string) =>
  fetchMock.mock.calls.some(([input]) => String(input).startsWith(prefix));
const nav = () => screen.getByRole('navigation', { name: 'Navegación principal' });
const path = () => screen.getByRole('status', { name: 'Ruta actual' }).textContent;

afterEach(() => vi.unstubAllGlobals());

describe('Caja navigation by role', () => {
  it('shows the head secretary a Caja group with Arqueo and Reportes, and Reportes nowhere else', async () => {
    stubSession('head_secretary', HEAD);
    renderApp('/socios');

    const caja = await within(await screen.findByRole('navigation', { name: 'Navegación principal' })).findByRole('group', { name: 'Caja' });
    expect(within(caja).getAllByRole('link').map((link) => link.textContent)).toEqual(['04Arqueo', '05Reportes']);
    expect(within(nav()).getAllByRole('link', { name: /Reportes/ })).toHaveLength(1);
  });

  it('shows the secretary Reportes on its own, with no Caja group and no Arqueo', async () => {
    stubSession('secretary', SECRETARY);
    renderApp('/socios');

    expect(await within(await screen.findByRole('navigation', { name: 'Navegación principal' })).findByRole('link', { name: /Reportes/ })).toBeInTheDocument();
    expect(within(nav()).queryByRole('group')).not.toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: /Arqueo/ })).not.toBeInTheDocument();
  });

  it('shows a teacher neither Caja nor Reportes', async () => {
    stubSession('teacher', TEACHER);
    renderApp('/');

    await screen.findByRole('heading', { level: 1, name: 'Mis disciplinas' });
    expect(within(nav()).queryByRole('link', { name: /Reportes|Arqueo/ })).not.toBeInTheDocument();
  });

  it('opens Reportes from the Caja group and marks it as the current page', async () => {
    stubSession('head_secretary', HEAD);
    const user = userEvent.setup();
    renderApp('/socios');

    await user.click(await screen.findByRole('link', { name: /Reportes/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(path()).toBe('/reportes');
    expect(within(nav()).getByRole('link', { name: /Reportes/ })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Caja direct URLs', () => {
  it('opens Arqueo for the head secretary and loads today from the server', async () => {
    const fetchMock = stubSession('head_secretary', HEAD);
    renderApp('/caja/arqueo');

    expect(await screen.findByRole('heading', { level: 1, name: 'Arqueo' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Arqueo del 05/10/2026' })).toBeInTheDocument();
    expect(requested(fetchMock, '/api/cashcount/today')).toBe(true);
  });

  it('shows the secretary a forbidden page for Arqueo, without asking the server for it', async () => {
    const fetchMock = stubSession('secretary', SECRETARY);
    renderApp('/caja/arqueo');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sin acceso' })).toBeInTheDocument();
    expect(requested(fetchMock, '/api/cashcount')).toBe(false);
  });

  it.each([['head_secretary', HEAD], ['secretary', SECRETARY]])('opens the same Reportes screen for the %s, asking for no report until one is generated', async (role, capabilities) => {
    const fetchMock = stubSession(role, capabilities);
    renderApp('/reportes');

    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar reporte' })).toBeInTheDocument();
    expect(requested(fetchMock, '/api/reports')).toBe(false);
  });

  it('shows a teacher a forbidden page for Reportes', async () => {
    const fetchMock = stubSession('teacher', TEACHER);
    renderApp('/reportes');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sin acceso' })).toBeInTheDocument();
    expect(requested(fetchMock, '/api/reports')).toBe(false);
  });
});
