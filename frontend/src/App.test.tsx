import { render, screen, within } from '@testing-library/react';
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
});
