import { fireEvent, render, screen, within } from '@testing-library/react';
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
  it('shows login initially and does not request members or users before authentication', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Socios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'User management' })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps rejected credentials on login and does not request protected data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you in');
    expect(screen.getByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/auth/login', expect.anything());
  });

  it('opens Socios after successful login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/auth/login') {
        return new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }));
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(await screen.findByText(/No hay socios/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'POST' }));
  });

  it('renders the members list inside the main region after login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => input === '/auth/login'
      ? new Response(JSON.stringify({ user: { id: '1', name: 'Demo', email: 'demo@example.com', role: 'admin' } }), { headers: { 'Content-Type': 'application/json' } })
      : new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));

    await screen.findByRole('heading', { level: 1, name: 'Socios' });
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('button', { name: 'Alta de socio' })).toBeInTheDocument();
  });
});
