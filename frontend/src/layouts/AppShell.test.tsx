import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <AppShell title="Socios" subtitle="Padrón de socios">
      <p>Page content</p>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('shows the club brand in the sidebar', () => {
    renderShell();

    expect(screen.getByText('Club Independiente')).toBeInTheDocument();
    expect(screen.getByText('Sistema de gestión')).toBeInTheDocument();
  });

  it('exposes a labelled main navigation landmark', () => {
    renderShell();

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
  });

  it('marks the Socios entry as the current page', () => {
    renderShell();

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    const link = within(nav).getByRole('link', { name: /Socios/ });

    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('shows Usuarios alongside Socios and marks the requested section active', () => {
    render(<AppShell title="Usuarios" section="users"><p>Page content</p></AppShell>);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Socios/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Usuarios/ })).toHaveAttribute('aria-current', 'page');
  });

  it('renders the screen title and subtitle in the page header', () => {
    renderShell();

    const banner = screen.getByRole('banner');

    expect(
      within(banner).getByRole('heading', { level: 1, name: 'Socios' }),
    ).toBeInTheDocument();
    expect(within(banner).getByText('Padrón de socios')).toBeInTheDocument();
  });

  it('renders its children inside the main content region', () => {
    renderShell();

    const main = screen.getByRole('main');

    expect(within(main).getByText('Page content')).toBeInTheDocument();
  });

  it('omits the subtitle when none is given', () => {
    render(
      <AppShell title="Socios">
        <p>Page content</p>
      </AppShell>,
    );

    expect(screen.queryByText('Padrón de socios')).not.toBeInTheDocument();
  });

  it('lists the Disciplinas entry and marks the active section', () => {
    render(<AppShell title="Disciplinas" section="disciplines" />);

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    expect(within(nav).getByRole('link', { name: /Disciplinas/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Socios/ })).not.toHaveAttribute('aria-current');
  });

  it('reports the chosen section on navigation', async () => {
    const onNavigate = vi.fn();
    render(<AppShell title="Socios" onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('link', { name: /Disciplinas/ }));

    expect(onNavigate).toHaveBeenCalledWith('disciplines');
  });
});

describe('AppShell session panel', () => {
  const user = { id: '1', name: 'Manuel Mendoza', email: 'manum@gmail.com', role: 'admin' };

  it('shows the initial, name, email and role of the signed-in user at the foot of the sidebar', () => {
    render(<AppShell title="Socios" user={user} onLogout={vi.fn()}><p>Page content</p></AppShell>);

    const session = screen.getByRole('region', { name: 'Sesión actual' });
    expect(within(session).getByText('M')).toBeInTheDocument();
    expect(within(session).getByText('Manuel Mendoza')).toBeInTheDocument();
    expect(within(session).getByText('manum@gmail.com')).toBeInTheDocument();
    expect(within(session).getByText('Administrador')).toBeInTheDocument();
  });

  it('keeps the full name and email available when they are truncated', () => {
    const long = { ...user, name: 'Maria de los Angeles Fernandez Gonzalez de la Vega', email: 'maria.de.los.angeles.fernandez@clubindependiente.example' };
    render(<AppShell title="Socios" user={long} onLogout={vi.fn()}><p>Page content</p></AppShell>);

    expect(screen.getByText(long.name)).toHaveAttribute('title', long.name);
    expect(screen.getByText(long.email)).toHaveAttribute('title', long.email);
  });

  it('calls onLogout from the Cerrar sesión button', async () => {
    const onLogout = vi.fn();
    render(<AppShell title="Socios" user={user} onLogout={onLogout}><p>Page content</p></AppShell>);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('renders no session panel without a signed-in user', () => {
    renderShell();

    expect(screen.queryByRole('region', { name: 'Sesión actual' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });
});
