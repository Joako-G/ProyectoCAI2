import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import { MembersRoute } from './MembersRoute';

afterEach(() => vi.unstubAllGlobals());

function stub() {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => (String(url) === '/api/disciplines' ? jsonResponse([]) : jsonResponse([buildMember()])));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('MembersRoute', () => {
  it('lists the member whose number is in the address (?search=)', async () => {
    const fetchMock = stub();
    render(<MemoryRouter initialEntries={['/socios?search=0001']}><MembersRoute canWrite={false} /></MemoryRouter>);

    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/members?search=0001', expect.anything());
  });

  it('lists everyone when the address has no search', async () => {
    const fetchMock = stub();
    render(<MemoryRouter initialEntries={['/socios']}><MembersRoute canWrite={false} /></MemoryRouter>);

    expect(await screen.findByText('Lucía Ríos')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/members', expect.anything());
  });
});
