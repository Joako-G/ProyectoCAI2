import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

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
  it('renders the shell with the Socios page', async () => {
    render(<App />);

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Socios' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    await screen.findByText(/No hay socios/);
  });

  it('renders the members list inside the main region', async () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(
      await within(main).findByRole('button', { name: 'Alta de socio' }),
    ).toBeInTheDocument();
  });

  it('switches to the Disciplinas screen from the sidebar and back', async () => {
    const user = userEvent.setup();
    render(<App />);
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
