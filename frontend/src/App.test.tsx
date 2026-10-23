import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { buildMember } from './features/members/test/fixtures';

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
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } })
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
        return new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } });
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
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } })
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
      { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin', active: true },
      { id: '2', name: 'Socio de prueba', email: 'socio@example.com', role: 'member', active: true },
      { id: '3', name: 'Cuenta inactiva', email: 'inactivo@example.com', role: 'member', active: false },
    ];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/auth/login') return new Response(JSON.stringify({ user: users[0] }), { headers: { 'Content-Type': 'application/json' } });
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
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getAllByText('Socio', { selector: '.role-pill' })).toHaveLength(2);
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
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } })
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
