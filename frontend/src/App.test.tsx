import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { buildMember } from './features/members/test/fixtures';

const HEAD = ['members:read', 'members:write', 'disciplines:read', 'disciplines:write', 'users:manage'];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows login initially and does not request members or users before authentication', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Socios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/auth/me', { credentials: 'include' });
  });

  it('restores the server session on load so a refresh does not go back to login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => input === '/auth/me'
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' }, capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } })
      : new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bienvenido/a de nuevo' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/auth/me', { credentials: 'include' });
  });

  it('falls back to login when the session check fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
  });

  it('keeps rejected credentials on login and does not request protected data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    render(<App />);
    await screen.findByLabelText('Correo electrónico');

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo iniciar sesión');
    expect(screen.getByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ credentials: 'include' }));
  });

  it('opens Socios after successful login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/auth/login') {
        return new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' }, capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }));
    render(<App />);
    await screen.findByLabelText('Correo electrónico');

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(await screen.findByText(/No hay socios/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('renders the members list inside the main region after login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => input === '/auth/login'
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' }, capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } })
      : new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    render(<App />);
    await screen.findByLabelText('Correo electrónico');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    await screen.findByRole('heading', { level: 1, name: 'Socios' });
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('button', { name: 'Alta de socio' })).toBeInTheDocument();
  });

  it('switches sections in the shared shell and preserves user administration actions', async () => {
    const users = [
      { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary', active: true },
      { id: '2', name: 'Socio de prueba', email: 'socio@example.com', role: 'secretary', active: true },
      { id: '3', name: 'Cuenta inactiva', email: 'inactivo@example.com', role: 'teacher', active: false },
    ];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/auth/login') return new Response(JSON.stringify({ user: users[0], capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } });
      if (input === '/users' && init?.method === 'POST') return new Response(JSON.stringify(users[0]), { status: 201, headers: { 'Content-Type': 'application/json' } });
      if (input === '/api/members') return new Response(JSON.stringify([buildMember()]), { headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(users), { headers: { 'Content-Type': 'application/json' } });
    }));
    render(<App />);
    await screen.findByLabelText('Correo electrónico');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));
    await screen.findByRole('heading', { level: 1, name: 'Socios' });
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Socios/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(nav).getByRole('link', { name: /Usuarios/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Usuarios/ })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('main')).getByText('Jefa de secretaría')).toBeInTheDocument();
    expect(screen.getByText('Secretaria', { selector: '.role-pill' })).toBeInTheDocument();
    expect(screen.getByText('Docente', { selector: '.role-pill' })).toBeInTheDocument();
    expect(screen.getByText('Sesión actual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    expect(screen.getByRole('heading', { name: 'Editar usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cuenta activa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByLabelText(/Cuenta activa/)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Crear usuario/ }));
    expect(screen.getByRole('heading', { name: 'Crear usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre completo/)).toBeInTheDocument();
    expect(screen.getByText(/No utilice datos reales ni sensibles/)).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('link', { name: /Socios/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/auth/login', expect.anything());
  });

  it('switches to the Disciplinas screen from the sidebar and back', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => input === '/auth/login'
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' }, capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } })
      : new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('Correo electrónico');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));
    await screen.findByRole('heading', { level: 1, name: 'Socios' });
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    await user.click(within(nav).getByRole('link', { name: /Disciplinas/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Disciplinas' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Disciplinas/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Socios/ })).not.toHaveAttribute('aria-current');
    expect(
      await within(screen.getByRole('main')).findByRole('button', { name: 'Nueva disciplina' }),
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: /Socios/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
  });
});

describe('App session panel', () => {
  const sessionUser = { id: '1', name: 'Demo', email: 'demo@example.com', role: 'head_secretary' };

  function stubSession(logout: () => Response = () => new Response(null, { status: 204 })) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/auth/me') return new Response(JSON.stringify({ user: sessionUser, capabilities: HEAD }), { headers: { 'Content-Type': 'application/json' } });
      if (input === '/auth/logout') return logout();
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }));
  }

  it('shows the data of the real session in the sidebar', async () => {
    stubSession();
    render(<App />);

    const session = await screen.findByRole('region', { name: 'Sesión actual' });
    expect(within(session).getByText('Demo')).toBeInTheDocument();
    expect(within(session).getByText('demo@example.com')).toBeInTheDocument();
    expect(within(session).getByText('Jefa de secretaría')).toBeInTheDocument();
  });

  it('ends the server session and returns to login on Cerrar sesión', async () => {
    stubSession();
    render(<App />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST', credentials: 'include' });
    expect(screen.queryByRole('region', { name: 'Sesión actual' })).not.toBeInTheDocument();
  });

  it('still returns to login when the server cannot be reached on logout', async () => {
    stubSession(() => { throw new Error('network down'); });
    render(<App />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
  });
});
