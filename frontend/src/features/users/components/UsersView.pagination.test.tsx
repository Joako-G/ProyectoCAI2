import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import type { ManagedUser } from '../types/user';
import { UsersView } from './UsersView';

afterEach(() => vi.unstubAllGlobals());

function stubUsers(count: number) {
  const users: ManagedUser[] = Array.from({ length: count }, (_unused, index) => ({
    id: `u${index + 1}`,
    name: `Usuario ${index + 1}`,
    email: `usuario${index + 1}@club.test`,
    role: 'secretary',
    active: true,
  }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => jsonResponse(url === '/users' ? users : [])));
}

describe('UsersView pagination', () => {
  it('shows no pagination when the accounts fit on one page', async () => {
    stubUsers(10);
    render(<UsersView currentUserId="u1" />);

    expect(await screen.findByText('Usuario 10')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación de usuarios' })).not.toBeInTheDocument();
  });

  it('shows ten accounts per page and counts all of them in the toolbar', async () => {
    stubUsers(14);
    const user = userEvent.setup();
    render(<UsersView currentUserId="u1" />);

    expect(await screen.findByText('Usuario 10')).toBeInTheDocument();
    expect(screen.queryByText('Usuario 11')).not.toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Usuario 11')).toBeInTheDocument();
    expect(screen.queryByText('Usuario 1')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 11–14 de 14')).toBeInTheDocument();
  });
});
