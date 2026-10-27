import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Capability } from './features/auth/types/auth';
import { renderApp } from './test/renderApp';

const HEAD: Capability[] = ['members:read', 'members:write', 'disciplines:read', 'disciplines:write', 'users:manage', 'payments:read', 'config:read'];
const SECRETARY: Capability[] = ['members:read', 'members:write', 'disciplines:read'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubSession(role: string, capabilities: Capability[]) {
  const user = { id: '1', name: 'Demo', email: 'demo@example.com', role };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (input === '/auth/me') return json({ user, capabilities });
    if (input === '/auth/login') return json({ user, capabilities });
    return json([]);
  }));
}

const path = () => screen.getByRole('status', { name: 'Ruta actual' }).textContent;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL routing', () => {
  it('opens the section named by the URL on a direct visit and marks it in the sidebar', async () => {
    stubSession('head_secretary', HEAD);
    renderApp('/disciplinas');

    expect(await screen.findByRole('heading', { level: 1, name: 'Disciplinas' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Disciplinas/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Socios/ })).not.toHaveAttribute('aria-current');
  });

  it('moves the URL when a sidebar link is clicked', async () => {
    stubSession('head_secretary', HEAD);
    const user = userEvent.setup();
    renderApp('/socios');

    await user.click(await screen.findByRole('link', { name: /Usuarios/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(path()).toBe('/usuarios');
  });

  it('redirects the root to the first section the user may open', async () => {
    stubSession('teacher', ['roster:read']);
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis disciplinas' })).toBeInTheDocument();
    expect(path()).toBe('/mis-disciplinas');
  });

  it('shows a forbidden page, without loading its data, for a section the role cannot open', async () => {
    stubSession('secretary', SECRETARY);
    renderApp('/usuarios');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sin acceso' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/users', expect.anything());
    expect(screen.queryByRole('heading', { level: 1, name: 'Usuarios' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/socios');
  });

  it('shows a not-found page for an unknown URL, keeping the shell', async () => {
    stubSession('head_secretary', HEAD);
    renderApp('/no-existe');

    expect(await screen.findByRole('heading', { level: 2, name: 'Página no encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to /login and returns them to the requested URL after signing in', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/auth/me') return json({}, 401);
      if (input === '/auth/login') return json({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' }, capabilities: HEAD });
      return json([]);
    }));
    const user = userEvent.setup();
    renderApp('/disciplinas');

    await user.type(await screen.findByLabelText('Correo electrónico'), 'demo@example.com');
    expect(path()).toBe('/login');
    await user.type(screen.getByLabelText('Contraseña'), 'password');
    await user.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Disciplinas' })).toBeInTheDocument();
    expect(path()).toBe('/disciplinas');
  });

  it('leaves /login for the first section when already signed in', async () => {
    stubSession('head_secretary', HEAD);
    renderApp('/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(path()).toBe('/socios');
  });
});
