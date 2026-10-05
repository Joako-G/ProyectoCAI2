import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
